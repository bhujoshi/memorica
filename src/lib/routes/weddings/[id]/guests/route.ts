import { contactPreview } from "@/lib/contact-import";
import { missingEventDetails, invitationOptions } from "@/lib/event-setup";
import { normalizeGuestGroup } from "@/lib/format";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import {
  addGuestsToWedding,
  getWeddingAccess,
  mapGuestToDTO,
  resolveGuestConflict,
  trackAnalyticsEvent,
} from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { GuestSource } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getWeddingAccess(params.id, user.id);
  if (!access.wedding) {
    return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json(
      { error: "Forbidden: Only the event owner can view the guest list." },
      { status: 403 }
    );
  }

  const rows = await prisma.guest.findMany({
    where: { weddingId: access.wedding.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ guests: rows.map(mapGuestToDTO) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getWeddingAccess(params.id, user.id);
  if (!access.wedding) {
    return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json(
      { error: "Forbidden: Only the event owner can manage the guest list." },
      { status: 403 }
    );
  }

  if (missingEventDetails(access.wedding).length) return NextResponse.json({ error: "Complete the event details and invitation before inviting contacts." }, { status: 400 });

  try {
    const body = await req.json();

    if (body.action === "log_import_event") {
      const eventType =
        body.status === "failed"
          ? "contact_import_failed"
          : "contact_import_started";
      await trackAnalyticsEvent({
        weddingId: access.wedding.id,
        eventType,
        actorRole: "host",
        summary:
          body.status === "failed"
            ? `Contact import failed or denied (${body.reason || "permission_denied"}). Manual entry remains available.`
            : `Host initiated contact import (${body.source || "contact_picker"})`,
        metadata: {
          source: body.source || "contact_picker",
          reason: body.reason || "initiated",
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "preview_import") {
      const existingGuests = await prisma.guest.findMany({
        where: { weddingId: access.wedding.id },
      });
      const rawContacts = Array.isArray(body.candidates) ? body.candidates : [];
      if (rawContacts.length > 500) return NextResponse.json({error:"Choose up to 500 contacts at a time."},{status:400});
      const preview = contactPreview(rawContacts, existingGuests);

      return NextResponse.json({ preview });
    }

    const candidates = Array.isArray(body.candidates)
      ? body.candidates
      : [
          {
            name: body.name,
            email: body.email,
            phone: body.phone,
            guestGroup: body.guestGroup,
            partySize: body.partySize,
          },
        ];

    const source: GuestSource = body.source || "manual";
    const result = await addGuestsToWedding({
      weddingId: access.wedding.id,
      ownerUserId: user.id,
      source,
      candidates,
      skipDuplicates: body.skipDuplicates !== false,
      invitationKey: body.invitationKey,
    });

    const rows = await prisma.guest.findMany({
      where: { weddingId: access.wedding.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ...result,
      guests: rows.map(mapGuestToDTO),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add guest.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getWeddingAccess(params.id, user.id);
  if (!access.wedding || !access.canManage) {
    return NextResponse.json(
      { error: "Forbidden: Only the event owner can modify the guest list." },
      { status: 403 }
    );
  }

  if (missingEventDetails(access.wedding).length) return NextResponse.json({ error: "Complete the event details and invitation before inviting contacts." }, { status: 400 });

  try {
    const body = await req.json();
    const weddingId = access.wedding.id;

    if (body.action === "mark_shared") {
      if (!invitationOptions(access.wedding).some(option => option.key === body.invitationKey)) return NextResponse.json({error:"Select an available invitation card."},{status:400});
      const { guestId, channel } = body as {
        guestId?: string;
        channel?: string;
      };

      if (guestId) {
        const guest = await prisma.guest.findFirst({
          where: { id: guestId, weddingId },
        });
        if (!guest) return NextResponse.json({error:"Guest not found."},{status:404});
        if (guest) {
          await prisma.guest.update({
            where: { id: guest.id },
            data: { invitationKey: body.invitationKey, ...(guest.invitationStatus === "not_shared" ? {invitationStatus: "link_shared"} : {}) },
          });
        }
      }

      await trackAnalyticsEvent({
        weddingId,
        eventType: "invitation_sharing_initiated",
        actorRole: "host",
        summary: guestId
          ? `Initiated personalized invitation share via ${channel || "link_copy"}`
          : `Initiated wedding invitation link share via ${channel || "link_copy"}`,
        metadata: {
          channel: channel || "link_copy",
          personalized: Boolean(guestId),
        },
      });

      const rows = await prisma.guest.findMany({
        where: { weddingId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        guests: rows.map(mapGuestToDTO),
      });
    }

    if (body.action === "resolve_conflict") {
      const { guestId, resolution } = body as {
        guestId: string;
        resolution: "accept_incoming" | "keep_original" | "split_into_new_guest";
      };
      await resolveGuestConflict({
        weddingId,
        ownerUserId: user.id,
        guestId,
        resolution,
      });

      const rows = await prisma.guest.findMany({
        where: { weddingId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        guests: rows.map(mapGuestToDTO),
      });
    }

    if (body.action === "update_guest") {
      const { guestId, guestGroup, partySize } = body as {
        guestId?: string;
        guestGroup?: string;
        partySize?: number;
      };
      if (!guestId) {
        return NextResponse.json({ error: "Guest ID is required." }, { status: 400 });
      }
      const existing = await prisma.guest.findFirst({
        where: { id: guestId, weddingId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Guest not found." }, { status: 404 });
      }
      await prisma.guest.update({
        where: { id: existing.id },
        data: {
          ...(guestGroup !== undefined ? { guestGroup: normalizeGuestGroup(guestGroup) } : {}),
          ...(typeof partySize === "number" && Number.isFinite(partySize)
            ? { partySize: Math.min(20, Math.max(1, Math.round(partySize))) }
            : {}),
        },
      });
      const rows = await prisma.guest.findMany({
        where: { weddingId },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ guests: rows.map(mapGuestToDTO) });
    }

    if (body.action === "delete_guest") {
      const { guestId } = body as { guestId: string };
      await prisma.guest.deleteMany({
        where: { id: guestId, weddingId },
      });
      await prisma.eventMembership.deleteMany({
        where: { linkedGuestId: guestId, weddingId },
      });

      const rows = await prisma.guest.findMany({
        where: { weddingId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        guests: rows.map(mapGuestToDTO),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update guest.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

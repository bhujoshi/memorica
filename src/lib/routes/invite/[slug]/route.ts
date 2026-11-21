import { missingEventDetails, invitationOptions } from "@/lib/event-setup";
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUserFromCookies,
  hydrateBackupWeddingsFromCookie,
} from "@/lib/auth";
import {
  getWeddingAccess,
  mapGuestToDTO,
  mapWeddingToDTO,
  submitGuestRsvp,
  trackAnalyticsEvent,
} from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { RsvpStatus } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  await hydrateBackupWeddingsFromCookie();

  const wedding = await prisma.wedding.findFirst({
    where: {
      OR: [{ slug: params.slug }, { id: params.slug }],
    },
  });

  if (!wedding) {
    return NextResponse.json(
      { error: "Invitation not found." },
      { status: 404 }
    );
  }

  const inviteToken = req.nextUrl.searchParams.get("guest") || undefined;
  const currentUser = await getAuthenticatedUserFromCookies();
  const access = await getWeddingAccess(wedding.id, currentUser?.id);
  if (!access.canManage && missingEventDetails(mapWeddingToDTO(wedding)).length) return NextResponse.json({error:"The host is still completing this event invitation."},{status:403});

  let matchedGuestRow = inviteToken
    ? await prisma.guest.findFirst({
        where: { weddingId: wedding.id, inviteToken },
      })
    : null;

  if (matchedGuestRow) {
    if (
      matchedGuestRow.invitationStatus === "not_shared" ||
      matchedGuestRow.invitationStatus === "link_shared"
    ) {
      matchedGuestRow = await prisma.guest.update({
        where: { id: matchedGuestRow.id },
        data: { invitationStatus: "opened" },
      });
    }
  }

  const matchedGuestDTO = matchedGuestRow
    ? mapGuestToDTO(matchedGuestRow)
    : access.guestRecord || null;

  const choices = invitationOptions(mapWeddingToDTO(wedding));
  const requestedKey = req.nextUrl.searchParams.get("invitation") || matchedGuestDTO?.invitationKey;
  const selected = requestedKey ? choices.find(o => o.key === requestedKey) : choices[0];
  if (!selected) return NextResponse.json({error:"This invitation card is unavailable. Please contact the host."}, {status:404});

  await trackAnalyticsEvent({
    weddingId: wedding.id,
    eventType: "invitation_opened",
    actorRole: currentUser
      ? access.role === "host"
        ? "host"
        : "guest"
      : "anonymous",
    summary: "Guest opened wedding invitation page",
    metadata: {
      personalizedLink: Boolean(inviteToken),
    },
  });

  const publishedUpdatesCount = await prisma.eventUpdate.count({
    where: {
      weddingId: wedding.id,
      publicationStatus: "published",
    },
  });

  const weddingDto = mapWeddingToDTO(wedding);
  return NextResponse.json({
    wedding: {
      id: wedding.id,
      slug: wedding.slug,
      coupleNames: wedding.coupleNames,
      eventTitle: wedding.eventTitle,
      date: wedding.date.toISOString(),
      endDate: wedding.endDate ? wedding.endDate.toISOString() : null,
      venue: wedding.venue,
      description: wedding.description,
      eventType: wedding.eventType,
      moodTheme: weddingDto.moodTheme,
      setup: weddingDto.setup,
      selectedInvitationKey: selected.key,
      selectedInvitationTitle: selected.title,
      selectedCard: selected.card,
    },
    personalizedGuest: matchedGuestDTO
      ? {
          id: matchedGuestDTO.id,
          name: matchedGuestDTO.name,
          email: matchedGuestDTO.email || "",
          phone: matchedGuestDTO.phone || "",
          inviteToken: matchedGuestDTO.inviteToken,
          rsvpStatus: matchedGuestDTO.rsvpStatus,
          rsvpNote: matchedGuestDTO.rsvpNote || "",
          rsvpUpdatedAt: matchedGuestDTO.rsvpUpdatedAt,
          partySize: matchedGuestDTO.partySize,
          plannedArrival: matchedGuestDTO.plannedArrival,
          plannedDeparture: matchedGuestDTO.plannedDeparture,
          sharePlannedDates: matchedGuestDTO.sharePlannedDates,
          isLinkedToUser: Boolean(matchedGuestDTO.linkedUserId),
        }
      : null,
    viewerAccess: {
      isAuthenticated: Boolean(currentUser),
      role: access.role,
      detailedRole: access.detailedRole,
      canViewUpdates: access.canViewUpdates,
      canAccessSocial: access.canAccessSocial,
      canAccessFamily: access.canAccessFamily,
      canManage: access.canManage,
      publishedUpdatesCount,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await req.json();
    const currentUser = await getAuthenticatedUserFromCookies();

    const {
      name,
      email,
      phone,
      rsvpStatus,
      rsvpNote,
      inviteToken,
      invitationKey,
      partySize,
      plannedArrival,
      plannedDeparture,
      sharePlannedDates,
    } = body as {
      name?: string;
      email?: string;
      phone?: string;
      rsvpStatus?: RsvpStatus;
      rsvpNote?: string;
      inviteToken?: string;
      invitationKey?: string;
      partySize?: number;
      plannedArrival?: string | null;
      plannedDeparture?: string | null;
      sharePlannedDates?: boolean;
    };

    const result = await submitGuestRsvp({
      weddingSlugOrId: params.slug,
      invitationKey,
      inviteToken,
      name: name || "",
      email,
      phone,
      rsvpStatus: (rsvpStatus || "yes") as RsvpStatus,
      rsvpNote,
      partySize,
      plannedArrival,
      plannedDeparture,
      sharePlannedDates,
      authenticatedUserId: currentUser?.id,
    });

    return NextResponse.json({
      guest: {
        id: result.guest.id,
        name: result.guest.name,
        email: result.guest.email,
        phone: result.guest.phone,
        inviteToken: result.guest.inviteToken,
        rsvpStatus: result.guest.rsvpStatus,
        rsvpNote: result.guest.rsvpNote,
        rsvpUpdatedAt: result.guest.rsvpUpdatedAt,
        partySize: result.guest.partySize,
        plannedArrival: result.guest.plannedArrival,
        plannedDeparture: result.guest.plannedDeparture,
        sharePlannedDates: result.guest.sharePlannedDates,
      },
      resolutionType: result.resolutionType,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit RSVP.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

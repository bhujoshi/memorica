import { NextRequest, NextResponse } from "next/server";
import {
  buildWeddingsBackupCookieValue,
  getAuthenticatedUserFromCookies,
  WEDDINGS_BACKUP_COOKIE_NAME,
} from "@/lib/auth";
import {
  getWeddingAccess,
  mapAnalyticsToDTO,
  mapGuestToDTO,
  mapUpdateToDTO,
  updateWedding,
} from "@/lib/db";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const access = await getWeddingAccess(params.id, user.id);
  if (!access.wedding) {
    return NextResponse.json(
      { error: "Wedding event not found." },
      { status: 404 }
    );
  }

  if (!access.canManage && !access.canViewUpdates) {
    return NextResponse.json(
      {
        error:
          "Access Denied: You do not have permission to view this private wedding workspace.",
      },
      { status: 403 }
    );
  }

  const wedding = access.wedding;

  if (access.canManage) {
    const [guestRows, updateRows, analyticsRows] = await Promise.all([
      prisma.guest.findMany({
        where: { weddingId: wedding.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.eventUpdate.findMany({
        where: { weddingId: wedding.id },
        include: { author: { select: { name: true } } },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      }),
      prisma.analyticsEvent.findMany({
        where: { weddingId: wedding.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return NextResponse.json({
      wedding,
      role: "host",
      detailedRole: access.detailedRole,
      isOwner: access.isOwner,
      canManage: true,
      canAccessFinances: access.canAccessFinances,
      canAccessFamily: access.canAccessFamily,
      canAccessSocial: access.canAccessSocial,
      guests: guestRows.map(mapGuestToDTO),
      updates: updateRows.map(mapUpdateToDTO),
      analytics: analyticsRows.map(mapAnalyticsToDTO),
    });
  }

  const updateRows = await prisma.eventUpdate.findMany({
    where: {
      weddingId: wedding.id,
      publicationStatus: "published",
    },
    include: { author: { select: { name: true } } },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    wedding,
    role: "guest",
    detailedRole: access.detailedRole,
    isOwner: false,
    canManage: false,
    canAccessFinances: false,
    canAccessFamily: access.canAccessFamily,
    canAccessSocial: access.canAccessSocial,
    guestRecord: access.guestRecord,
    updates: updateRows.map(mapUpdateToDTO),
  });
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
  if (!access.wedding) {
    return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json(
      { error: "Forbidden: Only the event owner can edit wedding details." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const updated = await updateWedding(access.wedding.id, user.id, body);
    const backupValue = await buildWeddingsBackupCookieValue(user.id);
    const res = NextResponse.json({ wedding: updated });
    if (backupValue) {
      res.cookies.set(WEDDINGS_BACKUP_COOKIE_NAME, backupValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update wedding.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
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
  if (!access.isOwner) {
    return NextResponse.json(
      { error: "Forbidden: Only the event owner can delete a wedding." },
      { status: 403 }
    );
  }

  await prisma.wedding.delete({
    where: { id: access.wedding.id },
  });

  const backupValue = await buildWeddingsBackupCookieValue(user.id);
  const res = NextResponse.json({ ok: true });
  if (backupValue) {
    res.cookies.set(WEDDINGS_BACKUP_COOKIE_NAME, backupValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

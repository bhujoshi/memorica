import { validPhone } from "@/lib/contact-validation";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  buildWeddingsBackupCookieValue,
  createDatabaseSession,
  getAuthenticatedUserFromCookies,
  OTP_CHALLENGE_COOKIE_NAME,
  revokeCurrentSession,
  SESSION_COOKIE_NAME,
  verifyOtpChallenge,
  WEDDINGS_BACKUP_COOKIE_NAME,
} from "@/lib/auth";
import {
  emailsMatch,
  linkUserToMatchingGuestRecords,
  mapUserToDTO,
  mapWeddingToDTO,
  normalizePhone,
  phonesMatch,
  trackAnalyticsEvent,
  upsertVerifiedUser,
} from "@/lib/db";
import { prisma } from "@/lib/prisma";

async function buildUserDashboardSummary(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Claim any pending Co-Admin / Close Family role invites on session load
  await linkUserToMatchingGuestRecords(user);

  const activeMemberships = await prisma.eventMembership.findMany({
    where: {
      userId: user.id,
      membershipStatus: "active",
    },
  });

  const coAdminWeddingIds = activeMemberships
    .filter((m) => m.role === "co_admin" || m.role === "host")
    .map((m) => m.weddingId);

  const managedWeddings = await prisma.wedding.findMany({
    where: {
      OR: [
        { ownerUserId: user.id },
        ...(coAdminWeddingIds.length ? [{ id: { in: coAdminWeddingIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      guests: true,
      updates: { where: { publicationStatus: "published" } },
    },
  });

  const managedIds = new Set(managedWeddings.map((w) => w.id));

  const hostedWeddings = managedWeddings.map((w) => {
    const dto = mapWeddingToDTO(w);
    return {
      ...dto,
      myRole: (w.ownerUserId === user.id ? "owner" : "co_admin") as
        | "owner"
        | "co_admin",
      stats: {
        totalGuests: w.guests.length,
        invitedCount: w.guests.filter((g) => g.invitationStatus !== "not_shared").length,
        remainingCount: w.guests.filter((g) => g.invitationStatus === "not_shared").length,
        yesCount: w.guests.filter((g) => g.rsvpStatus === "yes").length,
        noCount: w.guests.filter((g) => g.rsvpStatus === "no").length,
        maybeCount: w.guests.filter((g) => g.rsvpStatus === "maybe").length,
        pendingCount: w.guests.filter((g) => g.rsvpStatus === "pending").length,
        registeredGuests: w.guests.filter((g) => Boolean(g.linkedUserId)).length,
        conflictCount: w.guests.filter((g) => g.hasConflict).length,
        updatesCount: w.updates.length,
      },
    };
  });

  const membershipByWedding = new Map(
    activeMemberships.map((m) => [m.weddingId, m])
  );

  const allGuests = await prisma.guest.findMany();
  const matchedGuestWeddingIds = new Set<string>(
    activeMemberships
      .filter((m) => m.role === "guest" || m.role === "close_family")
      .map((m) => m.weddingId)
  );

  for (const g of allGuests) {
    if (
      g.linkedUserId === user.id ||
      (user.email && emailsMatch(g.email, user.email)) ||
      (user.phone && phonesMatch(g.phone, user.phone))
    ) {
      matchedGuestWeddingIds.add(g.weddingId);
    }
  }

  for (const mid of Array.from(managedIds)) {
    matchedGuestWeddingIds.delete(mid);
  }

  const invitedWeddingRows =
    matchedGuestWeddingIds.size > 0
      ? await prisma.wedding.findMany({
          where: {
            id: { in: Array.from(matchedGuestWeddingIds) },
            ownerUserId: { not: user.id },
          },
          orderBy: { date: "asc" },
          include: {
            guests: true,
            updates: { where: { publicationStatus: "published" } },
          },
        })
      : [];

  const invitedWeddings = invitedWeddingRows.map((w) => {
    const guestRecord = w.guests.find(
      (g) =>
        g.linkedUserId === user.id ||
        (user.email && emailsMatch(g.email, user.email)) ||
        (user.phone && phonesMatch(g.phone, user.phone))
    );
    const mem = membershipByWedding.get(w.id);
    const isCloseFamily = mem?.role === "close_family";
    return {
      ...mapWeddingToDTO(w),
      myRole: (isCloseFamily ? "close_family" : "guest") as
        | "close_family"
        | "guest",
      canAccessFamily: isCloseFamily,
      myRsvpStatus: (guestRecord?.rsvpStatus || "pending") as
        | "pending"
        | "yes"
        | "no"
        | "maybe",
      myInviteToken: guestRecord?.inviteToken,
      updatesCount: w.updates.length,
    };
  });

  return {
    user: mapUserToDTO(user),
    hostedWeddings,
    invitedWeddings,
    googleOAuthConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
  };
}

export async function GET() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json({
      user: null,
      hostedWeddings: [],
      invitedWeddings: [],
      googleOAuthConfigured: Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    });
  }

  const summary = await buildUserDashboardSummary(user.id);
  const res = NextResponse.json(summary);

  const existingToken = cookies().get(SESSION_COOKIE_NAME)?.value || "";
  if (existingToken.split(".").length !== 3) {
    const { rawToken, expiresAt } = await createDatabaseSession(user.id);
    res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }

  return res;
}

/**
 * Authenticates a user via verified OTP code OR Google ID Token,
 * creates a database-backed session, and links matching guest records.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      method,
      identifier,
      channel,
      code,
      name,
      phone,
      googleIdToken,
      claimInviteToken,
    } = body as {
      method?: "otp" | "google_id_token";
      identifier?: string;
      channel?: "email" | "phone";
      code?: string;
      name?: string;
      phone?: string;
      googleIdToken?: string;
      claimInviteToken?: string;
    };

    let verifiedEmail: string | null = null;
    let verifiedPhone: string | null = null;
    let verifiedName = name?.trim() || "";
    let googleSub: string | null = null;
    let avatarUrl: string | null = null;

    if (method === "google_id_token" && googleIdToken) {
      const tokenRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
          googleIdToken
        )}`
      );
      if (!tokenRes.ok) {
        throw new Error("Invalid Google ID token.");
      }
      const payload = await tokenRes.json();
      verifiedEmail = payload.email;
      verifiedName = payload.name || verifiedName;
      googleSub = payload.sub;
      avatarUrl = payload.picture;
    } else {
      // Standard OTP Verification flow
      if (!identifier || !code) {
        return NextResponse.json(
          { error: "Verification code and email/phone are required." },
          { status: 400 }
        );
      }

      const selectedChannel =
        channel || (identifier.includes("@") ? "email" : "phone");

      const { verifiedIdentifier } = await verifyOtpChallenge({
        identifier,
        channel: selectedChannel,
        code,
      });

      if (selectedChannel === "email") {
        verifiedEmail = verifiedIdentifier;
        if (phone && !validPhone(phone)) throw new Error("Enter a valid phone number with country code.");
        verifiedPhone = normalizePhone(phone);
      } else {
        verifiedPhone = verifiedIdentifier;
      }
    }

    const { user, newlyLinkedWeddings } = await upsertVerifiedUser({
      name: verifiedName,
      email: verifiedEmail,
      phone: verifiedPhone,
      googleSub,
      avatarUrl,
      claimInviteToken,
    });

    const { rawToken, expiresAt } = await createDatabaseSession(user.id);
    const summary = await buildUserDashboardSummary(user.id);
    const backupValue = await buildWeddingsBackupCookieValue(user.id);

    const res = NextResponse.json({
      ...summary,
      newlyLinkedWeddings,
    });

    res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
    res.cookies.delete(OTP_CHALLENGE_COOKIE_NAME);
    if (backupValue) {
      res.cookies.set(WEDDINGS_BACKUP_COOKIE_NAME, backupValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: expiresAt,
      });
    }

    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const currentUser = await getAuthenticatedUserFromCookies();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, phone, onboardingCompleted, profilePhoto } = body as {
      profilePhoto?: string | null;
      name?: string;
      phone?: string;
      onboardingCompleted?: boolean;
    };

    const existing = await prisma.user.findUnique({
      where: { id: currentUser.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (phone && !validPhone(phone)) throw new Error("Enter a valid phone number with its country code.");
    const cleanPhone =
      phone !== undefined ? normalizePhone(phone) : existing.phone;

    // Check if phone is already used by another user
    if (cleanPhone && cleanPhone !== existing.phone) {
      const phoneTaken = await prisma.user.findUnique({
        where: { phone: cleanPhone },
      });
      if (phoneTaken && phoneTaken.id !== existing.id) {
        return NextResponse.json(
          { error: "This phone number is already linked to another account." },
          { status: 400 }
        );
      }
    }

    let photoUpdate = {};
    if (profilePhoto !== undefined) {
      if (profilePhoto === null) photoUpdate = { avatarImage: null, avatarMime: null, avatarUrl: null };
      else {
        if (typeof profilePhoto !== "string" || profilePhoto.length > 300000) throw new Error("Please choose a smaller profile photo.");
        const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(profilePhoto);
        if (!match) throw new Error("Choose a JPG, PNG or WebP profile photo.");
        const image = Buffer.from(match[2], "base64");
        const valid = match[1] === "jpeg" ? image.subarray(0,3).equals(Buffer.from([255,216,255])) : match[1] === "png" ? image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : image.toString("ascii",0,4) === "RIFF" && image.toString("ascii",8,12) === "WEBP";
        if (!valid) throw new Error("Invalid profile photo.");
        photoUpdate = { avatarImage: image, avatarMime: `image/${match[1]}`, avatarUrl: `/api/auth/avatar?v=${Date.now()}` };
      }
    }
    const updatedUser = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...photoUpdate,
        ...(name !== undefined && name.trim() ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: cleanPhone } : {}),
        ...(onboardingCompleted !== undefined
          ? { onboardingCompleted: Boolean(onboardingCompleted) }
          : {}),
      },
    });

    await linkUserToMatchingGuestRecords(updatedUser);

    if (!existing.onboardingCompleted && onboardingCompleted) {
      await trackAnalyticsEvent({
        eventType: "host_onboarding_completed",
        actorRole: "host",
        summary: "Host completed onboarding and verified profile details",
        metadata: { onboardingCompleted: true },
      });
    }

    const { rawToken, expiresAt } = await createDatabaseSession(updatedUser.id);
    const backupValue = await buildWeddingsBackupCookieValue(updatedUser.id);
    const summary = await buildUserDashboardSummary(updatedUser.id);
    const res = NextResponse.json(summary);

    res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
    if (backupValue) {
      res.cookies.set(WEDDINGS_BACKUP_COOKIE_NAME, backupValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: expiresAt,
      });
    }

    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  await revokeCurrentSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  res.cookies.delete(WEDDINGS_BACKUP_COOKIE_NAME);
  return res;
}

export async function avatar() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarImage: true, avatarMime: true } });
  if (!profile?.avatarImage || !profile.avatarMime) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(profile.avatarImage), { headers: { "Content-Type": profile.avatarMime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

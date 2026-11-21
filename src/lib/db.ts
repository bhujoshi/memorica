import { parseEventSetup, normalizeEventSetup, EVENT_TYPES, missingEventDetails, validateSubEventDates, invitationOptions } from "./event-setup";
import { normalizeEventMood, normalizeGuestGroup } from "./format";
import crypto from "crypto";
import { Guest, Wedding, User, EventUpdate, AnalyticsEvent } from "@prisma/client";
import { prisma } from "./prisma";
import {
  AccountStatus,
  AnalyticsEventDTO,
  AnalyticsEventType,
  EventAccessRole,
  EventUpdateDTO,
  GuestConflictDTO,
  GuestDTO,
  GuestSource,
  InvitationStatus,
  PublicationStatus,
  RsvpStatus,
  UpdateCategory,
  UserDTO,
  WeddingDTO,
} from "./types";

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  const onlyNums = digits.replace(/\D/g, "");
  if (onlyNums.length === 10) {
    return `+91${onlyNums}`;
  }
  if (onlyNums.length > 10) {
    return `+${onlyNums}`;
  }
  return onlyNums.length >= 7 ? onlyNums : null;
}

export function phonesMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const digitsA = na.replace(/\D/g, "");
  const digitsB = nb.replace(/\D/g, "");
  if (digitsA.length >= 10 && digitsB.length >= 10) {
    return digitsA.slice(-10) === digitsB.slice(-10);
  }
  return false;
}

export function emailsMatch(a?: string | null, b?: string | null): boolean {
  const ea = normalizeEmail(a);
  const eb = normalizeEmail(b);
  if (!ea || !eb) return false;
  return ea === eb;
}

export function mapUserToDTO(u: User): UserDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    googleSub: u.googleSub,
    accountStatus: (u.accountStatus as AccountStatus) || "verified",
    onboardingCompleted: u.onboardingCompleted,
    createdAt: u.createdAt.toISOString(),
  };
}

export function mapWeddingToDTO(w: Wedding): WeddingDTO {
  return {
    id: w.id,
    slug: w.slug,
    eventType: w.eventType,
    otherEventType: w.otherEventType,
    moodTheme: normalizeEventMood(w.moodTheme),
    setup: parseEventSetup(w.setupDetails),
    ownerUserId: w.ownerUserId,
    eventTitle: w.eventTitle,
    coupleNames: w.coupleNames,
    date: w.date.toISOString(),
    endDate: w.endDate ? w.endDate.toISOString() : null,
    venue: w.venue,
    description: w.description,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function mapGuestToDTO(g: Guest): GuestDTO {
  const conflict: GuestConflictDTO | null =
    g.hasConflict && g.conflictReason
      ? {
          reason: g.conflictReason,
          incomingName: g.conflictIncomingName || g.name,
          incomingEmail: g.conflictIncomingEmail,
          incomingPhone: g.conflictIncomingPhone,
          incomingRsvpStatus: (g.conflictIncomingRsvp as RsvpStatus) || "yes",
          incomingNote: g.conflictIncomingNote,
          duplicateOfGuestId: g.conflictDuplicateGuestId,
        }
      : null;

  return {
    id: g.id,
    weddingId: g.weddingId,
    invitationKey: g.invitationKey,
    name: g.name,
    email: g.email,
    phone: g.phone,
    guestGroup: normalizeGuestGroup(g.guestGroup),
    partySize: Math.max(1, g.partySize || 1),
    inviteToken: g.inviteToken,
    invitationStatus: g.invitationStatus as InvitationStatus,
    rsvpStatus: g.rsvpStatus as RsvpStatus,
    rsvpNote: g.rsvpNote,
    rsvpUpdatedAt: g.rsvpUpdatedAt ? g.rsvpUpdatedAt.toISOString() : null,
    plannedArrival: g.plannedArrival ? g.plannedArrival.toISOString() : null,
    plannedDeparture: g.plannedDeparture ? g.plannedDeparture.toISOString() : null,
    sharePlannedDates: g.sharePlannedDates,
    linkedUserId: g.linkedUserId,
    source: g.source as GuestSource,
    hasConflict: g.hasConflict,
    conflict,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

export function mapUpdateToDTO(
  u: EventUpdate & { author?: { name: string } | null }
): EventUpdateDTO {
  return {
    id: u.id,
    weddingId: u.weddingId,
    authorUserId: u.authorUserId,
    authorName: u.author?.name ? `${u.author.name}` : "Event Host",
    textContent: u.textContent,
    category: u.category as UpdateCategory,
    isPinned: u.isPinned,
    publicationStatus: u.publicationStatus as PublicationStatus,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export function mapAnalyticsToDTO(a: AnalyticsEvent): AnalyticsEventDTO {
  let metadata: Record<string, string | number | boolean> = {};
  if (a.metadataJson) {
    try {
      metadata = JSON.parse(a.metadataJson);
    } catch {
      metadata = {};
    }
  }
  return {
    id: a.id,
    weddingId: a.weddingId,
    eventType: a.eventType as AnalyticsEventType,
    actorRole: a.actorRole as "host" | "guest" | "anonymous",
    summary: a.summary,
    metadata,
    createdAt: a.createdAt.toISOString(),
  };
}

/**
 * Privacy-conscious analytics logger (FR-09).
 * Strips raw address books, verification codes, tokens, and unnecessary PII before persisting.
 */
export async function trackAnalyticsEvent(params: {
  weddingId?: string | null;
  eventType: AnalyticsEventType;
  actorRole: "host" | "guest" | "anonymous";
  summary: string;
  metadata?: Record<string, string | number | boolean>;
}): Promise<AnalyticsEventDTO> {
  const safeMetadata: Record<string, string | number | boolean> = {};
  if (params.metadata) {
    const forbiddenKeys = new Set([
      "email",
      "phone",
      "addressBook",
      "contacts",
      "token",
      "inviteToken",
      "otp",
      "code",
      "password",
    ]);
    for (const [k, v] of Object.entries(params.metadata)) {
      if (!forbiddenKeys.has(k)) {
        safeMetadata[k] = v;
      }
    }
  }

  const created = await prisma.analyticsEvent.create({
    data: {
      weddingId: params.weddingId || null,
      eventType: params.eventType,
      actorRole: params.actorRole,
      summary: params.summary,
      metadataJson: JSON.stringify(safeMetadata),
    },
  });

  return mapAnalyticsToDTO(created);
}

/**
 * Links an authenticated User to any matching Guest records across all weddings
 * by verified email, verified phone, or claimed inviteToken (FR-05 & FR-06).
 */
export async function linkUserToMatchingGuestRecords(
  user: User,
  claimInviteToken?: string
): Promise<string[]> {
  const allCandidateGuests = await prisma.guest.findMany({
    where: {
      OR: [
        ...(user.email ? [{ email: user.email }] : []),
        ...(claimInviteToken ? [{ inviteToken: claimInviteToken }] : []),
        ...(user.phone ? [{ phone: { not: null } }] : []),
      ],
    },
  });

  const newlyLinkedWeddings: string[] = [];

  for (const guest of allCandidateGuests) {
    const matchedByToken =
      Boolean(claimInviteToken) && guest.inviteToken === claimInviteToken;
    const matchedByEmail =
      Boolean(user.email) && emailsMatch(guest.email, user.email);
    const matchedByPhone =
      Boolean(user.phone) && phonesMatch(guest.phone, user.phone);

    if (!matchedByToken && !matchedByEmail && !matchedByPhone) {
      continue;
    }

    const wasAlreadyLinked = guest.linkedUserId === user.id;

    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        linkedUserId: user.id,
        email: guest.email || user.email,
        phone: guest.phone || user.phone,
      },
    });

    await prisma.eventMembership.upsert({
      where: {
        weddingId_userId: {
          weddingId: guest.weddingId,
          userId: user.id,
        },
      },
      create: {
        weddingId: guest.weddingId,
        userId: user.id,
        role: "guest",
        membershipStatus: "active",
        linkedGuestId: guest.id,
      },
      update: {
        membershipStatus: "active",
        linkedGuestId: guest.id,
      },
    });

    if (!wasAlreadyLinked) {
      newlyLinkedWeddings.push(guest.weddingId);
      await trackAnalyticsEvent({
        weddingId: guest.weddingId,
        eventType: "guest_registration_completed",
        actorRole: "guest",
        summary: "Guest registered and verified account to access wedding updates",
        metadata: {
          matchedBy: matchedByToken
            ? "invite_token"
            : matchedByEmail
            ? "email"
            : "phone",
        },
      });
    }
  }

  // Also claim any pending Co-Admin or Close Family role invites matching this verified user
  const pendingInvites = await prisma.eventRoleInvite.findMany({
    where: { status: "pending" },
  });
  const rank: Record<string, number> = {
    guest: 1,
    close_family: 2,
    co_admin: 3,
    host: 4,
    owner: 4,
  };
  for (const invite of pendingInvites) {
    const matched =
      (user.email && emailsMatch(invite.email, user.email)) ||
      (user.phone && phonesMatch(invite.phone, user.phone));
    if (!matched) continue;
    const existingMembership = await prisma.eventMembership.findUnique({
      where: {
        weddingId_userId: { weddingId: invite.weddingId, userId: user.id },
      },
    });
    const nextRole =
      existingMembership &&
      existingMembership.membershipStatus === "active" &&
      (rank[existingMembership.role] || 0) >= (rank[invite.role] || 0)
        ? existingMembership.role
        : invite.role;
    await prisma.eventMembership.upsert({
      where: {
        weddingId_userId: { weddingId: invite.weddingId, userId: user.id },
      },
      create: {
        weddingId: invite.weddingId,
        userId: user.id,
        role: nextRole,
        membershipStatus: "active",
      },
      update: {
        role: nextRole,
        membershipStatus: "active",
      },
    });
    await prisma.eventRoleInvite.update({
      where: { id: invite.id },
      data: { status: "accepted" },
    });
    if (!newlyLinkedWeddings.includes(invite.weddingId)) {
      newlyLinkedWeddings.push(invite.weddingId);
    }
  }

  return newlyLinkedWeddings;
}

/**
 * Upserts a verified user (via Google OAuth or Email/Phone OTP) and links their invitations.
 */
export async function upsertVerifiedUser(params: {
  name?: string;
  email?: string | null;
  phone?: string | null;
  googleSub?: string | null;
  avatarUrl?: string | null;
  claimInviteToken?: string;
}): Promise<{ user: UserDTO; newlyLinkedWeddings: string[] }> {
  const cleanEmail = normalizeEmail(params.email);
  const cleanPhone = normalizePhone(params.phone);

  if (!cleanEmail && !cleanPhone) {
    throw new Error("A valid email address or phone number is required.");
  }

  let existingUser: User | null = null;

  if (params.googleSub) {
    existingUser = await prisma.user.findUnique({
      where: { googleSub: params.googleSub },
    });
  }
  if (!existingUser && cleanEmail) {
    existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
  }
  if (!existingUser && cleanPhone) {
    existingUser = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });
  }

  // If user wasn't found by exact phone string, check normalized phone match
  if (!existingUser && cleanPhone) {
    const usersWithPhone = await prisma.user.findMany({
      where: { phone: { not: null } },
    });
    existingUser =
      usersWithPhone.find((u) => phonesMatch(u.phone, cleanPhone)) || null;
  }

  const displayName =
    params.name?.trim() ||
    existingUser?.name ||
    (cleanEmail ? cleanEmail.split("@")[0] : `Guest ${cleanPhone?.slice(-4)}`);

  let user: User;
  if (!existingUser) {
    user = await prisma.user.create({
      data: {
        name: displayName,
        email: cleanEmail,
        phone: cleanPhone,
        googleSub: params.googleSub || null,
        avatarUrl: params.avatarUrl || null,
        accountStatus: "verified",
        onboardingCompleted: Boolean(params.name?.trim()),
      },
    });
  } else {
    // Check if updating email/phone would conflict with another record
    const canSetEmail =
      cleanEmail &&
      cleanEmail !== existingUser.email &&
      !(await prisma.user.findUnique({ where: { email: cleanEmail } }));
    const canSetPhone =
      cleanPhone &&
      cleanPhone !== existingUser.phone &&
      !(await prisma.user.findUnique({ where: { phone: cleanPhone } }));

    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: params.name?.trim() ? params.name.trim() : existingUser.name,
        ...(canSetEmail ? { email: cleanEmail } : {}),
        ...(canSetPhone ? { phone: cleanPhone } : {}),
        ...(params.googleSub ? { googleSub: params.googleSub } : {}),
        ...(params.avatarUrl && !existingUser.avatarImage ? { avatarUrl: params.avatarUrl } : {}),
        accountStatus: "verified",
      },
    });
  }

  const newlyLinkedWeddings = await linkUserToMatchingGuestRecords(
    user,
    params.claimInviteToken
  );

  return {
    user: mapUserToDTO(user),
    newlyLinkedWeddings,
  };
}

export interface WeddingAccessResult {
  wedding: WeddingDTO | null;
  role: "host" | "guest" | "none";
  detailedRole: EventAccessRole;
  isOwner: boolean;
  canManage: boolean;
  canManageRoles: boolean;
  canAccessFinances: boolean;
  canAccessFamily: boolean;
  canAccessSocial: boolean;
  canViewUpdates: boolean;
  guestRecord?: GuestDTO;
}

function emptyAccess(wedding: WeddingDTO | null): WeddingAccessResult {
  return {
    wedding,
    role: "none",
    detailedRole: "none",
    isOwner: false,
    canManage: false,
    canManageRoles: false,
    canAccessFinances: false,
    canAccessFamily: false,
    canAccessSocial: false,
    canViewUpdates: false,
  };
}

/**
 * FR-08: Server-side role-based access control check for a wedding.
 */
export async function getWeddingAccess(
  weddingIdOrSlug: string,
  userId?: string | null
): Promise<WeddingAccessResult> {
  const wedding = await prisma.wedding.findFirst({
    where: {
      OR: [{ id: weddingIdOrSlug }, { slug: weddingIdOrSlug }],
    },
  });

  if (!wedding) {
    return emptyAccess(null);
  }

  const weddingDTO = mapWeddingToDTO(wedding);

  if (!userId) {
    return emptyAccess(weddingDTO);
  }

  if (wedding.ownerUserId === userId) {
    return {
      wedding: weddingDTO,
      role: "host",
      detailedRole: "owner",
      isOwner: true,
      canManage: true,
      canManageRoles: true,
      canAccessFinances: true,
      canAccessFamily: true,
      canAccessSocial: true,
      canViewUpdates: true,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return emptyAccess(weddingDTO);
  }

  let membership = await prisma.eventMembership.findUnique({
    where: {
      weddingId_userId: {
        weddingId: wedding.id,
        userId: user.id,
      },
    },
  });

  // Auto-claim pending role invites for this event if contact matches
  const pendingInvites = await prisma.eventRoleInvite.findMany({
    where: { weddingId: wedding.id, status: "pending" },
  });
  const matchingInvite = pendingInvites.find(
    (inv) =>
      (user.email && emailsMatch(inv.email, user.email)) ||
      (user.phone && phonesMatch(inv.phone, user.phone))
  );
  if (matchingInvite) {
    const rank: Record<string, number> = {
      guest: 1,
      close_family: 2,
      co_admin: 3,
      host: 4,
      owner: 4,
    };
    const nextRole =
      membership &&
      membership.membershipStatus === "active" &&
      (rank[membership.role] || 0) >= (rank[matchingInvite.role] || 0)
        ? membership.role
        : matchingInvite.role;
    membership = await prisma.eventMembership.upsert({
      where: {
        weddingId_userId: { weddingId: wedding.id, userId: user.id },
      },
      create: {
        weddingId: wedding.id,
        userId: user.id,
        role: nextRole,
        membershipStatus: "active",
      },
      update: {
        role: nextRole,
        membershipStatus: "active",
      },
    });
    await prisma.eventRoleInvite.update({
      where: { id: matchingInvite.id },
      data: { status: "accepted" },
    });
  }

  const weddingGuests = await prisma.guest.findMany({
    where: { weddingId: wedding.id },
  });

  const matchingGuest = weddingGuests.find(
    (g) =>
      g.linkedUserId === user.id ||
      (user.email && emailsMatch(g.email, user.email)) ||
      (user.phone && phonesMatch(g.phone, user.phone))
  );

  if (
    (membership && membership.membershipStatus === "active") ||
    matchingGuest
  ) {
    if (matchingGuest && matchingGuest.linkedUserId !== user.id) {
      await prisma.guest.update({
        where: { id: matchingGuest.id },
        data: { linkedUserId: user.id },
      });
      membership = await prisma.eventMembership.upsert({
        where: {
          weddingId_userId: {
            weddingId: wedding.id,
            userId: user.id,
          },
        },
        create: {
          weddingId: wedding.id,
          userId: user.id,
          role: "guest",
          membershipStatus: "active",
          linkedGuestId: matchingGuest.id,
        },
        update: {
          membershipStatus: "active",
          linkedGuestId: matchingGuest.id,
        },
      });
    }

    const rawRole = membership?.membershipStatus === "active" ? membership.role : "guest";
    const isCoAdmin = rawRole === "co_admin" || rawRole === "host";
    const isCloseFamily = rawRole === "close_family";
    const detailedRole: EventAccessRole = isCoAdmin
      ? "co_admin"
      : isCloseFamily
      ? "close_family"
      : "guest";

    return {
      wedding: weddingDTO,
      role: isCoAdmin ? "host" : "guest",
      detailedRole,
      isOwner: false,
      canManage: isCoAdmin,
      canManageRoles: false,
      canAccessFinances: isCoAdmin,
      canAccessFamily: isCoAdmin || isCloseFamily,
      canAccessSocial: true,
      canViewUpdates: true,
      guestRecord: matchingGuest ? mapGuestToDTO(matchingGuest) : undefined,
    };
  }

  return emptyAccess(weddingDTO);
}

async function assertCanManageWedding(
  weddingId: string,
  userId: string,
  forbiddenMessage: string
): Promise<Wedding> {
  const wedding = await prisma.wedding.findUnique({ where: { id: weddingId } });
  if (!wedding) throw new Error("Wedding event not found.");
  if (wedding.ownerUserId === userId) return wedding;
  const membership = await prisma.eventMembership.findUnique({
    where: { weddingId_userId: { weddingId, userId } },
  });
  if (
    membership &&
    membership.membershipStatus === "active" &&
    (membership.role === "co_admin" || membership.role === "host")
  ) {
    return wedding;
  }
  throw new Error(forbiddenMessage);
}

async function generateUniqueWeddingSlug(
  coupleNames: string,
  eventTitle: string
): Promise<string> {
  const base = `${coupleNames}-${eventTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  const cleanBase = base || "wedding-celebration";
  const existing = await prisma.wedding.findUnique({
    where: { slug: cleanBase },
  });
  if (!existing) {
    return cleanBase;
  }
  const suffix = crypto.randomBytes(2).toString("hex");
  return `${cleanBase}-${suffix}`;
}

/**
 * FR-02: Create a wedding with field and date range validation.
 */
export async function createWedding(params: {
  eventType?: string;
  otherEventType?: string;
  moodTheme?: string;
  ownerUserId: string;
  coupleNames?: string;
  eventTitle: string;
  date: string;
  endDate: string;
  venue: string;
  description?: string;
}): Promise<WeddingDTO> {
  const eventType = params.eventType || "Wedding";
  if (!EVENT_TYPES.includes(eventType)) throw new Error("Choose a valid event type.");
  const otherEventType = params.otherEventType?.trim() || "";
  if (eventType === "Other" && !otherEventType) throw new Error("Name your event type.");
  const moodTheme = normalizeEventMood(params.moodTheme);
  const coupleNames = eventType === "Wedding" ? (params.coupleNames?.trim() || "") : params.eventTitle.trim();
  const eventTitle = params.eventTitle.trim();
  const venue = params.venue.trim();
  const description = params.description?.trim() || null;

  if (!eventTitle || eventTitle.length < 3) {
    throw new Error("Event title is required (at least 3 characters).");
  }
  if (!venue || venue.length < 3) {
    throw new Error("Venue is required.");
  }

  const parsedDate = new Date(params.date);
  if (isNaN(parsedDate.getTime())) {
    throw new Error("Please provide a valid start date (From).");
  }
  if (parsedDate.getFullYear() < 2024 || parsedDate.getFullYear() > 2036) {
    throw new Error("Please enter a valid start date between 2024 and 2036.");
  }

  const parsedEndDate = new Date(params.endDate);
  if (isNaN(parsedEndDate.getTime())) {
    throw new Error("Please provide a valid end date (To).");
  }
  if (parsedEndDate.getFullYear() < 2024 || parsedEndDate.getFullYear() > 2036) {
    throw new Error("Please enter a valid end date between 2024 and 2036.");
  }
  if (parsedEndDate.getTime() < parsedDate.getTime()) {
    throw new Error(
      "The end date (To) must be on or after the start date (From)."
    );
  }

  const slug = await generateUniqueWeddingSlug(coupleNames, eventTitle);

  const created = await prisma.$transaction(async (tx) => {
    const w = await tx.wedding.create({
      data: {
        slug,
        eventType,
        otherEventType,
        moodTheme,
        ownerUserId: params.ownerUserId,
        coupleNames,
        eventTitle,
        date: parsedDate,
        endDate: parsedEndDate,
        venue,
        description,
      },
    });

    await tx.eventMembership.create({
      data: {
        weddingId: w.id,
        userId: params.ownerUserId,
        role: "host",
        membershipStatus: "active",
      },
    });

    await tx.analyticsEvent.create({
      data: {
        weddingId: w.id,
        eventType: "wedding_created",
        actorRole: "host",
        summary: `Created wedding event: ${w.eventTitle}`,
        metadataJson: JSON.stringify({ slug: w.slug }),
      },
    });

    return w;
  });

  return mapWeddingToDTO(created);
}

function applyCoupleNameUpdates(
  setup: ReturnType<typeof parseEventSetup>,
  updates: { groomName?: string; brideName?: string }
) {
  for (const key of ["groomName", "brideName"] as const) {
    if (updates[key] !== undefined) {
      if (typeof updates[key] !== "string") throw new Error("Invalid event details.");
      setup[key] = updates[key].trim().slice(0, 500);
    }
  }
}

/**
 * FR-02: Edit wedding details (Owner or Co-Admin).
 */
export async function updateWedding(
  weddingId: string,
  actorUserId: string,
  updates: {
    setup?: unknown;
    moodTheme?: string;
    groomName?: string;
    brideName?: string;
    coupleNames?: string;
    eventTitle?: string;
    date?: string;
    endDate?: string;
    venue?: string;
    description?: string;
  }
): Promise<WeddingDTO> {
  const wedding = await assertCanManageWedding(
    weddingId,
    actorUserId,
    "Forbidden: Only event organizers can edit event details."
  );

  const dataToUpdate: {
    setupDetails?: string;
    moodTheme?: string;
    coupleNames?: string;
    eventTitle?: string;
    date?: Date;
    endDate?: Date | null;
    venue?: string;
    description?: string | null;
  } = {};

  if (updates.moodTheme !== undefined) {
    dataToUpdate.moodTheme = normalizeEventMood(updates.moodTheme);
  }

  if (updates.coupleNames !== undefined) {
    const val = updates.coupleNames.trim();
    if (val.length < 3) {
      throw new Error("Couple names must be at least 3 characters.");
    }
    dataToUpdate.coupleNames = val;
  }
  if (updates.eventTitle !== undefined) {
    const val = updates.eventTitle.trim();
    if (val.length < 3) {
      throw new Error("Event title must be at least 3 characters.");
    }
    dataToUpdate.eventTitle = val;
  }
  if (updates.venue !== undefined) {
    const val = updates.venue.trim();
    if (val.length < 3) {
      throw new Error("Venue is required.");
    }
    dataToUpdate.venue = val;
  }
  if (updates.date !== undefined) {
    const parsed = new Date(updates.date);
    if (isNaN(parsed.getTime())) {
      throw new Error("Please provide a valid start date (From).");
    }
    dataToUpdate.date = parsed;
  }
  if (updates.endDate !== undefined) {
    const parsedEnd = new Date(updates.endDate);
    if (isNaN(parsedEnd.getTime())) {
      throw new Error("Please provide a valid end date (To).");
    }
    dataToUpdate.endDate = parsedEnd;
  }

  const finalStartDate = dataToUpdate.date || wedding.date;
  const finalEndDate =
    dataToUpdate.endDate !== undefined ? dataToUpdate.endDate : wedding.endDate;
  if (finalEndDate && finalEndDate.getTime() < finalStartDate.getTime()) {
    throw new Error(
      "The end date (To) must be on or after the start date (From)."
    );
  }

  if (updates.description !== undefined) {
    dataToUpdate.description = updates.description.trim() || null;
  }

  if (updates.setup !== undefined) {
    const setup = normalizeEventSetup(updates.setup);
    applyCoupleNameUpdates(setup, updates);
    for (const asset of [setup.card, ...setup.photos, ...setup.subEvents.map(sub => sub.card)].filter(Boolean)) {
      const stored = asset && await prisma.eventAsset.findFirst({ where: { id: asset.id, weddingId } });
      if (!stored || !asset) throw new Error("Upload media to this event before saving.");
      asset.name = stored.name; asset.mime = stored.mime;
    }
    if (setup.photos.some(photo => !photo.mime.startsWith("image/"))) throw new Error("Couple photos must be images.");
    validateSubEventDates(setup, finalStartDate, finalEndDate);
    dataToUpdate.setupDetails = JSON.stringify(setup);
    if (wedding.eventType === "Wedding") dataToUpdate.coupleNames = [setup.groomName, setup.brideName].filter(Boolean).join(" & ");
  }
  if (updates.setup === undefined) {
    const setup = parseEventSetup(wedding.setupDetails);
    if (updates.groomName !== undefined || updates.brideName !== undefined) {
      applyCoupleNameUpdates(setup, updates);
      if (wedding.eventType === "Wedding") dataToUpdate.coupleNames = [setup.groomName, setup.brideName].filter(Boolean).join(" & ");
      dataToUpdate.setupDetails = JSON.stringify(setup);
    }
    validateSubEventDates(setup, finalStartDate, finalEndDate);
  }
  const updated = await prisma.wedding.update({
    where: { id: weddingId },
    data: dataToUpdate,
  });

  return mapWeddingToDTO(updated);
}

/**
 * FR-03: Add or import guests with duplicate detection.
 * Never automatically sends invitations (invitationStatus starts as 'not_shared').
 */
export async function addGuestsToWedding(params: {
  invitationKey?: string;
  weddingId: string;
  ownerUserId: string;
  source: GuestSource;
  candidates: Array<{
    name: string;
    email?: string | null;
    phone?: string | null;
    guestGroup?: string;
    partySize?: number;
  }>;
  skipDuplicates?: boolean;
}): Promise<{
  added: GuestDTO[];
  duplicatesFlagged: Array<{
    candidate: { name: string; email?: string | null; phone?: string | null };
    existingGuest: GuestDTO;
    reason: string;
  }>;
}> {
  const wedding = await assertCanManageWedding(
    params.weddingId,
    params.ownerUserId,
    "Forbidden: Only event organizers can manage the guest list."
  );

  const choices = invitationOptions(mapWeddingToDTO(wedding));
  if (params.invitationKey && !choices.some(option => option.key === params.invitationKey)) throw new Error("Select an available invitation card for these guests.");
  const existingGuests = await prisma.guest.findMany({
    where: { weddingId: wedding.id },
  });

  const allUsers = await prisma.user.findMany();
  const added: GuestDTO[] = [];
  const workingGuests: Guest[] = [...existingGuests];
  const duplicatesFlagged: Array<{
    candidate: { name: string; email?: string | null; phone?: string | null };
    existingGuest: GuestDTO;
    reason: string;
  }> = [];

  for (const raw of params.candidates) {
    const name = (raw.name || "").trim();
    const email = normalizeEmail(raw.email);
    const phone = normalizePhone(raw.phone);

    if (!name) continue;
    if (params.source === "manual" && !phone) throw new Error(`Guest "${name}" needs a mobile number.`);
    if (!email && !phone) {
      throw new Error(
        `Guest "${name}" must have at least an email address or phone number.`
      );
    }

    const dupByEmail = email
      ? workingGuests.find((g) => emailsMatch(g.email, email))
      : undefined;
    const dupByPhone = phone
      ? workingGuests.find((g) => phonesMatch(g.phone, phone))
      : undefined;

    const duplicate = dupByEmail || dupByPhone;
    if (duplicate) {
      const reason = dupByEmail
        ? `Duplicate email (${email}) matches existing guest "${duplicate.name}"`
        : `Duplicate phone (${phone}) matches existing guest "${duplicate.name}"`;
      duplicatesFlagged.push({
        candidate: { name, email, phone },
        existingGuest: mapGuestToDTO(duplicate),
        reason,
      });
      if (params.skipDuplicates !== false) {
        continue;
      }
    }

    const matchingUser = allUsers.find(
      (u) =>
        (email && emailsMatch(u.email, email)) ||
        (phone && phonesMatch(u.phone, phone))
    );

    const partySize =
      typeof raw.partySize === "number" && Number.isFinite(raw.partySize)
        ? Math.min(20, Math.max(1, Math.round(raw.partySize)))
        : 1;
    const guestGroup = normalizeGuestGroup(raw.guestGroup);

    const createdGuest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        invitationKey: params.invitationKey || "",
        name,
        email,
        phone,
        guestGroup,
        partySize,
        inviteToken: `inv_${crypto.randomBytes(8).toString("hex")}`,
        invitationStatus: "not_shared",
        rsvpStatus: "pending",
        linkedUserId: matchingUser?.id || null,
        source: params.source,
      },
    });

    workingGuests.push(createdGuest);
    added.push(mapGuestToDTO(createdGuest));

    if (matchingUser) {
      await prisma.eventMembership.upsert({
        where: {
          weddingId_userId: {
            weddingId: wedding.id,
            userId: matchingUser.id,
          },
        },
        create: {
          weddingId: wedding.id,
          userId: matchingUser.id,
          role: "guest",
          membershipStatus: "active",
          linkedGuestId: createdGuest.id,
        },
        update: {
          membershipStatus: "active",
          linkedGuestId: createdGuest.id,
        },
      });
    }
  }

  if (params.source === "contact_picker" || params.source === "file_import") {
    await trackAnalyticsEvent({
      weddingId: wedding.id,
      eventType: "contact_import_completed",
      actorRole: "host",
      summary: `Imported ${added.length} contact(s) via ${params.source}`,
      metadata: {
        source: params.source,
        importedCount: added.length,
        duplicatesFlagged: duplicatesFlagged.length,
      },
    });
  }

  if (added.length > 0) {
    await trackAnalyticsEvent({
      weddingId: wedding.id,
      eventType: "guest_added",
      actorRole: "host",
      summary: `Added ${added.length} guest(s) to the invitation list`,
      metadata: {
        count: added.length,
        source: params.source,
      },
    });
  }

  return { added, duplicatesFlagged };
}

/**
 * FR-05: Submit or update an RSVP from a guest (before or after registration).
 * Links to the correct guest record and safely flags conflicting records so no RSVP data is lost.
 */
function parseOptionalDate(value?: string | null): Date | null {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    throw new Error("Please select a valid planned attendance date.");
  }
  return parsed;
}

export async function submitGuestRsvp(params: {
  weddingSlugOrId: string;
  invitationKey?: string;
  inviteToken?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  rsvpStatus: RsvpStatus;
  rsvpNote?: string | null;
  partySize?: number;
  plannedArrival?: string | null;
  plannedDeparture?: string | null;
  sharePlannedDates?: boolean;
  authenticatedUserId?: string | null;
}): Promise<{
  guest: GuestDTO;
  resolutionType: "updated_existing" | "created_new" | "flagged_conflict";
}> {
  if (!["yes", "no", "maybe"].includes(params.rsvpStatus)) {
    throw new Error("RSVP response must be Yes, No, or Maybe.");
  }

  const parsedArrival =
    params.rsvpStatus === "no" ? null : parseOptionalDate(params.plannedArrival);
  const parsedDeparture =
    params.rsvpStatus === "no" ? null : parseOptionalDate(params.plannedDeparture);
  if (
    parsedArrival &&
    parsedDeparture &&
    parsedDeparture.getTime() < parsedArrival.getTime()
  ) {
    throw new Error("Planned departure date must be on or after arrival date.");
  }
  const safePartySize =
    typeof params.partySize === "number" && Number.isFinite(params.partySize)
      ? Math.min(20, Math.max(1, Math.round(params.partySize)))
      : undefined;
  const plannedFields = {
    ...(safePartySize !== undefined ? { partySize: safePartySize } : {}),
    ...(params.plannedArrival !== undefined || params.rsvpStatus === "no"
      ? { plannedArrival: parsedArrival }
      : {}),
    ...(params.plannedDeparture !== undefined || params.rsvpStatus === "no"
      ? { plannedDeparture: parsedDeparture }
      : {}),
    ...(params.sharePlannedDates !== undefined
      ? { sharePlannedDates: Boolean(params.sharePlannedDates) }
      : {}),
  };

  const cleanName = params.name.trim();
  const cleanEmail = normalizeEmail(params.email);
  const cleanPhone = normalizePhone(params.phone);

  if (!cleanName) {
    throw new Error("Please enter your full name to submit your RSVP.");
  }
  if (!cleanEmail && !cleanPhone && !params.inviteToken) {
    throw new Error(
      "Please provide your email address or phone number so we can record your RSVP."
    );
  }

  const wedding = await prisma.wedding.findFirst({
    where: {
      OR: [{ slug: params.weddingSlugOrId }, { id: params.weddingSlugOrId }],
    },
  });
  if (!wedding) {
    throw new Error("Wedding invitation not found.");
  }
  if (missingEventDetails(mapWeddingToDTO(wedding)).length) throw new Error("The host is still completing this event invitation.");


  const choices = invitationOptions(mapWeddingToDTO(wedding));
  if (params.invitationKey && !choices.some(o => o.key === params.invitationKey)) throw new Error("Choose an available invitation.");

  const weddingGuests = await prisma.guest.findMany({
    where: { weddingId: wedding.id },
  });

  let targetGuest = params.inviteToken
    ? weddingGuests.find((g) => g.inviteToken === params.inviteToken)
    : undefined;

  if (!targetGuest && params.authenticatedUserId) {
    targetGuest = weddingGuests.find(
      (g) => g.linkedUserId === params.authenticatedUserId
    );
  }

  const emailMatch = cleanEmail
    ? weddingGuests.find((g) => emailsMatch(g.email, cleanEmail))
    : undefined;
  const phoneMatch = cleanPhone
    ? weddingGuests.find((g) => phonesMatch(g.phone, cleanPhone))
    : undefined;

  let resolutionType: "updated_existing" | "created_new" | "flagged_conflict" =
    "updated_existing";
  const now = new Date();

  let updatedGuest: Guest;

  // Case A: Email matched one guest, Phone matched a DIFFERENT guest -> Conflict!
  if (
    !targetGuest &&
    emailMatch &&
    phoneMatch &&
    emailMatch.id !== phoneMatch.id
  ) {
    resolutionType = "flagged_conflict";
    updatedGuest = await prisma.guest.update({
      where: { id: emailMatch.id },
      data: {
        hasConflict: true,
        conflictReason: `Email (${cleanEmail}) matched "${emailMatch.name}", while phone (${cleanPhone}) matched another guest record "${phoneMatch.name}".`,
        conflictIncomingName: cleanName,
        conflictIncomingEmail: cleanEmail,
        conflictIncomingPhone: cleanPhone,
        conflictIncomingRsvp: params.rsvpStatus,
        conflictIncomingNote: params.rsvpNote?.trim() || null,
        conflictDuplicateGuestId: phoneMatch.id,
      },
    });
  } else if (!targetGuest && (emailMatch || phoneMatch)) {
    const matched = (emailMatch || phoneMatch)!;
    const existingFirst = matched.name.trim().split(/\s+/)[0].toLowerCase();
    const incomingFirst = cleanName.split(/\s+/)[0].toLowerCase();
    const isUnverifiedDifferentPerson =
      !params.inviteToken &&
      !params.authenticatedUserId &&
      matched.rsvpStatus !== "pending" &&
      existingFirst !== incomingFirst &&
      !cleanName.toLowerCase().includes(existingFirst);

    if (isUnverifiedDifferentPerson) {
      resolutionType = "flagged_conflict";
      updatedGuest = await prisma.guest.update({
        where: { id: matched.id },
        data: {
          hasConflict: true,
          conflictReason: `A new RSVP (${params.rsvpStatus.toUpperCase()}) was submitted with matching contact info under name "${cleanName}" while "${matched.name}" had already responded ${matched.rsvpStatus.toUpperCase()}.`,
          conflictIncomingName: cleanName,
          conflictIncomingEmail: cleanEmail,
          conflictIncomingPhone: cleanPhone,
          conflictIncomingRsvp: params.rsvpStatus,
          conflictIncomingNote: params.rsvpNote?.trim() || null,
        },
      });
    } else {
      updatedGuest = await prisma.guest.update({
        where: { id: matched.id },
        data: {
          name: cleanName,
          email: cleanEmail || matched.email,
          phone: cleanPhone || matched.phone,
          rsvpStatus: params.rsvpStatus,
          rsvpNote: params.rsvpNote?.trim() || null,
          rsvpUpdatedAt: now,
          invitationStatus: "responded",
          ...plannedFields,
          ...(params.authenticatedUserId
            ? { linkedUserId: params.authenticatedUserId }
            : {}),
        },
      });
    }
  } else if (targetGuest) {
    updatedGuest = await prisma.guest.update({
      where: { id: targetGuest.id },
      data: {
        name: cleanName,
        email: cleanEmail || targetGuest.email,
        phone: cleanPhone || targetGuest.phone,
        rsvpStatus: params.rsvpStatus,
        rsvpNote: params.rsvpNote?.trim() || null,
        rsvpUpdatedAt: now,
        invitationStatus: "responded",
        ...plannedFields,
        ...(params.authenticatedUserId
          ? { linkedUserId: params.authenticatedUserId }
          : {}),
      },
    });
  } else {
    resolutionType = "created_new";
    updatedGuest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        partySize: safePartySize ?? 1,
        plannedArrival: parsedArrival,
        plannedDeparture: parsedDeparture,
        sharePlannedDates: params.sharePlannedDates ?? true,
        inviteToken: `inv_${crypto.randomBytes(8).toString("hex")}`,
        invitationStatus: "responded",
        rsvpStatus: params.rsvpStatus,
        rsvpNote: params.rsvpNote?.trim() || null,
        rsvpUpdatedAt: now,
        linkedUserId: params.authenticatedUserId || null,
        source: "self_rsvp",
        invitationKey: params.invitationKey || choices[0]?.key || "overall",
      },
    });
  }

  if (params.authenticatedUserId) {
    await prisma.eventMembership.upsert({
      where: {
        weddingId_userId: {
          weddingId: wedding.id,
          userId: params.authenticatedUserId,
        },
      },
      create: {
        weddingId: wedding.id,
        userId: params.authenticatedUserId,
        role: "guest",
        membershipStatus: "active",
        linkedGuestId: updatedGuest.id,
      },
      update: {
        membershipStatus: "active",
        linkedGuestId: updatedGuest.id,
      },
    });
  }

  await trackAnalyticsEvent({
    weddingId: wedding.id,
    eventType: "rsvp_submitted",
    actorRole: "guest",
    summary: `Guest submitted RSVP response: ${params.rsvpStatus.toUpperCase()}`,
    metadata: {
      rsvpStatus: params.rsvpStatus,
      resolutionType,
    },
  });

  return {
    guest: mapGuestToDTO(updatedGuest),
    resolutionType,
  };
}

/**
 * FR-05: Resolve duplicate or conflicting guest record.
 */
export async function resolveGuestConflict(params: {
  weddingId: string;
  ownerUserId: string;
  guestId: string;
  resolution: "accept_incoming" | "keep_original" | "split_into_new_guest";
}): Promise<GuestDTO> {
  const wedding = await assertCanManageWedding(
    params.weddingId,
    params.ownerUserId,
    "Forbidden: Only event organizers can resolve guest conflicts."
  );

  const guest = await prisma.guest.findFirst({
    where: { id: params.guestId, weddingId: wedding.id },
  });
  if (!guest || !guest.hasConflict) {
    throw new Error("Conflicting guest record not found.");
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    if (params.resolution === "accept_incoming") {
      if (guest.conflictDuplicateGuestId) {
        await tx.guest
          .delete({ where: { id: guest.conflictDuplicateGuestId } })
          .catch(() => null);
      }
      return tx.guest.update({
        where: { id: guest.id },
        data: {
          name: guest.conflictIncomingName || guest.name,
          email: guest.conflictIncomingEmail || guest.email,
          phone: guest.conflictIncomingPhone || guest.phone,
          rsvpStatus: guest.conflictIncomingRsvp || guest.rsvpStatus,
          rsvpNote: guest.conflictIncomingNote,
          rsvpUpdatedAt: now,
          invitationStatus: "responded",
          hasConflict: false,
          conflictReason: null,
          conflictIncomingName: null,
          conflictIncomingEmail: null,
          conflictIncomingPhone: null,
          conflictIncomingRsvp: null,
          conflictIncomingNote: null,
          conflictDuplicateGuestId: null,
        },
      });
    } else if (params.resolution === "split_into_new_guest") {
      await tx.guest.create({
        data: {
          weddingId: wedding.id,
          name: guest.conflictIncomingName || "Guest",
          email: guest.conflictIncomingEmail,
          phone: guest.conflictIncomingPhone,
          inviteToken: `inv_${crypto.randomBytes(8).toString("hex")}`,
          invitationStatus: "responded",
          rsvpStatus: guest.conflictIncomingRsvp || "yes",
          rsvpNote: guest.conflictIncomingNote,
          rsvpUpdatedAt: now,
          source: "self_rsvp",
        invitationKey: guest.invitationKey,
        },
      });
    }

    return tx.guest.update({
      where: { id: guest.id },
      data: {
        hasConflict: false,
        conflictReason: null,
        conflictIncomingName: null,
        conflictIncomingEmail: null,
        conflictIncomingPhone: null,
        conflictIncomingRsvp: null,
        conflictIncomingNote: null,
        conflictDuplicateGuestId: null,
      },
    });
  });

  return mapGuestToDTO(updated);
}

/**
 * FR-07: Host publishes, edits, or removes event updates.
 */
export async function createEventUpdate(params: {
  weddingId: string;
  authorUserId: string;
  textContent: string;
  category?: UpdateCategory;
  isPinned?: boolean;
}): Promise<EventUpdateDTO> {
  const wedding = await assertCanManageWedding(
    params.weddingId,
    params.authorUserId,
    "Forbidden: Only event organizers can publish event updates."
  );

  const textContent = params.textContent.trim();
  if (!textContent) {
    throw new Error("Update content cannot be empty.");
  }

  const created = await prisma.eventUpdate.create({
    data: {
      weddingId: wedding.id,
      authorUserId: params.authorUserId,
      textContent,
      category: params.category || "announcement",
      isPinned: Boolean(params.isPinned),
      publicationStatus: "published",
    },
    include: {
      author: { select: { name: true } },
    },
  });

  await trackAnalyticsEvent({
    weddingId: wedding.id,
    eventType: "event_update_published",
    actorRole: "host",
    summary: `Published event update (${created.category})`,
    metadata: {
      category: created.category,
      isPinned: created.isPinned,
    },
  });

  return mapUpdateToDTO(created);
}

export async function editEventUpdate(params: {
  weddingId: string;
  updateId: string;
  authorUserId: string;
  textContent?: string;
  category?: UpdateCategory;
  isPinned?: boolean;
}): Promise<EventUpdateDTO> {
  const wedding = await assertCanManageWedding(
    params.weddingId,
    params.authorUserId,
    "Forbidden: Only event organizers can edit event updates."
  );

  const existing = await prisma.eventUpdate.findFirst({
    where: { id: params.updateId, weddingId: wedding.id },
  });
  if (!existing) {
    throw new Error("Event update not found.");
  }

  const updated = await prisma.eventUpdate.update({
    where: { id: existing.id },
    data: {
      ...(params.textContent !== undefined
        ? { textContent: params.textContent.trim() }
        : {}),
      ...(params.category !== undefined ? { category: params.category } : {}),
      ...(params.isPinned !== undefined
        ? { isPinned: Boolean(params.isPinned) }
        : {}),
    },
    include: {
      author: { select: { name: true } },
    },
  });

  return mapUpdateToDTO(updated);
}

export async function removeEventUpdate(params: {
  weddingId: string;
  updateId: string;
  authorUserId: string;
}): Promise<void> {
  const wedding = await assertCanManageWedding(
    params.weddingId,
    params.authorUserId,
    "Forbidden: Only event organizers can remove event updates."
  );

  await prisma.eventUpdate.deleteMany({
    where: { id: params.updateId, weddingId: wedding.id },
  });
}

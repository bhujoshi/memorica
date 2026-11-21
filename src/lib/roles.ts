import { prisma } from "./prisma";
import {
  emailsMatch,
  getWeddingAccess,
  normalizeEmail,
  normalizePhone,
  phonesMatch,
} from "./db";
import { RoleInviteDTO, TeamMemberDTO } from "./types";

export async function listEventTeam(
  weddingId: string,
  actorUserId: string
): Promise<{
  isOwner: boolean;
  members: TeamMemberDTO[];
  invites: RoleInviteDTO[];
}> {
  const access = await getWeddingAccess(weddingId, actorUserId);
  if (!access.wedding || !access.canManage) {
    throw new Error("Forbidden: Only event organizers can view team access.");
  }

  const wedding = await prisma.wedding.findUnique({
    where: { id: access.wedding.id },
    include: {
      owner: true,
      memberships: {
        where: { membershipStatus: "active" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      roleInvites: {
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!wedding) throw new Error("Wedding event not found.");

  const members: TeamMemberDTO[] = [
    {
      userId: wedding.owner.id,
      name: wedding.owner.name,
      email: wedding.owner.email,
      phone: wedding.owner.phone,
      avatarUrl: wedding.owner.avatarUrl,
      role: "owner",
      joinedAt: wedding.createdAt.toISOString(),
    },
  ];

  const seen = new Set<string>([wedding.owner.id]);
  for (const m of wedding.memberships) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    const normalizedRole =
      m.role === "co_admin" || m.role === "host"
        ? "co_admin"
        : m.role === "close_family"
        ? "close_family"
        : "guest";
    if (normalizedRole === "guest") continue;
    members.push({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      avatarUrl: m.user.avatarUrl,
      role: normalizedRole,
      joinedAt: m.createdAt.toISOString(),
    });
  }

  const invites: RoleInviteDTO[] = wedding.roleInvites.map((inv) => ({
    id: inv.id,
    name: inv.name,
    email: inv.email,
    phone: inv.phone,
    role: inv.role === "co_admin" ? "co_admin" : "close_family",
    status: inv.status as "pending" | "accepted" | "revoked",
    createdAt: inv.createdAt.toISOString(),
  }));

  return { isOwner: access.isOwner, members, invites };
}

export async function inviteEventMember(params: {
  weddingId: string;
  actorUserId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: "co_admin" | "close_family";
}): Promise<{ activatedImmediately: boolean }> {
  const access = await getWeddingAccess(params.weddingId, params.actorUserId);
  if (!access.wedding || !access.canManage) {
    throw new Error("Forbidden: Only event organizers can invite family or admins.");
  }
  if (params.role !== "co_admin" && params.role !== "close_family") {
    throw new Error("Choose either Co-Admin or Close Family role.");
  }
  if (params.role === "co_admin" && !access.isOwner) {
    throw new Error("Only the event owner can add or change Co-Admins.");
  }

  const name = params.name.trim().slice(0, 120);
  const email = normalizeEmail(params.email);
  const phone = normalizePhone(params.phone);
  if (!name) throw new Error("Enter the person's name.");
  if (!email && !phone) {
    throw new Error("Enter an email address or phone number so their account links automatically.");
  }

  // Check if a verified user with this email/phone already exists
  const allUsers = await prisma.user.findMany();
  const matchedUser = allUsers.find(
    (u) =>
      (email && emailsMatch(u.email, email)) ||
      (phone && phonesMatch(u.phone, phone))
  );

  if (matchedUser) {
    if (matchedUser.id === access.wedding.ownerUserId) {
      throw new Error("This person is already the event owner.");
    }
    await prisma.eventMembership.upsert({
      where: {
        weddingId_userId: {
          weddingId: access.wedding.id,
          userId: matchedUser.id,
        },
      },
      create: {
        weddingId: access.wedding.id,
        userId: matchedUser.id,
        role: params.role,
        membershipStatus: "active",
      },
      update: {
        role: params.role,
        membershipStatus: "active",
      },
    });
    return { activatedImmediately: true };
  }

  // Otherwise save a pending role invite that auto-activates when they verify/sign in
  const existingInvites = await prisma.eventRoleInvite.findMany({
    where: { weddingId: access.wedding.id, status: "pending" },
  });
  const duplicate = existingInvites.find(
    (inv) =>
      (email && emailsMatch(inv.email, email)) ||
      (phone && phonesMatch(inv.phone, phone))
  );
  if (duplicate) {
    await prisma.eventRoleInvite.update({
      where: { id: duplicate.id },
      data: { name, email: email || duplicate.email, phone: phone || duplicate.phone, role: params.role },
    });
    return { activatedImmediately: false };
  }

  await prisma.eventRoleInvite.create({
    data: {
      weddingId: access.wedding.id,
      name,
      email,
      phone,
      role: params.role,
      invitedByUserId: params.actorUserId,
      status: "pending",
    },
  });

  return { activatedImmediately: false };
}

export async function updateMemberRole(params: {
  weddingId: string;
  actorUserId: string;
  targetUserId: string;
  role: "co_admin" | "close_family" | "guest";
}): Promise<void> {
  const access = await getWeddingAccess(params.weddingId, params.actorUserId);
  if (!access.wedding || !access.isOwner) {
    throw new Error("Only the event owner can change member roles.");
  }
  if (params.targetUserId === access.wedding.ownerUserId) {
    throw new Error("The event owner role cannot be changed.");
  }
  if (!["co_admin", "close_family", "guest"].includes(params.role)) {
    throw new Error("Invalid role.");
  }

  await prisma.eventMembership.upsert({
    where: {
      weddingId_userId: {
        weddingId: access.wedding.id,
        userId: params.targetUserId,
      },
    },
    create: {
      weddingId: access.wedding.id,
      userId: params.targetUserId,
      role: params.role,
      membershipStatus: "active",
    },
    update: {
      role: params.role,
      membershipStatus: "active",
    },
  });
}

export async function revokeMemberOrInvite(params: {
  weddingId: string;
  actorUserId: string;
  targetUserId?: string;
  inviteId?: string;
}): Promise<void> {
  const access = await getWeddingAccess(params.weddingId, params.actorUserId);
  if (!access.wedding || !access.canManage) {
    throw new Error("Forbidden: Only event organizers can revoke access.");
  }

  if (params.inviteId) {
    const invite = await prisma.eventRoleInvite.findFirst({
      where: { id: params.inviteId, weddingId: access.wedding.id },
    });
    if (!invite) throw new Error("Invitation not found.");
    if (invite.role === "co_admin" && !access.isOwner) {
      throw new Error("Only the event owner can revoke Co-Admin invites.");
    }
    await prisma.eventRoleInvite.update({
      where: { id: invite.id },
      data: { status: "revoked" },
    });
    return;
  }

  if (params.targetUserId) {
    if (params.targetUserId === access.wedding.ownerUserId) {
      throw new Error("The event owner cannot be removed.");
    }
    const existing = await prisma.eventMembership.findUnique({
      where: {
        weddingId_userId: {
          weddingId: access.wedding.id,
          userId: params.targetUserId,
        },
      },
    });
    if (!existing) return;
    if ((existing.role === "co_admin" || existing.role === "host") && !access.isOwner) {
      throw new Error("Only the event owner can remove a Co-Admin.");
    }
    // Demote back to regular guest if linked to a guest record, else revoke
    if (existing.linkedGuestId) {
      await prisma.eventMembership.update({
        where: { id: existing.id },
        data: { role: "guest" },
      });
    } else {
      await prisma.eventMembership.update({
        where: { id: existing.id },
        data: { membershipStatus: "revoked" },
      });
    }
  }
}

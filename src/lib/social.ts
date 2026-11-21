import { prisma } from "./prisma";
import { getWeddingAccess } from "./db";
import {
  normalizeGuestGroup,
  SocialReactionId,
  VALID_SOCIAL_REACTIONS,
} from "./format";
import {
  PlannedGuestAttendanceDTO,
  SharedPhotoDTO,
  SocialPostDTO,
  WeddingDTO,
} from "./types";

const EMPTY_REACTIONS: Record<SocialReactionId, number> = {
  heart: 0,
  party: 0,
  blessings: 0,
  sparkles: 0,
};

export async function formatSocialPosts(
  weddingId: string,
  space: "social" | "family",
  viewerUserId: string
): Promise<SocialPostDTO[]> {
  const rows = await prisma.socialPost.findMany({
    where: { weddingId, space },
    include: {
      author: { select: { name: true, avatarUrl: true } },
      comments: {
        include: { author: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      reactions: true,
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 80,
  });

  return rows.map((p) => {
    const counts: Record<SocialReactionId, number> = { ...EMPTY_REACTIONS };
    const mine: SocialReactionId[] = [];
    for (const r of p.reactions) {
      if (VALID_SOCIAL_REACTIONS.has(r.emoji)) {
        const key = r.emoji as SocialReactionId;
        counts[key] += 1;
        if (r.userId === viewerUserId) mine.push(key);
      }
    }
    return {
      id: p.id,
      weddingId: p.weddingId,
      authorUserId: p.authorUserId,
      authorName: p.author.name,
      authorAvatarUrl: p.author.avatarUrl,
      space: p.space === "family" ? "family" : "social",
      kind: (["moment", "wish", "plan", "photo"].includes(p.kind)
        ? p.kind
        : "moment") as SocialPostDTO["kind"],
      content: p.content,
      mediaAssetId: p.mediaAssetId,
      isPinned: p.isPinned,
      createdAt: p.createdAt.toISOString(),
      reactions: counts,
      myReactions: mine,
      comments: p.comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        authorUserId: c.authorUserId,
        authorName: c.author.name,
        authorAvatarUrl: c.author.avatarUrl,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });
}

export async function getSocialHubData(
  weddingIdOrSlug: string,
  userId: string
): Promise<{
  wedding: WeddingDTO;
  detailedRole: string;
  canManage: boolean;
  canAccessFamily: boolean;
  posts: SocialPostDTO[];
  attendees: PlannedGuestAttendanceDTO[];
  photos: SharedPhotoDTO[];
  stats: {
    confirmedCount: number;
    confirmedHeadcount: number;
    maybeCount: number;
    sharedDatesCount: number;
  };
}> {
  const access = await getWeddingAccess(weddingIdOrSlug, userId);
  if (!access.wedding) throw new Error("Celebration not found.");
  if (!access.canAccessSocial) {
    throw new Error(
      "Access denied: Only invited verified guests and organizers can view this celebration page."
    );
  }

  const weddingId = access.wedding.id;
  const [posts, guestRows, photoRows] = await Promise.all([
    formatSocialPosts(weddingId, "social", userId),
    prisma.guest.findMany({
      where: { weddingId, rsvpStatus: { in: ["yes", "maybe"] } },
      orderBy: [{ plannedArrival: "asc" }, { name: "asc" }],
    }),
    prisma.sharedPhoto.findMany({
      where: { weddingId },
      include: { uploader: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  // Privacy guard: only expose plannedArrival/plannedDeparture to other guests when sharePlannedDates is true
  const attendees: PlannedGuestAttendanceDTO[] = guestRows.map((g) => {
    const canSeeDates =
      g.sharePlannedDates || access.canManage || g.linkedUserId === userId;
    return {
      id: g.id,
      name: g.name,
      rsvpStatus: g.rsvpStatus as "yes" | "maybe",
      partySize: Math.max(1, g.partySize || 1),
      guestGroup: normalizeGuestGroup(g.guestGroup),
      plannedArrival:
        canSeeDates && g.plannedArrival ? g.plannedArrival.toISOString() : null,
      plannedDeparture:
        canSeeDates && g.plannedDeparture
          ? g.plannedDeparture.toISOString()
          : null,
      rsvpNote: g.rsvpNote,
    };
  });

  const confirmedRows = guestRows.filter((g) => g.rsvpStatus === "yes");
  const stats = {
    confirmedCount: confirmedRows.length,
    confirmedHeadcount: confirmedRows.reduce(
      (sum, g) => sum + Math.max(1, g.partySize || 1),
      0
    ),
    maybeCount: guestRows.filter((g) => g.rsvpStatus === "maybe").length,
    sharedDatesCount: attendees.filter((a) => Boolean(a.plannedArrival)).length,
  };

  const photos: SharedPhotoDTO[] = photoRows.map((p) => ({
    id: p.id,
    weddingId: p.weddingId,
    uploaderUserId: p.uploaderUserId,
    uploaderName: p.uploader.name,
    albumName: p.albumName,
    caption: p.caption,
    assetId: p.assetId,
    createdAt: p.createdAt.toISOString(),
  }));

  return {
    wedding: access.wedding,
    detailedRole: access.detailedRole,
    canManage: access.canManage,
    canAccessFamily: access.canAccessFamily,
    posts,
    attendees,
    photos,
    stats,
  };
}

export async function createSocialPost(params: {
  weddingIdOrSlug: string;
  authorUserId: string;
  space: "social" | "family";
  kind?: "moment" | "wish" | "plan" | "photo";
  content: string;
  mediaAssetId?: string | null;
}): Promise<SocialPostDTO> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.authorUserId
  );
  if (!access.wedding) throw new Error("Celebration not found.");
  if (params.space === "family" && !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }
  if (params.space === "social" && !access.canAccessSocial) {
    throw new Error("Forbidden: Verified guest access required.");
  }

  const content = params.content.trim().slice(0, 2000);
  if (!content && !params.mediaAssetId) {
    throw new Error("Write a message or attach a photo to post.");
  }

  let verifiedAssetId: string | null = null;
  if (params.mediaAssetId) {
    const asset = await prisma.eventAsset.findFirst({
      where: { id: params.mediaAssetId, weddingId: access.wedding.id },
    });
    if (!asset) throw new Error("Attached photo not found for this event.");
    verifiedAssetId = asset.id;
  }

  const kind =
    params.kind && ["moment", "wish", "plan", "photo"].includes(params.kind)
      ? params.kind
      : verifiedAssetId
      ? "photo"
      : "moment";

  const created = await prisma.socialPost.create({
    data: {
      weddingId: access.wedding.id,
      authorUserId: params.authorUserId,
      space: params.space,
      kind,
      content: content || "Shared a celebration moment",
      mediaAssetId: verifiedAssetId,
    },
    include: { author: { select: { name: true, avatarUrl: true } } },
  });

  return {
    id: created.id,
    weddingId: created.weddingId,
    authorUserId: created.authorUserId,
    authorName: created.author.name,
    authorAvatarUrl: created.author.avatarUrl,
    space: params.space,
    kind,
    content: created.content,
    mediaAssetId: created.mediaAssetId,
    isPinned: created.isPinned,
    createdAt: created.createdAt.toISOString(),
    reactions: { ...EMPTY_REACTIONS },
    myReactions: [],
    comments: [],
  };
}

export async function addSocialComment(params: {
  weddingIdOrSlug: string;
  postId: string;
  authorUserId: string;
  content: string;
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.authorUserId
  );
  if (!access.wedding) throw new Error("Celebration not found.");

  const post = await prisma.socialPost.findFirst({
    where: { id: params.postId, weddingId: access.wedding.id },
  });
  if (!post) throw new Error("Post not found.");
  if (post.space === "family" && !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }
  if (post.space === "social" && !access.canAccessSocial) {
    throw new Error("Forbidden: Verified guest access required.");
  }

  const content = params.content.trim().slice(0, 1000);
  if (!content) throw new Error("Comment cannot be empty.");

  await prisma.socialComment.create({
    data: {
      postId: post.id,
      authorUserId: params.authorUserId,
      content,
    },
  });
}

export async function toggleSocialReaction(params: {
  weddingIdOrSlug: string;
  postId: string;
  userId: string;
  emoji: string;
}): Promise<void> {
  if (!VALID_SOCIAL_REACTIONS.has(params.emoji)) {
    throw new Error("Unsupported reaction.");
  }
  const access = await getWeddingAccess(params.weddingIdOrSlug, params.userId);
  if (!access.wedding) throw new Error("Celebration not found.");

  const post = await prisma.socialPost.findFirst({
    where: { id: params.postId, weddingId: access.wedding.id },
  });
  if (!post) throw new Error("Post not found.");
  if (post.space === "family" && !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }
  if (post.space === "social" && !access.canAccessSocial) {
    throw new Error("Forbidden: Verified guest access required.");
  }

  const existing = await prisma.socialReaction.findUnique({
    where: {
      postId_userId_emoji: {
        postId: post.id,
        userId: params.userId,
        emoji: params.emoji,
      },
    },
  });

  if (existing) {
    await prisma.socialReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.socialReaction.create({
      data: { postId: post.id, userId: params.userId, emoji: params.emoji },
    });
  }
}

export async function deleteSocialPost(params: {
  weddingIdOrSlug: string;
  postId: string;
  actorUserId: string;
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.actorUserId
  );
  if (!access.wedding) throw new Error("Celebration not found.");

  const post = await prisma.socialPost.findFirst({
    where: { id: params.postId, weddingId: access.wedding.id },
  });
  if (!post) throw new Error("Post not found.");

  if (post.authorUserId !== params.actorUserId && !access.canManage) {
    throw new Error("You can only delete your own posts.");
  }

  await prisma.socialPost.delete({ where: { id: post.id } });
}

export async function createSharedPhoto(params: {
  weddingIdOrSlug: string;
  uploaderUserId: string;
  assetId: string;
  albumName?: string;
  caption?: string;
}): Promise<SharedPhotoDTO> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.uploaderUserId
  );
  if (!access.wedding || !access.canAccessSocial) {
    throw new Error("Forbidden: Verified guest access required to share photos.");
  }

  const asset = await prisma.eventAsset.findFirst({
    where: { id: params.assetId, weddingId: access.wedding.id },
  });
  if (!asset || !asset.mime.startsWith("image/")) {
    throw new Error("Upload a valid photo before saving to the album.");
  }

  const albumName = (params.albumName || "All Memories").trim().slice(0, 80) || "All Memories";
  const caption = params.caption?.trim().slice(0, 500) || null;

  const created = await prisma.sharedPhoto.create({
    data: {
      weddingId: access.wedding.id,
      uploaderUserId: params.uploaderUserId,
      albumName,
      caption,
      assetId: asset.id,
    },
    include: { uploader: { select: { name: true } } },
  });

  return {
    id: created.id,
    weddingId: created.weddingId,
    uploaderUserId: created.uploaderUserId,
    uploaderName: created.uploader.name,
    albumName: created.albumName,
    caption: created.caption,
    assetId: created.assetId,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteSharedPhoto(params: {
  weddingIdOrSlug: string;
  photoId: string;
  actorUserId: string;
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.actorUserId
  );
  if (!access.wedding) throw new Error("Celebration not found.");

  const photo = await prisma.sharedPhoto.findFirst({
    where: { id: params.photoId, weddingId: access.wedding.id },
  });
  if (!photo) throw new Error("Photo not found.");
  if (photo.uploaderUserId !== params.actorUserId && !access.canManage) {
    throw new Error("You can only remove photos you uploaded.");
  }

  await prisma.sharedPhoto.delete({ where: { id: photo.id } });
}

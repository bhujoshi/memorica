import { prisma } from "./prisma";
import { getWeddingAccess } from "./db";
import { VALID_POLL_CATEGORIES } from "./format";
import { formatSocialPosts } from "./social";
import {
  FamilyPollDTO,
  FamilyTaskDTO,
  SocialPostDTO,
  WeddingDTO,
} from "./types";

export async function getFamilyRoomData(
  weddingIdOrSlug: string,
  userId: string
): Promise<{
  wedding: WeddingDTO;
  detailedRole: string;
  canManage: boolean;
  polls: FamilyPollDTO[];
  tasks: FamilyTaskDTO[];
  discussions: SocialPostDTO[];
}> {
  const access = await getWeddingAccess(weddingIdOrSlug, userId);
  if (!access.wedding) throw new Error("Celebration not found.");
  if (!access.canAccessFamily) {
    throw new Error(
      "Access denied: The Close Family planning room is invite-only for close family and event organizers."
    );
  }

  const weddingId = access.wedding.id;
  const [pollRows, taskRows, discussions] = await Promise.all([
    prisma.familyPoll.findMany({
      where: { weddingId },
      include: {
        creator: { select: { name: true } },
        options: {
          orderBy: { sortOrder: "asc" },
          include: {
            votes: { include: { user: { select: { id: true, name: true } } } },
          },
        },
        votes: { select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.familyTask.findMany({
      where: { weddingId },
      include: { creator: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    formatSocialPosts(weddingId, "family", userId),
  ]);

  const polls: FamilyPollDTO[] = pollRows.map((p) => {
    const distinctVoters = new Set(p.votes.map((v) => v.userId));
    return {
      id: p.id,
      weddingId: p.weddingId,
      creatorUserId: p.creatorUserId,
      creatorName: p.creator.name,
      question: p.question,
      category: p.category,
      allowMultiple: p.allowMultiple,
      isClosed: p.isClosed,
      totalVotes: p.votes.length,
      totalVoters: distinctVoters.size,
      createdAt: p.createdAt.toISOString(),
      options: p.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        voteCount: opt.votes.length,
        votedByMe: opt.votes.some((v) => v.userId === userId),
        voters: opt.votes.map((v) => v.user.name),
      })),
    };
  });

  const tasks: FamilyTaskDTO[] = taskRows.map((t) => ({
    id: t.id,
    weddingId: t.weddingId,
    creatorUserId: t.creatorUserId,
    creatorName: t.creator.name,
    title: t.title,
    assigneeName: t.assigneeName,
    category: t.category,
    status: (["todo", "in_progress", "done"].includes(t.status)
      ? t.status
      : "todo") as FamilyTaskDTO["status"],
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return {
    wedding: access.wedding,
    detailedRole: access.detailedRole,
    canManage: access.canManage,
    polls,
    tasks,
    discussions,
  };
}

export async function createFamilyPoll(params: {
  weddingIdOrSlug: string;
  creatorUserId: string;
  question: string;
  category?: string;
  allowMultiple?: boolean;
  options: string[];
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.creatorUserId
  );
  if (!access.wedding || !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }

  const question = params.question.trim().slice(0, 280);
  if (question.length < 4) {
    throw new Error("Enter a clear poll question (at least 4 characters).");
  }
  const cleanOptions = Array.from(
    new Set(
      (params.options || [])
        .map((o) => String(o || "").trim().slice(0, 140))
        .filter(Boolean)
    )
  );
  if (cleanOptions.length < 2 || cleanOptions.length > 8) {
    throw new Error("Add between 2 and 8 distinct poll options.");
  }

  const category =
    params.category && VALID_POLL_CATEGORIES.has(params.category)
      ? params.category
      : "other";

  await prisma.familyPoll.create({
    data: {
      weddingId: access.wedding.id,
      creatorUserId: params.creatorUserId,
      question,
      category,
      allowMultiple: Boolean(params.allowMultiple),
      options: {
        create: cleanOptions.map((label, idx) => ({ label, sortOrder: idx })),
      },
    },
  });
}

export async function toggleFamilyPollVote(params: {
  weddingIdOrSlug: string;
  pollId: string;
  optionId: string;
  userId: string;
}): Promise<void> {
  const access = await getWeddingAccess(params.weddingIdOrSlug, params.userId);
  if (!access.wedding || !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }

  const poll = await prisma.familyPoll.findFirst({
    where: { id: params.pollId, weddingId: access.wedding.id },
    include: { options: true },
  });
  if (!poll) throw new Error("Poll not found.");
  if (poll.isClosed) throw new Error("This poll is closed for voting.");
  if (!poll.options.some((o) => o.id === params.optionId)) {
    throw new Error("Poll option not found.");
  }

  const existing = await prisma.familyPollVote.findUnique({
    where: {
      pollId_optionId_userId: {
        pollId: poll.id,
        optionId: params.optionId,
        userId: params.userId,
      },
    },
  });

  if (existing) {
    await prisma.familyPollVote.delete({ where: { id: existing.id } });
    return;
  }

  if (!poll.allowMultiple) {
    await prisma.familyPollVote.deleteMany({
      where: { pollId: poll.id, userId: params.userId },
    });
  }

  await prisma.familyPollVote.create({
    data: {
      pollId: poll.id,
      optionId: params.optionId,
      userId: params.userId,
    },
  });
}

export async function setFamilyPollClosed(params: {
  weddingIdOrSlug: string;
  pollId: string;
  actorUserId: string;
  isClosed: boolean;
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.actorUserId
  );
  if (!access.wedding || !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }
  const poll = await prisma.familyPoll.findFirst({
    where: { id: params.pollId, weddingId: access.wedding.id },
  });
  if (!poll) throw new Error("Poll not found.");
  if (poll.creatorUserId !== params.actorUserId && !access.canManage) {
    throw new Error("Only the poll creator or event organizer can close/reopen this poll.");
  }
  await prisma.familyPoll.update({
    where: { id: poll.id },
    data: { isClosed: Boolean(params.isClosed) },
  });
}

export async function deleteFamilyPoll(params: {
  weddingIdOrSlug: string;
  pollId: string;
  actorUserId: string;
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.actorUserId
  );
  if (!access.wedding || !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }
  const poll = await prisma.familyPoll.findFirst({
    where: { id: params.pollId, weddingId: access.wedding.id },
  });
  if (!poll) throw new Error("Poll not found.");
  if (poll.creatorUserId !== params.actorUserId && !access.canManage) {
    throw new Error("Only the poll creator or event organizer can delete this poll.");
  }
  await prisma.familyPoll.delete({ where: { id: poll.id } });
}

export async function createFamilyTask(params: {
  weddingIdOrSlug: string;
  creatorUserId: string;
  title: string;
  assigneeName?: string | null;
  category?: string;
  dueDate?: string | null;
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.creatorUserId
  );
  if (!access.wedding || !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }

  const title = params.title.trim().slice(0, 200);
  if (!title) throw new Error("Enter a task title.");
  const dueDate =
    params.dueDate && params.dueDate.trim() ? new Date(params.dueDate) : null;
  if (dueDate && isNaN(dueDate.getTime())) {
    throw new Error("Choose a valid due date.");
  }

  await prisma.familyTask.create({
    data: {
      weddingId: access.wedding.id,
      creatorUserId: params.creatorUserId,
      title,
      assigneeName: params.assigneeName?.trim().slice(0, 100) || null,
      category:
        params.category && VALID_POLL_CATEGORIES.has(params.category)
          ? params.category
          : "other",
      status: "todo",
      dueDate,
    },
  });
}

export async function updateFamilyTask(params: {
  weddingIdOrSlug: string;
  taskId: string;
  actorUserId: string;
  status?: "todo" | "in_progress" | "done";
  assigneeName?: string | null;
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.actorUserId
  );
  if (!access.wedding || !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }
  const task = await prisma.familyTask.findFirst({
    where: { id: params.taskId, weddingId: access.wedding.id },
  });
  if (!task) throw new Error("Task not found.");

  await prisma.familyTask.update({
    where: { id: task.id },
    data: {
      ...(params.status && ["todo", "in_progress", "done"].includes(params.status)
        ? { status: params.status }
        : {}),
      ...(params.assigneeName !== undefined
        ? { assigneeName: params.assigneeName?.trim().slice(0, 100) || null }
        : {}),
    },
  });
}

export async function deleteFamilyTask(params: {
  weddingIdOrSlug: string;
  taskId: string;
  actorUserId: string;
}): Promise<void> {
  const access = await getWeddingAccess(
    params.weddingIdOrSlug,
    params.actorUserId
  );
  if (!access.wedding || !access.canAccessFamily) {
    throw new Error("Forbidden: Close Family access required.");
  }
  const task = await prisma.familyTask.findFirst({
    where: { id: params.taskId, weddingId: access.wedding.id },
  });
  if (!task) throw new Error("Task not found.");
  if (task.creatorUserId !== params.actorUserId && !access.canManage) {
    throw new Error("Only the task creator or event organizer can delete this task.");
  }
  await prisma.familyTask.delete({ where: { id: task.id } });
}

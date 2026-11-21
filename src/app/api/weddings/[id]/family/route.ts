import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import {
  createFamilyPoll,
  createFamilyTask,
  deleteFamilyPoll,
  deleteFamilyTask,
  getFamilyRoomData,
  setFamilyPollClosed,
  toggleFamilyPollVote,
  updateFamilyTask,
} from "@/lib/family";
import {
  addSocialComment,
  createSocialPost,
  deleteSocialPost,
  toggleSocialReaction,
} from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to open the Close Family planning room.", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }
  try {
    const data = await getFamilyRoomData(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load Close Family room.";
    const status = message.startsWith("Access denied")
      ? 403
      : message.includes("not found")
      ? 404
      : 400;
    return NextResponse.json(
      { error: message, code: status === 403 ? "FORBIDDEN_CLOSE_FAMILY" : undefined },
      { status }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "create_poll") {
      await createFamilyPoll({
        weddingIdOrSlug: params.id,
        creatorUserId: user.id,
        question: String(body.question || ""),
        category: body.category,
        allowMultiple: Boolean(body.allowMultiple),
        options: Array.isArray(body.options) ? body.options : [],
      });
    } else if (body.action === "vote") {
      await toggleFamilyPollVote({
        weddingIdOrSlug: params.id,
        pollId: String(body.pollId || ""),
        optionId: String(body.optionId || ""),
        userId: user.id,
      });
    } else if (body.action === "create_task") {
      await createFamilyTask({
        weddingIdOrSlug: params.id,
        creatorUserId: user.id,
        title: String(body.title || ""),
        assigneeName: body.assigneeName,
        category: body.category,
        dueDate: body.dueDate,
      });
    } else if (body.action === "comment") {
      await addSocialComment({
        weddingIdOrSlug: params.id,
        postId: String(body.postId || ""),
        authorUserId: user.id,
        content: String(body.content || ""),
      });
    } else if (body.action === "react") {
      await toggleSocialReaction({
        weddingIdOrSlug: params.id,
        postId: String(body.postId || ""),
        userId: user.id,
        emoji: String(body.emoji || ""),
      });
    } else {
      await createSocialPost({
        weddingIdOrSlug: params.id,
        authorUserId: user.id,
        space: "family",
        kind: "plan",
        content: String(body.content || ""),
        mediaAssetId: body.mediaAssetId || null,
      });
    }
    const data = await getFamilyRoomData(params.id, user.id);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update Close Family room.";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("Forbidden") ? 403 : 400 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "toggle_poll") {
      await setFamilyPollClosed({
        weddingIdOrSlug: params.id,
        pollId: String(body.pollId || ""),
        actorUserId: user.id,
        isClosed: Boolean(body.isClosed),
      });
    } else if (body.action === "update_task") {
      await updateFamilyTask({
        weddingIdOrSlug: params.id,
        taskId: String(body.taskId || ""),
        actorUserId: user.id,
        status: body.status,
        assigneeName: body.assigneeName,
      });
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    const data = await getFamilyRoomData(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update item.";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("Forbidden") ? 403 : 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const pollId = req.nextUrl.searchParams.get("pollId");
    const taskId = req.nextUrl.searchParams.get("taskId");
    const postId = req.nextUrl.searchParams.get("postId");
    if (pollId) {
      await deleteFamilyPoll({ weddingIdOrSlug: params.id, pollId, actorUserId: user.id });
    } else if (taskId) {
      await deleteFamilyTask({ weddingIdOrSlug: params.id, taskId, actorUserId: user.id });
    } else if (postId) {
      await deleteSocialPost({ weddingIdOrSlug: params.id, postId, actorUserId: user.id });
    }
    const data = await getFamilyRoomData(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

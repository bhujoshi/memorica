import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import {
  addSocialComment,
  createSocialPost,
  deleteSocialPost,
  getSocialHubData,
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
      { error: "Sign in to join the celebration social page.", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }
  try {
    const data = await getSocialHubData(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load celebration page.";
    const status = message.startsWith("Access denied")
      ? 403
      : message.includes("not found")
      ? 404
      : 400;
    return NextResponse.json(
      { error: message, code: status === 403 ? "FORBIDDEN_NOT_INVITED" : undefined },
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
    if (body.action === "comment") {
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
        space: "social",
        kind: body.kind,
        content: String(body.content || ""),
        mediaAssetId: body.mediaAssetId || null,
      });
    }
    const data = await getSocialHubData(params.id, user.id);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update social feed.";
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
    const postId = req.nextUrl.searchParams.get("postId") || "";
    await deleteSocialPost({
      weddingIdOrSlug: params.id,
      postId,
      actorUserId: user.id,
    });
    const data = await getSocialHubData(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to remove post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

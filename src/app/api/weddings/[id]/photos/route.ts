import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import { createSharedPhoto, deleteSharedPhoto, getSocialHubData } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await getSocialHubData(params.id, user.id);
    return NextResponse.json({ photos: data.photos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load shared photos.";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("Access denied") ? 403 : 400 }
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
    const photo = await createSharedPhoto({
      weddingIdOrSlug: params.id,
      uploaderUserId: user.id,
      assetId: String(body.assetId || ""),
      albumName: body.albumName,
      caption: body.caption,
    });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to save shared photo.";
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
    const photoId = req.nextUrl.searchParams.get("photoId") || "";
    await deleteSharedPhoto({
      weddingIdOrSlug: params.id,
      photoId,
      actorUserId: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to remove photo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

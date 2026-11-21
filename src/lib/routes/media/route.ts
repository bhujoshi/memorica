import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWeddingAccess, mapWeddingToDTO } from "@/lib/db";
import { missingEventDetails } from "@/lib/event-setup";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_MEDIA_TYPES,
  MediaScope,
  detectMediaMime,
  readStoredMediaBytes,
  storeEventMedia,
} from "@/lib/storage";

export async function upload(req: NextRequest, weddingId: string) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const scopeParam = req.nextUrl.searchParams.get("scope") || "setup";
  const scope: MediaScope =
    scopeParam === "social" || scopeParam === "photo" || scopeParam === "receipt"
      ? scopeParam
      : "setup";

  const access = await getWeddingAccess(weddingId, user.id);
  if (!access.wedding) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (scope === "setup" || scope === "receipt") {
    if (!access.canManage) {
      return NextResponse.json(
        { error: "Only event organizers can upload these files." },
        { status: 403 }
      );
    }
  } else if (!access.canAccessSocial) {
    return NextResponse.json(
      { error: "Only verified guests and organizers can share photos here." },
      { status: 403 }
    );
  }

  if (Number(req.headers.get("content-length")) > 21 * 1024 * 1024) {
    return NextResponse.json({ error: "Maximum file size is 20 MB." }, { status: 413 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const allowed: readonly string[] =
      scope === "social" || scope === "photo"
        ? ALLOWED_IMAGE_TYPES
        : ALLOWED_MEDIA_TYPES;

    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 20 * 1024 * 1024 ||
      !allowed.includes(file.type)
    ) {
      return NextResponse.json(
        {
          error:
            scope === "social" || scope === "photo"
              ? "Choose a JPG, PNG, WebP or GIF photo under 20 MB."
              : "Choose a JPG, PNG, WebP, GIF, MP4, WebM or PDF under 20 MB.",
        },
        { status: 400 }
      );
    }

    const data = Buffer.from(await file.arrayBuffer());
    if (detectMediaMime(data) !== file.type) {
      return NextResponse.json(
        { error: "The file contents do not match its format." },
        { status: 400 }
      );
    }

    const asset = await storeEventMedia({
      weddingId: access.wedding.id,
      fileName: file.name,
      mime: file.type,
      data,
      scope,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not upload this file. Try again." },
      { status: 400 }
    );
  }
}

export async function read(id: string) {
  const asset = await prisma.eventAsset.findUnique({
    where: { id },
    include: { wedding: true },
  });
  if (!asset) return new NextResponse("Not found", { status: 404 });

  const user = await getAuthenticatedUserFromCookies();
  const access = await getWeddingAccess(asset.weddingId, user?.id);
  const wedding = mapWeddingToDTO(asset.wedding);

  if (asset.scope === "receipt") {
    if (!access.canAccessFinances) {
      return new NextResponse("Not found", { status: 404 });
    }
  } else if (asset.scope === "social" || asset.scope === "photo") {
    if (!access.canAccessSocial) {
      return new NextResponse("Not found", { status: 404 });
    }
  } else {
    const attached =
      wedding.setup.card?.id === id ||
      wedding.setup.photos.some((p) => p.id === id) ||
      wedding.setup.subEvents.some((sub) => sub.card?.id === id);
    if (!access.canManage && (!attached || missingEventDetails(wedding).length)) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const bytes = await readStoredMediaBytes(asset);
  if (!bytes) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": asset.mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

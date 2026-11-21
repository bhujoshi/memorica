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
  isHeifOrAvif,
  readStoredMediaBytes,
  storeEventMedia,
} from "@/lib/storage";

interface UploadedBlobLike {
  size: number;
  type: string;
  name?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function isUploadedFile(value: unknown): value is UploadedBlobLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UploadedBlobLike>;
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.size === "number" &&
    typeof candidate.type === "string"
  );
}

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

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 21 * 1024 * 1024) {
    return NextResponse.json({ error: "Maximum file size is 20 MB." }, { status: 413 });
  }

  const formatError =
    scope === "social" || scope === "photo"
      ? "Choose a JPG, PNG, WebP or GIF photo under 20 MB."
      : "Choose a JPG, PNG, WebP, GIF, MP4, WebM or PDF under 20 MB.";

  try {
    const form = await req.formData();
    const file = form.get("file");
    const allowed: readonly string[] =
      scope === "social" || scope === "photo"
        ? ALLOWED_IMAGE_TYPES
        : ALLOWED_MEDIA_TYPES;

    if (!isUploadedFile(file) || !file.size) {
      return NextResponse.json({ error: formatError }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Maximum file size is 20 MB." },
        { status: 413 }
      );
    }

    const data = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectMediaMime(data);
    if (!detectedMime) {
      const lowerType = file.type.toLowerCase();
      if (
        isHeifOrAvif(data) ||
        lowerType.includes("heic") ||
        lowerType.includes("heif") ||
        lowerType.includes("avif")
      ) {
        return NextResponse.json(
          {
            error:
              "HEIC/AVIF images aren't supported directly. Please export or save your card as JPG, PNG, or PDF.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: formatError }, { status: 400 });
    }

    if (!allowed.includes(detectedMime)) {
      return NextResponse.json({ error: formatError }, { status: 400 });
    }

    const rawName =
      typeof file.name === "string" && file.name.trim()
        ? file.name.trim()
        : "invitation";

    const asset = await storeEventMedia({
      weddingId: access.wedding.id,
      fileName: rawName,
      mime: detectedMime,
      data,
      scope,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (err) {
    console.error("[Memorica Media Upload Error]", err);
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

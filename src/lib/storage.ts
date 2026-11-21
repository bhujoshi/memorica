import { prisma } from "./prisma";

export type MediaScope = "setup" | "social" | "photo" | "receipt";

export const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
] as const;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function detectMediaMime(data: Buffer): string | null {
  if (data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6))) return "image/gif";
  if (
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (data.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (data.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (data.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return "video/webm";
  return null;
}

export function isCloudStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Stores validated media bytes either in Vercel Blob (when BLOB_READ_WRITE_TOKEN is set)
 * or in Prisma EventAsset bytes as a fallback, always indexing metadata in EventAsset.
 */
export async function storeEventMedia(params: {
  weddingId: string;
  fileName: string;
  mime: string;
  data: Buffer;
  scope: MediaScope;
}): Promise<{ id: string; name: string; mime: string }> {
  const safeName = params.fileName.replace(/[^\w.\- ()]/g, "_").slice(0, 255) || "file";
  let storageUrl: string | null = null;
  let storedBytes: Buffer = params.data;

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const pathname = `memorica/${params.weddingId}/${params.scope}/${Date.now()}-${safeName}`;
      const uploadRes = await fetch(
        `https://blob.vercel-storage.com/${encodeURIComponent(pathname)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${blobToken}`,
            "Content-Type": params.mime,
            "x-api-version": "7",
          },
          body: new Uint8Array(params.data),
        }
      );
      if (uploadRes.ok) {
        const json = (await uploadRes.json().catch(() => null)) as { url?: string } | null;
        if (json?.url) {
          storageUrl = json.url;
          storedBytes = Buffer.alloc(0);
        }
      }
    } catch {
      // Fall back to DB bytes if cloud upload is unreachable
      storageUrl = null;
      storedBytes = params.data;
    }
  }

  return prisma.eventAsset.create({
    data: {
      weddingId: params.weddingId,
      name: safeName,
      mime: params.mime,
      scope: params.scope,
      storageUrl,
      data: storedBytes,
    },
    select: { id: true, name: true, mime: true },
  });
}

export async function readStoredMediaBytes(asset: {
  data: Buffer;
  storageUrl: string | null;
}): Promise<Uint8Array | null> {
  if (asset.storageUrl) {
    try {
      const res = await fetch(asset.storageUrl);
      if (res.ok) {
        return new Uint8Array(await res.arrayBuffer());
      }
    } catch {
      return null;
    }
  }
  return new Uint8Array(asset.data);
}

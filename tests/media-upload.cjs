const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { createRequire } = require("node:module");
const { NextRequest } = require("next/server");

const TEST_DB_PATH = `/tmp/memorica_media_upload_test_${process.pid}.db`;
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

const moduleCache = new Map();
const SRC_DIR = path.resolve("src");

let activeAuthUser = null;

function resolveTsFile(basePath) {
  for (const candidate of [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function loadTs(file, stubs = {}) {
  const filename = path.resolve(file);
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
  const localRequire = createRequire(filename);
  const mod = { exports: {} };
  moduleCache.set(filename, mod);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const customRequire = (name) => {
    if (Object.prototype.hasOwnProperty.call(stubs, name)) {
      return stubs[name];
    }
    if (name.startsWith("@/")) {
      const target = resolveTsFile(path.join(SRC_DIR, name.slice(2)));
      if (target) return loadTs(target, stubs);
    }
    if (name.startsWith(".")) {
      const target = resolveTsFile(path.resolve(path.dirname(filename), name));
      if (target) return loadTs(target, stubs);
    }
    return localRequire(name);
  };

  new Function("require", "module", "exports", code)(
    customRequire,
    mod,
    mod.exports
  );
  return mod.exports;
}

function cleanupDb() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function makeUploadRequest(weddingId, bytes, fileName, claimedMime, scope) {
  const form = new FormData();
  const blob = new Blob([bytes], { type: claimedMime });
  form.append("file", blob, fileName);
  const qs = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  return new NextRequest(
    `http://localhost:3000/api/weddings/${weddingId}/media${qs}`,
    {
      method: "POST",
      body: form,
    }
  );
}

(async () => {
  cleanupDb();
  execFileSync(
    path.resolve("node_modules/.bin/prisma"),
    ["db", "push", "--skip-generate", "--accept-data-loss"],
    {
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
      stdio: "pipe",
    }
  );

  const authStub = {
    getAuthenticatedUserFromCookies: async () => activeAuthUser,
  };

  const { prisma } = loadTs("src/lib/prisma.ts", { "@/lib/auth": authStub });
  const { detectMediaMime, isHeifOrAvif } = loadTs("src/lib/storage.ts", {
    "@/lib/auth": authStub,
  });
  const { createWedding, updateWedding } = loadTs("src/lib/db.ts", {
    "@/lib/auth": authStub,
  });
  const { upload, read } = loadTs("src/lib/routes/media/route.ts", {
    "@/lib/auth": authStub,
  });

  try {
    // 1. Magic-byte detection checks
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const jpgBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const pdfWithBom = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("  %PDF-1.7\n1 0 obj\n"),
    ]);
    const mp4Bytes = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    const heicBytes = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    const svgSpoof = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");

    assert.equal(detectMediaMime(pngBytes), "image/png");
    assert.equal(detectMediaMime(jpgBytes), "image/jpeg");
    assert.equal(detectMediaMime(pdfWithBom), "application/pdf");
    assert.equal(detectMediaMime(mp4Bytes), "video/mp4");
    assert.equal(isHeifOrAvif(heicBytes), true);
    assert.equal(detectMediaMime(heicBytes), null);
    assert.equal(detectMediaMime(svgSpoof), null);

    // 2. Create owner & wedding
    const owner = await prisma.user.create({
      data: {
        name: "Bhuwan",
        phone: "+919999999999",
        onboardingCompleted: true,
      },
    });
    const wedding = await createWedding({
      ownerUserId: owner.id,
      eventType: "Wedding",
      eventTitle: "Wedding",
      date: "2026-12-01T00:00:00.000Z",
      endDate: "2026-12-02T00:00:00.000Z",
      venue: "Lucknow, Uttar Pradesh",
    });

    activeAuthUser = {
      id: owner.id,
      name: owner.name,
      email: null,
      phone: owner.phone,
      avatarUrl: null,
      googleSub: null,
      accountStatus: "verified",
      onboardingCompleted: true,
      createdAt: owner.createdAt.toISOString(),
    };

    // 3. Upload a standard JPEG invitation card (works on Node 18 where globalThis.File is undefined)
    const resJpg = await upload(
      makeUploadRequest(wedding.id, jpgBytes, "wedding-card.jpg", "image/jpeg"),
      wedding.id
    );
    assert.equal(resJpg.status, 201);
    const bodyJpg = await resJpg.json();
    assert.ok(bodyJpg.asset?.id);
    assert.equal(bodyJpg.asset.mime, "image/jpeg");
    assert.equal(bodyJpg.asset.name, "wedding-card.jpg");

    // 4. Upload a PNG saved with a .jpg extension or blank MIME type -> normalized to verified image/png
    const resMisnamed = await upload(
      makeUploadRequest(wedding.id, pngBytes, "whatsapp-card.jpg", "image/jpeg"),
      wedding.id
    );
    assert.equal(resMisnamed.status, 201);
    const bodyMisnamed = await resMisnamed.json();
    assert.equal(bodyMisnamed.asset.mime, "image/png");

    const resBlankMime = await upload(
      makeUploadRequest(wedding.id, pdfWithBom, "invite.pdf", ""),
      wedding.id
    );
    assert.equal(resBlankMime.status, 201);
    const bodyPdf = await resBlankMime.json();
    assert.equal(bodyPdf.asset.mime, "application/pdf");

    // 5. Reject HEIC cleanly with a helpful error message (never misclassified as video/mp4)
    const resHeic = await upload(
      makeUploadRequest(wedding.id, heicBytes, "iphone-card.heic", "image/heic"),
      wedding.id
    );
    assert.equal(resHeic.status, 400);
    const bodyHeic = await resHeic.json();
    assert.match(bodyHeic.error, /HEIC/i);

    // 6. Reject spoofed SVG disguised as image/jpeg
    const resSpoof = await upload(
      makeUploadRequest(wedding.id, svgSpoof, "evil.jpg", "image/jpeg"),
      wedding.id
    );
    assert.equal(resSpoof.status, 400);

    // 7. Reject PDF on photo-only scope
    const resPdfInPhoto = await upload(
      makeUploadRequest(wedding.id, pdfWithBom, "doc.pdf", "application/pdf", "photo"),
      wedding.id
    );
    assert.equal(resPdfInPhoto.status, 400);

    // 8. Host can immediately preview uploaded card before saving setup
    const previewRes = await read(bodyJpg.asset.id);
    assert.equal(previewRes.status, 200);
    assert.equal(previewRes.headers.get("content-type"), "image/jpeg");
    const previewBuf = Buffer.from(await previewRes.arrayBuffer());
    assert.deepEqual(previewBuf, jpgBytes);

    // 9. Unauthenticated viewer cannot read unattached/incomplete card
    activeAuthUser = null;
    const blockedRes = await read(bodyJpg.asset.id);
    assert.equal(blockedRes.status, 404);

    // 10. Save wedding setup with uploaded card -> unauthenticated guest CAN view it
    await updateWedding(wedding.id, owner.id, {
      description: "Join us to celebrate!",
      setup: {
        ...wedding.setup,
        groomName: "Aarav",
        brideName: "Diya",
        card: bodyJpg.asset,
      },
    });
    const publicRes = await read(bodyJpg.asset.id);
    assert.equal(publicRes.status, 200);
    assert.equal(publicRes.headers.get("content-type"), "image/jpeg");

    console.log(
      "Media upload tests passed (Node 18 Blob/File compat, magic-byte normalization, HEIC/SVG rejection, host preview & public read)"
    );
  } finally {
    await prisma.$disconnect();
    cleanupDb();
  }
})().catch((err) => {
  console.error(err);
  cleanupDb();
  process.exit(1);
});

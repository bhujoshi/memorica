import { NextRequest, NextResponse } from "next/server";
import {
  buildWeddingsBackupCookieValue,
  createDatabaseSession,
  getAuthenticatedUserFromCookies,
  SESSION_COOKIE_NAME,
  WEDDINGS_BACKUP_COOKIE_NAME,
} from "@/lib/auth";
import { createWedding, mapWeddingToDTO } from "@/lib/db";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.wedding.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    weddings: rows.map(mapWeddingToDTO),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to create an event." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { eventType, otherEventType, moodTheme, coupleNames, eventTitle, date, endDate, venue, description } =
      body as {
        eventType?: string;
        otherEventType?: string;
        moodTheme?: string;
        coupleNames?: string;
        eventTitle?: string;
        date?: string;
        endDate?: string;
        venue?: string;
        description?: string;
      };

    const wedding = await createWedding({
      ownerUserId: user.id,
      eventType,
      otherEventType,
      moodTheme,
      coupleNames: coupleNames || "",
      eventTitle: eventTitle || "",
      date: date || "",
      endDate: endDate || "",
      venue: venue || "",
      description,
    });

    const { rawToken, expiresAt } = await createDatabaseSession(user.id);
    const backupValue = await buildWeddingsBackupCookieValue(user.id);

    const res = NextResponse.json({ wedding }, { status: 201 });
    res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
    if (backupValue) {
      res.cookies.set(WEDDINGS_BACKUP_COOKIE_NAME, backupValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: expiresAt,
      });
    }

    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create event.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

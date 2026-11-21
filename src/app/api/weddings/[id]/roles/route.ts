import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import {
  inviteEventMember,
  listEventTeam,
  revokeMemberOrInvite,
  updateMemberRole,
} from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await listEventTeam(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load team access.";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("Forbidden") ? 403 : 400 }
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
    const res = await inviteEventMember({
      weddingId: params.id,
      actorUserId: user.id,
      name: String(body.name || ""),
      email: body.email,
      phone: body.phone,
      role: body.role === "co_admin" ? "co_admin" : "close_family",
    });
    const team = await listEventTeam(params.id, user.id);
    return NextResponse.json({ ...res, ...team }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to invite member.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("owner") || message.startsWith("Forbidden") ? 403 : 400 }
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
    await updateMemberRole({
      weddingId: params.id,
      actorUserId: user.id,
      targetUserId: String(body.userId || ""),
      role: body.role,
    });
    const team = await listEventTeam(params.id, user.id);
    return NextResponse.json(team);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update role.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("owner") || message.startsWith("Forbidden") ? 403 : 400 }
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
    const userId = req.nextUrl.searchParams.get("userId") || undefined;
    const inviteId = req.nextUrl.searchParams.get("inviteId") || undefined;
    await revokeMemberOrInvite({
      weddingId: params.id,
      actorUserId: user.id,
      targetUserId: userId,
      inviteId,
    });
    const team = await listEventTeam(params.id, user.id);
    return NextResponse.json(team);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to revoke access.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("owner") || message.startsWith("Forbidden") ? 403 : 400 }
    );
  }
}

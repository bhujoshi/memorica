import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import {
  createBudgetItem,
  deleteBudgetItem,
  getBudgetData,
  updateBudgetItem,
} from "@/lib/organizer";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await getBudgetData(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load budget.";
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
    await createBudgetItem({
      weddingId: params.id,
      userId: user.id,
      category: body.category,
      title: String(body.title || ""),
      estimatedAmount: body.estimatedAmount,
      actualAmount: body.actualAmount,
      paidAmount: body.paidAmount,
      paidBy: body.paidBy,
      paymentStatus: body.paymentStatus,
      dueDate: body.dueDate,
      notes: body.notes,
    });
    const data = await getBudgetData(params.id, user.id);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to add budget item.";
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
    await updateBudgetItem({
      weddingId: params.id,
      userId: user.id,
      itemId: String(body.itemId || ""),
      category: body.category,
      title: body.title,
      estimatedAmount: body.estimatedAmount,
      actualAmount: body.actualAmount,
      paidAmount: body.paidAmount,
      paidBy: body.paidBy,
      paymentStatus: body.paymentStatus,
      dueDate: body.dueDate,
      notes: body.notes,
    });
    const data = await getBudgetData(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update budget item.";
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
    const itemId = req.nextUrl.searchParams.get("itemId") || "";
    await deleteBudgetItem(params.id, user.id, itemId);
    const data = await getBudgetData(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete budget item.";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("Forbidden") ? 403 : 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import {
  createVendorBooking,
  deleteVendorBooking,
  getVendorBookings,
  updateVendorBooking,
} from "@/lib/organizer";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await getVendorBookings(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load vendor bookings.";
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
    await createVendorBooking({
      weddingId: params.id,
      userId: user.id,
      category: body.category,
      vendorName: String(body.vendorName || ""),
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      status: body.status,
      totalAmount: body.totalAmount,
      advancePaid: body.advancePaid,
      balanceDueDate: body.balanceDueDate,
      eventDay: body.eventDay,
      notes: body.notes,
      receiptAssetId: body.receiptAssetId,
    });
    const data = await getVendorBookings(params.id, user.id);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to save booking.";
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
    await updateVendorBooking({
      weddingId: params.id,
      userId: user.id,
      bookingId: String(body.bookingId || ""),
      status: body.status,
      totalAmount: body.totalAmount,
      advancePaid: body.advancePaid,
      balanceDueDate: body.balanceDueDate,
      notes: body.notes,
      receiptAssetId: body.receiptAssetId,
    });
    const data = await getVendorBookings(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update booking.";
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
    const bookingId = req.nextUrl.searchParams.get("bookingId") || "";
    await deleteVendorBooking(params.id, user.id, bookingId);
    const data = await getVendorBookings(params.id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to remove booking.";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("Forbidden") ? 403 : 400 }
    );
  }
}

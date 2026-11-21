import { prisma } from "./prisma";
import { getWeddingAccess } from "./db";
import { VALID_BUDGET_CATEGORIES } from "./format";
import { BudgetItemDTO, VendorBookingDTO } from "./types";

function safeAmount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000_000, Math.round(n));
}

function derivePaymentStatus(
  actual: number,
  estimated: number,
  paid: number,
  requested?: string
): "planned" | "partial" | "paid" {
  if (requested === "paid") return "paid";
  const target = actual > 0 ? actual : estimated;
  if (paid > 0 && target > 0 && paid >= target) return "paid";
  if (paid > 0) return "partial";
  if (requested === "partial") return "partial";
  return "planned";
}

function mapBudgetItem(row: {
  id: string;
  weddingId: string;
  category: string;
  title: string;
  estimatedAmount: number;
  actualAmount: number;
  paidAmount: number;
  paidBy: string | null;
  paymentStatus: string;
  dueDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BudgetItemDTO {
  return {
    id: row.id,
    weddingId: row.weddingId,
    category: row.category,
    title: row.title,
    estimatedAmount: row.estimatedAmount,
    actualAmount: row.actualAmount,
    paidAmount: row.paidAmount,
    paidBy: row.paidBy,
    paymentStatus: (["planned", "partial", "paid"].includes(row.paymentStatus)
      ? row.paymentStatus
      : "planned") as BudgetItemDTO["paymentStatus"],
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getBudgetData(
  weddingId: string,
  userId: string
): Promise<{
  items: BudgetItemDTO[];
  summary: {
    totalEstimated: number;
    totalActual: number;
    totalPaid: number;
    totalPending: number;
    byCategory: Array<{ category: string; estimated: number; actual: number; paid: number }>;
    byContributor: Array<{ contributor: string; paid: number }>;
  };
}> {
  const access = await getWeddingAccess(weddingId, userId);
  if (!access.wedding || !access.canAccessFinances) {
    throw new Error("Forbidden: Only event organizers can access finance & budget records.");
  }

  const rows = await prisma.budgetItem.findMany({
    where: { weddingId: access.wedding.id },
    orderBy: [{ createdAt: "desc" }],
  });
  const items = rows.map(mapBudgetItem);

  let totalEstimated = 0;
  let totalActual = 0;
  let totalPaid = 0;
  const catMap = new Map<string, { estimated: number; actual: number; paid: number }>();
  const contributorMap = new Map<string, number>();

  for (const item of items) {
    totalEstimated += item.estimatedAmount;
    const effective = item.actualAmount > 0 ? item.actualAmount : item.estimatedAmount;
    totalActual += effective;
    totalPaid += item.paidAmount;

    const existing = catMap.get(item.category) || { estimated: 0, actual: 0, paid: 0 };
    existing.estimated += item.estimatedAmount;
    existing.actual += effective;
    existing.paid += item.paidAmount;
    catMap.set(item.category, existing);

    if (item.paidAmount > 0) {
      const who = item.paidBy?.trim() || "Unassigned";
      contributorMap.set(who, (contributorMap.get(who) || 0) + item.paidAmount);
    }
  }

  return {
    items,
    summary: {
      totalEstimated,
      totalActual,
      totalPaid,
      totalPending: Math.max(0, totalActual - totalPaid),
      byCategory: Array.from(catMap.entries())
        .map(([category, vals]) => ({ category, ...vals }))
        .sort((a, b) => b.actual - a.actual),
      byContributor: Array.from(contributorMap.entries())
        .map(([contributor, paid]) => ({ contributor, paid }))
        .sort((a, b) => b.paid - a.paid),
    },
  };
}

export async function createBudgetItem(params: {
  weddingId: string;
  userId: string;
  category?: string;
  title: string;
  estimatedAmount?: number;
  actualAmount?: number;
  paidAmount?: number;
  paidBy?: string | null;
  paymentStatus?: string;
  dueDate?: string | null;
  notes?: string | null;
}): Promise<BudgetItemDTO> {
  const access = await getWeddingAccess(params.weddingId, params.userId);
  if (!access.wedding || !access.canAccessFinances) {
    throw new Error("Forbidden: Only event organizers can manage budgets.");
  }

  const title = params.title.trim().slice(0, 180);
  if (!title) throw new Error("Enter an expense or budget item title.");
  const category =
    params.category && VALID_BUDGET_CATEGORIES.has(params.category)
      ? params.category
      : "other";
  const estimatedAmount = safeAmount(params.estimatedAmount);
  const actualAmount = safeAmount(params.actualAmount);
  const paidAmount = safeAmount(params.paidAmount);
  const dueDate =
    params.dueDate && params.dueDate.trim() ? new Date(params.dueDate) : null;
  if (dueDate && isNaN(dueDate.getTime())) throw new Error("Invalid due date.");

  const created = await prisma.budgetItem.create({
    data: {
      weddingId: access.wedding.id,
      category,
      title,
      estimatedAmount,
      actualAmount,
      paidAmount,
      paidBy: params.paidBy?.trim().slice(0, 100) || null,
      paymentStatus: derivePaymentStatus(
        actualAmount,
        estimatedAmount,
        paidAmount,
        params.paymentStatus
      ),
      dueDate,
      notes: params.notes?.trim().slice(0, 1000) || null,
    },
  });

  return mapBudgetItem(created);
}

export async function updateBudgetItem(params: {
  weddingId: string;
  userId: string;
  itemId: string;
  category?: string;
  title?: string;
  estimatedAmount?: number;
  actualAmount?: number;
  paidAmount?: number;
  paidBy?: string | null;
  paymentStatus?: string;
  dueDate?: string | null;
  notes?: string | null;
}): Promise<BudgetItemDTO> {
  const access = await getWeddingAccess(params.weddingId, params.userId);
  if (!access.wedding || !access.canAccessFinances) {
    throw new Error("Forbidden: Only event organizers can edit budgets.");
  }
  const existing = await prisma.budgetItem.findFirst({
    where: { id: params.itemId, weddingId: access.wedding.id },
  });
  if (!existing) throw new Error("Budget item not found.");

  const estimatedAmount =
    params.estimatedAmount !== undefined
      ? safeAmount(params.estimatedAmount)
      : existing.estimatedAmount;
  const actualAmount =
    params.actualAmount !== undefined
      ? safeAmount(params.actualAmount)
      : existing.actualAmount;
  const paidAmount =
    params.paidAmount !== undefined
      ? safeAmount(params.paidAmount)
      : existing.paidAmount;
  const dueDate =
    params.dueDate === undefined
      ? existing.dueDate
      : params.dueDate && params.dueDate.trim()
      ? new Date(params.dueDate)
      : null;
  if (dueDate && isNaN(dueDate.getTime())) throw new Error("Invalid due date.");

  const updated = await prisma.budgetItem.update({
    where: { id: existing.id },
    data: {
      ...(params.category && VALID_BUDGET_CATEGORIES.has(params.category)
        ? { category: params.category }
        : {}),
      ...(params.title !== undefined && params.title.trim()
        ? { title: params.title.trim().slice(0, 180) }
        : {}),
      estimatedAmount,
      actualAmount,
      paidAmount,
      ...(params.paidBy !== undefined
        ? { paidBy: params.paidBy?.trim().slice(0, 100) || null }
        : {}),
      paymentStatus: derivePaymentStatus(
        actualAmount,
        estimatedAmount,
        paidAmount,
        params.paymentStatus
      ),
      dueDate,
      ...(params.notes !== undefined
        ? { notes: params.notes?.trim().slice(0, 1000) || null }
        : {}),
    },
  });

  return mapBudgetItem(updated);
}

export async function deleteBudgetItem(
  weddingId: string,
  userId: string,
  itemId: string
): Promise<void> {
  const access = await getWeddingAccess(weddingId, userId);
  if (!access.wedding || !access.canAccessFinances) {
    throw new Error("Forbidden: Only event organizers can delete budget items.");
  }
  await prisma.budgetItem.deleteMany({
    where: { id: itemId, weddingId: access.wedding.id },
  });
}

const VALID_BOOKING_STATUSES = new Set([
  "shortlisted",
  "booked",
  "advance_paid",
  "fully_paid",
  "cancelled",
]);

function mapBooking(row: {
  id: string;
  weddingId: string;
  category: string;
  vendorName: string;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  totalAmount: number;
  advancePaid: number;
  balanceDueDate: Date | null;
  eventDay: string | null;
  notes: string | null;
  receiptAssetId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): VendorBookingDTO {
  return {
    id: row.id,
    weddingId: row.weddingId,
    category: row.category,
    vendorName: row.vendorName,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    status: (VALID_BOOKING_STATUSES.has(row.status)
      ? row.status
      : "shortlisted") as VendorBookingDTO["status"],
    totalAmount: row.totalAmount,
    advancePaid: row.advancePaid,
    balanceDueDate: row.balanceDueDate ? row.balanceDueDate.toISOString() : null,
    eventDay: row.eventDay,
    notes: row.notes,
    receiptAssetId: row.receiptAssetId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getVendorBookings(
  weddingId: string,
  userId: string
): Promise<{
  bookings: VendorBookingDTO[];
  summary: {
    totalVendors: number;
    confirmedCount: number;
    totalContracted: number;
    totalAdvancePaid: number;
    totalBalanceDue: number;
  };
}> {
  const access = await getWeddingAccess(weddingId, userId);
  if (!access.wedding || !access.canAccessFinances) {
    throw new Error("Forbidden: Only event organizers can view vendor bookings.");
  }

  const rows = await prisma.vendorBooking.findMany({
    where: { weddingId: access.wedding.id },
    orderBy: [{ createdAt: "desc" }],
  });
  const bookings = rows.map(mapBooking);

  const active = bookings.filter((b) => b.status !== "cancelled");
  const totalContracted = active.reduce((s, b) => s + b.totalAmount, 0);
  const totalAdvancePaid = active.reduce((s, b) => s + b.advancePaid, 0);

  return {
    bookings,
    summary: {
      totalVendors: active.length,
      confirmedCount: active.filter((b) =>
        ["booked", "advance_paid", "fully_paid"].includes(b.status)
      ).length,
      totalContracted,
      totalAdvancePaid,
      totalBalanceDue: Math.max(0, totalContracted - totalAdvancePaid),
    },
  };
}

export async function createVendorBooking(params: {
  weddingId: string;
  userId: string;
  category?: string;
  vendorName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  status?: string;
  totalAmount?: number;
  advancePaid?: number;
  balanceDueDate?: string | null;
  eventDay?: string | null;
  notes?: string | null;
  receiptAssetId?: string | null;
}): Promise<VendorBookingDTO> {
  const access = await getWeddingAccess(params.weddingId, params.userId);
  if (!access.wedding || !access.canAccessFinances) {
    throw new Error("Forbidden: Only event organizers can manage vendor bookings.");
  }

  const vendorName = params.vendorName.trim().slice(0, 180);
  if (!vendorName) throw new Error("Enter the vendor or venue name.");
  const category =
    params.category && VALID_BUDGET_CATEGORIES.has(params.category)
      ? params.category
      : "other";
  const status =
    params.status && VALID_BOOKING_STATUSES.has(params.status)
      ? params.status
      : "shortlisted";
  const totalAmount = safeAmount(params.totalAmount);
  const advancePaid = safeAmount(params.advancePaid);
  const balanceDueDate =
    params.balanceDueDate && params.balanceDueDate.trim()
      ? new Date(params.balanceDueDate)
      : null;
  if (balanceDueDate && isNaN(balanceDueDate.getTime())) {
    throw new Error("Choose a valid balance due date.");
  }

  let receiptAssetId: string | null = null;
  if (params.receiptAssetId) {
    const asset = await prisma.eventAsset.findFirst({
      where: { id: params.receiptAssetId, weddingId: access.wedding.id },
    });
    if (!asset) throw new Error("Attached receipt not found for this event.");
    receiptAssetId = asset.id;
  }

  const created = await prisma.vendorBooking.create({
    data: {
      weddingId: access.wedding.id,
      category,
      vendorName,
      contactName: params.contactName?.trim().slice(0, 120) || null,
      contactPhone: params.contactPhone?.trim().slice(0, 40) || null,
      status,
      totalAmount,
      advancePaid,
      balanceDueDate,
      eventDay: params.eventDay?.trim().slice(0, 80) || null,
      notes: params.notes?.trim().slice(0, 1500) || null,
      receiptAssetId,
    },
  });

  return mapBooking(created);
}

export async function updateVendorBooking(params: {
  weddingId: string;
  userId: string;
  bookingId: string;
  status?: string;
  totalAmount?: number;
  advancePaid?: number;
  balanceDueDate?: string | null;
  notes?: string | null;
  receiptAssetId?: string | null;
}): Promise<VendorBookingDTO> {
  const access = await getWeddingAccess(params.weddingId, params.userId);
  if (!access.wedding || !access.canAccessFinances) {
    throw new Error("Forbidden: Only event organizers can edit vendor bookings.");
  }
  const existing = await prisma.vendorBooking.findFirst({
    where: { id: params.bookingId, weddingId: access.wedding.id },
  });
  if (!existing) throw new Error("Booking record not found.");

  const balanceDueDate =
    params.balanceDueDate === undefined
      ? existing.balanceDueDate
      : params.balanceDueDate && params.balanceDueDate.trim()
      ? new Date(params.balanceDueDate)
      : null;
  if (balanceDueDate && isNaN(balanceDueDate.getTime())) {
    throw new Error("Choose a valid balance due date.");
  }

  let receiptAssetId = existing.receiptAssetId;
  if (params.receiptAssetId !== undefined) {
    if (!params.receiptAssetId) {
      receiptAssetId = null;
    } else {
      const asset = await prisma.eventAsset.findFirst({
        where: { id: params.receiptAssetId, weddingId: access.wedding.id },
      });
      if (!asset) throw new Error("Attached receipt not found.");
      receiptAssetId = asset.id;
    }
  }

  const updated = await prisma.vendorBooking.update({
    where: { id: existing.id },
    data: {
      ...(params.status && VALID_BOOKING_STATUSES.has(params.status)
        ? { status: params.status }
        : {}),
      ...(params.totalAmount !== undefined
        ? { totalAmount: safeAmount(params.totalAmount) }
        : {}),
      ...(params.advancePaid !== undefined
        ? { advancePaid: safeAmount(params.advancePaid) }
        : {}),
      balanceDueDate,
      ...(params.notes !== undefined
        ? { notes: params.notes?.trim().slice(0, 1500) || null }
        : {}),
      receiptAssetId,
    },
  });

  return mapBooking(updated);
}

export async function deleteVendorBooking(
  weddingId: string,
  userId: string,
  bookingId: string
): Promise<void> {
  const access = await getWeddingAccess(weddingId, userId);
  if (!access.wedding || !access.canAccessFinances) {
    throw new Error("Forbidden: Only event organizers can delete vendor bookings.");
  }
  await prisma.vendorBooking.deleteMany({
    where: { id: bookingId, weddingId: access.wedding.id },
  });
}

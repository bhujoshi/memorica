"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Phone,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import DateInput from "@/components/DateInput";
import {
  BUDGET_CATEGORIES,
  budgetCategoryLabel,
  formatINR,
  formatShortDate,
} from "@/lib/format";
import { VendorBookingDTO, encodeUserHintHeader } from "@/lib/types";

const STATUS_OPTIONS: Array<{
  id: VendorBookingDTO["status"];
  label: string;
}> = [
  { id: "shortlisted", label: "Shortlisted" },
  { id: "booked", label: "Booked" },
  { id: "advance_paid", label: "Advance Paid" },
  { id: "fully_paid", label: "Fully Paid" },
  { id: "cancelled", label: "Cancelled" },
];

export default function VendorBookingsManager({
  weddingId,
}: {
  weddingId: string;
}) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<VendorBookingDTO[]>([]);
  const [summary, setSummary] = useState({
    totalVendors: 0,
    confirmedCount: 0,
    totalContracted: 0,
    totalAdvancePaid: 0,
    totalBalanceDue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");

  const [category, setCategory] = useState("venue");
  const [vendorName, setVendorName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState<VendorBookingDTO["status"]>("booked");
  const [totalAmount, setTotalAmount] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");
  const [balanceDueDate, setBalanceDueDate] = useState("");
  const [eventDay, setEventDay] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptAssetId, setReceiptAssetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/bookings`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load vendor bookings.");
      setBookings(data.bookings || []);
      if (data.summary) setSummary(data.summary);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [weddingId, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/weddings/${weddingId}/media?scope=receipt`, {
        method: "POST",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setReceiptAssetId(data.asset.id);
      setNotice(`Attached receipt/contract: ${data.asset.name}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not upload receipt.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !vendorName.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(`/api/weddings/${weddingId}/bookings`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          category,
          vendorName,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          status,
          totalAmount: Number(totalAmount || 0),
          advancePaid: Number(advancePaid || 0),
          balanceDueDate: balanceDueDate || undefined,
          eventDay: eventDay || undefined,
          notes: notes || undefined,
          receiptAssetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save booking.");
      setBookings(data.bookings || []);
      if (data.summary) setSummary(data.summary);
      setVendorName("");
      setContactName("");
      setContactPhone("");
      setTotalAmount("");
      setAdvancePaid("");
      setBalanceDueDate("");
      setEventDay("");
      setNotes("");
      setReceiptAssetId(null);
      setShowForm(false);
      setNotice("Vendor booking saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save booking.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(bookingId: string, nextStatus: VendorBookingDTO["status"]) {
    const res = await fetch(`/api/weddings/${weddingId}/bookings`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...encodeUserHintHeader(user),
      },
      body: JSON.stringify({ bookingId, status: nextStatus }),
    });
    if (res.ok) {
      const data = await res.json();
      setBookings(data.bookings || []);
      if (data.summary) setSummary(data.summary);
    }
  }

  async function handleDelete(bookingId: string) {
    const res = await fetch(
      `/api/weddings/${weddingId}/bookings?bookingId=${encodeURIComponent(bookingId)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      }
    );
    if (res.ok) {
      const data = await res.json();
      setBookings(data.bookings || []);
      if (data.summary) setSummary(data.summary);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Loading vendor &amp; booking records...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Booking KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-[11px] text-stone-500">Active Vendors</div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900 tabular-nums mt-1">
            {summary.totalVendors}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {summary.confirmedCount} confirmed
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-[11px] text-stone-500">Total Contracted</div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900 tabular-nums mt-1">
            {formatINR(summary.totalContracted)}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="text-[11px] font-semibold text-emerald-800">Advance Paid</div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-emerald-950 tabular-nums mt-1">
            {formatINR(summary.totalAdvancePaid)}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="text-[11px] font-semibold text-amber-900">Balance Due</div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-amber-950 tabular-nums mt-1">
            {formatINR(summary.totalBalanceDue)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-stone-900">
            Vendor Directory &amp; Booking Records ({bookings.length})
          </h2>
          <p className="text-xs text-stone-500">
            Keep contacts, ceremony assignments, payment milestones, and contracts/receipts together.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 shrink-0"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Close" : "Add Booking"}
        </button>
      </div>

      {notice && (
        <p role="status" className="text-xs font-medium text-emerald-800">
          {notice}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-stone-700">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
              >
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Vendor / Venue Name *
              <input
                type="text"
                required
                placeholder="e.g. Royal Jaipur Caterers"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Booking Status
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as VendorBookingDTO["status"])
                }
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-stone-700">
              Contact Person
              <input
                type="text"
                placeholder="e.g. Rajesh Verma"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Phone / WhatsApp
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Ceremony / Function
              <input
                type="text"
                placeholder="e.g. Sangeet & Wedding"
                value={eventDay}
                onChange={(e) => setEventDay(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-stone-700">
              Total Quote (₹)
              <input
                type="number"
                min={0}
                placeholder="450000"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Advance Paid (₹)
              <input
                type="number"
                min={0}
                placeholder="100000"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Balance Due Date
              <DateInput
                type="date"
                value={balanceDueDate}
                onChange={(e) => setBalanceDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <label className="text-xs font-semibold text-stone-700">
              Booking Notes / Terms
              <input
                type="text"
                placeholder="Includes 500 plates, live chaat counter..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50">
                <Upload className="h-4 w-4 text-rose-700" />
                {uploading
                  ? "Uploading..."
                  : receiptAssetId
                  ? "Receipt Attached ✓"
                  : "Attach Quote / Receipt"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={uploading || busy}
                  onChange={handleReceiptUpload}
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                disabled={busy || uploading}
                className="rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save Booking"}
              </button>
            </div>
          </div>
        </form>
      )}

      {bookings.length === 0 ? (
        <div className="celebration-empty">
          <img
            src="/illustrations/organizer-hub.jpg"
            alt="Event planning vignette with fairy-light floral arch, camera, celebration gifts, and notebook"
            className="mx-auto mb-3 h-40 w-auto object-contain mix-blend-multiply"
          />
          <h3>No vendor bookings recorded yet</h3>
          <p>
            Save your venue, caterer, photographer, makeup artist, decorator, and contract PDFs in one place.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookings.map((b) => {
            const balance = Math.max(0, b.totalAmount - b.advancePaid);
            const pct =
              b.totalAmount > 0
                ? Math.min(100, Math.round((b.advancePaid / b.totalAmount) * 100))
                : 0;
            return (
              <article
                key={b.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
                        {budgetCategoryLabel(b.category)}
                      </span>
                      {b.eventDay && (
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                          {b.eventDay}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-lg font-bold text-stone-900 mt-1">
                      {b.vendorName}
                    </h3>
                    {(b.contactName || b.contactPhone) && (
                      <div className="text-xs text-stone-600 mt-0.5 flex flex-wrap items-center gap-2">
                        {b.contactName && <span>{b.contactName}</span>}
                        {b.contactPhone && (
                          <a
                            href={`tel:${b.contactPhone}`}
                            className="inline-flex items-center gap-1 font-semibold text-rose-700 underline"
                          >
                            <Phone className="h-3 w-3" />
                            {b.contactPhone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(b.id)}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove booking"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="font-semibold text-emerald-800">
                      Paid: {formatINR(b.advancePaid)}
                    </span>
                    <span className="text-stone-600">
                      Total: {formatINR(b.totalAmount)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {balance > 0 && (
                    <div className="text-[11px] text-amber-800 font-medium">
                      Balance due: {formatINR(balance)}
                      {b.balanceDueDate && ` by ${formatShortDate(b.balanceDueDate)}`}
                    </div>
                  )}
                </div>

                {b.notes && <p className="text-xs text-stone-600">{b.notes}</p>}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                  <select
                    aria-label={`Status for ${b.vendorName}`}
                    value={b.status}
                    onChange={(e) =>
                      updateStatus(b.id, e.target.value as VendorBookingDTO["status"])
                    }
                    className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {b.receiptAssetId && (
                    <a
                      href={`/api/media/${b.receiptAssetId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View Receipt / Contract
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

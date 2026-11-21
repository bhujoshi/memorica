"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, IndianRupee, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import DateInput from "@/components/DateInput";
import {
  BUDGET_CATEGORIES,
  budgetCategoryLabel,
  formatINR,
  formatShortDate,
} from "@/lib/format";
import { BudgetItemDTO, encodeUserHintHeader } from "@/lib/types";

interface BudgetSummary {
  totalEstimated: number;
  totalActual: number;
  totalPaid: number;
  totalPending: number;
  byCategory: Array<{ category: string; estimated: number; actual: number; paid: number }>;
  byContributor: Array<{ contributor: string; paid: number }>;
}

export default function FinancePlanner({ weddingId }: { weddingId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<BudgetItemDTO[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({
    totalEstimated: 0,
    totalActual: 0,
    totalPaid: 0,
    totalPending: 0,
    byCategory: [],
    byContributor: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [category, setCategory] = useState<string>("venue");
  const [title, setTitle] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/budget`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load finance planner.");
      setItems(data.items || []);
      if (data.summary) setSummary(data.summary);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load budget.");
    } finally {
      setLoading(false);
    }
  }, [weddingId, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(`/api/weddings/${weddingId}/budget`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          category,
          title,
          estimatedAmount: Number(estimatedAmount || 0),
          actualAmount: Number(actualAmount || 0),
          paidAmount: Number(paidAmount || 0),
          paidBy: paidBy || undefined,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add expense.");
      setItems(data.items || []);
      if (data.summary) setSummary(data.summary);
      setTitle("");
      setEstimatedAmount("");
      setActualAmount("");
      setPaidAmount("");
      setPaidBy("");
      setDueDate("");
      setNotes("");
      setShowForm(false);
      setNotice("Budget item saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not add expense.");
    } finally {
      setBusy(false);
    }
  }

  async function markFullyPaid(item: BudgetItemDTO) {
    const target = item.actualAmount > 0 ? item.actualAmount : item.estimatedAmount;
    const res = await fetch(`/api/weddings/${weddingId}/budget`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...encodeUserHintHeader(user),
      },
      body: JSON.stringify({
        itemId: item.id,
        paidAmount: target,
        paymentStatus: "paid",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      if (data.summary) setSummary(data.summary);
    }
  }

  async function handleDelete(itemId: string) {
    const res = await fetch(
      `/api/weddings/${weddingId}/budget?itemId=${encodeURIComponent(itemId)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      }
    );
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      if (data.summary) setSummary(data.summary);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Loading finance &amp; budget tracker...
      </div>
    );
  }

  const paidPct =
    summary.totalActual > 0
      ? Math.min(100, Math.round((summary.totalPaid / summary.totalActual) * 100))
      : 0;

  return (
    <div className="space-y-5">
      {/* INR Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-[11px] font-medium text-stone-500">Planned Estimate</div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900 tabular-nums mt-1">
            {formatINR(summary.totalEstimated)}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-[11px] font-medium text-stone-500">Total Committed</div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900 tabular-nums mt-1">
            {formatINR(summary.totalActual)}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="text-[11px] font-semibold text-emerald-800">Paid So Far</div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-emerald-950 tabular-nums mt-1">
            {formatINR(summary.totalPaid)}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="text-[11px] font-semibold text-amber-900">Balance Pending</div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-amber-950 tabular-nums mt-1">
            {formatINR(summary.totalPending)}
          </div>
        </div>
      </div>

      {/* Overall Paid Progress + Category & Contributor Breakdown */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-stone-700">Category Spend Breakdown</span>
              <span className="text-emerald-700">{paidPct}% paid overall</span>
            </div>
            <div className="space-y-2.5">
              {summary.byCategory.map((cat) => {
                const catPct =
                  cat.actual > 0 ? Math.min(100, Math.round((cat.paid / cat.actual) * 100)) : 0;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-stone-800">
                        {budgetCategoryLabel(cat.category)}
                      </span>
                      <span className="tabular-nums text-stone-600">
                        {formatINR(cat.paid)} / {formatINR(cat.actual)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${catPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Family Contributor Splits (Paid)
            </h3>
            {summary.byContributor.length === 0 ? (
              <p className="text-xs text-stone-500">
                Record who paid an expense (e.g. Groom&apos;s Family, Bride&apos;s Family, Couple) to track family contributions automatically.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.byContributor.map((c) => (
                  <div
                    key={c.contributor}
                    className="flex items-center justify-between rounded-xl bg-stone-50 border border-stone-200/70 px-3.5 py-2.5 text-xs"
                  >
                    <span className="font-semibold text-stone-800">
                      {c.contributor}
                    </span>
                    <span className="font-bold text-emerald-800 tabular-nums">
                      {formatINR(c.paid)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Add Budget Item Bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-stone-900">
            Expenses &amp; Budget Ledger ({items.length})
          </h2>
          <p className="text-xs text-stone-500">
            Private to Owner &amp; Co-Admins. Track every rupee cleanly in INR (₹).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 shrink-0"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Close" : "Add Expense"}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              Item / Expense Title *
              <input
                type="text"
                required
                placeholder="e.g. Udaipur Mandap Floral Decor"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-stone-700">
              Estimated (₹)
              <input
                type="number"
                min={0}
                placeholder="250000"
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Final / Actual Quote (₹)
              <input
                type="number"
                min={0}
                placeholder="240000"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Paid So Far (₹)
              <input
                type="number"
                min={0}
                placeholder="50000"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-stone-700">
              Paid By / Contributor
              <input
                type="text"
                placeholder="e.g. Groom's Family"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Next Payment Due Date
              <DateInput
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
              Notes
              <input
                type="text"
                placeholder="UPI ref, milestones, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save Budget Item"}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="celebration-empty">
          <img
            src="/illustrations/organizer-hub.jpg"
            alt="Fairy-light floral arch, camera, gift boxes, lantern, and celebration planning notebook"
            className="mx-auto mb-3 h-40 w-auto object-contain mix-blend-multiply"
          />
          <h3>Start your celebration budget</h3>
          <p>
            Track estimates, final quotes, advance payments, and family splits in ₹ INR.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-sm">
          {items.map((item) => {
            const effective =
              item.actualAmount > 0 ? item.actualAmount : item.estimatedAmount;
            const pending = Math.max(0, effective - item.paidAmount);
            return (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-stone-900">
                      {item.title}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-semibold text-stone-600">
                      {budgetCategoryLabel(item.category)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        item.paymentStatus === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.paymentStatus === "partial"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {item.paymentStatus}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 tabular-nums">
                    <span className="inline-flex items-center gap-0.5 font-semibold text-stone-900">
                      <IndianRupee className="h-3 w-3" />
                      Committed: {formatINR(effective)}
                    </span>
                    <span className="text-emerald-700 font-medium">
                      Paid: {formatINR(item.paidAmount)}
                    </span>
                    {pending > 0 && (
                      <span className="text-amber-800 font-medium">
                        Pending: {formatINR(pending)}
                      </span>
                    )}
                    {item.paidBy && <span>By: {item.paidBy}</span>}
                    {item.dueDate && <span>Due: {formatShortDate(item.dueDate)}</span>}
                  </div>
                  {item.notes && (
                    <p className="text-xs text-stone-500">{item.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.paymentStatus !== "paid" && effective > 0 && (
                    <button
                      type="button"
                      onClick={() => markFullyPaid(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Paid
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

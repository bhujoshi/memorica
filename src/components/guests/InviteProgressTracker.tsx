"use client";

import React from "react";
import { CheckCircle2, Clock, Users } from "lucide-react";
import { GuestDTO } from "@/lib/types";
import { GUEST_GROUPS, GuestGroupId } from "@/lib/format";

export default function InviteProgressTracker({
  guests,
  activeGroup,
  onSelectGroup,
  onQuickFilterRemaining,
}: {
  guests: GuestDTO[];
  activeGroup: GuestGroupId | "all";
  onSelectGroup: (group: GuestGroupId | "all") => void;
  onQuickFilterRemaining: () => void;
}) {
  const total = guests.length;
  const invited = guests.filter((g) => g.invitationStatus !== "not_shared").length;
  const remaining = total - invited;
  const pct = total > 0 ? Math.round((invited / total) * 100) : 0;

  const totalHeadcount = guests.reduce(
    (sum, g) => sum + Math.max(1, g.partySize || 1),
    0
  );
  const confirmedHeadcount = guests
    .filter((g) => g.rsvpStatus === "yes")
    .reduce((sum, g) => sum + Math.max(1, g.partySize || 1), 0);
  const withPlannedDates = guests.filter((g) => Boolean(g.plannedArrival)).length;

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700">
            Invite Planning Tracker
          </p>
          <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900">
            {total === 0
              ? "Build your celebration guest list"
              : remaining === 0
              ? "Everyone on your list has been invited!"
              : `${remaining} guest${remaining === 1 ? "" : "s"} remaining to invite`}
          </h2>
        </div>
        {remaining > 0 && (
          <button
            type="button"
            onClick={onQuickFilterRemaining}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition self-start sm:self-auto"
          >
            <Clock className="h-3.5 w-3.5" />
            Show {remaining} Remaining
          </button>
        )}
      </div>

      {/* Invited vs Remaining Meter */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {invited} Already Invited ({pct}%)
          </span>
          <span className="text-amber-800">{remaining} Remaining (Not Yet Invited)</span>
        </div>
        <div
          role="progressbar"
          aria-label="Invitations sent progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2.5 w-full overflow-hidden rounded-full bg-white border border-rose-200"
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Headcount & Planned Dates Strip */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-white border border-stone-200/80 px-3 py-2">
          <div className="text-[11px] text-stone-500">Planned Headcount</div>
          <div className="font-bold text-stone-900 tabular-nums mt-0.5 flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-rose-700" />
            {totalHeadcount} people
          </div>
        </div>
        <div className="rounded-xl bg-white border border-emerald-200/80 px-3 py-2">
          <div className="text-[11px] text-emerald-700">Confirmed Coming</div>
          <div className="font-bold text-emerald-900 tabular-nums mt-0.5">
            {confirmedHeadcount} people
          </div>
        </div>
        <div className="rounded-xl bg-white border border-amber-200/80 px-3 py-2">
          <div className="text-[11px] text-amber-800">Shared Travel Dates</div>
          <div className="font-bold text-amber-950 tabular-nums mt-0.5">
            {withPlannedDates} guests
          </div>
        </div>
      </div>

      {/* Indian Family Side / Circle Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => onSelectGroup("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            activeGroup === "all"
              ? "bg-rose-700 text-white"
              : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
          }`}
        >
          All Circles ({total})
        </button>
        {GUEST_GROUPS.map((grp) => {
          const count = guests.filter((g) => g.guestGroup === grp.id).length;
          if (count === 0 && activeGroup !== grp.id) return null;
          return (
            <button
              key={grp.id}
              type="button"
              onClick={() => onSelectGroup(grp.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeGroup === grp.id
                  ? "bg-rose-700 text-white"
                  : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              {grp.label} ({count})
            </button>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Crown, HeartHandshake, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import CountryPhoneInput from "@/components/CountryPhoneInput";
import { RoleInviteDTO, TeamMemberDTO, encodeUserHintHeader } from "@/lib/types";

export default function TeamAccessManager({
  weddingId,
}: {
  weddingId: string;
}) {
  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<TeamMemberDTO[]>([]);
  const [invites, setInvites] = useState<RoleInviteDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"co_admin" | "close_family">("close_family");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/roles`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load team access.");
      setIsOwner(Boolean(data.isOwner));
      setMembers(data.members || []);
      setInvites(data.invites || []);
      if (!data.isOwner) setRole("close_family");
    } catch (e) {
      setError(true);
      setNotice(e instanceof Error ? e.message : "Could not load team access.");
    } finally {
      setLoading(false);
    }
  }, [weddingId, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError(false);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/roles`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          role: isOwner ? role : "close_family",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add member.");
      setMembers(data.members || []);
      setInvites(data.invites || []);
      setName("");
      setEmail("");
      setPhone("");
      setNotice(
        data.activatedImmediately
          ? "Access granted immediately! Their account is already on Memorica."
          : "Access invite saved! It will activate automatically as soon as they verify this email or phone."
      );
    } catch (err) {
      setError(true);
      setNotice(err instanceof Error ? err.message : "Failed to invite member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(
    targetUserId: string,
    nextRole: "co_admin" | "close_family"
  ) {
    setBusy(true);
    setNotice("");
    setError(false);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/roles`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({ userId: targetUserId, role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update role.");
      setMembers(data.members || []);
      setNotice("Member role updated.");
    } catch (err) {
      setError(true);
      setNotice(err instanceof Error ? err.message : "Could not update role.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(opts: { userId?: string; inviteId?: string }) {
    setBusy(true);
    setNotice("");
    setError(false);
    try {
      const query = new URLSearchParams();
      if (opts.userId) query.set("userId", opts.userId);
      if (opts.inviteId) query.set("inviteId", opts.inviteId);
      const res = await fetch(`/api/weddings/${weddingId}/roles?${query}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not revoke access.");
      setMembers(data.members || []);
      setInvites(data.invites || []);
      setNotice("Access updated.");
    } catch (err) {
      setError(true);
      setNotice(err instanceof Error ? err.message : "Could not revoke access.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Loading family &amp; organizer access...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Co-Admin (Family Organizer)
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            Full planning access: manage guest lists, share invitations, track budgets
            (₹) &amp; vendor bookings, publish updates, and join the Close Family room.
            Cannot delete the event.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <HeartHandshake className="h-4 w-4 text-amber-700" />
            Close Family (Inner Circle)
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            Private access to the Close Family Planning Room (live polls &amp; voting,
            family discussions, shared checklists) plus the Celebration Social Page.
            Does not see finance or booking records.
          </p>
        </div>
      </div>

      {/* Add Co-Admin / Close Family Form */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-stone-900">
              Add Family Co-Admin or Close Family Member
            </h2>
            <p className="text-xs text-stone-500">
              Enter their email or +91 mobile number so everyone stays on the same page.
            </p>
          </div>
        </div>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rohan Sharma (Groom's Brother)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-rose-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Access Level *
              </label>
              <select
                value={isOwner ? role : "close_family"}
                onChange={(e) =>
                  setRole(e.target.value as "co_admin" | "close_family")
                }
                disabled={!isOwner}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm focus:border-rose-600 focus:outline-none"
              >
                <option value="close_family">
                  Close Family (Private Planning Room &amp; Voting)
                </option>
                {isOwner && (
                  <option value="co_admin">
                    Co-Admin (Full Organizer, Guests, Budget &amp; Bookings)
                  </option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="rohan@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-rose-600 focus:outline-none"
              />
            </div>
            <CountryPhoneInput
              label="Mobile Number (Optional if email given)"
              value={phone}
              onChange={setPhone}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-stone-500">
              When they sign in with this email or mobile number, their access activates automatically.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Grant Access"}
            </button>
          </div>
          {notice && (
            <p
              role={error ? "alert" : "status"}
              className={`text-xs font-medium ${
                error ? "text-red-700" : "text-emerald-800"
              }`}
            >
              {notice}
            </p>
          )}
        </form>
      </section>

      {/* Active Team & Close Family List */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-serif text-lg font-bold text-stone-900">
          Active Organizers &amp; Close Family ({members.length})
        </h3>
        <div className="divide-y divide-stone-100">
          {members.map((m) => (
            <div
              key={m.userId}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-stone-900">{m.name}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      m.role === "owner"
                        ? "bg-rose-100 text-rose-800"
                        : m.role === "co_admin"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {m.role === "owner" && <Crown className="h-3 w-3" />}
                    {m.role === "owner"
                      ? "Owner"
                      : m.role === "co_admin"
                      ? "Co-Admin"
                      : "Close Family"}
                  </span>
                </div>
                <div className="text-xs text-stone-500">
                  {[m.email, m.phone].filter(Boolean).join(" • ")}
                </div>
              </div>

              {m.role !== "owner" && (isOwner || m.role === "close_family") && (
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <select
                      aria-label={`Change role for ${m.name}`}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) =>
                        handleRoleChange(
                          m.userId,
                          e.target.value as "co_admin" | "close_family"
                        )
                      }
                      className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700"
                    >
                      <option value="co_admin">Co-Admin</option>
                      <option value="close_family">Close Family</option>
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRevoke({ userId: m.userId })}
                    className="rounded-lg border border-stone-200 p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove access"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {invites.length > 0 && (
          <div className="pt-4 border-t border-stone-100 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Pending Invites — Waiting for Sign-In ({invites.length})
            </h4>
            <div className="divide-y divide-stone-100">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-800">
                        {inv.name}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-600">
                        {inv.role === "co_admin" ? "Co-Admin" : "Close Family"} · Pending
                      </span>
                    </div>
                    <div className="text-xs text-stone-500">
                      {[inv.email, inv.phone].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  {(isOwner || inv.role === "close_family") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRevoke({ inviteId: inv.id })}
                      className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

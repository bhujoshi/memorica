"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  EventUpdateDTO,
  GuestDTO,
  WeddingDTO,
  encodeUserHintHeader,
  formatWeddingDateRange,
} from "@/lib/types";
import {
  ArrowLeft,
  Bell,
  Calendar,
  Lock,
  MapPin,
  Pin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";

export default function GuestEventUpdatesPage() {
  const params = useParams<{ slug: string }>();
  const { user, openAuthModal } = useAuth();

  const [wedding, setWedding] = useState<WeddingDTO | null>(null);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [guestRecord, setGuestRecord] = useState<GuestDTO | null>(null);
  const [updates, setUpdates] = useState<EventUpdateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<
    "AUTH_REQUIRED" | "FORBIDDEN_NOT_INVITED" | "NOT_FOUND" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/weddings/${params.slug}/updates`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          ...encodeUserHintHeader(user),
        },
      });
      const data = await res.json();

      if (res.status === 401) {
        setErrorCode("AUTH_REQUIRED");
        setErrorMessage(data.error);
        return;
      }
      if (res.status === 403) {
        setErrorCode("FORBIDDEN_NOT_INVITED");
        setErrorMessage(data.error);
        if (data.weddingSummary) {
          setWedding(data.weddingSummary);
        }
        return;
      }
      if (!res.ok) {
        setErrorCode("NOT_FOUND");
        setErrorMessage(data.error || "Wedding not found");
        return;
      }

      setWedding(data.wedding);
      setRole(data.role);
      setGuestRecord(data.guestRecord || null);
      setUpdates(data.updates || []);
    } catch {
      setErrorCode("NOT_FOUND");
      setErrorMessage("Failed to load live updates.");
    } finally {
      setLoading(false);
    }
  }, [params.slug]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates, user?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-700" />
        <p className="text-sm text-stone-600">Loading live wedding updates...</p>
      </div>
    );
  }

  if (errorCode === "AUTH_REQUIRED") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Sign in to View Live Updates
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            {errorMessage ||
              "Live wedding updates are private to verified guests and the event host. Please verify your email or phone number to continue."}
          </p>

          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={() =>
                openAuthModal({
                  title: "Verify Account for Live Wedding Updates",
                })
              }
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 transition"
            >
              Sign In / Verify Account
            </button>

            <Link
              href={`/invite/${params.slug}`}
              className="block w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
            >
              ← View Invitation & Submit RSVP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (errorCode === "FORBIDDEN_NOT_INVITED") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Private Event Updates
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Your signed-in account (
            <strong className="text-stone-900">
              {user?.email || user?.phone}
            </strong>
            ) is not currently linked to an invitation for{" "}
            <strong>{wedding?.coupleNames || "this wedding"}</strong>. Live
            updates are only visible to invited guests and the event host.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2.5">
            <Link
              href={`/invite/${params.slug}`}
              className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-800 transition"
            >
              Open Invitation & RSVP
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
            >
              Back to My Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (errorCode === "NOT_FOUND" || !wedding) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 space-y-3">
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Wedding Event Not Found
          </h1>
          <p className="text-xs text-stone-500">{errorMessage}</p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto max-w-3xl px-4 py-8 space-y-6 mood-${
        wedding.moodTheme || "emerald"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/invite/${wedding.slug}${
            guestRecord ? `?guest=${guestRecord.inviteToken}` : ""
          }`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invitation
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/events/${wedding.slug}/social`}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Celebration Social Page
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            {role === "host" ? "Organizer" : "Verified Guest"}
          </span>
        </div>
      </div>

      <div className="rounded-3xl mood-hero p-6 sm:p-8 text-white shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200">
              <Bell className="h-3.5 w-3.5" />
              Live Event Updates
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">
              {wedding.coupleNames} — {wedding.eventTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-rose-100 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                <span>
                  {formatWeddingDateRange(wedding.date, wedding.endDate)}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-amber-300" />
                {wedding.venue}
              </span>
            </div>
          </div>

          {role === "host" && (
            <Link
              href={`/host/weddings/${wedding.id}`}
              className="inline-flex items-center gap-1.5 self-start rounded-xl bg-white px-4 py-2 text-xs font-semibold text-rose-900 shadow-sm hover:bg-rose-50 transition shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Manage Event
            </Link>
          )}
        </div>

        {guestRecord && (
          <div className="rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <UserCheck className="h-4 w-4 text-amber-300 shrink-0" />
              <span>
                Guest: <strong>{guestRecord.name}</strong> • RSVP:{" "}
                <strong className="uppercase text-amber-200">
                  {guestRecord.rsvpStatus}
                </strong>
              </span>
            </div>
            <Link
              href={`/invite/${wedding.slug}?guest=${guestRecord.inviteToken}`}
              className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 transition self-start sm:self-auto"
            >
              Update RSVP →
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-stone-900">
            Published Updates ({updates.length})
          </h2>
          <span className="text-xs text-stone-500">
            Most recent updates shown first
          </span>
        </div>

        {updates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center space-y-2">
            <Bell className="h-6 w-6 text-stone-400 mx-auto" />
            <div className="text-sm font-semibold text-stone-800">
              No updates published yet
            </div>
            <p className="text-xs text-stone-500">
              Announcements and schedule updates from the host will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {updates.map((u) => (
              <article
                key={u.id}
                className={`rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-3 transition ${
                  u.isPinned
                    ? "border-rose-300 ring-1 ring-rose-100"
                    : "border-stone-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {u.isPinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </span>
                    )}
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-700">
                      {u.category}
                    </span>
                  </div>

                  <time className="text-xs text-stone-400">
                    {new Date(u.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {u.updatedAt !== u.createdAt && " • Edited"}
                  </time>
                </div>

                <p className="text-sm sm:text-base text-stone-800 leading-relaxed whitespace-pre-line">
                  {u.textContent}
                </p>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                  <span>Posted by {u.authorName}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

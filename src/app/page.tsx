"use client";

import { EVENT_TYPES, missingEventDetails } from "@/lib/event-setup";
import { EVENT_MOODS, EventMoodId, formatCountdownLabel } from "@/lib/format";
import DateInput from "@/components/DateInput";
import { FestiveToranDivider } from "@/components/FestiveMotifs";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { groupHostedEvents } from "@/lib/event-status";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  encodeUserHintHeader,
  formatWeddingDateRange,
} from "@/lib/types";
import {
  ArrowRight,
  BookUser,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Heart,
  HeartHandshake,
  Lock,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const {
    user,
    hostedWeddings,
    invitedWeddings,
    loading,
    openAuthModal,
    refreshAuth,
  } = useAuth();

  const [dashboardView, setDashboardView] = useState("ongoing");
  const [userPickedView, setUserPickedView] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [eventType, setEventType] = useState("Birthday");
  const [otherEventType, setOtherEventType] = useState("");
  const [moodTheme, setMoodTheme] = useState<EventMoodId>("emerald");
  const [eventTitle, setEventTitle] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Host Onboarding / Profile Verification State
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null | undefined>(undefined);
  const [photoReading, setPhotoReading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !editingProfile) { setProfileName(user.name); setProfilePhone(user.phone || ""); }
  }, [user, editingProfile]);
  const eventGroups = groupHostedEvents(hostedWeddings);

  useEffect(() => {
    if (userPickedView || loading) return;
    const ongoing = eventGroups.find((g) => g.id === "ongoing")?.events.length || 0;
    const upcoming = eventGroups.find((g) => g.id === "upcoming")?.events.length || 0;
    const past = eventGroups.find((g) => g.id === "past")?.events.length || 0;
    if (ongoing > 0) setDashboardView("ongoing");
    else if (upcoming > 0) setDashboardView("upcoming");
    else if (invitedWeddings.length > 0) setDashboardView("invited");
    else if (past > 0) setDashboardView("past");
  }, [hostedWeddings.length, invitedWeddings.length, loading, userPickedView]);
  async function choosePhoto(file?: File) {
    if (!file) return;
    setPhotoReading(true); setProfileError(null);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP photo under 10 MB.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 320;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare this photo.");
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 320, 320);
      bitmap.close(); setProfilePhoto(canvas.toDataURL("image/jpeg", 0.85));
    } catch (error) { setProfileError(error instanceof Error ? error.message : "Could not read this photo."); }
    finally {setPhotoReading(false);}
  }

  const handleCreateWedding = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const startObj = new Date(date);
      const endObj = new Date(endDate);
      if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
        throw new Error(
          "Please select both start (From) and end (To) date."
        );
      }
      if (endObj.getTime() < startObj.getTime()) {
        throw new Error(
          "The end date (To) must be on or after the start date (From)."
        );
      }

      const res = await fetch("/api/weddings", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          eventType,
          otherEventType: eventType === "Other" ? otherEventType : undefined,
          moodTheme,
          eventTitle,
          date: startObj.toISOString(),
          endDate: endObj.toISOString(),
          venue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create event");
      }
      await refreshAuth();
      setCreateModalOpen(false);
      sessionStorage.setItem(`memorica-created-${data.wedding.id}`, "true");
      router.push(`/host/weddings/${data.wedding.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create event"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          profilePhoto,
          name: profileName,
          phone: profilePhone,
          onboardingCompleted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }
      await refreshAuth();
      setEditingProfile(false);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Failed to save profile"
      );
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-700" />
        <p className="text-sm text-stone-500">Loading your workspace...</p>
      </div>
    );
  }

  // Unauthenticated Product Landing Page
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14 space-y-14">
        <section className="relative overflow-hidden rounded-3xl bg-royal-header text-white p-6 sm:p-12 shadow-xl">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-10">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-medium backdrop-blur-sm border border-white/20">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>One Shared Home for Any Occasion</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                Plan together. Invite effortlessly. Celebrate any occasion.
              </h1>
              <p className="text-sm sm:text-base text-rose-100 leading-relaxed max-w-xl">
                From birthdays, anniversaries, and housewarmings to weddings,
                Diwali get-togethers, and reunions — track who’s invited and
                remaining, plan with co-admins, vote in your Close Family room,
                share photos on your Celebration Page, and manage ₹ budgets and
                vendor bookings.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    openAuthModal({
                      title: "Create an Event or Sign In",
                      subtitle:
                        "Verify your email or +91 phone to start hosting or view your invitations.",
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-rose-900 shadow-md hover:bg-rose-50 transition"
                >
                  Start Planning Your Celebration
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openAuthModal({
                      title: "Guest & Family Sign In",
                      subtitle:
                        "Verify the email or phone number from your event invitation to join the Celebration Page and Close Family room.",
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/25 transition"
                >
                  Guest &amp; Family Sign In
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-2xl border border-amber-200/35 bg-black/15 shadow-2xl">
                <img
                  src="/illustrations/hero-celebration.jpg"
                  alt="Joyful multi-generational family and friends celebrating together on a lantern-lit courtyard terrace with sparklers and festive treats"
                  className="w-full h-auto aspect-[4/3] object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/80 via-stone-950/25 to-transparent px-4 py-3 flex items-center justify-between text-[11px] font-medium text-amber-100">
                  <span>Birthdays · Anniversaries · Housewarmings · Weddings · Festivals</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FestiveToranDivider className="max-w-xl mx-auto" />

        {/* Big Showcase Offering Cards (2x2 Editorial Bento) */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-700">
                BUILT FOR EVERY OCCASION
              </p>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
                Four purpose-built spaces for every celebration &amp; gathering
              </h2>
            </div>
            <p className="text-sm text-stone-500 max-w-md">
              Whether it’s a birthday dinner, Griha Pravesh, anniversary, festival, reunion, or multi-day wedding — everyone stays effortlessly connected.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Invited vs. Remaining Tracker */}
            <article className="group rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-white via-white to-emerald-50/50 p-6 sm:p-8 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                    <BookUser className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Invite Planner
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <h3 className="font-serif text-2xl sm:text-[26px] font-bold text-stone-900 leading-snug">
                      Invited vs. Remaining Tracker
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      Organize Family, Friends, Colleagues, or Host Sides in one master list. Always see at a glance who is already invited, who is remaining, and who confirmed RSVP with headcount.
                    </p>
                  </div>
                  <img
                    src="/illustrations/invite-envelope.jpg"
                    alt="Emerald celebration invitation envelope with gold lotus wax seal, marigolds, and glowing brass diya"
                    className="w-36 sm:w-40 shrink-0 self-center object-contain mix-blend-multiply"
                  />
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-stone-700">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>Import from mobile contacts or CSV/vCard — never auto-sends without your confirmation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>Filter by guest circle, expected party size, and send directly over WhatsApp</span>
                  </li>
                </ul>
              </div>

              {/* Mini Visual UI Preview */}
              <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-800">142 Already Invited (79%)</span>
                  <span className="text-amber-800">38 Remaining</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full w-[79%] rounded-full bg-emerald-600" />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">Close Family · 64</span>
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">Friends · 72</span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-700">Colleagues · 44</span>
                </div>
              </div>
            </article>

            {/* Card 2: Celebration Social Page */}
            <article className="group rounded-3xl border border-amber-200/80 bg-gradient-to-br from-white via-white to-amber-50/50 p-6 sm:p-8 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-sm">
                    <Camera className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    For Invited Guests
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <h3 className="font-serif text-2xl sm:text-[26px] font-bold text-stone-900 leading-snug">
                      Celebration Social Page
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      Every event automatically unlocks a private social hub for your invited guests — post celebratory moments, share photo albums together, and see who’s coming and when.
                    </p>
                  </div>
                  <img
                    src="/illustrations/social-memories.jpg"
                    alt="Overlapping instant photo frames of friends and family celebrating with sparklers and fairy lights"
                    className="w-36 sm:w-40 shrink-0 self-center object-contain mix-blend-multiply"
                  />
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-stone-700">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>Guests share optional planned arrival &amp; departure dates (with a per-guest privacy toggle)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>Moments, wishes, travel plans, emoji reactions, comments &amp; shared photo albums</span>
                  </li>
                </ul>
              </div>

              {/* Mini Visual UI Preview */}
              <div className="rounded-2xl border border-amber-200/70 bg-white/90 p-4 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">R</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-900 truncate">Rohan Mehta · Travel Plan</p>
                      <p className="text-[11px] text-emerald-700 font-medium">Arriving Dec 9 – Dec 13 · 2 guests</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">48 Photos</span>
                </div>
                <p className="text-xs text-stone-600">&ldquo;Landing Tuesday morning — can’t wait to catch up and celebrate with everyone!&rdquo;</p>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-stone-700">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5">❤️ 18</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5">🎉 12</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5">🙏 9</span>
                </div>
              </div>
            </article>

            {/* Card 3: Close Family Planning Room */}
            <article className="group rounded-3xl border border-rose-200/80 bg-gradient-to-br from-white via-white to-rose-50/50 p-6 sm:p-8 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-700 text-white shadow-sm">
                    <HeartHandshake className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-800">
                    <Lock className="h-3 w-3" />
                    Invite-Only Circle
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <h3 className="font-serif text-2xl sm:text-[26px] font-bold text-stone-900 leading-snug">
                      Close Family Planning Room
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      A dedicated inner-circle space strictly invisible to general guests. Decide venues, menus, themes, and schedules together with live polls, checklists, and private threads.
                    </p>
                  </div>
                  <img
                    src="/illustrations/family-planning.jpg"
                    alt="Multi-generational family gathered happily over chai with swatches and celebration planning notes"
                    className="w-36 sm:w-40 shrink-0 self-center object-contain mix-blend-multiply"
                  />
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-stone-700">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
                    <span>Run single-choice or multi-choice group polls with transparent voter attribution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
                    <span>Assign tasks (decor, catering, return gifts, guest pickups) &amp; track completion</span>
                  </li>
                </ul>
              </div>

              {/* Mini Visual UI Preview */}
              <div className="rounded-2xl border border-rose-200/70 bg-white/90 p-4 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-900">Live Poll · Dinner &amp; Decor Theme</span>
                  <span className="text-[11px] font-semibold text-emerald-700">11 inner-circle votes</span>
                </div>
                <div className="space-y-1.5">
                  <div className="relative overflow-hidden rounded-xl border border-emerald-300 bg-emerald-50/40 px-3 py-1.5 text-xs flex justify-between font-semibold text-stone-900">
                    <span className="relative z-10">Courtyard Dinner &amp; Live Music</span>
                    <span className="relative z-10 text-emerald-800">68%</span>
                    <div className="absolute inset-y-0 left-0 w-[68%] bg-emerald-100/70" />
                  </div>
                  <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs flex justify-between text-stone-700">
                    <span className="relative z-10">Terrace Lights &amp; Live Chaat Bar</span>
                    <span className="relative z-10 font-medium">32%</span>
                    <div className="absolute inset-y-0 left-0 w-[32%] bg-stone-200/60" />
                  </div>
                </div>
              </div>
            </article>

            {/* Card 4: Co-Admins, ₹ Budget & Vendors */}
            <article className="group rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 sm:p-8 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-700 text-white shadow-sm">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                    <ShieldCheck className="h-3 w-3" />
                    Owner &amp; Co-Admins
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <h3 className="font-serif text-2xl sm:text-[26px] font-bold text-stone-900 leading-snug">
                      Co-Admins, ₹ Budget &amp; Vendors
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      Stop passing around spreadsheets and phones. Add trusted co-admins to track every rupee in INR (₹), vendor advances, balance due dates, and uploaded booking receipts.
                    </p>
                  </div>
                  <img
                    src="/illustrations/organizer-hub.jpg"
                    alt="Fairy-light floral arch, camera, celebration gift parcels, lantern, and planning notebook"
                    className="w-36 sm:w-40 shrink-0 self-center object-contain mix-blend-multiply"
                  />
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-stone-700">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-indigo-700 shrink-0 mt-0.5" />
                    <span>INR lakh/crore ledger with category bars &amp; contributor expense splits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-indigo-700 shrink-0 mt-0.5" />
                    <span>Vendor directory with tap-to-call numbers, payment milestones &amp; contract/receipt storage</span>
                  </li>
                </ul>
              </div>

              {/* Mini Visual UI Preview */}
              <div className="rounded-2xl border border-indigo-200/70 bg-white/90 p-4 space-y-2.5 shadow-xs">
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                  <div className="rounded-xl bg-stone-50 px-1.5 py-2 sm:p-2">
                    <p className="text-[10px] font-medium text-stone-500">Planned</p>
                    <p className="text-[11px] sm:text-sm font-bold text-stone-900 tabular-nums whitespace-nowrap">₹18,50,000</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-1.5 py-2 sm:p-2">
                    <p className="text-[10px] font-medium text-emerald-700">Paid</p>
                    <p className="text-[11px] sm:text-sm font-bold text-emerald-900 tabular-nums whitespace-nowrap">₹9,20,000</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-1.5 py-2 sm:p-2">
                    <p className="text-[10px] font-medium text-amber-800">Pending</p>
                    <p className="text-[11px] sm:text-sm font-bold text-amber-950 tabular-nums whitespace-nowrap">₹9,30,000</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600 pt-0.5">
                  <span className="inline-flex items-center gap-1 font-semibold text-indigo-800">
                    <Users className="h-3.5 w-3.5" />
                    3 Co-Admins collaborating live
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium">12 Vendors · 8 Receipts</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Connected 4-Step Celebration Journey Strip */}
        <section className="rounded-3xl border border-rose-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">
              HOW IT ALL CONNECTS
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
              From save-the-date to shared memories — one connected flow
            </h2>
          </div>

          <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Desktop Horizontal Connector Rail */}
            <div
              aria-hidden="true"
              className="hidden md:block absolute top-5 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-600"
            />
            {[
              {
                num: "1",
                title: "Create Any Occasion",
                desc: "Choose your occasion, pick a festive mood, add your schedule, and upload your invitation card.",
              },
              {
                num: "2",
                title: "Invite & Track Remaining",
                desc: "Organize guest circles, add co-admins, and track exactly who is invited vs. remaining.",
              },
              {
                num: "3",
                title: "Plan Together Privately",
                desc: "Vote on venues, themes & menus in your inner circle, assign tasks, and track ₹ budgets.",
              },
              {
                num: "4",
                title: "Celebrate Together",
                desc: "Guests RSVP with planned dates, post moments, and upload photos to shared albums.",
              },
            ].map((step) => (
              <li
                key={step.num}
                className="relative flex md:flex-col items-start md:items-center md:text-center gap-4 md:gap-3"
              >
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-700 bg-emerald-700 text-sm font-bold text-white shadow-sm ring-4 ring-white">
                  {step.num}
                </span>
                <div className="space-y-1">
                  <h3 className="font-serif text-base font-bold text-stone-900">
                    {step.title}
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  // Authenticated User Dashboard (Host & Guest)
  return (
    <div className="celebration-dashboard mx-auto max-w-6xl px-4 py-5 sm:py-8 space-y-6">
      {/* Host Onboarding / Profile Completion Banner */}
      {(!user.onboardingCompleted || editingProfile) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                {user.onboardingCompleted ? "Your account" : "Account Onboarding & Profile Verification"}
              </span>
              <h2 className="font-serif text-xl font-bold text-stone-900 mt-0.5">
                {user.onboardingCompleted ? "Edit your profile" : "Complete Your Host & Guest Profile"}
              </h2>
              <p className="text-xs text-stone-600">
                Confirm your display name and optional phone number so your
                hosted events and any guest invitations link automatically.
              </p>
            </div>
            {user.onboardingCompleted && (
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Cancel
              </button>
            )}
          </div>

          {profileError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
              {profileError}
            </div>
          )}

          <form
            onSubmit={handleSaveProfile}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          >
            <div className="sm:col-span-3 flex flex-wrap items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full bg-rose-100 flex items-center justify-center text-2xl font-bold text-rose-800">
                {(profilePhoto === undefined ? user.avatarUrl : profilePhoto) ? <img src={(profilePhoto === undefined ? user.avatarUrl : profilePhoto)!} alt="Profile photo preview" className="h-full w-full object-cover" /> : user.name.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold">Profile picture<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoReading || profileSaving} onChange={e=>{void choosePhoto(e.target.files?.[0]); e.target.value="";}} className="block mt-2 text-xs"/></label>
                <p className="text-xs text-stone-500">JPG, PNG or WebP · up to 10 MB · cropped to a square</p>
                <button type="button" onClick={()=>setProfilePhoto(null)} className="text-xs text-rose-700 underline">Remove photo</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Your Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Arjun Kapoor"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Mobile Phone Number (Optional)
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={profileSaving || photoReading}
              className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50 transition"
            >
              {profileSaving ? "Saving..." : user.onboardingCompleted ? "Save profile" : "Save & Complete Onboarding"}
            </button>
          </form>
        </div>
      )}

      {user.onboardingCompleted && !editingProfile && <section className="dashboard-welcome flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-rose-100 font-serif text-xl text-rose-800 shadow-sm">{user.avatarUrl ? <img src={user.avatarUrl} alt="Your profile" className="h-full w-full rounded-full object-cover"/> : user.name.charAt(0).toUpperCase()}</div>
            <div className="min-w-0"><p className="text-xs text-rose-700">A little planning. A lot of memories.</p><h1 className="font-serif text-2xl sm:text-3xl truncate">Hello, {user.name.split(" ")[0]}</h1></div>
          </div>
          <button type="button" onClick={()=>{setProfilePhoto(undefined);setProfileError(null);setProfileName(user.name);setProfilePhone(user.phone || "");setEditingProfile(true);}} className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-rose-800 underline underline-offset-4">Edit profile <CheckCircle2 size={14}/><span className="font-normal text-stone-500 no-underline">Verified account</span></button>
        </div>
        <img
          src="/illustrations/invite-envelope.jpg"
          alt=""
          aria-hidden="true"
          className="hidden sm:block h-28 w-auto shrink-0 object-contain mix-blend-multiply"
        />
      </section>}
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700">YOUR MEMORIES START HERE</p><h2 className="font-serif text-2xl sm:text-3xl">My celebrations</h2></div><button type="button" onClick={()=>setCreateModalOpen(true)} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><Plus size={17}/>Create event</button></div>
      <div role="group" aria-label="Event groups" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...eventGroups.map(group=>({id:group.id,title:group.id==='past'?'Previously hosted':group.id==='ongoing'?'Ongoing':'Upcoming',count:group.events.length,icon:group.id==='ongoing'?Sparkles:group.id==='upcoming'?Calendar:Heart})),{id:'invited',title:'Invited to',count:invitedWeddings.length,icon:BookUser}].map(group=>{const Icon=group.icon;return <button type="button" key={group.id} aria-pressed={dashboardView===group.id} onClick={()=>{setUserPickedView(true);setDashboardView(group.id);}} className={`event-widget ${dashboardView===group.id?'is-active':''}`}><div className="flex items-center justify-between"><span className="widget-icon"><Icon size={19}/></span><span className="font-serif text-3xl">{group.count}</span></div><span className="mt-3 block text-sm font-semibold">{group.title}</span><span className="mt-0.5 block text-[11px] opacity-75">{group.id==='ongoing'?'Happening now':group.id==='upcoming'?'Looking forward':group.id==='past'?'Memories to revisit':'You’re on the guest list'}</span></button>})}
      </div>
      <section aria-live="polite" className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl">{dashboardView==='invited'?'Your invitations':eventGroups.find(group=>group.id===dashboardView)?.title}</h2><span className="text-xs text-stone-500">{dashboardView==='invited'?invitedWeddings.length:eventGroups.find(group=>group.id===dashboardView)?.events.length} events</span></div>
        {dashboardView === "invited" ? (
          invitedWeddings.length ? (
            invitedWeddings.map((w) => (
              <article
                key={w.id}
                className={`celebration-card mood-${w.moodTheme || "emerald"}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                  <span>
                    YOU’RE INVITED · RSVP: {w.myRsvpStatus}
                  </span>
                  {w.canAccessFamily && (
                    <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-amber-900">
                      Close Family
                    </span>
                  )}
                  <span className="ml-auto rounded-full bg-rose-50 px-2.5 py-0.5 text-rose-800">
                    {formatCountdownLabel(w.date, w.endDate)}
                  </span>
                </div>
                <h3 className="font-serif text-2xl mt-2">
                  {w.coupleNames || w.eventTitle}
                </h3>
                {w.coupleNames && (
                  <p className="text-xs text-stone-500 mt-0.5">{w.eventTitle}</p>
                )}
                <p className="text-sm text-stone-500 mt-2">
                  {formatWeddingDateRange(w.date, w.endDate)} · {w.venue}
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link
                    className="card-primary"
                    href={`/events/${w.slug}/social`}
                  >
                    <Sparkles size={15} />
                    Celebration Social Page
                    <ArrowRight size={15} />
                  </Link>
                  {w.canAccessFamily && (
                    <Link
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 transition"
                      href={`/events/${w.slug}/family`}
                    >
                      <HeartHandshake size={15} className="text-amber-700" />
                      Close Family Room
                    </Link>
                  )}
                  <Link
                    className="card-secondary"
                    href={
                      w.myInviteToken
                        ? `/invite/${w.slug}?guest=${w.myInviteToken}`
                        : `/invite/${w.slug}`
                    }
                  >
                    Invitation &amp; RSVP
                  </Link>
                  <Link
                    className="card-secondary"
                    href={`/events/${w.slug}/updates`}
                  >
                    Live updates ({w.updatesCount})
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="celebration-empty">
              <img
                src="/illustrations/invite-envelope.jpg"
                alt="Festive celebration invitation envelope with marigolds and glowing brass diya"
                className="mx-auto mb-3 h-36 w-auto object-contain mix-blend-multiply"
              />
              <h3>Your next invitation awaits</h3>
              <p>Events you’re invited to will appear here.</p>
            </div>
          )
        ) : (
          (() => {
            const group = eventGroups.find(
              (item) => item.id === dashboardView
            )!;
            return group.events.length ? (
              group.events.map((w) => {
                const remainingSetup = missingEventDetails(w);
                const invitedCount = w.stats.invitedCount ?? 0;
                const remainingGuests =
                  w.stats.remainingCount ??
                  Math.max(0, w.stats.totalGuests - invitedCount);
                return (
                  <article
                    key={w.id}
                    className={`celebration-card mood-${w.moodTheme || "emerald"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                      <Heart size={12} />
                      <span>
                        {w.eventType} ·{" "}
                        {w.myRole === "co_admin" ? "Co-Admin" : "Owner"}
                      </span>
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-amber-900">
                        {formatCountdownLabel(w.date, w.endDate)}
                      </span>
                      <span className="ml-auto rounded-full bg-rose-50 px-2.5 py-0.5">
                        {remainingSetup.length
                          ? "Setup in progress"
                          : group.id === "past"
                          ? "Memories saved"
                          : "Ready to celebrate"}
                      </span>
                    </div>
                    <h3 className="font-serif text-2xl sm:text-3xl mt-3">
                      {w.coupleNames || w.eventTitle}
                    </h3>
                    {w.coupleNames && (
                      <p className="text-xs text-stone-500 mt-1">
                        {w.eventTitle}
                      </p>
                    )}
                    <div className="mt-4 space-y-2 text-sm text-stone-600">
                      <p className="flex items-start gap-2">
                        <Calendar
                          size={16}
                          className="shrink-0 text-rose-600 mt-0.5"
                        />
                        {formatWeddingDateRange(w.date, w.endDate)}
                      </p>
                      <p className="flex items-start gap-2">
                        <MapPin
                          size={16}
                          className="shrink-0 text-rose-600 mt-0.5"
                        />
                        {w.venue}
                      </p>
                    </div>
                    <div className="mt-4 border-t border-rose-100 pt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
                      <span className="font-semibold text-stone-800">
                        {w.stats.totalGuests} guests
                      </span>
                      <span className="text-emerald-700">
                        {invitedCount} invited
                      </span>
                      {remainingGuests > 0 && (
                        <span className="font-semibold text-amber-800">
                          {remainingGuests} remaining
                        </span>
                      )}
                      <span>{w.stats.yesCount} attending</span>
                      {w.stats.conflictCount > 0 && (
                        <span className="text-amber-700 font-semibold">
                          · {w.stats.conflictCount} conflicts
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <Link
                        className="card-primary"
                        href={`/host/weddings/${w.id}`}
                      >
                        {remainingSetup.length
                          ? "Continue setup"
                          : "Manage event"}
                        <ArrowRight size={16} />
                      </Link>
                      <Link
                        className="card-secondary"
                        href={`/events/${w.slug}/social`}
                      >
                        Celebration Page
                      </Link>
                      <Link
                        className="card-secondary"
                        href={`/events/${w.slug}/family`}
                      >
                        Close Family
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="celebration-empty">
                <img
                  src="/illustrations/social-memories.jpg"
                  alt="Friends and family celebration photo collage with sparklers and fairy lights"
                  className="mx-auto mb-3 h-36 w-auto object-contain mix-blend-multiply"
                />
                <h3>
                  {group.id === "ongoing"
                    ? "A little quiet, for now"
                    : group.id === "upcoming"
                    ? "Something lovely to look forward to"
                    : "Beautiful memories belong here"}
                </h3>
                <p>
                  {group.id === "past"
                    ? "Your hosted celebrations will be saved here."
                    : "Start planning your next celebration."}
                </p>
                <button
                  type="button"
                  className="card-primary mx-auto mt-4"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Plus size={16} />
                  Create an event
                </button>
              </div>
            );
          })()
        )}
      </section>

      {/* Create Event Modal */}
      {createModalOpen && (
        <div className="sheet-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/40 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="sheet-panel w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#ffffff] p-5 sm:p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Create an Event
                </h3>
                <p className="text-xs text-stone-500">
                  Enter your celebration schedule and venue details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateWedding} className="space-y-3.5">
              <label className="block text-xs font-semibold text-stone-700">Occasion / Event Type *
                <select value={eventType} onChange={e => setEventType(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-300 p-3 bg-white">
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              {eventType === "Other" && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Name Your Occasion *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Retirement Dinner, Mundan, Graduation Party"
                    value={otherEventType}
                    onChange={(e) => setOtherEventType(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <span className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Celebration Mood
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_MOODS.map((m) => {
                    const active = moodTheme === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMoodTheme(m.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-rose-700 bg-rose-50 text-rose-900"
                            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <span
                          className="h-3 w-3 rounded-full border border-black/10"
                          style={{ background: m.swatch }}
                        />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-stone-500">Step 1 of 2 · Create your event, then complete its details and invitation.</p>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mom’s 60th Birthday, Housewarming, or Aarav & Diya’s Wedding"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    From (Start Date) *
                  </label>
                  <DateInput
                    type="date"
                    required
                    value={date}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDate(val);
                      if (val && (!endDate || endDate < val)) {
                        setEndDate(val);
                      }
                    }}
                    className="block w-full max-w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    To (End Date) *
                  </label>
                  <DateInput
                    type="date"
                    required
                    min={date || undefined}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full max-w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Venue *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Oberoi Udaivilas, Udaipur"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-rose-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

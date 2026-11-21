"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Heart,
  Loader2,
  Mail,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { WeddingDTO, encodeUserHintHeader } from "@/lib/types";
import { EventMedia, SubEvent, missingEventDetails } from "@/lib/event-setup";
import {
  EVENT_MOODS,
  EventMoodId,
  INDIAN_SUBEVENT_PRESETS,
} from "@/lib/format";
import DateInput from "./DateInput";

export function MediaPreview({ asset }: { asset: EventMedia }) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = `/api/media/${asset.id}`;
  useEffect(() => {
    setImgFailed(false);
  }, [asset.id]);
  if (asset.mime.startsWith("image/")) {
    if (imgFailed) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
          <p className="font-semibold">Preview unavailable for {asset.name}</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-block font-semibold text-emerald-800 underline"
          >
            Open uploaded card
          </a>
        </div>
      );
    }
    return (
      <img
        src={url}
        alt={asset.name}
        onError={() => setImgFailed(true)}
        className="max-h-80 w-full rounded-xl object-contain bg-stone-50"
      />
    );
  }
  if (asset.mime.startsWith("video/")) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="max-h-80 w-full rounded-xl"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm font-semibold text-rose-700 underline hover:bg-emerald-50"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span>View PDF invitation: {asset.name}</span>
    </a>
  );
}

type SetupStepId = "couple" | "ceremonies" | "invitation";

export default function EventSetupForm({
  wedding,
  onSaved,
  onInvite,
  mode = "details",
}: {
  wedding: WeddingDTO;
  onSaved: (event: WeddingDTO) => void;
  onInvite: () => void;
  onNext?: () => void;
  mode?: "details" | "invitations";
}) {
  const { user } = useAuth();
  const [setup, setSetup] = useState(wedding.setup);
  const [moodTheme, setMoodTheme] = useState<EventMoodId>(wedding.moodTheme);
  const [message, setMessage] = useState(wedding.description || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [cardNotices, setCardNotices] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);

  const isWedding = wedding.eventType === "Wedding";
  const initialStep: SetupStepId =
    mode === "invitations"
      ? "invitation"
      : isWedding && !(wedding.setup.groomName.trim() && wedding.setup.brideName.trim())
      ? "couple"
      : "invitation";
  const [activeStep, setActiveStep] = useState<SetupStepId>(initialStep);

  const prevWeddingId = useRef(wedding.id);
  const prevWeddingUpdatedAt = useRef(wedding.updatedAt);
  const prevDescription = useRef(wedding.description || "");
  const stepRefs = useRef<Partial<Record<SetupStepId, HTMLDivElement | null>>>({});

  useEffect(() => {
    const nextDescription = wedding.description || "";
    const weddingChanged = prevWeddingId.current !== wedding.id;
    const serverUpdated = prevWeddingUpdatedAt.current !== wedding.updatedAt;

    if (weddingChanged) {
      prevWeddingId.current = wedding.id;
      prevWeddingUpdatedAt.current = wedding.updatedAt;
      prevDescription.current = nextDescription;
      setMoodTheme(wedding.moodTheme);
      setSetup(wedding.setup);
      setMessage(nextDescription);
      setCardNotices({});
      return;
    }

    if (!serverUpdated) {
      return;
    }

    prevWeddingUpdatedAt.current = wedding.updatedAt;
    setMoodTheme(wedding.moodTheme);
    if (prevDescription.current !== nextDescription) {
      prevDescription.current = nextDescription;
      setMessage(nextDescription);
    }
    setSetup((prev) =>
      mode === "details"
        ? wedding.setup
        : {
            ...prev,
            groomName: wedding.setup.groomName,
            brideName: wedding.setup.brideName,
          }
    );
  }, [wedding, mode]);

  const missing = missingEventDetails({
    ...wedding,
    setup,
    description: message,
  });
  const coupleDone =
    !isWedding ||
    Boolean(setup.groomName.trim() && setup.brideName.trim());
  const breakdownDone =
    setup.subEvents.length > 0 &&
    !missing.some((item) => item.startsWith("Sub-event"));
  const invitationDone = !missing.some((item) => /invitation/i.test(item));
  const completedEssentials =
    (isWedding ? Number(coupleDone) : 0) + Number(invitationDone);
  const totalEssentials = isWedding ? 2 : 1;

  const currentMoodLabel =
    EVENT_MOODS.find((m) => m.id === moodTheme)?.label || "Emerald Classic";

  const steps: Array<{
    id: SetupStepId;
    number: number;
    mobileLabel: string;
    shortTitle: string;
    title: string;
    summary: string;
    done: boolean;
    optional: boolean;
    icon: typeof Heart;
  }> = [
    ...(isWedding
      ? [
          {
            id: "couple" as SetupStepId,
            number: 1,
            mobileLabel: "Couple",
            shortTitle: "Couple",
            title: "The couple & family blessings",
            summary: coupleDone
              ? `${setup.groomName.trim()} & ${setup.brideName.trim()}${
                  setup.coupleHashtag ? ` · ${setup.coupleHashtag}` : ""
                }`
              : "Add groom’s and bride’s names (parents & hashtags optional)",
            done: coupleDone,
            optional: false,
            icon: Heart,
          },
        ]
      : []),
    {
      id: "ceremonies" as SetupStepId,
      number: isWedding ? 2 : 1,
      mobileLabel: "Mood",
      shortTitle: "Mood & Schedule",
      title: "Festive mood & celebration itinerary",
      summary: `${currentMoodLabel}${
        setup.subEvents.length > 0
          ? ` · ${setup.subEvents.length} function${
              setup.subEvents.length === 1 ? "" : "s"
            } (${setup.subEvents
              .map((s) => s.name || "Untitled")
              .slice(0, 3)
              .join(", ")})`
          : " · Single celebration (tap presets to add Haldi, Sangeet...)"
      }`,
      done: breakdownDone,
      optional: true,
      icon: Palette,
    },
    {
      id: "invitation" as SetupStepId,
      number: isWedding ? 3 : 2,
      mobileLabel: "Card",
      shortTitle: "Invitation Card",
      title: "Invitation message & card upload",
      summary: invitationDone
        ? `${
            setup.invitationMode === "universal"
              ? "Universal invitation card"
              : "Sub-event invitation cards"
          } & warm message ready`
        : "Write your warm invitation note and upload your card (image, video, or PDF)",
      done: invitationDone,
      optional: false,
      icon: Mail,
    },
  ];

  const inputClass =
    "mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm focus:border-rose-600 focus:outline-none";

  function goToStep(stepId: SetupStepId) {
    setActiveStep(stepId);
    requestAnimationFrame(() => {
      stepRefs.current[stepId]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function changeSub(id: string, update: Partial<SubEvent>) {
    setSetup((prev) => ({
      ...prev,
      subEvents: prev.subEvents.map((sub) =>
        sub.id === id ? { ...sub, ...update } : sub
      ),
    }));
  }

  async function upload(
    selectedFiles: File[],
    target: "overall" | "photos" | string
  ) {
    if (!selectedFiles.length) return;
    setUploading(true);
    setUploadingTarget(target);
    setNotice("");
    setError(false);
    setCardNotices((prev) => {
      const next = { ...prev };
      delete next[target];
      return next;
    });
    try {
      if (target === "photos" && setup.photos.length + selectedFiles.length > 8) {
        throw new Error("You can add up to 8 couple photos.");
      }
      const assets: EventMedia[] = [];
      for (const file of selectedFiles) {
        if (
          target === "photos" &&
          file.type &&
          !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
            file.type
          )
        ) {
          throw new Error("Choose JPG, PNG, WebP or GIF couple photos.");
        }
        if (file.size === 0) {
          throw new Error("The selected file is empty. Please choose another file.");
        }
        if (file.size > 20 * 1024 * 1024) {
          throw new Error("Each file must be under 20 MB.");
        }
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(`/api/weddings/${wedding.id}/media`, {
          method: "POST",
          credentials: "same-origin",
          headers: { ...encodeUserHintHeader(user) },
          body: form,
        });
        const data = (await response.json().catch(() => ({}))) as {
          asset?: EventMedia;
          error?: string;
        };
        if (!response.ok || !data.asset) {
          if (response.status === 413) {
            throw new Error("This file is too large to upload. Try a smaller file.");
          }
          throw new Error(
            data.error || `Upload failed (HTTP ${response.status}). Please try again.`
          );
        }
        assets.push(data.asset);
      }
      setSetup((prev) =>
        target === "overall"
          ? { ...prev, card: assets[0] }
          : target === "photos"
          ? { ...prev, photos: [...prev.photos, ...assets] }
          : {
              ...prev,
              subEvents: prev.subEvents.map((sub) =>
                sub.id === target ? { ...sub, card: assets[0] } : sub
              ),
            }
      );
      const okMsg =
        "Invitation card uploaded! Click Save below to apply it to your invitation.";
      setNotice(okMsg);
      setCardNotices((prev) => ({
        ...prev,
        [target]: { type: "success", text: okMsg },
      }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Upload failed.";
      setError(true);
      setNotice(errMsg);
      setCardNotices((prev) => ({
        ...prev,
        [target]: { type: "error", text: errMsg },
      }));
    } finally {
      setUploading(false);
      setUploadingTarget(null);
    }
  }

  async function save(e: React.SyntheticEvent, advance = true) {
    e.preventDefault();
    if (advance && missing.length) return;
    setBusy(true);
    setNotice("");
    setError(false);
    try {
      const payloadSetup =
        mode === "invitations"
          ? {
              ...setup,
              groomName: wedding.setup.groomName,
              brideName: wedding.setup.brideName,
            }
          : setup;
      const response = await fetch(`/api/weddings/${wedding.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          setup: payloadSetup,
          moodTheme,
          description: message,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        wedding?: WeddingDTO;
        error?: string;
      };
      if (!response.ok || !data.wedding) {
        throw new Error(data.error || "Could not save details.");
      }
      setCardNotices({});
      onSaved(data.wedding);
      if (advance && !missingEventDetails(data.wedding).length) {
        onInvite();
        return;
      }
      setNotice(
        missingEventDetails(data.wedding).length
          ? `Draft saved. Still needed: ${missingEventDetails(data.wedding).join(
              "; "
            )}.`
          : "Event details saved."
      );
    } catch (err) {
      setError(true);
      setNotice(
        err instanceof Error ? err.message : "Could not save details."
      );
    } finally {
      setBusy(false);
    }
  }

  function cardUpload(
    title: string,
    target: string,
    card: EventMedia | null,
    required: boolean
  ) {
    const isThisUploading = uploading && uploadingTarget === target;
    const slotNotice = cardNotices[target];

    return (
      <div
        className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:p-5 space-y-3"
        key={target}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-stone-800">
            {title}
            {required ? " *" : " (optional)"}
          </span>
          {card && !isThisUploading && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 max-w-full truncate">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-[280px]">
                {card.name}
              </span>
            </span>
          )}
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (uploading || busy) return;
            const dropped = Array.from(e.dataTransfer.files || []).slice(0, 1);
            if (dropped.length) {
              void upload(dropped, target);
            }
          }}
          className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition cursor-pointer focus-within:ring-2 focus-within:ring-emerald-700 focus-within:ring-offset-2 ${
            isThisUploading
              ? "border-emerald-400 bg-emerald-50/70"
              : card
              ? "border-emerald-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30"
              : "border-stone-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/30"
          } ${uploading || busy ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf"
            disabled={uploading || busy}
            onChange={(e) => {
              const selected = Array.from(e.target.files || []);
              e.target.value = "";
              if (selected.length) {
                void upload(selected, target);
              }
            }}
            className="sr-only"
          />
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              {isThisUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-stone-900">
                {isThisUploading
                  ? "Uploading invitation card…"
                  : card
                  ? "Replace invitation card"
                  : "Choose invitation card file"}
              </p>
              <p className="text-xs text-stone-500">
                JPG, PNG, WebP, GIF, MP4, WebM or PDF · up to 20 MB
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shrink-0">
            {isThisUploading
              ? "Uploading…"
              : card
              ? "Choose new file"
              : "Browse file"}
          </span>
        </label>

        {slotNotice && (
          <div
            role={slotNotice.type === "error" ? "alert" : "status"}
            className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              slotNotice.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {slotNotice.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-700" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
            )}
            <span>{slotNotice.text}</span>
          </div>
        )}

        {card && (
          <div className="space-y-2.5 pt-1">
            <MediaPreview asset={card} />
            <button
              type="button"
              onClick={() => {
                setCardNotices((prev) => {
                  const next = { ...prev };
                  delete next[target];
                  return next;
                });
                if (target === "overall") {
                  setSetup((prev) => ({ ...prev, card: null }));
                } else {
                  changeSub(target, { card: null });
                }
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove card
            </button>
          </div>
        )}
      </div>
    );
  }

  const invitationControls = (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-stone-800">
        Invitation message *
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Together with our families, we warmly invite you to celebrate with us…"
          className={inputClass}
        />
      </label>

      <fieldset className="space-y-2.5">
        <legend className="text-sm font-semibold text-stone-900 mb-1.5">
          How would you like to use invitation cards?
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`flex gap-3 rounded-xl border p-3.5 text-sm cursor-pointer transition ${
              setup.invitationMode === "universal"
                ? "border-emerald-600 bg-emerald-50/50"
                : "border-stone-200 bg-white hover:bg-stone-50"
            }`}
          >
            <input
              type="radio"
              name="invitationMode"
              checked={setup.invitationMode === "universal"}
              onChange={() =>
                setSetup({ ...setup, invitationMode: "universal" })
              }
              className="mt-1 accent-rose-700"
            />
            <span>
              <strong className="text-stone-900">Universal invitation</strong>
              <span className="block text-xs text-stone-500 mt-0.5">
                Use one card for the overall celebration and all sub-events.
              </span>
            </span>
          </label>
          <label
            className={`flex gap-3 rounded-xl border p-3.5 text-sm cursor-pointer transition ${
              setup.invitationMode === "specific"
                ? "border-emerald-600 bg-emerald-50/50"
                : "border-stone-200 bg-white hover:bg-stone-50"
            }`}
          >
            <input
              type="radio"
              name="invitationMode"
              checked={setup.invitationMode === "specific"}
              onChange={() =>
                setSetup({ ...setup, invitationMode: "specific" })
              }
              className="mt-1 accent-rose-700"
            />
            <span>
              <strong className="text-stone-900">Specific invitations</strong>
              <span className="block text-xs text-stone-500 mt-0.5">
                Upload separate cards for Haldi, Mehndi, Sangeet, or Reception.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <p className="text-xs text-stone-500">
        Photo, animated GIF, MP4 / WebM video or PDF · maximum 20 MB per file.
        Replacing a card updates its saved invitation link.
      </p>

      {cardUpload(
        `${wedding.eventTitle} — ${
          setup.invitationMode === "universal"
            ? "universal card"
            : "overall event card"
        }`,
        "overall",
        setup.card,
        setup.invitationMode === "universal" || !setup.subEvents.length
      )}

      {setup.invitationMode === "specific" &&
        setup.subEvents.map((sub, index) =>
          cardUpload(sub.name || `Sub-event ${index + 1}`, sub.id, sub.card, true)
        )}

      {setup.invitationMode === "specific" && !setup.subEvents.length && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
          Add ceremonies in the <strong>Mood &amp; Schedule</strong> step to
          upload separate cards per function. For now, upload your overall event
          card above.
        </p>
      )}
    </div>
  );

  // Compact mode for the "Share & WhatsApp" tab
  if (mode === "invitations") {
    return (
      <form
        onSubmit={(e) => {
          void save(e);
        }}
        className="rounded-3xl border border-rose-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="border-b border-rose-100 bg-rose-50/50 p-5 sm:p-6 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-rose-700">
            Invitation Card &amp; Message
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
            Customize your invitation message &amp; cards
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            Update your universal card or individual ceremony cards anytime —
            shared links refresh automatically.
          </p>
        </div>
        <div className="p-5 sm:p-6 space-y-5">
          {invitationControls}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              disabled={busy || uploading}
              onClick={(e) => {
                void save(e, false);
              }}
              className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : busy ? "Saving…" : "Save invitation changes"}
            </button>
            {notice && (
              <p
                role={error ? "alert" : "status"}
                className={`text-sm ${error ? "text-red-700" : "text-emerald-800"}`}
              >
                {notice}
              </p>
            )}
          </div>
        </div>
      </form>
    );
  }

  // Full Connected Setup Journey (mode === "details")
  return (
    <form
      onSubmit={(e) => {
        void save(e);
      }}
      className="rounded-3xl border border-rose-200 bg-white shadow-sm overflow-hidden"
    >
      {/* Unified Header + Connected Horizontal Milestone Stepper */}
      <div className="border-b border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-amber-50/40 p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">
              CELEBRATION SETUP JOURNEY
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
              Prepare your celebration in {steps.length} connected steps
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              Follow the guided steps below — save a draft anytime, and unlock
              guest invitations once the essentials are complete.
            </p>
          </div>
          <span
            className={`self-start sm:self-center inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shrink-0 ${
              missing.length === 0
                ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {missing.length === 0 ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Ready to Invite
              </>
            ) : (
              `${completedEssentials} of ${totalEssentials} essentials complete`
            )}
          </span>
        </div>

        {/* Connected Horizontal Stepper Bar */}
        <nav
          aria-label="Setup steps"
          className="flex items-center justify-between gap-1 sm:gap-2 pt-1"
        >
          {steps.map((step, idx) => {
            const isActive = activeStep === step.id;
            const isLast = idx === steps.length - 1;
            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => goToStep(step.id)}
                  aria-current={isActive ? "step" : undefined}
                  className={`group flex items-center gap-2 rounded-2xl px-2.5 sm:px-3.5 py-2 text-left transition min-h-[44px] ${
                    isActive
                      ? "bg-white border border-emerald-300 shadow-sm"
                      : "hover:bg-white/70"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                      step.done
                        ? "bg-emerald-700 text-white"
                        : isActive
                        ? "border-2 border-emerald-700 bg-emerald-50 text-emerald-900"
                        : "border border-stone-300 bg-white text-stone-500"
                    }`}
                  >
                    {step.done ? <Check className="h-4 w-4" /> : step.number}
                  </span>
                  <span className="min-w-0 hidden sm:block">
                    <span
                      className={`block text-xs font-bold leading-tight ${
                        isActive
                          ? "text-emerald-950"
                          : step.done
                          ? "text-stone-800"
                          : "text-stone-600"
                      }`}
                    >
                      {step.shortTitle}
                    </span>
                    <span className="block text-[10px] text-stone-500">
                      {step.done
                        ? "Done"
                        : step.optional
                        ? "Optional"
                        : "Required"}
                    </span>
                  </span>
                  <span className="sm:hidden text-[11px] font-bold text-stone-800 whitespace-nowrap">
                    {step.mobileLabel}
                  </span>
                </button>
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className={`h-0.5 flex-1 rounded-full transition-colors ${
                      step.done ? "bg-emerald-500" : "bg-stone-200"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Connected Vertical Timeline Spine */}
      <div className="p-4 sm:p-7">
        <div className="relative">
          {steps.map((step, idx) => {
            const isActive = activeStep === step.id;
            const prevStep = idx > 0 ? steps[idx - 1] : null;
            const nextStep = idx < steps.length - 1 ? steps[idx + 1] : null;

            return (
              <div
                key={step.id}
                ref={(el) => {
                  stepRefs.current[step.id] = el;
                }}
                className="relative flex gap-3 sm:gap-5 pb-6 scroll-mt-24"
              >
                {/* Left Vertical Connector Rail + Step Node */}
                <div className="flex flex-col items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => goToStep(step.id)}
                    aria-label={`Jump to Step ${step.number}: ${step.title}`}
                    className={`relative z-10 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-xs sm:text-sm font-bold transition ${
                      step.done
                        ? "bg-emerald-700 text-white shadow-sm"
                        : isActive
                        ? "border-2 border-emerald-700 bg-white text-emerald-900 ring-4 ring-emerald-100"
                        : "border-2 border-stone-300 bg-white text-stone-500 hover:border-emerald-400"
                    }`}
                  >
                    {step.done ? <Check className="h-4 w-4" /> : step.number}
                  </button>
                  <div
                    aria-hidden="true"
                    className={`w-0.5 flex-1 mt-1.5 rounded-full transition-colors ${
                      step.done ? "bg-emerald-400" : "bg-stone-200"
                    }`}
                  />
                </div>

                {/* Right Connected Step Panel */}
                <div
                  className={`flex-1 min-w-0 rounded-2xl border transition-all ${
                    isActive
                      ? "border-emerald-300 bg-white shadow-sm ring-1 ring-emerald-100"
                      : step.done
                      ? "border-emerald-200/80 bg-emerald-50/30 hover:bg-emerald-50/50"
                      : "border-stone-200 bg-stone-50/50 hover:bg-white"
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isActive}
                    onClick={() => setActiveStep(step.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4 text-left"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700">
                          Step {step.number} of {steps.length}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            step.done
                              ? "bg-emerald-100 text-emerald-800"
                              : step.optional
                              ? "bg-stone-100 text-stone-600"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {step.done
                            ? "✓ Complete"
                            : step.optional
                            ? "Optional"
                            : "Required"}
                        </span>
                      </div>
                      <h3 className="font-serif text-base sm:text-lg font-bold text-stone-900">
                        {step.title}
                      </h3>
                      {!isActive && (
                        <p className="text-xs text-stone-500 truncate">
                          {step.summary}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-stone-400 transition-transform ${
                        isActive ? "rotate-180 text-emerald-700" : ""
                      }`}
                    />
                  </button>

                  {isActive && (
                    <div className="border-t border-stone-100 px-4 py-4 sm:px-5 sm:py-5 space-y-5">
                      {/* STEP 1: COUPLE & FAMILY */}
                      {step.id === "couple" && (
                        <>
                          <div className="grid sm:grid-cols-2 gap-4">
                            {(
                              [
                                ["groomName", "Groom’s name", "e.g. Aarav"],
                                ["brideName", "Bride’s name", "e.g. Diya"],
                              ] as const
                            ).map(([key, label, placeholder]) => (
                              <label
                                key={key}
                                className="text-sm font-medium text-stone-800"
                              >
                                {label} *
                                <input
                                  value={setup[key]}
                                  maxLength={160}
                                  placeholder={placeholder}
                                  onChange={(e) =>
                                    setSetup({
                                      ...setup,
                                      [key]: e.target.value,
                                    })
                                  }
                                  className={inputClass}
                                />
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-stone-500">
                            Only the groom’s and bride’s names are required.
                            Parents’ blessings and wedding hashtags are
                            optional.
                          </p>
                          <details className="rounded-xl border border-rose-100 bg-rose-50/30 p-3.5">
                            <summary className="cursor-pointer text-xs font-semibold text-rose-800">
                              + Add parents’ names &amp; couple hashtags
                              (optional)
                            </summary>
                            <div className="grid sm:grid-cols-2 gap-3.5 pt-3">
                              {(
                                [
                                  ["partnerOneMother", "Groom’s mother"],
                                  ["partnerOneFather", "Groom’s father"],
                                  ["partnerTwoMother", "Bride’s mother"],
                                  ["partnerTwoFather", "Bride’s father"],
                                  [
                                    "coupleHashtag",
                                    "Wedding hashtag for the couple",
                                  ],
                                  ["otherHashtags", "Other wedding hashtags"],
                                ] as const
                              ).map(([key, label]) => (
                                <label
                                  key={key}
                                  className="text-xs font-medium text-stone-700"
                                >
                                  {label}
                                  <input
                                    value={setup[key]}
                                    maxLength={500}
                                    onChange={(e) =>
                                      setSetup({
                                        ...setup,
                                        [key]: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      key.includes("Hashtag")
                                        ? "#AaravWedsDiya"
                                        : "Full name"
                                    }
                                    className={inputClass}
                                  />
                                </label>
                              ))}
                            </div>
                          </details>
                        </>
                      )}

                      {/* STEP 2: MOOD & CEREMONY TIMELINE */}
                      {step.id === "ceremonies" && (
                        <>
                          <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                              Celebration Mood Accent
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {EVENT_MOODS.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  aria-pressed={moodTheme === m.id}
                                  onClick={() => setMoodTheme(m.id)}
                                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                                    moodTheme === m.id
                                      ? "border-stone-900 bg-stone-900 text-white shadow-sm"
                                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                                  }`}
                                >
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: m.swatch }}
                                  />
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                                Quick Indian Ceremony Presets
                              </p>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Tap to add functions to your connected
                                itinerary. Times must fall within your event
                                dates.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {INDIAN_SUBEVENT_PRESETS.map((preset) => (
                                <button
                                  key={preset.name}
                                  type="button"
                                  disabled={setup.subEvents.length >= 50}
                                  onClick={() => {
                                    const startDay = wedding.date.slice(0, 10);
                                    setSetup({
                                      ...setup,
                                      subEvents: [
                                        ...setup.subEvents,
                                        {
                                          id: crypto.randomUUID(),
                                          name: preset.name,
                                          from: `${startDay}T11:00`,
                                          to: `${startDay}T15:00`,
                                          remarks: preset.remarks,
                                          card: null,
                                        },
                                      ],
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-40"
                                >
                                  <Plus className="h-3 w-3" />
                                  {preset.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Connected Mini Ceremony Timeline */}
                          {!setup.subEvents.length ? (
                            <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-xs text-stone-500 flex items-center gap-2.5">
                              <Calendar className="h-4 w-4 text-stone-400 shrink-0" />
                              <span>
                                No sub-events added yet. Keep a single event or
                                tap a preset above to build your ceremony
                                schedule.
                              </span>
                            </div>
                          ) : (
                            <div className="relative pl-5 space-y-4">
                              <div
                                aria-hidden="true"
                                className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-amber-300"
                              />
                              {setup.subEvents.map((sub, subIdx) => (
                                <div key={sub.id} className="relative">
                                  <span
                                    aria-hidden="true"
                                    className="absolute -left-5 top-4 h-3.5 w-3.5 rounded-full border-2 border-amber-600 bg-amber-100"
                                  />
                                  <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                                        Ceremony {subIdx + 1}
                                        {sub.name ? ` · ${sub.name}` : ""}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSetup({
                                            ...setup,
                                            subEvents: setup.subEvents.filter(
                                              (item) => item.id !== sub.id
                                            ),
                                          })
                                        }
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Remove
                                      </button>
                                    </div>
                                    <label className="block text-xs font-semibold text-stone-700">
                                      Ceremony / Function Name *
                                      <input
                                        value={sub.name}
                                        maxLength={160}
                                        onChange={(e) =>
                                          changeSub(sub.id, {
                                            name: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. Haldi, Mehndi, Sangeet"
                                        className={inputClass}
                                      />
                                    </label>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                      <label className="block text-xs font-semibold text-stone-700">
                                        From date &amp; time *
                                        <DateInput
                                          type="datetime-local"
                                          min={`${wedding.date.slice(
                                            0,
                                            10
                                          )}T00:00`}
                                          max={`${(
                                            wedding.endDate || wedding.date
                                          ).slice(0, 10)}T23:59`}
                                          value={sub.from}
                                          onChange={(e) =>
                                            changeSub(sub.id, {
                                              from: e.target.value,
                                              ...(sub.to &&
                                              sub.to < e.target.value
                                                ? { to: e.target.value }
                                                : {}),
                                            })
                                          }
                                          className={inputClass}
                                        />
                                      </label>
                                      <label className="block text-xs font-semibold text-stone-700">
                                        To date &amp; time *
                                        <DateInput
                                          type="datetime-local"
                                          min={
                                            sub.from ||
                                            `${wedding.date.slice(0, 10)}T00:00`
                                          }
                                          max={`${(
                                            wedding.endDate || wedding.date
                                          ).slice(0, 10)}T23:59`}
                                          value={sub.to}
                                          onChange={(e) =>
                                            changeSub(sub.id, {
                                              to: e.target.value,
                                            })
                                          }
                                          className={inputClass}
                                        />
                                      </label>
                                    </div>
                                    <label className="block text-xs font-semibold text-stone-700">
                                      Dress code, venue lawn or remarks
                                      <textarea
                                        rows={2}
                                        maxLength={2000}
                                        value={sub.remarks}
                                        onChange={(e) =>
                                          changeSub(sub.id, {
                                            remarks: e.target.value,
                                          })
                                        }
                                        placeholder="Venue, dress code, or anything guests should know"
                                        className={inputClass}
                                      />
                                    </label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={setup.subEvents.length >= 50}
                            onClick={() =>
                              setSetup({
                                ...setup,
                                subEvents: [
                                  ...setup.subEvents,
                                  {
                                    id: crypto.randomUUID(),
                                    name: "",
                                    from: "",
                                    to: "",
                                    remarks: "",
                                    card: null,
                                  },
                                ],
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add custom ceremony
                          </button>
                        </>
                      )}

                      {/* STEP 3: INVITATION DETAILS */}
                      {step.id === "invitation" && invitationControls}

                      {/* Connected Step Navigation Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-100">
                        {prevStep ? (
                          <button
                            type="button"
                            onClick={() => goToStep(prevStep.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back: {prevStep.shortTitle}
                          </button>
                        ) : (
                          <span className="text-[11px] text-stone-400">
                            Save a draft anytime below
                          </span>
                        )}
                        {nextStep && (
                          <button
                            type="button"
                            onClick={() => goToStep(nextStep.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                          >
                            Continue: {nextStep.shortTitle}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Final Connected Milestone: Save & Launch Invitations */}
          <div className="relative flex gap-3 sm:gap-5">
            <div className="flex flex-col items-center shrink-0">
              <span
                className={`relative z-10 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition ${
                  missing.length === 0
                    ? "bg-emerald-700 text-white shadow-sm ring-4 ring-emerald-100"
                    : "border-2 border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                <Sparkles className="h-4 w-4" />
              </span>
            </div>

            <div className="flex-1 min-w-0 rounded-2xl border border-rose-200 bg-rose-50/40 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-base font-bold text-stone-900">
                    {missing.length === 0
                      ? "All essentials ready — launch your guest list!"
                      : "Save progress or finish required steps"}
                  </h3>
                  <p className="text-xs text-stone-600">
                    {missing.length === 0
                      ? "Save your celebration setup to start tracking invited vs. remaining guests."
                      : "Fields marked * are needed before inviting contacts. You can save a draft anytime."}
                  </p>
                </div>
              </div>

              {missing.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {missing.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-white border border-amber-200 px-2.5 py-1 text-[11px] font-medium text-amber-900"
                    >
                      Still needed: {item}
                    </li>
                  ))}
                </ul>
              )}

              <div className="setup-save-bar flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={busy || uploading}
                  onClick={(e) => {
                    void save(e, false);
                  }}
                  className="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="submit"
                  disabled={busy || uploading || missing.length > 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading
                    ? "Uploading…"
                    : busy
                    ? "Saving…"
                    : "Save details & invite contacts"}
                  {!busy && !uploading && <ArrowRight className="h-4 w-4" />}
                </button>
                {notice && (
                  <p
                    role={error ? "alert" : "status"}
                    className={`text-xs sm:text-sm font-medium ${
                      error ? "text-red-700" : "text-emerald-800"
                    }`}
                  >
                    {notice}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

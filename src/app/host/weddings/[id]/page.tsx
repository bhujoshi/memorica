"use client";
import MobileEventNav, { HostTab } from "@/components/MobileEventNav";
import GuestInvitationActions from "@/components/GuestInvitationActions";
import WhatsAppInvitations from "@/components/WhatsAppInvitations";
import EventCreatedCelebration from "@/components/EventCreatedCelebration";
import EventSetupForm, { MediaPreview } from "@/components/EventSetupForm";
import InviteProgressTracker from "@/components/guests/InviteProgressTracker";
import TeamAccessManager from "@/components/roles/TeamAccessManager";
import CelebrationSocialHub from "@/components/social/CelebrationSocialHub";
import CloseFamilyRoom from "@/components/family/CloseFamilyRoom";
import FinancePlanner from "@/components/organizer/FinancePlanner";
import VendorBookingsManager from "@/components/organizer/VendorBookingsManager";
import { missingEventDetails, invitationOptions } from "@/lib/event-setup";
import {
  GUEST_GROUPS,
  GuestGroupId,
  formatCountdownLabel,
  formatShortDate,
  guestGroupLabel,
} from "@/lib/format";


import DateInput from "@/components/DateInput";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  AnalyticsEventDTO,
  EventUpdateDTO,
  GuestDTO,
  UpdateCategory,
  WeddingDTO,
  encodeUserHintHeader,
  formatWeddingDateRange,
} from "@/lib/types";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  BookUser,
  Briefcase,
  Calendar,
  CheckCircle2,
  Edit3,
  ExternalLink,
  HeartHandshake,
  Lock,
  MapPin,
  Pin,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";

interface ImportPreviewItem {
  tempId: string;
  name: string;
  email: string;
  phone: string;
  isDuplicate: boolean;
  isInvalid: boolean;
  duplicateReason: string | null;
  selected: boolean;
}

export default function HostWeddingWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, openAuthModal, refreshAuth } = useAuth();

  const [activeTab, setActiveTab] = useState<HostTab>("setup");
  const tabContentRef = useRef<HTMLDivElement>(null);
  const handleMobileTabSelect = useCallback((tab: HostTab) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      tabContentRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);
  const [wedding, setWedding] = useState<WeddingDTO | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [myRoleLabel, setMyRoleLabel] = useState<"Owner" | "Co-Admin">("Owner");
  const [guests, setGuests] = useState<GuestDTO[]>([]);
  const [updates, setUpdates] = useState<EventUpdateDTO[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const showToast = useCallback(
    (type: "success" | "error" | "info", text: string) => {
      setToast({ type, text });
      setTimeout(() => {
        setToast((prev) => (prev?.text === text ? null : prev));
      }, 4500);
    },
    []
  );

  // Event details edit form state
  const [editGroomName, setEditGroomName] = useState("");
  const [editBrideName, setEditBrideName] = useState("");

  const [editEventTitle, setEditEventTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingCardMessage, setSavingCardMessage] = useState(false);

  const syncUpdatedWedding = useCallback((updated: WeddingDTO) => {
    setWedding(updated);
    setEditGroomName(updated.setup.groomName);
    setEditBrideName(updated.setup.brideName);
    setEditEventTitle(updated.eventTitle);
    setEditDate(new Date(updated.date).toISOString().slice(0, 10));
    setEditEndDate(
      updated.endDate
        ? new Date(updated.endDate).toISOString().slice(0, 10)
        : new Date(updated.date).toISOString().slice(0, 10)
    );
    setEditVenue(updated.venue);
    setEditDescription(updated.description || "");
  }, []);

  // Manual guest entry state
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualGroup, setManualGroup] = useState<GuestGroupId>("groom_side");
  const [manualPartySize, setManualPartySize] = useState(1);
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [whatsAppGuestId, setWhatsAppGuestId] = useState("");
  const [shareRequest, setShareRequest] = useState<{guest?: GuestDTO; mode: "copy" | "web_share" | "whatsapp"} | null>(null);
  const [shareInvitationKey, setShareInvitationKey] = useState("");
  const [addingGuest, setAddingGuest] = useState(false);
  const manualNameInputRef = useRef<HTMLInputElement>(null);

  // Contact Import Review Staging state
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[] | null>(
    null
  );
  const [importSource, setImportSource] = useState<
    "contact_picker" | "file_import"
  >("contact_picker");
  const [importFallbackWarning, setImportFallbackWarning] = useState<
    string | null
  >(null);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guest list filtering
  const [guestSearch, setGuestSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GuestGroupId | "all">("all");
  const [rsvpFilter, setRsvpFilter] = useState<
    "all" | "remaining" | "invited" | "yes" | "maybe" | "no" | "pending" | "conflicts"
  >("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Event Updates state
  const [newUpdateText, setNewUpdateText] = useState("");
  const [newUpdateCategory, setNewUpdateCategory] =
    useState<UpdateCategory>("announcement");
  const [newUpdatePinned, setNewUpdatePinned] = useState(false);
  const [publishingUpdate, setPublishingUpdate] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingUpdateText, setEditingUpdateText] = useState("");
  const [editingUpdateCategory, setEditingUpdateCategory] =
    useState<UpdateCategory>("announcement");
  const [editingUpdatePinned, setEditingUpdatePinned] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setAccessError(null);
    try {
      const res = await fetch(`/api/weddings/${params.id}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          ...encodeUserHintHeader(user),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setAccessError(
          data.error || "You do not have permission to manage this wedding."
        );
        return;
      }
      if (!data.canManage) {
        setAccessError(
          "Only event organizers (Owner or Co-Admins) can manage this celebration workspace."
        );
        return;
      }

      syncUpdatedWedding(data.wedding);
      setIsOwner(Boolean(data.isOwner));
      setMyRoleLabel(data.detailedRole === "co_admin" ? "Co-Admin" : "Owner");
      setGuests(data.guests || []);
      setUpdates(data.updates || []);
      setAnalytics(data.analytics || []);

    } catch {
      setAccessError("Failed to load wedding workspace.");
    } finally {
      setLoading(false);
    }
  }, [params.id, user, syncUpdatedWedding]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleSaveWeddingDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wedding) return;
    setSavingDetails(true);
    try {
      const startObj = new Date(editDate);
      const endObj = new Date(editEndDate);
      if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
        throw new Error(
          "Please provide both start (From) and end (To) date."
        );
      }
      if (endObj.getTime() < startObj.getTime()) {
        throw new Error(
          "The end date (To) must be on or after the start date (From)."
        );
      }

      const res = await fetch(`/api/weddings/${wedding.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          ...(wedding.eventType === "Wedding"
            ? { groomName: editGroomName, brideName: editBrideName }
            : {}),

          eventTitle: editEventTitle,
          date: startObj.toISOString(),
          endDate: endObj.toISOString(),
          venue: editVenue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update details");
      syncUpdatedWedding(data.wedding);
      await refreshAuth();
      showToast("success", "Wedding details updated.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Could not save details"
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSaveInvitationCardMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wedding) return;
    setSavingCardMessage(true);
    try {
      const res = await fetch(`/api/weddings/${wedding.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          description: editDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to save invitation card");
      setWedding(data.wedding);
      await refreshAuth();
      showToast("success", "Invitation message & card updated.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Could not save invitation message"
      );
    } finally {
      setSavingCardMessage(false);
    }
  };

  const handleAddManualGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wedding) return;
    if (!manualPhone.trim()) { showToast("error", "Enter the guest’s mobile number."); return; }
    setAddingGuest(true);
    try {
      const res = await fetch(`/api/weddings/${wedding.id}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          skipDuplicates: false,
          candidates: [
            {
              name: manualName,
              email: manualEmail || undefined,
              phone: manualPhone || undefined,
              guestGroup: manualGroup,
              partySize: manualPartySize,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add guest");

      setGuests(data.guests || []);
      setManualName("");
      setManualEmail("");
      setManualPhone("");
      setManualPartySize(1);
      await loadWorkspace();
      await refreshAuth();

      if (data.duplicatesFlagged && data.duplicatesFlagged.length > 0) {
        showToast(
          "info",
          `Guest added. Note: ${data.duplicatesFlagged[0].reason}`
        );
      } else {
        showToast("success", "Guest added to your invitation list.");
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to add guest"
      );
    } finally {
      setAddingGuest(false);
    }
  };

  const openContactReviewStaging = async (
    rawCandidates: Array<{ name?: string; email?: string; phone?: string }>,
    source: "contact_picker" | "file_import"
  ) => {
    if (!wedding) return;
    setImportSource(source);
    setImportFallbackWarning(null);

    await fetch(`/api/weddings/${wedding.id}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "log_import_event",
        status: "started",
        source,
      }),
    });

    const res = await fetch(`/api/weddings/${wedding.id}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview_import",
        candidates: rawCandidates,
      }),
    });
    const data = await res.json();
    if (res.ok && data.preview) {
      setImportPreview(data.preview);
    }
  };

  const handleImportFailureFallback = async (
    reason: string,
    userMessage: string
  ) => {
    if (!wedding) return;
    await fetch(`/api/weddings/${wedding.id}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "log_import_event",
        status: "failed",
        source: "contact_picker",
        reason,
      }),
    });
    setImportPreview(null);
    setImportFallbackWarning(userMessage);
    await loadWorkspace();
    manualNameInputRef.current?.focus();
  };

  const handleDeviceContactPicker = async () => {
    if (!wedding) return;
    setImportFallbackWarning(null);

    const nav = navigator as unknown as {
      contacts?: {
        select: (
          props: string[],
          opts: { multiple: boolean }
        ) => Promise<
          Array<{ name?: string[]; email?: string[]; tel?: string[] }>
        >;
      };
    };

    if (!nav.contacts || typeof nav.contacts.select !== "function") {
      await handleImportFailureFallback(
        "unsupported_browser",
        "Direct device contact picker is only supported on mobile browsers (such as Chrome on Android or iOS Safari with Contact Picker enabled). Please upload a CSV or vCard (.vcf) contacts file, or add guests manually below."
      );
      return;
    }

    try {
      const selected = await nav.contacts.select(["name", "email", "tel"], {
        multiple: true,
      });
      if (!selected || selected.length === 0) return;
      const formatted = selected.map((c) => ({
        name: c.name?.[0] || "Contact",
        email: c.email?.[0] || "",
        phone: c.tel?.[0] || "",
      }));
      await openContactReviewStaging(formatted, "contact_picker");
    } catch {
      await handleImportFailureFallback(
        "permission_denied",
        "Contact access was declined or cancelled. You can upload a CSV/vCard file or enter guests manually below."
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const candidates: Array<{ name: string; email?: string; phone?: string }> =
        [];

      if (file.name.toLowerCase().endsWith(".vcf")) {
        const cards = text.split(/BEGIN:VCARD/i).slice(1);
        for (const card of cards) {
          const fnMatch = card.match(/FN:(.*)/i);
          const emailMatch = card.match(/EMAIL[^:]*:(.*)/i);
          const telMatch = card.match(/TEL[^:]*:(.*)/i);
          if (fnMatch || emailMatch || telMatch) {
            candidates.push({
              name: fnMatch?.[1]?.trim() || "Contact",
              email: emailMatch?.[1]?.trim(),
              phone: telMatch?.[1]?.trim(),
            });
          }
        }
      } else {
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim());
          if (
            i === 0 &&
            (cols[0]?.toLowerCase().includes("name") ||
              cols[1]?.toLowerCase().includes("email"))
          ) {
            continue;
          }
          if (cols.length >= 2) {
            candidates.push({
              name: cols[0] || `Guest ${i + 1}`,
              email: cols[1] || "",
              phone: cols[2] || "",
            });
          }
        }
      }

      if (candidates.length === 0) {
        await handleImportFailureFallback(
          "empty_or_invalid_file",
          "No valid contacts with a phone number or email were found in the selected file. Please check the file format (Name, Email, Phone) or add guests manually."
        );
        return;
      }

      await openContactReviewStaging(candidates, "file_import");
    } catch {
      await handleImportFailureFallback(
        "file_parse_error",
        "Could not read the selected contacts file. Please use a standard CSV or vCard (.vcf) file or enter guests manually."
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmStagedImport = async () => {
    if (!wedding || !importPreview) return;
    const selected = importPreview.filter((item) => item.selected);
    if (selected.length === 0) {
      showToast("error", "Please select at least one contact to add.");
      return;
    }

    setConfirmingImport(true);
    try {
      const res = await fetch(`/api/weddings/${wedding.id}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: importSource,
          skipDuplicates: false,
          candidates: selected.map((s) => ({
            name: s.name,
            email: s.email || undefined,
            phone: s.phone || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setImportPreview(null);
      await loadWorkspace();
      await refreshAuth();
      showToast(
        "success",
        `Added ${data.added?.length || 0} contact(s) to your guest list.`
      );
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to import contacts"
      );
    } finally {
      setConfirmingImport(false);
    }
  };

  const handleShareInvite = (opts: {guest?: GuestDTO; mode: "copy" | "web_share" | "whatsapp"}) => {
    setShareInvitationKey(opts.guest?.invitationKey || "");
    setShareRequest(opts);
  };
  const executeShareInvite = async (opts: {
    guest?: GuestDTO;
    mode: "copy" | "web_share" | "whatsapp";
  }) => {
    if (!wedding) return;
    if (missingEventDetails(wedding).length) { showToast("error", "Complete event details before inviting contacts."); return; }
    const choice = invitationOptions(wedding).find(o => o.key === shareInvitationKey);
    if (!choice) { showToast("error", "Choose an invitation card first."); return; }
    const query = new URLSearchParams({invitation: choice.key});
    if (opts.guest) query.set("guest", opts.guest.inviteToken);
    const url = `${window.location.origin}/invite/${wedding.slug}?${query}`;

    const shareText = opts.guest
      ? `Hi ${opts.guest.name}, you are warmly invited to ${choice.title}! View the invitation and RSVP here: ${url}`
      : `You are warmly invited to ${choice.title}! View the invitation and RSVP here: ${url}`;

    if (opts.mode === "web_share" && navigator.share) {
      try {
        await navigator.share({
          title: `${choice.title} — Invitation`,
          text: shareText,
          url,
        });
      } catch {
        return;
      }
    } else if (opts.mode === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      await navigator.clipboard.writeText(url);
      const copyKey = opts.guest ? opts.guest.id : "general";
      setCopiedId(copyKey);
      setTimeout(() => setCopiedId(null), 2500);
    }

    await fetch(`/api/weddings/${wedding.id}/guests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_shared",
        invitationKey: choice.key,
        guestId: opts.guest?.id,
        channel: opts.mode,
      }),
    });

    setShareRequest(null);
    await loadWorkspace();
    showToast(
      "info",
      opts.guest
        ? `Invitation link copied for ${opts.guest.name}.`
        : "Invitation link ready to share."
    );
  };

  const handleResolveConflict = async (
    guestId: string,
    resolution: "accept_incoming" | "keep_original" | "split_into_new_guest"
  ) => {
    if (!wedding) return;
    try {
      const res = await fetch(`/api/weddings/${wedding.id}/guests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_conflict",
          guestId,
          resolution,
        }),
      });
      if (!res.ok) throw new Error("Failed to resolve conflict");
      await loadWorkspace();
      await refreshAuth();
      showToast("success", "Guest record conflict resolved.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Could not resolve conflict"
      );
    }
  };

  const handleDeleteGuest = async (guestId: string, guestName: string) => {
    if (!wedding) return;
    const res = await fetch(`/api/weddings/${wedding.id}/guests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_guest",
        guestId,
      }),
    });
    if (res.ok) {
      await loadWorkspace();
      await refreshAuth();
      showToast("info", `Removed ${guestName} from the guest list.`);
    }
  };

  const handlePublishUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wedding) return;
    setPublishingUpdate(true);
    try {
      const res = await fetch(`/api/weddings/${wedding.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textContent: newUpdateText,
          category: newUpdateCategory,
          isPinned: newUpdatePinned,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish update");

      setNewUpdateText("");
      setNewUpdatePinned(false);
      await loadWorkspace();
      await refreshAuth();
      showToast("success", "Event update published for your verified guests.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to publish update"
      );
    } finally {
      setPublishingUpdate(false);
    }
  };

  const handleSaveEditedUpdate = async (updateId: string) => {
    if (!wedding) return;
    try {
      const res = await fetch(`/api/weddings/${wedding.id}/updates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateId,
          textContent: editingUpdateText,
          category: editingUpdateCategory,
          isPinned: editingUpdatePinned,
        }),
      });
      if (!res.ok) throw new Error("Failed to edit update");
      setEditingUpdateId(null);
      await loadWorkspace();
      showToast("success", "Event update saved.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to edit update"
      );
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (!wedding) return;
    const res = await fetch(
      `/api/weddings/${wedding.id}/updates?updateId=${encodeURIComponent(
        updateId
      )}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await loadWorkspace();
      await refreshAuth();
      showToast("info", "Event update removed.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-700" />
        <p className="text-sm text-stone-600">Loading wedding workspace...</p>
      </div>
    );
  }

  if (accessError || !wedding) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Host Access Required
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            {accessError ||
              "Only the verified owner of this wedding event can manage its guest list, details, and updates."}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {!user && (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-800 transition"
              >
                Sign In as Event Host
              </button>
            )}
            <Link
              href="/"
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const conflictGuests = guests.filter((g) => Boolean(g.hasConflict && g.conflict));
  const remainingGuestsCount = guests.filter(
    (g) => g.invitationStatus === "not_shared"
  ).length;
  const invitedGuestsCount = guests.length - remainingGuestsCount;

  const filteredGuests = guests.filter((g) => {
    if (groupFilter !== "all" && g.guestGroup !== groupFilter) return false;
    if (rsvpFilter === "remaining" && g.invitationStatus !== "not_shared") {
      return false;
    }
    if (rsvpFilter === "invited" && g.invitationStatus === "not_shared") {
      return false;
    }
    if (rsvpFilter === "conflicts" && !g.hasConflict) return false;
    if (
      !["all", "remaining", "invited", "conflicts"].includes(rsvpFilter) &&
      g.rsvpStatus !== rsvpFilter
    ) {
      return false;
    }
    if (!guestSearch.trim()) return true;
    const q = guestSearch.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      (g.email && g.email.toLowerCase().includes(q)) ||
      (g.phone && g.phone.toLowerCase().includes(q))
    );
  });

  const stats = {
    total: guests.length,
    yes: guests.filter((g) => g.rsvpStatus === "yes").length,
    maybe: guests.filter((g) => g.rsvpStatus === "maybe").length,
    no: guests.filter((g) => g.rsvpStatus === "no").length,
    pending: guests.filter((g) => g.rsvpStatus === "pending").length,
    sharedOrMore: guests.filter((g) => g.invitationStatus !== "not_shared")
      .length,
    openedOrMore: guests.filter(
      (g) =>
        g.invitationStatus === "opened" || g.invitationStatus === "responded"
    ).length,
    responded: guests.filter((g) => g.invitationStatus === "responded").length,
    registered: guests.filter((g) => Boolean(g.linkedUserId)).length,
  };

  return (
    <div className={`event-workspace mood-${wedding.moodTheme} mx-auto max-w-6xl px-4 pt-5 sm:py-8 space-y-5 ${activeTab === "guests" && selectedGuestIds.length ? "pb-56" : "pb-28"}`}>
      {toast && (
        <div
          className={`fixed bottom-28 left-4 right-4 sm:bottom-5 sm:left-auto sm:right-5 z-[70] max-w-md rounded-2xl border p-4 shadow-xl flex items-start gap-3 transition-all ${
            toast.type === "success"
              ? "bg-emerald-950 text-white border-emerald-700"
              : toast.type === "error"
              ? "bg-red-950 text-white border-red-700"
              : "bg-stone-900 text-white border-stone-700"
          }`}
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed font-medium">{toast.text}</div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-stone-400 hover:text-white ml-2"
          >
            ✕
          </button>
        </div>
      )}

      <EventCreatedCelebration eventId={wedding.id} />
      <MobileEventNav active={activeTab} ready={!missingEventDetails(wedding).length} onSelect={handleMobileTabSelect}/>
      {/* Header Banner */}
      <div className="event-hero rounded-3xl border border-rose-200 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mood-badge inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                <Sparkles className="h-3 w-3" />
                {wedding.eventType === "Other" ? wedding.otherEventType : wedding.eventType} · {myRoleLabel}
              </span>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                {formatCountdownLabel(wedding.date, wedding.endDate)}
              </span>
              <span className="hidden sm:inline text-xs text-stone-400 font-mono">
                /invite/{wedding.slug}
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
              {wedding.coupleNames ? `${wedding.coupleNames} — ${wedding.eventTitle}` : wedding.eventTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                <span>
                  {formatWeddingDateRange(wedding.date, wedding.endDate)}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                {wedding.venue}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/events/${wedding.slug}/social`}
              className="mood-button inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Celebration Page
            </Link>
            <Link
              href={`/events/${wedding.slug}/family`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 transition"
            >
              <HeartHandshake className="h-3.5 w-3.5 text-amber-700" />
              Close Family
            </Link>
            {missingEventDetails(wedding).length === 0 && <><Link
              href={`/invite/${wedding.slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition"
            >
              Public Invitation
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/events/${wedding.slug}/updates`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition"
            >
              Updates
              <Bell className="h-3.5 w-3.5 text-rose-700" />
            </Link></>}
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-3 border-t border-rose-100">
          <div className="rounded-xl bg-stone-50 px-3.5 py-2.5 border border-stone-200/70">
            <div className="text-[11px] text-stone-500">Invitation List</div>
            <div className="text-lg font-bold text-stone-900">
              {stats.total} Guests
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50/70 px-3.5 py-2.5 border border-emerald-200/70">
            <div className="text-[11px] text-emerald-700 font-medium">
              Attending (Yes)
            </div>
            <div className="text-lg font-bold text-emerald-900">
              {stats.yes}
            </div>
          </div>
          <div className="rounded-xl bg-amber-50/70 px-3.5 py-2.5 border border-amber-200/70">
            <div className="text-[11px] text-amber-700 font-medium">
              Tentative (Maybe)
            </div>
            <div className="text-lg font-bold text-amber-900">
              {stats.maybe}
            </div>
          </div>
          <div className="hidden sm:block rounded-xl bg-stone-100/80 px-3.5 py-2.5 border border-stone-200/80">
            <div className="text-[11px] text-stone-600 font-medium">
              Declined (No)
            </div>
            <div className="text-lg font-bold text-stone-800">{stats.no}</div>
          </div>
          <div className="rounded-xl bg-stone-50 px-3.5 py-2.5 border border-stone-200/70 hidden sm:block">
            <div className="text-[11px] text-stone-500">
              Registered for Updates
            </div>
            <div className="text-lg font-bold text-stone-900">
              {stats.registered} / {stats.total}
            </div>
          </div>
        </div>

        <div className="hidden sm:flex flex-wrap gap-1.5 pt-2 border-t border-stone-100">
          {[
            { id: "setup" as HostTab, label: "Setup", icon: Edit3, badge: null },
            {
              id: "guests" as HostTab,
              label: `Guests (${guests.length})`,
              icon: Users,
              badge:
                conflictGuests.length > 0
                  ? conflictGuests.length
                  : remainingGuestsCount > 0
                  ? remainingGuestsCount
                  : null,
            },
            {
              id: "share" as HostTab,
              label: "Share & WhatsApp",
              icon: Share2,
              badge: null,
            },
            {
              id: "social" as HostTab,
              label: "Social & Photos",
              icon: Sparkles,
              badge: null,
            },
            {
              id: "family" as HostTab,
              label: "Close Family",
              icon: HeartHandshake,
              badge: null,
            },
            {
              id: "budget" as HostTab,
              label: "Budget (₹)",
              icon: Wallet,
              badge: null,
            },
            {
              id: "bookings" as HostTab,
              label: "Bookings",
              icon: Briefcase,
              badge: null,
            },
            {
              id: "team" as HostTab,
              label: "Family & Admins",
              icon: ShieldCheck,
              badge: null,
            },
            {
              id: "updates" as HostTab,
              label: `Live Updates (${updates.length})`,
              icon: Bell,
              badge: null,
            },
            {
              id: "overview" as HostTab,
              label: "Event Details",
              icon: Edit3,
              badge: null,
            },
            {
              id: "analytics" as HostTab,
              label: "Insights",
              icon: BarChart3,
              badge: null,
            },
          ]
            .filter(
              (t) =>
                !missingEventDetails(wedding).length ||
                [
                  "setup",
                  "share",
                  "social",
                  "family",
                  "budget",
                  "bookings",
                  "team",
                  "overview",
                ].includes(t.id)
            )
            .map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  active
                    ? "bg-rose-700 text-white shadow-sm"
                    : "bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      active
                        ? "bg-amber-300 text-stone-950"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={tabContentRef} className="scroll-mt-20 space-y-5">
      {activeTab === "setup" && <EventSetupForm key={wedding.id} wedding={wedding} onNext={() => setActiveTab("share")} onInvite={() => setActiveTab("guests")} onSaved={syncUpdatedWedding} />}
      {activeTab !== "setup" && missingEventDetails(wedding).length > 0 && <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-sm">Complete the couple’s names, event details, invitation message and card before inviting contacts. <button onClick={()=>setActiveTab("setup")} className="underline font-semibold">Complete event details</button></div>}

      {/* TAB 1: GUEST LIST & CONTACT IMPORT */}
      {activeTab === "guests" && !missingEventDetails(wedding).length && (
        <div className="space-y-6">
          <InviteProgressTracker
            guests={guests}
            activeGroup={groupFilter}
            onSelectGroup={setGroupFilter}
            onQuickFilterRemaining={() => setRsvpFilter("remaining")}
          />

          {conflictGuests.length > 0 && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-5 space-y-4 shadow-sm">
              <div className="flex min-w-0 items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Conflicting RSVP Responses Need Review ({conflictGuests.length})
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    A guest submitted an RSVP that matched an existing contact
                    under a different name or matched two separate guest
                    records. Choose how to resolve each record below.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {conflictGuests.map((cg) => (
                  <div
                    key={cg.id}
                    className="rounded-xl bg-white border border-amber-200 p-4 space-y-3"
                  >
                    <div className="text-xs font-medium text-amber-900 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                      {cg.conflict?.reason}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-stone-200 p-3 bg-stone-50">
                        <div className="font-bold text-stone-500 uppercase text-[10px] mb-1">
                          Existing Guest Record
                        </div>
                        <div className="font-semibold text-stone-900">
                          {cg.name}
                        </div>
                        <div className="text-stone-600">
                          {cg.email || "No email"} • {cg.phone || "No phone"}
                        </div>
                        <div className="mt-1">
                          Current RSVP:{" "}
                          <span className="font-bold uppercase text-rose-700">
                            {cg.rsvpStatus}
                          </span>
                          {cg.rsvpNote && (
                            <span className="block italic text-stone-500 mt-0.5">
                              &ldquo;{cg.rsvpNote}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 p-3 bg-emerald-50/50">
                        <div className="font-bold text-emerald-700 uppercase text-[10px] mb-1">
                          New Incoming RSVP
                        </div>
                        <div className="font-semibold text-stone-900">
                          {cg.conflict?.incomingName}
                        </div>
                        <div className="text-stone-600">
                          {cg.conflict?.incomingEmail || cg.email} •{" "}
                          {cg.conflict?.incomingPhone || cg.phone}
                        </div>
                        <div className="mt-1">
                          Incoming RSVP:{" "}
                          <span className="font-bold uppercase text-emerald-700">
                            {cg.conflict?.incomingRsvpStatus}
                          </span>
                          {cg.conflict?.incomingNote && (
                            <span className="block italic text-stone-600 mt-0.5">
                              &ldquo;{cg.conflict.incomingNote}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleResolveConflict(cg.id, "accept_incoming")
                        }
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                      >
                        Accept New Response & Merge
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleResolveConflict(cg.id, "split_into_new_guest")
                        }
                        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition"
                      >
                        Keep Both as Separate Guests
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleResolveConflict(cg.id, "keep_original")
                        }
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 transition"
                      >
                        Keep Existing & Ignore Incoming
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Import Contacts Card */}
            <div className="lg:col-span-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                  <BookUser className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-900">
                    Import Contacts
                  </h2>
                  <p className="text-xs text-stone-500">
                    Review selected contacts before adding. Importing never
                    automatically sends invitations.
                  </p>
                </div>
              </div>

              {importFallbackWarning && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>{importFallbackWarning}</div>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleDeviceContactPicker}
                  className="w-full flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-left hover:bg-rose-100/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-rose-700 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-stone-900">
                        Select from Mobile Contacts
                      </div>
                      <div className="text-[11px] text-stone-600">
                        Uses your device&apos;s native Contact Picker on
                        supported browsers
                      </div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-rose-700 px-2.5 py-1 text-[11px] font-semibold text-white">
                    Open
                  </span>
                </button>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.vcf,text/csv,text/vcard"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                  >
                    <Upload className="h-4 w-4 text-stone-600" />
                    Import from CSV or vCard (.vcf) File
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Guest Entry Form */}
            <div className="lg:col-span-7 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-900">
                    Add Guest Manually
                  </h2>
                  <p className="text-xs text-stone-500">
                    Enter your guest&apos;s name and mobile number. Email is optional.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddManualGuest} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Guest Full Name *
                    </label>
                    <input
                      ref={manualNameInputRef}
                      type="text"
                      required
                      placeholder="e.g. Priya Sharma"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98111 22233"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Email Address (optional)
                    </label>
                    <input
                      type="email"
                      placeholder="priya@example.com"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Family Circle / Side
                    </label>
                    <select
                      value={manualGroup}
                      onChange={(e) =>
                        setManualGroup(e.target.value as GuestGroupId)
                      }
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                    >
                      {GUEST_GROUPS.map((grp) => (
                        <option key={grp.id} value={grp.id}>
                          {grp.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Expected Party Size
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={manualPartySize}
                      onChange={(e) =>
                        setManualPartySize(
                          Math.min(20, Math.max(1, Number(e.target.value) || 1))
                        )
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-stone-400">
                    Duplicate phone numbers or emails are automatically flagged.
                  </span>
                  <button
                    type="submit"
                    disabled={addingGuest}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {addingGuest ? "Adding..." : "Add Guest"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Contact Import Review Staging Modal */}
          {importPreview && (
            <div className="sheet-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/40 sm:p-4 backdrop-blur-sm">
              <div className="sheet-panel w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-[#ffffff] p-5 sm:p-6 shadow-2xl border border-rose-100 space-y-4 max-h-[90dvh] flex flex-col">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-stone-900">
                      Review Selected Contacts
                    </h3>
                    <p className="text-xs text-stone-500">
                      Duplicate phone numbers or emails are highlighted below.
                      Importing adds guests to your list without sending
                      invitations automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportPreview(null)}
                    className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                  {importPreview.map((item, idx) => (
                    <label
                      key={item.tempId}
                      className={`flex items-start justify-between gap-3 rounded-xl border p-3 cursor-pointer transition ${
                        item.isDuplicate
                          ? "border-amber-300 bg-amber-50/60"
                          : item.selected
                          ? "border-rose-300 bg-rose-50/30"
                          : "border-stone-200 bg-white"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          disabled={item.isInvalid}
                          onChange={(e) => {
                            const next = [...importPreview];
                            next[idx] = {
                              ...item,
                              selected: e.target.checked,
                            };
                            setImportPreview(next);
                          }}
                          className="mt-1 h-4 w-4 rounded border-stone-300 text-rose-700 focus:ring-rose-600"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-stone-900">
                              {item.name}
                            </span>
                            {item.isDuplicate && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                <AlertTriangle className="h-3 w-3" />
                                {item.duplicateReason}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            {item.email || "No email"} •{" "}
                            {item.phone || "No phone"}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-stone-500">
                        {item.selected ? "Selected" : "Skipped"}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="text-xs text-stone-500">
                    Selected:{" "}
                    <strong>
                      {importPreview.filter((i) => i.selected).length}
                    </strong>{" "}
                    of {importPreview.length} contacts
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImportPreview(null)}
                      className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={confirmingImport}
                      onClick={handleConfirmStagedImport}
                      className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                    >
                      {confirmingImport
                        ? "Adding..."
                        : "Add Selected Contacts"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Guest List Search, Filter & Table */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search guests by name, email, or phone..."
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-3 py-2 text-xs focus:border-rose-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all", label: `All (${guests.length})` },
                    { id: "remaining", label: `Remaining (${remainingGuestsCount})` },
                    { id: "invited", label: `Invited (${invitedGuestsCount})` },
                    { id: "yes", label: `Yes (${stats.yes})` },
                    { id: "maybe", label: `Maybe (${stats.maybe})` },
                    { id: "no", label: `No (${stats.no})` },
                    { id: "pending", label: `Pending (${stats.pending})` },
                    ...(conflictGuests.length > 0
                      ? [
                          {
                            id: "conflicts",
                            label: `Conflicts (${conflictGuests.length})`,
                          },
                        ]
                      : []),
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setRsvpFilter(
                        f.id as
                          | "all"
                          | "remaining"
                          | "invited"
                          | "yes"
                          | "maybe"
                          | "no"
                          | "pending"
                          | "conflicts"
                      )
                    }
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      rsvpFilter === f.id
                        ? "bg-stone-900 text-white"
                        : f.id === "remaining" && remainingGuestsCount > 0
                        ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {guests.length > 0 && <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="Select all visible guests" checked={filteredGuests.length > 0 && filteredGuests.every(g=>selectedGuestIds.includes(g.id))} disabled={!filteredGuests.length} onChange={e=>setSelectedGuestIds(prev=>e.target.checked?Array.from(new Set([...prev,...filteredGuests.map(g=>g.id)])):prev.filter(id=>!filteredGuests.some(g=>g.id===id)))}/>Select all visible guests</label>
              <GuestInvitationActions wedding={wedding} guests={guests.filter(g=>selectedGuestIds.includes(g.id))} onCompleted={async ids=>{setSelectedGuestIds(prev=>prev.filter(id=>!ids.includes(id)));await loadWorkspace();}}/>
            </div>}

            {filteredGuests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
                {guests.length === 0
                  ? "Your guest list is empty. Add guests manually or import contacts above to get started."
                  : "No guests match your current search or filter."}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filteredGuests.map((g) => (
                  <div
                    key={g.id}
                    className="guest-row py-4 flex flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <label className="flex h-11 w-9 shrink-0 items-start justify-center pt-1"><input type="checkbox" className="h-5 w-5 accent-rose-700" aria-label={`Select ${g.name}`} checked={selectedGuestIds.includes(g.id)} onChange={e=>setSelectedGuestIds(prev=>e.target.checked?[...prev,g.id]:prev.filter(id=>id!==g.id))}/></label>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-stone-900">
                          {g.name}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            g.rsvpStatus === "yes"
                              ? "bg-emerald-100 text-emerald-800"
                              : g.rsvpStatus === "maybe"
                              ? "bg-amber-100 text-amber-800"
                              : g.rsvpStatus === "no"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          RSVP: {g.rsvpStatus}
                        </span>

                        <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                          {guestGroupLabel(g.guestGroup)}
                        </span>

                        {g.partySize > 1 && (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            {g.partySize} people
                          </span>
                        )}

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            g.invitationStatus === "responded"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : g.invitationStatus === "opened"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : g.invitationStatus === "link_shared"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-amber-200 bg-amber-50/70 text-amber-900"
                          }`}
                        >
                          {g.invitationStatus === "not_shared" &&
                            "Remaining · Not Yet Invited"}
                          {g.invitationStatus === "link_shared" &&
                            "Link Shared (Delivery Unconfirmed)"}
                          {g.invitationStatus === "opened" &&
                            "Invitation Opened"}
                          {g.invitationStatus === "responded" &&
                            "RSVP Submitted"}
                        </span>

                        {g.linkedUserId && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            <UserCheck className="h-3 w-3" />
                            Registered for Updates
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-stone-500 flex flex-wrap items-center gap-3">
                        {g.email && <span>{g.email}</span>}
                        {g.phone && <span>{g.phone}</span>}
                        {(g.plannedArrival || g.plannedDeparture) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            <Calendar className="h-3 w-3" />
                            Planned: {formatShortDate(g.plannedArrival) || "TBD"}
                            {g.plannedDeparture &&
                            g.plannedDeparture !== g.plannedArrival
                              ? ` – ${formatShortDate(g.plannedDeparture)}`
                              : ""}
                            {!g.sharePlannedDates && " (Private)"}
                          </span>
                        )}
                      </div>

                      {g.rsvpNote && (
                        <div className="text-xs italic text-stone-600 bg-stone-50 rounded-lg px-2.5 py-1 border border-stone-200/60 inline-block mt-1">
                          &ldquo;{g.rsvpNote}&rdquo;
                        </div>
                      )}
                    </div>

                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeleteGuest(g.id, g.name)}
                        className="rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                        title="Remove guest"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVITATION MESSAGE / CARD & SHARE INVITATIONS */}
      {activeTab === "share" && <div className="space-y-6">
        <WhatsAppInvitations key={`${wedding.id}:${whatsAppGuestId}`} wedding={wedding} guests={guests} initialGuestId={whatsAppGuestId} onSent={loadWorkspace} onWeddingUpdated={syncUpdatedWedding} onOpenSetup={() => setActiveTab("setup")} />
        <EventSetupForm mode="invitations" wedding={wedding} onSaved={syncUpdatedWedding} onInvite={() => setActiveTab("guests")} />
        {!missingEventDetails(wedding).length && <section className="rounded-2xl bg-white border p-6"><h2 className="font-semibold mb-4">Share your invitation</h2><div className="flex flex-wrap gap-3">
          <button className="rounded-xl bg-rose-700 text-white px-4 py-3" onClick={() => handleShareInvite({mode:"copy"})}>Choose card & copy link</button>
          <button className="rounded-xl border px-4 py-3" onClick={() => handleShareInvite({mode:"web_share"})}>Share using device</button>
          <button className="rounded-xl border px-4 py-3" onClick={() => handleShareInvite({mode:"whatsapp"})}>Open WhatsApp</button>
        </div></section>}
      </div>}
      {shareRequest && <div className="sheet-overlay fixed inset-0 z-50 bg-stone-950/40 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Choose invitation card"><div className="sheet-panel bg-[#ffffff] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[90dvh] overflow-auto space-y-4">
        <h2 className="text-xl font-semibold">Which invitation would you like to share?</h2>
        <label className="block">Event invitation<select className="mt-2 w-full rounded-xl border p-3" value={shareInvitationKey} onChange={e => setShareInvitationKey(e.target.value)}><option value="">Choose an event or sub-event</option>{invitationOptions(wedding).map(o => <option key={o.key} value={o.key}>{o.title}</option>)}</select></label>
        {invitationOptions(wedding).filter(o => o.key === shareInvitationKey).map(o => <MediaPreview key={o.key} asset={o.card} />)}
        <div className="flex gap-3"><button className="border rounded-xl px-4 py-2" onClick={() => setShareRequest(null)}>Cancel</button><button disabled={!invitationOptions(wedding).some(o => o.key === shareInvitationKey)} className="bg-rose-700 text-white rounded-xl px-4 py-2 disabled:opacity-50" onClick={() => executeShareInvite(shareRequest).catch(e => showToast("error", e.message || "Unable to share invitation"))}>Continue with selected invitation</button></div>
      </div></div>}

      {/* NEW ORGANIZER & COLLABORATION TABS */}
      {activeTab === "social" && (
        <CelebrationSocialHub slugOrId={wedding.id} embedded />
      )}
      {activeTab === "family" && (
        <CloseFamilyRoom slugOrId={wedding.id} embedded />
      )}
      {activeTab === "budget" && <FinancePlanner weddingId={wedding.id} />}
      {activeTab === "bookings" && (
        <VendorBookingsManager weddingId={wedding.id} />
      )}
      {activeTab === "team" && <TeamAccessManager weddingId={wedding.id} />}

      {/* TAB 3: LIVE EVENT UPDATES MANAGER */}
      {activeTab === "updates" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4 h-fit">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                <Send className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Publish Live Event Update
                </h2>
                <p className="text-xs text-stone-500">
                  Visible exclusively to registered and verified guests of this
                  wedding.
                </p>
              </div>
            </div>

            <form onSubmit={handlePublishUpdate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Category
                </label>
                <select
                  value={newUpdateCategory}
                  onChange={(e) =>
                    setNewUpdateCategory(e.target.value as UpdateCategory)
                  }
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                >
                  <option value="announcement">General Announcement</option>
                  <option value="schedule">Schedule / Timing Update</option>
                  <option value="logistics">
                    Transport & Venue Logistics
                  </option>
                  <option value="welcome">Welcome Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Message *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Share schedule updates, shuttle timings, or venue directions..."
                  value={newUpdateText}
                  onChange={(e) => setNewUpdateText(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newUpdatePinned}
                  onChange={(e) => setNewUpdatePinned(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-rose-700"
                />
                <span>Pin this update to the top of the guest feed</span>
              </label>

              <button
                type="submit"
                disabled={publishingUpdate}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50 transition"
              >
                <Send className="h-3.5 w-3.5" />
                {publishingUpdate ? "Publishing..." : "Publish Update"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">
                Published Updates ({updates.length})
              </h3>
              <span className="text-[11px] text-stone-500">
                Most recent shown first
              </span>
            </div>

            {updates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-xs text-stone-500">
                No event updates have been published yet.
              </div>
            ) : (
              updates.map((u) => (
                <div
                  key={u.id}
                  className={`rounded-2xl border bg-white p-5 shadow-sm space-y-3 ${
                    u.isPinned ? "border-rose-300" : "border-stone-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {u.isPinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
                          <Pin className="h-3 w-3" />
                          Pinned
                        </span>
                      )}
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-700">
                        {u.category}
                      </span>
                      <span className="text-xs text-stone-400">
                        {new Date(u.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {u.updatedAt !== u.createdAt && " (Edited)"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUpdateId(u.id);
                          setEditingUpdateText(u.textContent);
                          setEditingUpdateCategory(u.category);
                          setEditingUpdatePinned(Boolean(u.isPinned));
                        }}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                        title="Edit update"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUpdate(u.id)}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove update"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingUpdateId === u.id ? (
                    <div className="space-y-3 pt-1">
                      <textarea
                        rows={3}
                        value={editingUpdateText}
                        onChange={(e) => setEditingUpdateText(e.target.value)}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-stone-600">
                          <input
                            type="checkbox"
                            checked={editingUpdatePinned}
                            onChange={(e) =>
                              setEditingUpdatePinned(e.target.checked)
                            }
                            className="h-3.5 w-3.5 rounded"
                          />
                          Pinned
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUpdateId(null)}
                            className="rounded-lg border border-stone-200 px-3 py-1 text-xs text-stone-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditedUpdate(u.id)}
                            className="rounded-lg bg-rose-700 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-line">
                      {u.textContent}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: EDIT WEDDING DETAILS */}
      {activeTab === "overview" && (
        <div className="max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="font-serif text-xl font-bold text-stone-900">
              Edit Event Details
            </h2>
            <p className="text-xs text-stone-500">
              Changes immediately update your public invitation page and guest
              updates feed.
            </p>
          </div>

          <form onSubmit={handleSaveWeddingDetails} className="space-y-4">
            {wedding.eventType === "Wedding" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Groom’s name (for WhatsApp)
                  </label>
                  <input
                    type="text"
                    maxLength={160}
                    placeholder="e.g. Arjun"
                    value={editGroomName}
                    onChange={(e) => setEditGroomName(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Bride’s name (for WhatsApp)
                  </label>
                  <input
                    type="text"
                    maxLength={160}
                    placeholder="e.g. Meera"
                    value={editBrideName}
                    onChange={(e) => setEditBrideName(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                required
                value={editEventTitle}
                onChange={(e) => setEditEventTitle(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  From (Start Date) *
                </label>
                <DateInput
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditDate(val);
                    if (val && (!editEndDate || editEndDate < val)) {
                      setEditEndDate(val);
                    }
                  }}
                  className="block w-full max-w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  To (End Date) *
                </label>
                <DateInput
                  type="date"
                  required
                  min={editDate || undefined}
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="block w-full max-w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
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
                value={editVenue}
                onChange={(e) => setEditVenue(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              {isOwner ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      confirm(
                        "Are you sure you want to delete this wedding event? Guests will no longer be able to access its invitation or updates."
                      )
                    ) {
                      await fetch(`/api/weddings/${wedding.id}`, {
                        method: "DELETE",
                      });
                      await refreshAuth();
                      router.push("/");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Wedding
                </button>
              ) : (
                <span className="text-xs text-stone-400">
                  Only the event Owner can delete this celebration.
                </span>
              )}

              <button
                type="submit"
                disabled={savingDetails}
                className="rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50"
              >
                {savingDetails ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: INSIGHTS & ACTIVITY */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
            <div>
              <h2 className="font-serif text-xl font-bold text-stone-900">
                Invitation & RSVP Funnel
              </h2>
              <p className="text-xs text-stone-500">
                Track how guests engage with your wedding invitation and live
                updates.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  label: "Guests Added to Invitation List",
                  count: stats.total,
                  pct: stats.total ? 100 : 0,
                  color: "bg-stone-800",
                },
                {
                  label: "Invitation Link Shared",
                  count: stats.sharedOrMore,
                  pct: stats.total
                    ? Math.round((stats.sharedOrMore / stats.total) * 100)
                    : 0,
                  color: "bg-amber-600",
                },
                {
                  label: "Invitation Opened",
                  count: stats.openedOrMore,
                  pct: stats.total
                    ? Math.round((stats.openedOrMore / stats.total) * 100)
                    : 0,
                  color: "bg-blue-600",
                },
                {
                  label: "RSVP Submitted (Yes / No / Maybe)",
                  count: stats.responded,
                  pct: stats.total
                    ? Math.round((stats.responded / stats.total) * 100)
                    : 0,
                  color: "bg-rose-600",
                },
                {
                  label: "Registered & Verified for Live Updates",
                  count: stats.registered,
                  pct: stats.total
                    ? Math.round((stats.registered / stats.total) * 100)
                    : 0,
                  color: "bg-emerald-600",
                },
              ].map((step) => (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800">
                      {step.label}
                    </span>
                    <span className="font-mono text-stone-600">
                      {step.count} ({step.pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${step.color} transition-all`}
                      style={{ width: `${Math.max(step.pct, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-stone-900">
              Recent Activity ({analytics.length})
            </h3>
            <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
              {analytics.map((ev) => (
                <div
                  key={ev.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-800">
                      {ev.eventType}
                    </span>
                    <span className="text-stone-800 font-medium">
                      {ev.summary}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-stone-400 shrink-0">
                    <span>{ev.actorRole}</span>
                    <span>
                      {new Date(ev.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

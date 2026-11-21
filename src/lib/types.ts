export type AccountStatus = "verified" | "pending";

export interface UserDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  googleSub: string | null;
  accountStatus: AccountStatus;
  onboardingCompleted: boolean;
  createdAt: string;
}

import type { EventSetup } from "./event-setup";
import type { EventMoodId, GuestGroupId, SocialReactionId } from "./format";

export type EventAccessRole =
  | "owner"
  | "co_admin"
  | "close_family"
  | "guest"
  | "none";

export interface WeddingDTO {
  eventType: string;
  otherEventType: string;
  moodTheme: EventMoodId;
  setup: EventSetup;
  id: string;
  slug: string;
  ownerUserId: string;
  eventTitle: string;
  coupleNames: string;
  date: string;
  endDate: string | null;
  venue: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export function formatWeddingDate(isoString?: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatWeddingDateRange(
  startIso: string,
  endIso?: string | null
): string {
  const fromStr = formatWeddingDate(startIso);
  const toStr = formatWeddingDate(endIso);
  if (fromStr && toStr) {
    return `From ${fromStr} to ${toStr}`;
  }
  return fromStr;
}

export function encodeUserHintHeader(
  user?: UserDTO | null
): Record<string, string> {
  if (!user) return {};
  try {
    const json = JSON.stringify(user);
    const b64 =
      typeof window !== "undefined"
        ? window.btoa(unescape(encodeURIComponent(json)))
        : Buffer.from(json, "utf-8").toString("base64");
    return { "x-wm-user-hint": b64 };
  } catch {
    return {};
  }
}

export type InvitationStatus =
  | "not_shared"
  | "link_shared"
  | "opened"
  | "responded";

export type RsvpStatus = "pending" | "yes" | "no" | "maybe";

export type GuestSource =
  | "manual"
  | "contact_picker"
  | "file_import"
  | "self_rsvp";

export interface GuestConflictDTO {
  reason: string;
  incomingName: string;
  incomingEmail?: string | null;
  incomingPhone?: string | null;
  incomingRsvpStatus: RsvpStatus;
  incomingNote?: string | null;
  duplicateOfGuestId?: string | null;
}

export interface GuestDTO {
  invitationKey: string;
  id: string;
  weddingId: string;
  name: string;
  email: string | null;
  phone: string | null;
  guestGroup: GuestGroupId;
  partySize: number;
  inviteToken: string;
  invitationStatus: InvitationStatus;
  rsvpStatus: RsvpStatus;
  rsvpNote: string | null;
  rsvpUpdatedAt: string | null;
  plannedArrival: string | null;
  plannedDeparture: string | null;
  sharePlannedDates: boolean;
  linkedUserId: string | null;
  source: GuestSource;
  hasConflict: boolean;
  conflict: GuestConflictDTO | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateCategory =
  | "announcement"
  | "schedule"
  | "logistics"
  | "welcome";

export type PublicationStatus = "published" | "archived";

export interface EventUpdateDTO {
  id: string;
  weddingId: string;
  authorUserId: string;
  authorName: string;
  textContent: string;
  category: UpdateCategory;
  isPinned: boolean;
  publicationStatus: PublicationStatus;
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsEventType =
  | "wedding_created"
  | "host_onboarding_completed"
  | "contact_import_started"
  | "contact_import_completed"
  | "contact_import_failed"
  | "guest_added"
  | "invitation_sharing_initiated"
  | "invitation_opened"
  | "rsvp_submitted"
  | "guest_registration_completed"
  | "event_update_published"
  | "guest_viewed_updates";

export interface AnalyticsEventDTO {
  id: string;
  weddingId: string | null;
  eventType: AnalyticsEventType;
  actorRole: "host" | "guest" | "anonymous";
  summary: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface TeamMemberDTO {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: "owner" | "co_admin" | "close_family" | "guest";
  joinedAt: string;
}

export interface RoleInviteDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "co_admin" | "close_family";
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
}

export interface SocialCommentDTO {
  id: string;
  postId: string;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
}

export interface SocialPostDTO {
  id: string;
  weddingId: string;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  space: "social" | "family";
  kind: "moment" | "wish" | "plan" | "photo";
  content: string;
  mediaAssetId: string | null;
  isPinned: boolean;
  createdAt: string;
  reactions: Record<SocialReactionId, number>;
  myReactions: SocialReactionId[];
  comments: SocialCommentDTO[];
}

export interface PlannedGuestAttendanceDTO {
  id: string;
  name: string;
  rsvpStatus: RsvpStatus;
  partySize: number;
  guestGroup: GuestGroupId;
  plannedArrival: string | null;
  plannedDeparture: string | null;
  rsvpNote: string | null;
}

export interface SharedPhotoDTO {
  id: string;
  weddingId: string;
  uploaderUserId: string;
  uploaderName: string;
  albumName: string;
  caption: string | null;
  assetId: string;
  createdAt: string;
}

export interface FamilyPollOptionDTO {
  id: string;
  label: string;
  voteCount: number;
  votedByMe: boolean;
  voters: string[];
}

export interface FamilyPollDTO {
  id: string;
  weddingId: string;
  creatorUserId: string;
  creatorName: string;
  question: string;
  category: string;
  allowMultiple: boolean;
  isClosed: boolean;
  totalVotes: number;
  totalVoters: number;
  createdAt: string;
  options: FamilyPollOptionDTO[];
}

export interface FamilyTaskDTO {
  id: string;
  weddingId: string;
  creatorUserId: string;
  creatorName: string;
  title: string;
  assigneeName: string | null;
  category: string;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetItemDTO {
  id: string;
  weddingId: string;
  category: string;
  title: string;
  estimatedAmount: number;
  actualAmount: number;
  paidAmount: number;
  paidBy: string | null;
  paymentStatus: "planned" | "partial" | "paid";
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorBookingDTO {
  id: string;
  weddingId: string;
  category: string;
  vendorName: string;
  contactName: string | null;
  contactPhone: string | null;
  status: "shortlisted" | "booked" | "advance_paid" | "fully_paid" | "cancelled";
  totalAmount: number;
  advancePaid: number;
  balanceDueDate: string | null;
  eventDay: string | null;
  notes: string | null;
  receiptAssetId: string | null;
  createdAt: string;
  updatedAt: string;
}

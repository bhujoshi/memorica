export type EventMoodId =
  | "emerald"
  | "haldi"
  | "mehndi"
  | "sangeet"
  | "reception";

export interface EventMoodOption {
  id: EventMoodId;
  label: string;
  tagline: string;
  swatch: string;
}

export const EVENT_MOODS: EventMoodOption[] = [
  {
    id: "emerald",
    label: "Royal Emerald",
    tagline: "Crisp white, signature emerald & gold",
    swatch: "#047857",
  },
  {
    id: "haldi",
    label: "Haldi Marigold",
    tagline: "Sunlit marigold & warm festive amber",
    swatch: "#d97706",
  },
  {
    id: "mehndi",
    label: "Mehndi Garden",
    tagline: "Fresh garden foliage & henna green",
    swatch: "#15803d",
  },
  {
    id: "sangeet",
    label: "Sangeet Royal Night",
    tagline: "Festive royal indigo & shimmer gold",
    swatch: "#4338ca",
  },
  {
    id: "reception",
    label: "Reception Ivory & Gold",
    tagline: "Warm ivory & timeless antique gold",
    swatch: "#92400e",
  },
];

export const VALID_EVENT_MOODS = new Set<string>(EVENT_MOODS.map((m) => m.id));

export function normalizeEventMood(value?: string | null): EventMoodId {
  if (value && VALID_EVENT_MOODS.has(value)) return value as EventMoodId;
  return "emerald";
}

export const INDIAN_SUBEVENT_PRESETS = [
  { name: "Roka", remarks: "Intimate family blessing & shagun ceremony" },
  { name: "Haldi", remarks: "Dress code: Shades of yellow & marigold" },
  { name: "Mehndi", remarks: "Henna, folk music & daytime festivities" },
  { name: "Sangeet", remarks: "Dance performances, cocktails & dinner" },
  { name: "Baraat & Pheras", remarks: "Traditional wedding ceremony & blessings" },
  { name: "Reception", remarks: "Evening dinner & celebration with family and friends" },
] as const;

export type GuestGroupId =
  | "groom_side"
  | "bride_side"
  | "close_family"
  | "friends"
  | "colleagues"
  | "general";

export const GUEST_GROUPS: Array<{ id: GuestGroupId; label: string }> = [
  { id: "groom_side", label: "Groom's Side" },
  { id: "bride_side", label: "Bride's Side" },
  { id: "close_family", label: "Close Family" },
  { id: "friends", label: "Friends" },
  { id: "colleagues", label: "Colleagues" },
  { id: "general", label: "General" },
];

export const VALID_GUEST_GROUPS = new Set<string>(GUEST_GROUPS.map((g) => g.id));

export function normalizeGuestGroup(value?: string | null): GuestGroupId {
  if (value && VALID_GUEST_GROUPS.has(value)) return value as GuestGroupId;
  return "general";
}

export function guestGroupLabel(group?: string | null): string {
  return GUEST_GROUPS.find((g) => g.id === group)?.label || "General";
}

export const BUDGET_CATEGORIES = [
  { id: "venue", label: "Venue & Stay" },
  { id: "catering", label: "Catering & Sweets" },
  { id: "decor", label: "Decor & Mandap" },
  { id: "photography", label: "Photo & Video" },
  { id: "outfits", label: "Outfits & Styling" },
  { id: "jewelry", label: "Jewelry & Shagun" },
  { id: "entertainment", label: "DJ, Dhol & Sangeet" },
  { id: "gifts", label: "Favors & Gifts" },
  { id: "travel", label: "Guest Travel & Logistics" },
  { id: "rituals", label: "Pandit & Rituals" },
  { id: "other", label: "Other Expenses" },
] as const;

export type BudgetCategoryId = (typeof BUDGET_CATEGORIES)[number]["id"];
export const VALID_BUDGET_CATEGORIES = new Set<string>(
  BUDGET_CATEGORIES.map((c) => c.id)
);

export function budgetCategoryLabel(id: string): string {
  return BUDGET_CATEGORIES.find((c) => c.id === id)?.label || "Other Expenses";
}

export const POLL_CATEGORIES = [
  { id: "venue", label: "Venue" },
  { id: "menu", label: "Food & Menu" },
  { id: "outfit", label: "Outfits & Theme" },
  { id: "music", label: "Music & Sangeet" },
  { id: "schedule", label: "Dates & Schedule" },
  { id: "ritual", label: "Rituals" },
  { id: "other", label: "Planning" },
] as const;

export type PollCategoryId = (typeof POLL_CATEGORIES)[number]["id"];
export const VALID_POLL_CATEGORIES = new Set<string>(
  POLL_CATEGORIES.map((c) => c.id)
);

export const PHOTO_ALBUMS = [
  "All Memories",
  "Roka & Engagement",
  "Haldi",
  "Mehndi",
  "Sangeet",
  "Wedding Ceremony",
  "Reception",
  "Family Moments",
] as const;

export const SOCIAL_REACTIONS = [
  { id: "heart", symbol: "❤️", label: "Love" },
  { id: "party", symbol: "🎉", label: "Celebrate" },
  { id: "blessings", symbol: "🙏", label: "Blessings" },
  { id: "sparkles", symbol: "✨", label: "Sparkle" },
] as const;

export type SocialReactionId = (typeof SOCIAL_REACTIONS)[number]["id"];
export const VALID_SOCIAL_REACTIONS = new Set<string>(
  SOCIAL_REACTIONS.map((r) => r.id)
);

/** Formats whole INR rupees with Indian numbering (e.g. ₹1,50,000). */
export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safe);
}

/** Friendly countdown copy for celebration heroes. */
export function formatCountdownLabel(
  startIso: string,
  endIso?: string | null,
  now = new Date()
): string {
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
  const startStr = startIso.slice(0, 10);
  const endStr = (endIso || startIso).slice(0, 10);

  if (todayStr > endStr) return "Memories saved";
  if (todayStr >= startStr && todayStr <= endStr) return "Happening now!";

  const startMs = Date.parse(`${startStr}T00:00:00Z`);
  const todayMs = Date.parse(`${todayStr}T00:00:00Z`);
  const diffDays = Math.max(1, Math.round((startMs - todayMs) / (1000 * 60 * 60 * 24)));
  return diffDays === 1 ? "Tomorrow!" : `${diffDays} days to go`;
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

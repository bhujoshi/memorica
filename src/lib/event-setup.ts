export const EVENT_TYPES = [
  "Birthday",
  "Anniversary",
  "Housewarming / Griha Pravesh",
  "Wedding",
  "Engagement",
  "Baby Shower",
  "Festival Gathering",
  "Family Reunion",
  "Office outing",
  "Conference meeting",
  "Other",
];
export interface EventMedia { id: string; name: string; mime: string }
export interface SubEvent { id: string; name: string; from: string; to: string; remarks: string; card: EventMedia | null }
export interface EventSetup {
  groomName: string;
  brideName: string;
  invitationMode: "universal" | "specific";
  subEvents: SubEvent[];
  partnerOneMother: string;
  partnerOneFather: string;
  partnerTwoMother: string;
  partnerTwoFather: string;
  coupleHashtag: string;
  otherHashtags: string;
  card: EventMedia | null;
  photos: EventMedia[];
}
export const EMPTY_SETUP: EventSetup = {
  groomName: "", brideName: "",
  invitationMode: "universal", subEvents: [],
  partnerOneMother: "", partnerOneFather: "", partnerTwoMother: "", partnerTwoFather: "",
  coupleHashtag: "", otherHashtags: "", card: null, photos: [],
};
export function normalizeEventSetup(value: unknown): EventSetup {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid event details.");
  const input = value as Record<string, unknown>;
  const result = { ...EMPTY_SETUP };
  for (const key of ["groomName", "brideName", "partnerOneMother", "partnerOneFather", "partnerTwoMother", "partnerTwoFather", "coupleHashtag", "otherHashtags"] as const) {
    if (input[key] !== undefined && typeof input[key] !== "string") throw new Error("Invalid event details.");
    result[key] = String(input[key] || "").trim().slice(0, 500);
  }
  function media(value: unknown): EventMedia {
    const m = value as EventMedia;
    if (!m || typeof m.id !== "string" || !/^[a-z0-9]+$/.test(m.id) || typeof m.name !== "string" || typeof m.mime !== "string") throw new Error("Invalid uploaded media.");
    return { id: m.id, name: m.name.slice(0, 255), mime: m.mime };
  }
  if (input.invitationMode !== undefined && !["universal", "specific"].includes(String(input.invitationMode))) throw new Error("Choose a valid invitation mode.");
  result.invitationMode = input.invitationMode === "specific" ? "specific" : "universal";
  if (input.subEvents !== undefined && !Array.isArray(input.subEvents)) throw new Error("Invalid sub-events.");
  const entries = (input.subEvents || []) as unknown[];
  if (entries.length > 50) throw new Error("You can add up to 50 sub-events.");
  const ids = new Set<string>();
  result.subEvents = entries.map(value => {
    const entry = value as Record<string, unknown>;
    if (!entry || typeof entry.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id) || entry.id === "overall" || ids.has(entry.id)) throw new Error("Invalid or duplicate sub-event.");
    ids.add(entry.id);
    for (const key of ["name", "from", "to", "remarks"]) if (typeof entry[key] !== "string") throw new Error("Invalid sub-event details.");
    const from = String(entry.from), to = String(entry.to);
    for (const time of [from, to].filter(Boolean)) if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time) || !Number.isFinite(Date.parse(time + "Z")) || new Date(time + "Z").toISOString().slice(0,16) !== time) throw new Error("Choose a valid date and time for each sub-event.");
    if (from && to && to < from) throw new Error("A sub-event’s To date and time must be on or after From.");
    return {id:entry.id,name:String(entry.name).trim().slice(0,160),from,to,remarks:String(entry.remarks).trim().slice(0,2000),card:entry.card ? media(entry.card) : null};
  });
  result.card = input.card ? media(input.card) : null;
  if (input.photos !== undefined && !Array.isArray(input.photos)) throw new Error("Invalid couple photos.");
  result.photos = (Array.isArray(input.photos) ? input.photos : []).slice(0, 8).map(media);
  return result;
}
export function parseEventSetup(raw: string): EventSetup {
  try { return normalizeEventSetup(JSON.parse(raw)); } catch { return { ...EMPTY_SETUP, photos: [] }; }
}
export function missingEventDetails(event: { eventType: string; coupleNames: string; date: string; endDate?: string | null; venue: string; description?: string | null; setup: EventSetup }): string[] {
  const missing: string[] = [];
  if (!event.date || !event.endDate) missing.push("Event date range");
  if (!event.venue.trim()) missing.push("Venue");
  if (event.eventType === "Wedding") {
    if (!event.setup.groomName.trim()) missing.push("Groom’s name");
    if (!event.setup.brideName.trim()) missing.push("Bride’s name");
  }
  if (!event.description?.trim()) missing.push("Invitation message");
  for (const [index, sub] of event.setup.subEvents.map((sub, index) => [index, sub] as const)) {
    if (!sub.name.trim() || !sub.from || !sub.to) missing.push(`Sub-event ${index + 1}: name and date/time range`);
    else if (sub.to < sub.from || sub.from.slice(0,10) < event.date.slice(0,10) || sub.to.slice(0,10) > (event.endDate || event.date).slice(0,10)) missing.push(`Sub-event ${index + 1}: dates within the event range`);
  }
  if (event.setup.invitationMode === "universal" || !event.setup.subEvents.length) {
    if (!event.setup.card) missing.push("Overall invitation card");
  } else {
    for (const [index, sub] of event.setup.subEvents.map((sub, index) => [index, sub] as const)) if (!sub.card) missing.push(`Invitation card: ${sub.name || `Sub-event ${index + 1}`}`);
  }
  return missing;
}

export function invitationOptions(event: { eventTitle: string; setup: EventSetup }): {key:string;title:string;card:EventMedia}[] {
  const options: {key:string;title:string;card:EventMedia}[] = [];
  if (event.setup.card) options.push({key:"overall",title:event.eventTitle,card:event.setup.card});
  for (const sub of event.setup.subEvents) {
    const card = event.setup.invitationMode === "universal" ? event.setup.card : sub.card;
    if (card && sub.name) options.push({key:sub.id,title:sub.name,card});
  }
  return options;
}
export function validateSubEventDates(setup: EventSetup, from: Date, to: Date | null) {
  for (const sub of setup.subEvents) {
    if ((sub.from && sub.from.slice(0,10) < from.toISOString().slice(0,10)) || (sub.to && to && sub.to.slice(0,10) > to.toISOString().slice(0,10))) throw new Error(`${sub.name || "Sub-event"} must fall within the overall event date range.`);
  }
}
export function formatSubEventTime(value: string): string {
  const date = new Date(value + "Z");
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-US", {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:"UTC"}) : "";
}

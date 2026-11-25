import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { validEmail } from "./contact-validation";

export interface ContactCandidate { name?: string; phone?: string; email?: string; phoneOptions?: string[] }
export interface ContactPreview { tempId: string; name: string; phone: string; email: string; phoneOptions: string[]; isDuplicate: boolean; isInvalid: boolean; duplicateReason: string | null; selected: boolean }
export interface DeviceContact { name?: string[]; tel?: string[] }
export interface DeviceContacts { select: (properties: string[], options: { multiple: boolean }) => Promise<DeviceContact[]> }
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
export function importedPhone(value: unknown): string {
  const raw = text(value).replace(/^tel:/i, "");
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return "";
  const phone = parsePhoneNumberFromString(raw, "IN");
  return phone?.isValid() ? phone.number : "";
}
export function contactValues(raw: ContactCandidate) {
  const name = text(raw.name).slice(0, 160), email = text(raw.email).toLowerCase();
  const phone = importedPhone(raw.phone);
  const error = !name ? "Name is required." : !phone ? "Enter a valid mobile number, including the country code for numbers outside India." : email && !validEmail(email) ? "Enter a valid email address or leave it blank." : null;
  return { name, phone, email, error };
}
export function contactPreview(candidates: ContactCandidate[], existing: { email?: string | null; phone?: string | null }[]): ContactPreview[] {
  const phones = new Set(existing.map(c => importedPhone(c.phone)).filter(Boolean));
  const emails = new Set(existing.map(c => text(c.email).toLowerCase()).filter(Boolean));
  return candidates.map((raw, index) => {
    const value = contactValues(raw);
    const duplicate = Boolean(value.phone && phones.has(value.phone) || value.email && emails.has(value.email));
    // Invalid rows must not prevent a later valid contact from being selected.
    if (!value.error) { if (value.phone) phones.add(value.phone); if (value.email) emails.add(value.email); }
    return { tempId: `contact_${index}`, name: value.name, phone: value.phone || text(raw.phone), email: value.email,
      phoneOptions: Array.from(new Set((raw.phoneOptions || []).map(importedPhone).filter(Boolean))),
      isDuplicate: duplicate, isInvalid: Boolean(value.error), duplicateReason: value.error || (duplicate ? "Already in the guest list or selected contacts." : null), selected: !duplicate && !value.error };
  });
}
export async function pickDeviceContacts(contacts: DeviceContacts): Promise<ContactCandidate[]> {
  // Do not await analytics, permissions or network work before select: it needs the user's tap.
  const selected = await contacts.select(["name", "tel"], { multiple: true });
  return selected.map(contact => {
    const phones = Array.from(new Set((contact.tel || []).map(importedPhone).filter(Boolean)));
    return { name: contact.name?.find(name => name.trim()) || "", phone: phones[0] || contact.tel?.[0] || "", phoneOptions: phones };
  });
}
export function parseContactFile(content: string, filename: string): ContactCandidate[] {
  if (/\.vcf$/i.test(filename)) {
    const unfolded = content.replace(/\r?\n[ \t]/g, "");
    return unfolded.split(/BEGIN:VCARD/i).slice(1).map(card => {
      const value = (key: string) => Array.from(card.matchAll(new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, "gmi"))).map(match => match[1].trim().replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1"));
      const phones = value("TEL"), full = value("FN")[0];
      return { name: full || (value("N")[0] || "").split(";").reverse().filter(Boolean).join(" "), phone: phones.map(importedPhone).find(Boolean) || phones[0] || "", phoneOptions: phones, email: value("EMAIL")[0] || "" };
    });
  }
  // CSV fields may contain quoted commas, escaped quotes and line breaks.
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') { if (quoted && content[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (char === "," || char === "\n")) { row.push(field.trim()); field = ""; if (char === "\n") { if (row.some(Boolean)) rows.push(row); row = []; } }
    else if (char !== "\r") field += char;
  }
  if (quoted) throw new Error("This CSV has an unclosed quoted field. Please export it again.");
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const header = rows[0].map(value => value.replace(/^\uFEFF/, "").toLowerCase());
  const find = (terms: string[]) => header.findIndex(value => terms.includes(value));
  const nameIndex = find(["name", "full name", "display name"]), phoneIndex = find(["phone", "mobile", "mobile number", "phone number", "phone 1 - value"]), emailIndex = find(["email", "email address", "e-mail 1 - value"]);
  const hasHeader = nameIndex >= 0 || phoneIndex >= 0 || emailIndex >= 0;
  return (hasHeader ? rows.slice(1) : rows).map(values => ({ name: values[hasHeader ? Math.max(nameIndex, 0) : 0] || "", phone: values[hasHeader ? phoneIndex : values.length >= 3 && values[1].includes("@") ? 2 : 1] || "", email: values[hasHeader ? emailIndex : values.length >= 3 ? values[1].includes("@") ? 1 : 2 : -1] || "" }));
}

"use client";
import { useEffect, useRef, useState } from "react";
import { BookUser, Upload, X } from "lucide-react";
import { ContactCandidate, contactPreview, DeviceContacts, parseContactFile, pickDeviceContacts } from "@/lib/contact-import";
import { GuestDTO } from "@/lib/types";

export default function ContactImport({ eventId, guests, onAdded }: { eventId: string; guests: GuestDTO[]; onAdded: () => Promise<void> }) {
  const [supported, setSupported] = useState(false);
  const [candidates, setCandidates] = useState<ContactCandidate[] | null>(null);
  const [source, setSource] = useState<"contact_picker" | "file_import">("contact_picker");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = contactPreview(candidates || [], guests);
  const selected = preview.filter(item => !item.isInvalid && !item.isDuplicate && !excluded.has(item.tempId));
  useEffect(() => { setSupported(window.isSecureContext && window.top === window.self && typeof (navigator as Navigator & { contacts?: DeviceContacts }).contacts?.select === "function"); }, []);
  function stage(items: ContactCandidate[], nextSource: typeof source) {
    if (!items.length) { setNotice("No contacts found. Choose a contacts CSV or vCard file, or add a guest manually."); return; }
    if (items.length > 500) { setNotice("Choose up to 500 contacts at a time."); return; }
    setCandidates(items); setSource(nextSource); setExcluded(new Set()); setNotice("");
  }
  async function chooseContacts() {
    const contacts = (navigator as Navigator & { contacts?: DeviceContacts }).contacts;
    if (!supported || !contacts) { setNotice("This browser cannot open your phone contacts. Try Android Chrome, import a contacts file below, or add guests manually."); return; }
    setBusy(true); setNotice("");
    try { const items = await pickDeviceContacts(contacts); if (items.length) stage(items, "contact_picker"); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("Contacts could not be opened. Allow access when your browser asks, or import a contacts file below."); }
    finally { setBusy(false); }
  }
  async function uploadFile(file?: File) {
    if (!file) return;
    setBusy(true); setNotice("");
    try { if (file.size > 5 * 1024 * 1024) throw new Error("Choose a contacts file under 5 MB."); stage(parseContactFile(await file.text(), file.name), "file_import"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not read your contacts file."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function addContacts() {
    if (!selected.length || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/weddings/${eventId}/guests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, skipDuplicates: true, candidates: selected.map(({ name, phone, email }) => ({ name, phone, email: email || undefined })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not add contacts. Please try again.");
      setCandidates(null); setExcluded(new Set());
      setNotice(`Added ${data.added?.length || 0} guests${data.duplicatesFlagged?.length ? `; skipped ${data.duplicatesFlagged.length} duplicate contacts` : ""}. No invitations were sent.`);
      await onAdded();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not add contacts."); }
    finally { setBusy(false); }
  }
  function edit(index: number, field: "name" | "phone" | "email", value: string) { setCandidates(prev => prev?.map((item, i) => i === index ? { ...item, [field]: value } : item) || null); }
  return <section className="lg:col-span-5 rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
    <div className="flex gap-3 items-center"><BookUser className="text-emerald-700"/><div><h2 className="font-serif text-xl font-bold">Bring your people together</h2><p className="text-xs text-stone-600">Choose contacts, review their details, then add them to your guest list.</p></div></div>
    <button type="button" disabled={busy} onClick={()=>{void chooseContacts();}} className="min-h-11 w-full rounded-xl bg-emerald-700 p-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : "Add from phone contacts"}</button>
    <p className="text-xs text-stone-600">{supported ? "Only the names and phone numbers you select are shared with Memorica." : "Direct selection works in supported mobile browsers such as Android Chrome. On iPhone or other browsers, import a contacts file."}</p>
    <input ref={fileInput} type="file" accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard" aria-label="Choose a contacts file" className="hidden" onChange={event=>{void uploadFile(event.target.files?.[0]);}}/>
    <button type="button" disabled={busy} onClick={()=>fileInput.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white p-3 text-sm font-semibold text-emerald-800"><Upload size={18}/>Import contacts file</button>
    <p className="text-xs text-stone-500">vCard (.vcf) or CSV with Name, Mobile, Email. Email is optional. Indian numbers use +91 by default; include the country code for other countries.</p>
    {notice && <p role="status" className="rounded-xl bg-white p-3 text-sm text-stone-700">{notice}</p>}
    {candidates && <div role="dialog" aria-modal="true" aria-label="Review selected contacts" className="sheet-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/45 sm:p-4 backdrop-blur-sm"><div className="sheet-panel w-full max-w-xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-serif text-xl font-bold">Your people, ready to join</h2><p className="text-xs text-stone-500 mt-1">Name and mobile number are required. Fix missing details below. Duplicates are skipped.</p></div><button type="button" aria-label="Close contact review" disabled={busy} onClick={()=>setCandidates(null)} className="min-h-11 min-w-11 rounded-full border flex items-center justify-center"><X size={18}/></button></div>
      <div className="overflow-y-auto min-h-0 space-y-3">{preview.map((item,index)=><div key={item.tempId} className={`rounded-2xl border p-4 space-y-3 ${item.isInvalid || item.isDuplicate ? "border-amber-200 bg-amber-50/40" : "border-emerald-200"}`}>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={!item.isInvalid && !item.isDuplicate && !excluded.has(item.tempId)} disabled={busy || item.isInvalid || item.isDuplicate} onChange={e=>setExcluded(prev=>{const next=new Set(prev);if(e.target.checked)next.delete(item.tempId);else next.add(item.tempId);return next;})}/>Include contact {index+1}</label>
        <label className="block text-xs font-semibold">Name *<input disabled={busy} className="mt-1 block w-full min-h-11 rounded-xl border bg-white p-3 text-base" value={candidates[index].name || ""} onChange={e=>edit(index,"name",e.target.value)}/></label>
        <label className="block text-xs font-semibold">Mobile *<input type="tel" disabled={busy} className="mt-1 block w-full min-h-11 rounded-xl border bg-white p-3 text-base" value={candidates[index].phone || ""} onChange={e=>edit(index,"phone",e.target.value)}/></label>
        {item.phoneOptions.length>1 && <label className="block text-xs">Other numbers for this contact<select disabled={busy} className="mt-1 w-full min-h-11 rounded-xl border bg-white p-3 text-base" value={item.phoneOptions.includes(item.phone)?item.phone:""} onChange={e=>edit(index,"phone",e.target.value)}><option value="" disabled>Choose a saved number</option>{item.phoneOptions.map(phone=><option key={phone}>{phone}</option>)}</select></label>}
        <label className="block text-xs">Email (optional)<input type="email" disabled={busy} className="mt-1 block w-full min-h-11 rounded-xl border bg-white p-3 text-base" value={candidates[index].email || ""} onChange={e=>edit(index,"email",e.target.value)}/></label>
        {item.duplicateReason && <p className="text-xs text-amber-900">{item.duplicateReason}</p>}
      </div>)}</div>
      {notice&&<p role="alert" className="text-sm text-red-700">{notice}</p>}
      <div className="border-t pt-3 space-y-3"><p aria-live="polite" className="text-xs text-stone-600">{selected.length} of {preview.length} selected. Adding contacts never sends invitations.</p><div className="flex gap-3"><button type="button" disabled={busy} onClick={()=>setCandidates(null)} className="min-h-11 rounded-xl border px-4">Cancel</button><button type="button" disabled={busy || !selected.length} onClick={()=>{void addContacts();}} className="min-h-11 flex-1 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Adding…" : `Add ${selected.length} selected contacts`}</button></div></div>
    </div></div>}
  </section>;
}

"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Briefcase,
  ChartNoAxesCombined,
  ClipboardList,
  Ellipsis,
  HeartHandshake,
  House,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";

export type HostTab =
  | "setup"
  | "guests"
  | "share"
  | "social"
  | "family"
  | "budget"
  | "bookings"
  | "team"
  | "updates"
  | "overview"
  | "analytics";

const MORE_TABS: HostTab[] = [
  "share",
  "budget",
  "bookings",
  "team",
  "updates",
  "overview",
  "analytics",
];

export default function MobileEventNav({
  active,
  ready,
  onSelect,
}: {
  active: HostTab;
  ready: boolean;
  onSelect: (tab: HostTab) => void;
}) {
  const menu = useRef<HTMLDialogElement>(null);
  function select(tab: HostTab) {
    menu.current?.close();
    onSelect(tab);
  }

  return (
    <>
      <nav aria-label="Event navigation" className="mobile-event-nav sm:hidden">
        {(
          [
            { id: "setup", label: "Setup", icon: ClipboardList, needsReady: false },
            { id: "guests", label: "Guests", icon: Users, needsReady: true },
            { id: "social", label: "Social", icon: Sparkles, needsReady: false },
            { id: "family", label: "Family", icon: HeartHandshake, needsReady: false },
          ] as const
        ).map(({ id, label, icon: Icon, needsReady }) => (
          <button
            key={id}
            type="button"
            aria-current={active === id ? "page" : undefined}
            disabled={needsReady && !ready}
            title={needsReady && !ready ? "Complete event details first" : label}
            onClick={() => select(id)}
            className={active === id ? "is-active" : ""}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => menu.current?.showModal()}
          className={MORE_TABS.includes(active) ? "is-active" : ""}
        >
          <Ellipsis size={20} />
          <span>More</span>
        </button>
      </nav>
      <dialog
        ref={menu}
        aria-label="More event options"
        className="event-more-sheet sm:hidden"
      >
        <div className="flex items-center justify-between border-b border-rose-100 pb-4">
          <h2 className="font-serif text-2xl">Organizer Suite</h2>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => menu.current?.close()}
            className="rounded-full bg-rose-50 p-3"
          >
            <X size={18} />
          </button>
        </div>
        <button type="button" onClick={() => select("share")} className="more-option">
          <Share2 size={20} />
          Invitations &amp; WhatsApp
        </button>
        <button type="button" onClick={() => select("budget")} className="more-option">
          <Wallet size={20} />
          Budget &amp; Finance (₹)
        </button>
        <button type="button" onClick={() => select("bookings")} className="more-option">
          <Briefcase size={20} />
          Vendor Bookings &amp; Receipts
        </button>
        <button type="button" onClick={() => select("team")} className="more-option">
          <ShieldCheck size={20} />
          Family &amp; Co-Admin Access
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => select("updates")}
          className="more-option disabled:opacity-40"
        >
          <Bell size={20} />
          Live Guest Updates
        </button>
        <button type="button" onClick={() => select("overview")} className="more-option">
          <Settings2 size={20} />
          Event settings
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => select("analytics")}
          className="more-option disabled:opacity-40"
        >
          <ChartNoAxesCombined size={20} />
          Insights &amp; activity
        </button>
        <Link href="/" className="more-option">
          <House size={20} />
          All my celebrations
        </Link>
      </dialog>
    </>
  );
}

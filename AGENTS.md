# Memorica — Project Constitution & Agent Guidelines (`AGENTS.md`)

> Memorica is a mobile-first celebration & event operating system for **any occasion** — built first for **Indian audiences** so families, friends, and teams can plan together, track every invite, stay organized end-to-end, and celebrate as a community.

---

## 1. Product Vision & Experience Principles

### Core Product Pitch — Built for Any Occasion
- **Any occasion, one shared home**: Memorica is **not** a wedding-only tool. Hosts can use it for **any celebration or gathering** — birthdays, anniversaries, housewarmings (Griha Pravesh), baby showers & naming ceremonies, engagements, weddings, festival get-togethers (Diwali, Holi, Eid), family reunions, graduations, office offsites, and community milestones.
- **Primary market**: Indian audiences & global Indian families who love celebrating together across single-evening gatherings and multi-day celebrations.
- **Occasion-Agnostic Brand Voice & Visuals**:
  - Home page copy, onboarding, empty states, and default illustrations must feel **joyful, warm, Indian, and universal across all occasions** — never lock the brand imagery solely to a bride & groom or wedding mandap.
  - Wedding-specific details (groom/bride names, Haldi/Mehndi/Sangeet presets) appear cleanly when a host chooses `Wedding` or opts into ceremony presets, while every other occasion flows effortlessly without wedding jargon.
- **Defaults for India**:
  - Default phone country code `+91` (while supporting international guests via `libphonenumber-js/max`).
  - Indian Rupee (`₹`) and Indian numbering format (`₹1,50,000`) for finance/budget views.
  - Local venue dates/times clearly labeled; both single-day gatherings and multi-day / multi-sub-event celebrations are first-class citizens.

### Core Product Pillars
1. **Joyful, "Happening" Experience (Not Plain Forms)**
   - The product must feel warm, celebratory, social, and alive — never like a dry CRUD dashboard.
   - Replace long form walls with photo-forward celebration cards, live countdowns, quick-pick Indian event presets (Haldi, Mehndi, Sangeet, Wedding, Reception), collapsible progress modules, joyful completion feedback, and lively micro-interactions (always respecting `prefers-reduced-motion`).
2. **Mobile-First Everywhere**
   - Design for `360px–430px` mobile viewports first, then expand gracefully to tablet and desktop.
   - Sticky thumb-friendly navigation, bottom sheets (`<dialog>` / `.sheet-panel`), `44px+` touch targets, `16px` mobile inputs (no iOS auto-zoom), and `safe-area-inset-bottom` padding.
3. **Complete Invite Planning & Tracking**
   - Organizers can build, organize, segment (e.g., Groom's side, Bride's side, Close Family, Friends, sub-event groups), and track their entire guest list.
   - Always make it effortless to see **who is already invited**, **who is remaining (not yet invited)**, **who opened/accepted**, and **who confirmed RSVP + planned dates**.
   - Importing contacts **never** auto-sends invitations; sending is always explicit and consent-gated.
4. **Multi-Organizer & Role-Based Collaboration**
   - Organizers can add family co-admins so multiple people stay on the same page without passing around one phone or spreadsheet.
   - Clear server-enforced roles: **Owner**, **Co-Admin**, **Close Family**, and **Invited Guest**.
5. **Celebration Social Page (For All Invited Guests)**
   - Every event automatically gets a private social page for its invited guests.
   - Guests can RSVP (`Yes` / `Maybe` / `No`) and add **optional planned attendance / arrival–departure dates** so other guests and hosts know who is coming and when (with a per-guest privacy toggle to hide planned dates from other guests).
   - Verified guests can post celebratory moments, photos, wishes, and coordinate travel/plans together.
6. **Close Family Private Planning Room**
   - Invite-only inner-circle space separate from the broader guest social page.
   - Close family members can plan together, discuss ideas, coordinate checklists, and run **polls & voting** (venues, outfits, menus, dates, playlists, rituals).
7. **All-in-One Organizer Hub**
   - Single source of truth for the organizer and co-admins: **Finance & Budget tracking** (estimates, actuals, paid/pending, contributor splits), **Vendor & Booking Records** (contacts, quotes, receipts/contracts, due dates), **Shared Photo Albums**, live updates, and guest logistics.

---

## 2. Roles, Spaces & Access Control

All access rules **must be enforced server-side** (never trust client role hints):

| Role | Access & Capabilities |
| :--- | :--- |
| **Owner** | Full control of the event: settings, role assignments (add/remove Co-Admins & Close Family), event deletion, WhatsApp sending, finances/bookings, invite list, moderation, Close Family room, and Guest Social page. |
| **Co-Admin** | Full collaborative planning access: manage invite list, send/share invitations, edit schedule & sub-events, publish live updates, manage finances & vendor booking records, manage photo albums, moderate posts, and participate in the Close Family room. Cannot delete the event or demote the Owner. |
| **Close Family** | Access to the **Close Family private page** (planning discussions, polls/voting, family tasks) plus full Guest Social page access. Does **not** see organizer finance/booking records or admin controls unless also granted Co-Admin. |
| **Invited Guest** | Can open personal/event invitation links and submit/update RSVP + optional planned dates frictionlessly. Once verified (Email/Phone OTP or Google), unlocks the **Event Social Page** (post moments/photos, comment/react, view who's coming & shared planned dates), shared photo albums, and private live updates. |

### Privacy Defaults
- **Guest Social Page**: Requires verified guest membership (`EventMembership` or verified email/phone/token linked to a `Guest` record) to post moments, comment, and view the guest social feed.
- **Planned Attendance Dates**: Guests can optionally attach planned dates when confirming RSVP and choose whether to share those dates with other invited guests (default visible to verified invited guests when provided, with an explicit opt-out toggle).
- **Close Family Page**: Strictly invite-only; invisible to regular guests.
- **Finance & Booking Records**: Strictly Owner + Co-Admin only.

---

## 3. Current Codebase Architecture

### Tech Stack
- **Framework**: Next.js `14.2.15` (App Router), React `18.3.1`, TypeScript `5.5.4` (`strict: true`).
- **Styling**: Tailwind CSS `3.4.13`, PostCSS, `lucide-react` icons.
- **ORM & Validation**: Prisma `5.22.0`, `libphonenumber-js/max`.
- **Deployment**: Automated Vercel production deploy on push to `main` via `.github/workflows/deploy-vercel.yml`.

### Directory Map
- `src/app/` — App Router pages, global styles, and API entrypoints:
  - `layout.tsx` — Root layout (`AuthProvider`, `Navbar`, footer, viewport `viewportFit: "cover"`).
  - `globals.css` — Theme CSS variables, mobile overrides (`< 640px`), bottom nav, `<dialog>` bottom sheet, reduced-motion rules.
  - `page.tsx` — Public landing + signed-in celebration dashboard & Create Event modal.
  - `login/page.tsx` — Sign-in entry page.
  - `host/weddings/[id]/page.tsx` — Host workspace (`setup`, `guests`, `share`, `updates`, `overview`, `analytics` tabs).
  - `invite/[slug]/page.tsx` — Public/personalized invitation card & RSVP experience.
  - `events/[slug]/updates/page.tsx` — Verified guest live updates feed.
  - `src/app/api/**` — `force-dynamic` route handlers (most are thin re-exports of `src/lib/routes/**`; `api/[...path]/route.ts` is a catch-all dispatcher; `api/weddings/[id]/whatsapp/**` run directly on `runtime = "nodejs"`).
- `src/components/` — Client UI components:
  - `AuthProvider.tsx`, `Navbar.tsx`, `MobileEventNav.tsx`, `EventSetupForm.tsx`, `WhatsAppInvitations.tsx`, `GuestInvitationActions.tsx`, `CountryPhoneInput.tsx`, `DateInput.tsx`, `EventCreatedCelebration.tsx`.
- `src/lib/` — Shared & server logic:
  - `prisma.ts` — Singleton `PrismaClient` (currently copies bundled `prisma/dev.db` to `/tmp/dev_v2.db` on Vercel).
  - `auth.ts` — HMAC-SHA256 signed cookies (`wm_prod_session`, `wm_otp_challenge`, `wm_weddings_backup`), SHA-256 session tokens, OTP challenge creation/verification.
  - `db.ts` — DTO mappers, phone/email matching, `getWeddingAccess`, event/guest/RSVP/conflict/update/analytics domain functions.
  - `whatsapp.ts` — **Server-only** Meta WhatsApp Cloud API transport (never import in client components).
  - `event-setup.ts`, `event-status.ts`, `contact-validation.ts`, `types.ts` — Isomorphic shared modules.
  - `src/lib/routes/**` — Shared API route implementations.
- `prisma/schema.prisma` — Current models: `User`, `Session`, `OtpVerification`, `Wedding`, `Guest`, `EventUpdate`, `EventMembership`, `AnalyticsEvent`, `EventAsset`, `WhatsAppInvitation`.
- `docs/whatsapp-setup.md` — Meta Cloud API configuration & template contracts.
- `tests/whatsapp.cjs` — Automated tests for WhatsApp config, payloads, error redaction, and sample sends.

---

## 4. Target Backend & Storage Architecture (Mandatory Direction)

> **Known Current Limitation**: Production on Vercel currently uses SQLite copied to ephemeral `/tmp/dev_v2.db` with binary `EventAsset` blobs in SQLite and a signed cookie backup (`wm_weddings_backup`). Ephemeral `/tmp` SQLite **cannot** reliably persist multi-admin collaboration, social posts, polls, finance/booking records, or shared photo albums across serverless instances and deployments.

### Architectural Standards Going Forward
1. **Persistent Relational Database — PostgreSQL (Prisma)**
   - Standardize on **PostgreSQL** (e.g., Neon, Supabase Postgres, or Vercel Postgres) via Prisma with versioned migrations (`prisma/migrations/`).
   - Once PostgreSQL is live, retire the `/tmp/dev_v2.db` copy workaround in `src/lib/prisma.ts`, remove `outputFileTracingIncludes` for `prisma/dev.db` in `next.config.mjs`, and retire `wm_weddings_backup` cookie rehydration in `src/lib/auth.ts`.
   - Use proper relational tables (not unbounded JSON blobs) for new domains: `EventRole` / expanded `EventMembership`, `SocialPost`, `SocialComment`, `SocialReaction`, `FamilyPoll`, `FamilyPollOption`, `FamilyPollVote`, `BudgetItem`, `VendorBooking`, `MediaItem` / `PhotoAlbum`, and guest planned-date fields on `Guest`.
2. **Cloud Object Storage for Media & Photos**
   - Store all images, invitation cards, videos, PDFs, shared photo albums, and vendor receipts/contracts in **cloud object storage** (Vercel Blob, Cloudflare R2, or AWS S3).
   - Store only metadata (object key/URL, MIME type, byte size, dimensions, album/visibility scope, uploader ID) in PostgreSQL.
   - Enforce server-side authorization, size limits, and content-type / magic-byte validation on upload and authorized access on read.
3. **WhatsApp Cloud API Invariants**
   - Keep `src/lib/whatsapp.ts` strictly server-only; never place secrets in `NEXT_PUBLIC_` vars or return raw Meta error strings to clients.
   - Maintain atomic duplicate-send prevention (`@@unique([guestId, invitationKey])`) and explicit host consent confirmation before sending.
   - Never auto-guess or auto-split `coupleNames` into `groomName` / `brideName` for `memorica_wedding_celebration`.
   - Keep delivery status language honest ("Accepted by WhatsApp; delivery not yet confirmed") until delivery webhooks are implemented.

---

## 5. Design System & Visual Style Guide

### Color Palette ("White & Emerald + Warm Gold + Festive Moods")
- **Base Brand**:
  - Surfaces: Clean white (`#ffffff`), subtle mint-tinted surfaces (`#f2faf6`, `#ecfdf5`), warm stone neutrals (`stone-50`–`stone-950`).
  - Signature Emerald: `#047857` (primary), `#065f46` / `#064e3b` (deep), `#10b981` / `#a7f3d0` (accents).
  - Warm Gold: `gold-50` (`#fbf8eb`) through `gold-900` (`#63361f`) for celebratory highlights and badges.
  - **Important Repo Quirk**: In `tailwind.config.ts`, `rose-50`..`rose-950` are currently remapped to **emerald hex codes** (`#ecfdf5`..`#022c22`). Be aware of this when reading or editing existing classes, and introduce explicit semantic theme tokens (e.g., `brand-*`, mood accent CSS variables) as the design system evolves.
- **Per-Event & Sub-Event Mood Accents**:
  - Support curated Indian celebration mood accents (e.g., **Haldi Marigold**, **Mehndi Emerald**, **Sangeet Royal Indigo & Gold**, **Reception Ivory & Gold**) via CSS custom properties so each celebration and sub-event feels distinctly festive while maintaining WCAG AA contrast (`>= 4.5:1` for body text).

### Typography, Iconography & Illustrations
- **Display / Headings**: `font-serif` (`Georgia, Cambria, "Times New Roman", Times, serif`) for celebratory headlines, event titles, event heroes, and editorial warmth.
- **UI / Controls / Data**: `font-sans` (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) with tabular clarity for guest stats, dates, and `₹` budgets.
- **Icons**: `lucide-react` exclusively for visual consistency.
- **Illustrations**: Use warm modern editorial gouache-and-vector illustrations (`public/illustrations/`) in Memorica's emerald, warm saffron gold, and ivory palette. Keep landing, login, dashboard, social, close-family, and organizer illustrations **occasion-agnostic** (friends & multi-generational family celebrating under string lights, floral accents, sparklers, envelopes, notebooks, shared memories) so the platform clearly speaks to **every occasion** rather than weddings alone.

### UX & Accessibility Standards
- **Mobile ergonomics**: `min-height: 44px` tap targets, `16px` minimum input font size on mobile (`< 640px`), `touch-action: manipulation`, bottom navigation (`MobileEventNav`) + bottom sheets for mobile flows.
- **Accessibility**: Semantic landmarks, ARIA roles (`role="dialog"`, `role="status"`, `role="alert"`, `aria-live="polite"`, `aria-pressed`), keyboard-accessible controls, visible `:focus-visible` outlines (`#047857`), and `@media (prefers-reduced-motion: reduce)` fallbacks.
- **Anti-Form UX Rules**:
  - Lead screens with celebratory context (hero, countdown, live activity, visual summary cards) rather than bare inputs.
  - Use progressive disclosure (`<details>`, step drawers, bottom sheets, quick-add chips) so hosts aren't overwhelmed.
  - Always show immediate visual state transitions (loading, optimistic or clear saved feedback, completion badges, invited vs. remaining meters).

---

## 6. Coding Guidelines, Linting & Quality Gates

### TypeScript & Architecture Rules
- Keep `"strict": true` in `tsconfig.json`; avoid `any` (use `unknown` + runtime type guards/normalizers).
- Use `@/*` path imports consistently.
- Keep route handlers thin: validate inputs, verify auth & RBAC, call domain functions in `src/lib/`, and return typed DTOs (`src/lib/types.ts`).
- Keep client components focused and modular — avoid growing monolithic page files like `src/app/host/weddings/[id]/page.tsx`; extract new feature domains (e.g., Social Feed, Close Family Room, Budget Planner, Vendor Bookings, Role Management) into dedicated components under `src/components/<feature>/` and dedicated modules under `src/lib/<feature>.ts`.
- Never log or store PII (emails, phones, tokens, OTPs, raw address books) in `AnalyticsEvent` metadata or client-visible error messages.

### Linting & Formatting
- **Current state**: `package.json` has `"lint": "next lint"`, but no `.eslintrc*` or Prettier config is committed yet (running `npm run lint` currently prompts interactively).
- **Standard**: Add a non-interactive ESLint config (`next/core-web-vitals` + `next/typescript`) so `npm run lint` passes automatically locally and in CI. Keep formatting consistent (2-space indentation, double quotes, semicolons, clean imports).

### Required Verification Before Completing Changes
Before claiming any task complete or pushing to `main`, run and verify:
1. `npx tsc --noEmit` — zero TypeScript errors.
2. `npm run lint` — zero lint errors (once ESLint config is added).
3. Automated tests — `node tests/whatsapp.cjs` plus unit/integration tests for any newly added domain logic (use a temporary test DB, never pollute production/dev data).
4. `npx next build` — production build compiles cleanly.
5. Never commit `.env`, API tokens, or populated local database files.

---

## 7. Phased Product Roadmap

Build in vertical, shippable slices without breaking existing invitation or WhatsApp flows:

1. **Phase 0 — Cloud Foundation & Quality Baseline**
   - Migrate Prisma schema & deployment to **PostgreSQL** with migrations.
   - Integrate **cloud object storage** (Vercel Blob / R2 / S3) for cards, photos, and receipts.
   - Add non-interactive ESLint config (`next/core-web-vitals`) and structured test scripts.
2. **Phase 1 — Co-Admin Access & Smarter Invite Tracking**
   - Expand `EventMembership` roles (`owner`, `co_admin`, `close_family`, `guest`) with invite/revoke UI for organizers.
   - Upgrade guest list into an Indian-celebration invite planner: side/circle tags (Groom's side, Bride's side, Family, Friends), headcount/plus-ones, clear **Invited vs. Remaining** views & progress bars, and RSVP confirmation with **optional planned attendance dates** + guest visibility toggle.
3. **Phase 2 — "Happening" Celebration Social Page & Shared Photos**
   - Auto-created social hub per event for verified invited guests: celebratory hero & countdown, **Who's Coming & Planned Dates** board, guest moments/wishes/photo feed, reactions/comments, and shared photo albums.
   - Add optional per-event Indian mood accents (Haldi, Mehndi, Sangeet, Reception).
4. **Phase 3 — Close Family Private Planning Room**
   - Invite-only inner-circle space for close family: planning threads, shared checklists/assignments, and **interactive polls & voting** (venues, dates, outfits, catering, music).
5. **Phase 4 — All-in-One Organizer Suite (Finances & Bookings)**
   - **Finance & Budget Planner**: `₹` INR formatting, category budgets (Venue, Catering, Decor, Photography, Outfits, Gifts, Travel), planned vs. paid vs. pending tracking, and family contributor splits.
   - **Vendor & Booking Records**: vendor directory, booking status, payment milestones, due-date reminders, and contract/invoice attachments in cloud storage.

# Memorica Design Tokens & Component Reference

## 1. Brand & Festive Mood Tokens

### Base Brand ("White & Emerald + Warm Gold")
| Role | Hex / Tailwind Token | Usage |
| :--- | :--- | :--- |
| Canvas | `#ffffff` (`bg-white`) | Page background, cards, bottom sheets |
| Soft Mint Tint | `#f2faf6` / `#ecfdf5` (`bg-rose-50`) | Welcome banner, hero tint, subtle highlights |
| Primary Brand | `#047857` (`bg-rose-700`, `text-rose-700`) | Primary CTAs, active tabs, focus rings |
| Deep Brand | `#065f46` / `#064e3b` (`bg-rose-800` / `900`) | Hover states, royal header gradients |
| Warm Gold Accent | `#d8a436` / `#fbf8eb` (`gold-400`, `gold-50`) | Festive badges, countdown chips, milestones |
| Neutral Ink | `#1c1917` (`stone-900`) / `#57534e` (`stone-600`) | Primary & secondary body copy |
| Borders | `#e7e5e4` (`stone-200`) / `#a7f3d0` (`rose-200`) | Card & section dividers |

> **Repo Token Note**: In `tailwind.config.ts`, `rose-50` through `rose-950` are remapped to emerald greens (`#ecfdf5` → `#022c22`). For true error/destructive states use `red-*` (`text-red-700`, `bg-red-50`, `border-red-200`).

### Indian Celebration Mood Accents (CSS Custom Properties in `src/app/globals.css`)
Apply one `.mood-*` wrapper class to event heroes, invitation pages, and social hubs:

| Class | Mood Name | `--mood-accent` | `--mood-soft` | `--mood-border` | `--mood-deep` | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `.mood-emerald` | Royal Emerald (Default) | `#047857` | `#ecfdf5` | `#a7f3d0` | `#064e3b` | Classic weddings & all-purpose events |
| `.mood-haldi` | Haldi Marigold | `#b45309` | `#fffbeb` | `#fde68a` | `#78350f` | Haldi, daytime rituals, festive warmth |
| `.mood-mehndi` | Mehndi Garden | `#15803d` | `#f0fdf4` | `#bbf7d0` | `#14532d` | Mehndi, outdoor garden celebrations |
| `.mood-sangeet` | Sangeet Royal Indigo | `#4338ca` | `#eef2ff` | `#c7d2fe` | `#312e81` | Sangeet nights, cocktail & dance evenings |
| `.mood-reception` | Reception Ivory & Gold | `#92400e` | `#fdfbf7` | `#edd89a` | `#63361f` | Reception, formal evening dinners |

Use `.mood-hero` (gradient hero header), `.mood-surface` (soft tinted card), `.mood-badge` (high-contrast festive pill), and `.mood-button` (primary CTA matching the celebration mood).

---

## 2. Typography Scale

- **Celebration Display (`font-serif`)**:
  - Event Hero Title: `font-serif text-2xl sm:text-4xl font-bold tracking-tight`
  - Section Heading: `font-serif text-xl sm:text-2xl font-bold`
  - Card Title / Metric Count: `font-serif text-lg sm:text-xl font-bold`
- **UI & Structured Data (`font-sans`)**:
  - Eyebrow / Kicker: `text-[11px] font-bold uppercase tracking-widest`
  - Body Copy: `text-sm leading-relaxed text-stone-700`
  - Captions / Metadata: `text-xs text-stone-500`
  - Currency & Counters: `tabular-nums font-bold` with `formatINR(amount)` (`₹1,50,000`)

---

## 3. Reusable Surface & Interaction Recipes

### Celebratory Hero Card
```tsx
<section className={`mood-surface mood-${moodTheme} rounded-3xl border p-5 sm:p-7 space-y-4`}>
  <div className="flex flex-wrap items-center gap-2">
    <span className="mood-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
      <Sparkles className="h-3.5 w-3.5" /> Wedding Celebration
    </span>
    <span className="rounded-full bg-white/90 border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
      12 days to go
    </span>
  </div>
  <h1 className="font-serif text-2xl sm:text-4xl font-bold text-stone-900">Arjun &amp; Meera</h1>
</section>
```

### Progress & Ratio Meter (Invited vs. Remaining, Budget Paid vs. Total, Poll Votes)
```tsx
<div className="space-y-1.5">
  <div className="flex items-center justify-between text-xs font-semibold">
    <span className="text-emerald-800">42 invited</span>
    <span className="text-amber-800">18 remaining</span>
  </div>
  <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
    <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: "70%" }} />
  </div>
</div>
```

### Mobile Bottom Sheet / Desktop Modal
```tsx
<div role="dialog" aria-modal="true" aria-label="..." className="sheet-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/45 sm:p-4 backdrop-blur-sm">
  <div className="sheet-panel w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
    {/* Content */}
  </div>
</div>
```

### Anti-Plain-Form Patterns
- **Quick-pick chips**: Offer 1-tap chips for common Indian ceremonies (`Haldi`, `Mehndi`, `Sangeet`, `Wedding`, `Reception`), guest circles (`Groom's Side`, `Bride's Side`, `Close Family`, `Friends`), and budget categories (`Venue`, `Catering`, `Decor`, `Photography`, `Outfits`).
- **Connected Stepper Journey (never disconnected step boxes)**: For multi-step flows (such as event setup or ceremony schedules), wrap all steps inside **one unified `rounded-3xl` container** with a clickable **horizontal milestone track** in the header and a **continuous vertical spine** connecting numbered step nodes (`bg-emerald-700 text-white` with `Check` when complete, emerald ring when active, neutral stone when upcoming). Include live collapsed summaries and `Back` / `Continue` buttons inside each expanded step so every step flows visibly into the next.
- **Editorial Offering Showcase Cards (2×2 Bento)**: On landing or feature overview sections, prefer generous `grid-cols-1 lg:grid-cols-2 gap-6` cards (`p-6 sm:p-8 rounded-3xl`) featuring an eyebrow badge, `text-2xl` serif title, bullet highlights, and an embedded **mini live UI preview** (progress meter, poll bars, INR strip, or social moment) rather than cramped 4-column text boxes.
- **Bespoke Any-Occasion Indian Celebration Illustrations (`public/illustrations/` + `src/components/FestiveMotifs.tsx`)**:
  - `/illustrations/hero-celebration.jpg` — Twilight Indian terrace & courtyard celebration with friends and multi-generational family holding sparklers under lanterns and string lights (universal across birthdays, anniversaries, housewarmings, festivals, reunions, and weddings; never bride/groom-only).
  - `/illustrations/invite-envelope.jpg` — Emerald envelope, gold lotus seal, marigold blooms & brass diya on pure white (use with `mix-blend-multiply` on light cards, login, welcome banner, and invitation empty states).
  - `/illustrations/social-memories.jpg` — Instant photo collage of friends & family celebrating under fairy lights with sparklers, guitar, and confetti on pure white (use with `mix-blend-multiply` on Celebration Social Page & photo gallery empty states).
  - `/illustrations/family-planning.jpg` — Multi-generational family planning over chai & swatches on pure white (use with `mix-blend-multiply` on Close Family room headers & poll/checklist empty states).
  - `/illustrations/organizer-hub.jpg` — Fairy-light floral arch, camera, gift parcels, lantern & planning notebook on pure white (use with `mix-blend-multiply` on Finance `₹` & Vendor Bookings empty states).
  - `<FestiveToranDivider />` and `<FestiveLotusCrest />` in `src/components/FestiveMotifs.tsx` — lightweight decorative SVG dividers/crests for invitations and hero transitions.
- **Inline visual feedback**: Show instant `role="status"` updates, checked badges, reaction counters, and progress bar fills without full-page reloads.
- **Mobile safe padding**: Pages with `.mobile-event-nav` keep `pb-28 sm:pb-10` so floating bottom navigation never covers CTAs.

---
name: memorica-design
description: >-
  Guides UI, layout, color, typography, mobile-first interaction, and Indian festive
  design decisions for Memorica. Activate whenever creating or redesigning pages,
  components, modals, bottom sheets, cards, forms, or visual styling in Memorica.
---

# Memorica Design System Skill

Use this skill to keep every Memorica screen visually cohesive, mobile-first, joyful, and unmistakably crafted for **any Indian celebration or gathering** — birthdays, anniversaries, housewarmings, festivals, reunions, weddings, offsites, and family milestones.

Detailed token tables, CSS classes, and component recipes live in [tokens-and-components.md](./references/tokens-and-components.md).

## Core Design Philosophy

1. **Any Occasion First (Never Wedding-Only Branding)**
   - Keep home page copy, hero imagery, offering previews, and default empty-state illustrations **occasion-agnostic** (warm twilight gatherings, friends & multi-generational families celebrating under fairy lights, sparklers, invitations, shared photos, and planning tools).
   - Wedding-specific UI (couple names, Haldi/Mehndi/Sangeet quick presets) is offered contextually without excluding birthdays, anniversaries, Griha Pravesh, festivals, or team gatherings.
2. **Happening, Never Dry Forms**
   - Every screen must open with celebratory context (couple/event hero, live countdown, invited-vs-remaining meter, visual status cards, or photo moments) before inputs.
   - Replace long form walls with collapsible `<details>` cards, quick-pick Indian presets (`Roka`, `Haldi`, `Mehndi`, `Sangeet`, `Baraat & Pheras`, `Reception`), inline micro-actions, and bottom sheets.
2. **Mobile-First Ergonomics (`360px–430px` first)**
   - Design single-column stacked layouts for mobile first, expanding gracefully at `sm:` (`640px`) and `lg:` (`1024px`).
   - Enforce `min-height: 44px` tap targets, `16px` mobile inputs (no iOS zoom), `safe-area-inset-bottom` clearance above `.mobile-event-nav`, and bottom-anchored sheets (`.sheet-overlay` / `.sheet-panel` / `<dialog>`).
3. **White & Emerald + Warm Gold + Indian Festive Moods**
   - Base surfaces stay crisp and airy (`#ffffff`, `#f2faf6`, warm `stone-*` borders) anchored by signature Emerald (`#047857`) and Warm Gold (`gold-50`..`gold-900`).
   - **Critical repo note**: `tailwind.config.ts` maps `rose-50`..`rose-950` to **emerald hex values**. Do not expect `rose-*` to render pink; use semantic `.mood-*` CSS variables or explicit Tailwind emerald/amber/gold/indigo tokens for accents.
   - Apply optional celebration mood classes (`.mood-emerald`, `.mood-haldi`, `.mood-mehndi`, `.mood-sangeet`, `.mood-reception`) on event heroes and celebration hubs while maintaining WCAG AA text contrast (`>= 4.5:1`).
4. **Indian Audience Cultural Clarity**
   - Format all money in Indian Rupees (`₹`) with Indian grouping (`₹1,50,000`) via `formatINR()` in `src/lib/format.ts`.
   - Default phone inputs to India (`+91`) while supporting international guests.
   - Keep copy warm, family-friendly, and jargon-free ("Celebration Page", "Close Family Room", "Invited vs. Remaining").

## Implementation Workflow

1. **Before coding UI**: Read [tokens-and-components.md](./references/tokens-and-components.md) to pick exact mood variables, surface classes, typography scale, and mobile sheet patterns.
2. **Structure screens consistently**:
   - **Celebratory Header / Hero**: Rounded `rounded-3xl`, mood-accented gradient surface, serif title (`font-serif`), status pill, and live countdown or summary strip.
   - **Actionable Summary Strip**: 2–4 compact metric cards or progress bar (`Invited vs. Remaining`, `Paid vs. Pending`, `Who’s Coming`) above detailed lists.
   - **Progressive Controls**: Use filter pill bars, bottom sheets for multi-field creation on mobile, and immediate feedback banners (`role="status"` / `role="alert"`).
3. **Icons & Motion**:
   - Import icons exclusively from `lucide-react`.
   - Keep transitions subtle (`transition-all` / `180ms`) and never break `@media (prefers-reduced-motion: reduce)`.
4. **Accessibility & QA Checklist**:
   - Keyboard focus uses visible `:focus-visible` outlines (`#047857`).
   - Dialogs have `role="dialog"`, `aria-modal="true"`, `aria-label`, and clear Cancel/Close controls.
   - Verify no horizontal overflow at `375px` width (`min-w-0`, `truncate` / `overflow-wrap: anywhere` where needed) and confirm `npx tsc --noEmit` + `npx next build` pass.

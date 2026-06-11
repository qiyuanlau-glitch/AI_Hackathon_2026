# HOA Scenario + Linkable HOA Document + Netlify Launcher — Design

> Status: approved (2026-06-11). Single spec, single implementation plan.
> Scope: add a third "HOA / strata exterior" scenario to the agent pipeline, a linkable
> HOA-document viewer (inline peek → full modal), and a landing launcher so one Netlify
> deploy serves both the tenant flow and the agent pipeline.

## Context

This hackathon demo visualises an AI facility-management work-order pipeline. Two artifacts
exist today (see `CONTEXT.md`):

- `index.html` — the "agent behind the scenes" pipeline. Scenario-driven: a `SCENARIOS`
  object `{ clear, conflict }`, each `{name, wo, finalStatus, screens:[fn → htmlString]}`,
  rendered through a 5-node stepper. Header has a 2-way scenario toggle + autoplay.
  Step 3 (Responsibility) already renders document-reference tiles via a `doc()` helper
  (it cites lease / vendor contract / HOA rules inline, but they are not interactive).
- `tenant-flow.html` — the tenant journey. Ends with a "See the agent work" button linking
  to the pipeline.

Both are single self-contained files: Tailwind via Play CDN + NeoBrut design tokens inlined
in `:root` and mirrored into `tailwind.config.theme.extend`. No build step.

The new scenario: a tenant reports a **chipped exterior corner** of a house in an
**HOA / strata-title** community with **exterior-appearance guidelines**. The agent's
responsibility step must consult the HOA governing document and surface the specific cited
clauses, each linking into a viewable HOA document (per the whiteboard sketch: a guideline
row links into the full "general guideline" document).

## Goals

1. Add an `hoa` scenario to the pipeline that reads a mock HOA document and flags two
   guideline risks, each linking into the document.
2. A two-tier document-link interaction: inline clause peek → full-document modal,
   auto-scrolled to and highlighting the cited clause.
3. One Netlify deploy that serves a launcher at root, from which the user enters either
   the tenant flow or the agent pipeline, with a persistent switcher between them.

## Non-goals

- No backend / real LLM wiring (the existing `AGENT / LLM INTEGRATION POINT` placeholder
  pattern is untouched; the HOA scenario is canned data like the other two).
- No build tooling change (stays on Tailwind CDN, single files, no npm build).
- No changes to the existing `clear` / `conflict` scenario content beyond the toggle
  becoming 3-way.

## Design language — binding constraints

All new UI MUST follow the NeoBrut Design System v1.0 (`neobrutalism-design-system.md` /
`styleguide.html`). Concretely:

- Use design tokens (`--blue-*`, `--orange-*`, `--lime-*`, `--gray-*`, `--ink`, `--sp-*`,
  `--shadow-*`, `--radius-*`, `--font-*`). No raw hex except where a token does not exist
  (the existing files already use `#C20000` family for the invalid/error red and `#FDE7E7`
  for the conflict surface — reuse those existing values, do not invent new ones).
- Shadows are hard offset only — **no blur, no spread, no opacity** on any element shadow.
- `--radius-sm` (4px) on cards, modal, inputs, buttons; `--radius-pill` on badges only.
- Headings: Barlow Condensed 800 uppercase. Body: DM Sans. Icons: Material Symbols Sharp,
  `font-variation-settings:'FILL' 1`. Work-order IDs and clause refs that read as codes use
  `.mono`.
- Colour semantics: blue = info/active, orange = warning/urgent, lime = success/complete.
  Lime is never an icon colour below 28px.
- `prefers-reduced-motion` disables transitions/animations (existing pages already do this;
  new modal/animation must respect it).
- Reuse existing components/helpers (`.card`, `.tile`, `.badge`, `.btn`, `.alert`, `doc()`,
  `reason()`, `field()`, `scoreTile()`, `kv()`, `timeline()`) rather than new bespoke styles
  wherever they fit.

### Modal scrim exception (explicit)

The styleguide bans blur/opacity on *element shadows and interactive hover states*. A modal
backdrop scrim is a different thing and is permitted: use a flat `rgba(13,13,13,0.5)` scrim
(no blur). The modal card itself uses `--shadow-lg` (hard offset, no blur) per the spec's
"Cards, panels, modals" shadow row.

## File structure & Netlify deploy

```
index.html            → NEW launcher (replaces the current index content)
agent-pipeline.html   → the CURRENT index.html, renamed; now hosts 3 scenarios
tenant-flow.html      → unchanged journey; handoff button repointed to agent-pipeline.html
hoa-document.js       → mock HOA document data (see "Mock HOA document" below)
netlify.toml          → publish="." so root serves index.html
CONTEXT.md            → updated to reflect the rename + new scenario (housekeeping)
```

Decision: HOA document data ships as **`hoa-document.js`** (a `<script src>` that assigns a
global `HOA_DOC`), NOT `.json`. Reason: pages open via `file://` for local dev and `fetch()`
of a local JSON file is blocked by CORS under `file://`. A plain `<script src="hoa-document.js">`
loads under both `file://` and Netlify with zero fetch. `agent-pipeline.html` includes it via
a relative `<script src>` tag. (If we later move to a server we can switch to fetch; not now.)

### Launcher (`index.html`)

A small NeoBrut page:
- Dark ink header (`App Name` pattern from styleguide §8): "Lessen **Ops**".
- Hero: `.label` eyebrow, `.h1`/`.display` title, one `.body-lg` line of context.
- Two `card card-interactive` tiles in a responsive grid (`grid-cards`):
  - **Tenant flow** — icon `smartphone`/`assignment`, blurb "Report an issue as a resident",
    links to `tenant-flow.html`.
  - **Agent — behind the scenes** — icon `smart_toy` (blue-600), blurb "Watch the agent parse,
    decide responsibility, and route", links to `agent-pipeline.html`.
- No JS framework; anchor navigation. Self-contained tokens inlined (same pattern as the
  other files) OR — to avoid drift — inline the same `:root` token block the other pages use.
  Decision: inline tokens (consistent with existing single-file convention; no shared CSS file
  introduced in this spec).

### Persistent switcher

In the header of BOTH `tenant-flow.html` and `agent-pipeline.html`, add a small control group
on the right side of the existing ink header:
- `Home` (ghost) → `index.html`
- A 2-state segment `Tenant ⇄ Agent` indicating current page, the other link active.
- Styled `.btn-ghost btn-sm` with white text / `--gray-600` border on the ink header (matches
  the styleguide demo-header icon-button treatment). Must not collide with existing header
  content (tenant-flow has progress dots; agent-pipeline has the scenario toggle + autoplay).
- Concrete placement (resolves ambiguity): a single compact `Home` ghost button with a
  `home`/`grid_view` icon, placed at the **far left of the header** (before the existing
  "Lessen Ops" logo) on both pages. Tapping it returns to the launcher, where the user picks
  the other flow. This avoids a second toggle competing with the scenario toggle on the
  agent page and the progress dots on the tenant page. No inline `Tenant ⇄ Agent` segment —
  the launcher is the switch point. (Simpler, zero crowding, one obvious affordance.)

## The HOA scenario (in `agent-pipeline.html`)

Add `hoa` to `SCENARIOS` alongside `clear` and `conflict`. The scenario toggle in the header
becomes 3-way (Clear · Conflict · HOA); `setScenario` and the toggle handler updated from a
binary flip to cycle/select among three. Autoplay and keyboard nav work unchanged (they key
off `screens.length`).

- **Identity:** `name: "HOA exterior — strata"`, `wo: "WO-20495"`, unit/property e.g.
  "Unit 12 · 14 Birch Lane · Elmwood Heights HOA", `finalStatus: "Auto-dispatched"`.
- **Outcome:** homeowner-responsible, **88%** responsibility confidence (above the 70%
  auto-dispatch threshold), auto-dispatched. The header "2 ⚠" reflects **2 guideline risks
  flagged but resolved** (not a block).

### Per-step content (5 screens, same shells as other scenarios)

1. **Issue submitted** — raw report: "Front-left corner of the house is chipped, paint flaked
   off, bare board showing." Photo placeholder. Property tagged strata/HOA.
2. **Parse intent** — `field()` cards: trade = Exterior / facade, asset = Exterior corner /
   siding, urgency = Standard, unit = 12, plus an **"Ownership context: HOA strata title"**
   field. High confidence across.
3. **Responsibility check** — the centrepiece. Renders:
   - The consulted documents via `doc()` (existing helper): the HOA Architectural & Exterior
     Standards (state `ok`), lease/strata-fee note (neutral). Keep these as the high-level
     "documents read" list.
   - A new **risk list** of 2 `riskRow()` items (see component below):
     - **RISK #1 — Exterior finish below standard.** Body: chip exposes substrate; uniform-
       finish requirement applies. Cites **§4.2 Surface integrity**. ACT: "Schedule exterior
       refinish."
     - **RISK #2 — Repair must use approved palette & be pre-approved.** Body: any refinish must
       match the approved colour scheme and pass architectural review. Cites **§4.3 Colour
       palette** and **§4.4 Architectural review** (primary link §4.3; mention §4.4 in body or a
       secondary link). ACT: "Use HOA-approved materials/colour."
   - A confidence block: `<span data-counter>88</span>% · above 70% auto-dispatch threshold`,
     "Homeowner responsibility confirmed" (lime), reusing the existing meter/count-up animation
     classes.
4. **Work routing** — ranked exterior-repair vendors via `vendor()`; selected vendor noted as
   "uses HOA-approved materials per §4.3".
5. **Dispatched** — work order created, `kv()` "Billed to: Homeowner · HOA §4.2 surface duty",
   timeline entries, tenant/owner notified. `finalStatus` = Auto-dispatched.

## Linkable HOA document (the two-tier interaction)

### Tier 1 — `riskRow()` helper (inline peek)

New HTML-partial helper in `agent-pipeline.html`, returning a NeoBrut fragment:

- Collapsed: a `.tile`/`.card`-style row — numbered orange chip (reuse the `reason()` dot
  style), risk title (bold), one-line subtitle (`body-sm`), and an `expand_more` affordance.
  Clickable (cursor pointer; `aria-expanded`).
- Expanded: reveals an inline panel (`--gray-50` background, orange left-border à la
  `alert-warning`) containing:
  - `.label` "Source · HOA Architectural & Exterior Standards"
  - the cited clause snippet (truncated text of the clause)
  - a **"Guideline §4.2 →"** link rendered as a `.badge badge-blue` (or `.btn btn-ghost btn-sm`)
    with a `description`/`arrow_forward` icon, `data-clause="4.2"`, that opens the modal.
  - the **ACT** action as a `.badge badge-lime`/`.btn btn-lime btn-sm`.

State: which rows are expanded is local UI state (a `Set` of row ids, or a `.is-open` class
toggled on click). Re-render-safe: because screens are rebuilt by `renderScreen()`, expansion
state resets on step change (acceptable — each step re-render is a fresh screen). Expansion is
handled by a delegated click listener bound after render (consistent with how existing screens
wire up their interactions), not inline `onclick` in the template string where avoidable.

### Tier 2 — document modal

A single modal element (added once to `agent-pipeline.html`, hidden by default), driven by an
`openHoaDoc(clauseId)` function:

- Structure: scrim (`rgba(13,13,13,0.5)`, no blur) + centered `.card` (`--shadow-lg`,
  `--radius-sm`, max-width ~560px, max-height ~80vh, body scrolls). Ink header bar with white
  Barlow-condensed title "Elmwood Heights · Architectural & Exterior Standards" and a `close`
  icon button (`aria-label="Close"`).
- Body: renders the FULL document from `HOA_DOC` — every section and clause, each clause wrapped
  with `id="clause-<id>"`. Rendered once and cached; reopening just re-targets.
- On open with `clauseId`: scroll the cited clause into view (`scrollIntoView`, respecting
  reduced-motion → `auto` not `smooth`) and apply a highlight class to it (orange `alert-warning`
  block + `--shadow-sm`, 2px ink border). Clear the previous highlight first.
- Close: ✕ button, `Esc` key, and backdrop click all close; focus returns to the triggering
  link (basic focus management). Body scroll locked while open.
- Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title; focus moves
  into the modal on open.

## Mock HOA document (`hoa-document.js`)

Assigns `window.HOA_DOC` — a structured object grounded in real public HOA/CC&R sources
(adapted into the fictional Elmwood Heights community; no real association attributed).

Shape:

```js
window.HOA_DOC = {
  title: "Elmwood Heights — Architectural & Exterior Standards",
  subtitle: "Community Association · Strata Title · Adopted 2024",
  sections: [
    { num: "1", heading: "Purpose & Authority", clauses: [ {id:"1.1", text:"…"}, … ] },
    { num: "2", heading: "Maintenance Obligations", clauses: [ {id:"2.1", …}, {id:"2.2", …} ] },
    { num: "3", heading: "General Exterior Appearance", clauses: [ … ] },
    { num: "4", heading: "Exterior Surfaces & Finishes", clauses: [
        {id:"4.1", text:"Approved materials & finishes …"},
        {id:"4.2", text:"Surface integrity. All visible exterior surfaces — siding, trim,
                          corners, fascia — shall be maintained free of chips, cracks, peeling,
                          and exposed substrate. The homeowner shall remedy any such condition
                          within thirty (30) days of written notice, using association-approved
                          materials and colours per §4.3."},
        {id:"4.3", text:"Colour palette & approval. Exterior repairs and repainting must conform
                          to the association's approved colour scheme. …"},
        {id:"4.4", text:"Architectural review. Modifications and visible repairs require prior
                          approval by the Architectural Committee, which shall respond within
                          thirty (30) days. …"},
    ]},
    { num: "5", heading: "Landscaping & Common Areas", clauses: [ … ] },
  ],
}
```

Content drawn from real sources (cite in commit message, not in the rendered doc):
- hopb.co — "Whose Job is That? Determining the HOA's Maintenance Obligations"
- findhoalaw.com — "Architectural Standards"
- thehoahandbook.com, nashpainting.com — exterior paint / CC&R maintenance framing

The cited clauses (§4.2, §4.3, §4.4) are authored to land the chipped-corner scenario exactly;
the rest (§1, §2, §3, §5) are realistic filler so the modal reads like a real governing document.

## Data flow

1. `agent-pipeline.html` loads `hoa-document.js` → `window.HOA_DOC` available.
2. `setScenario('hoa')` (or 3-way toggle) selects the `hoa` scenario; `renderScreen()` builds
   the current step's HTML, including `riskRow()` items in step 3 that carry `data-clause` refs.
3. A delegated click listener handles (a) risk-row expand/collapse, (b) `Guideline →` links →
   `openHoaDoc(clauseId)`.
4. `openHoaDoc` renders/reveals the modal from `HOA_DOC`, scrolls to + highlights `clause-<id>`.
5. Close returns to the pipeline; pipeline state untouched.

## Error / edge handling

- If `window.HOA_DOC` is missing (script failed to load), `openHoaDoc` shows a graceful inline
  message in the modal ("Document unavailable") instead of throwing; risk rows still render.
- Unknown `clauseId` → modal opens at top, no highlight (no crash).
- Reduced-motion → no smooth scroll, no transitions; modal still functions.
- Switcher links use relative paths so they work under `file://` and Netlify root alike.

## Verification (headless Chrome, per CONTEXT.md pattern)

- `agent-pipeline.html`: 0 console errors / page exceptions on load.
- 3-way scenario toggle selects clear / conflict / hoa; HOA step 3 renders exactly 2 risk rows.
- Expanding a risk row reveals the inline clause peek with the `Guideline →` link + ACT badge.
- Clicking `Guideline §4.2 →` opens the modal, scrolled to and highlighting clause 4.2;
  clicking §4.3 link re-targets to 4.3. Esc / ✕ / backdrop close; focus returns.
- Confidence meter animates to 88%; final status shows Auto-dispatched.
- `index.html` launcher: both cards navigate; loads 0 errors.
- Persistent switcher navigates between launcher / tenant / agent on all three pages.
- `tenant-flow.html` handoff button now points to `agent-pipeline.html`.
- Spot-check NeoBrut conformance: tokens used, no blurred shadows, modal radius `--radius-sm`,
  badges pill, headings Barlow uppercase.

## Implementation order (single plan)

1. Rename `index.html` → `agent-pipeline.html`; repoint `tenant-flow.html` handoff link.
2. Add `hoa-document.js` (mock doc) + `<script src>` include in `agent-pipeline.html`.
3. Add `hoa` scenario to `SCENARIOS`; make the scenario toggle 3-way.
4. Add `riskRow()` helper + step-3 risk list + delegated expand listener.
5. Add the document modal + `openHoaDoc()` + close/focus/scroll/highlight logic.
6. Create new `index.html` launcher.
7. Add persistent header switcher to launcher target pages.
8. Add `netlify.toml`.
9. Update `CONTEXT.md` (rename + new scenario note).
10. Headless-Chrome verification pass.

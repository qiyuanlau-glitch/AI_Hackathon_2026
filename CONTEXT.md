# Hackathon Context — Lessen Ops "Agent Behind the Scenes"

> Handoff doc so a second agent (Codex) can work in parallel without re-deriving context.
> Last updated: 2026-06-10 by Claude.

## What this project is

A hackathon demo for an **AI-driven facility-management work-order pipeline**. The product
takes a tenant's free-text maintenance report and runs it through an autonomous agent that:
1. **Issue submitted** — ingests the raw report (e.g. SMS).
2. **Parse intent** — extracts structured fields (trade, asset, urgency, unit, issue type, duplicate check) with per-field confidence.
3. **Responsibility check** — reads lease / vendor contract / HOA docs to decide who pays, with a confidence score and a **70% auto-dispatch threshold**.
4. **Work routing** — ranks vendors by an efficiency score (skill match, travel time, workload).
5. **Dispatched** — creates the work order, notifies the tenant, logs a timeline; or escalates to a human.

The screens being built are **visualisations of the agent's internal pipeline** ("behind the
scenes"), NOT the production tenant-facing UI. They exist to *show how the agent reasons* —
useful for a demo / pitch.

### Two scenarios are modelled
- **Clear path** (`WO-20489`, Priya Nair, Unit 7A, plumbing): all fields high-confidence, no
  rule conflicts, 91% responsibility confidence → **auto-dispatched in 38s, 0 human interventions**.
- **Conflict → escalation** (`WO-20481`, Unit 4B, HVAC ceiling leak): parse step flags an
  **ambiguity** (leak from aircon vs ceiling), responsibility step finds a **rule conflict**
  (lease clause 7.3 says landlord, vendor contract VC-112 §4.1 says tenant) → confidence drops
  to **42%**, below threshold → routing blocked → **human "Review required" decision screen**.

## Source assets (reference only — do not need to be in repo)
- `neobrutalism-design-system.md` — the **NeoBrut design system** spec (v1.0). This is the
  design language we are integrating. Hard 2px ink borders, **flat offset shadows (no blur)**,
  Barlow Condensed 800 uppercase headings, DM Sans body, Material Symbols Sharp icons,
  4px-grid spacing, split-complementary palette (blue=info, orange=warning, lime=success).
- `styleguide.html` — a rendered styleguide of the same system (components + a demo screen).
- 8 screenshots provided by the user showing the flow content/layout (soft/rounded pastel
  mockups). **NOTE:** the screenshots use a soft look, but we deliberately build in the
  **NeoBrut skin** because that's the design system the user asked to integrate. Screenshots
  are content references; NeoBrut is the visual skin.

## What's built so far

### `agent-pipeline.html` (was `index.html`) — DONE & VERIFIED ✅
Single self-contained file. **Three** scenarios now (clear, conflict, **HOA exterior/strata**), all 5
steps each, animated. The pipeline was renamed from `index.html` → `agent-pipeline.html`; the new
`index.html` is a launcher (see below). **Ownership note:** "Claude owns index.html" now refers to
`agent-pipeline.html`.

**HOA scenario (`WO-20495`, chipped exterior corner, Elmwood Heights strata):** the responsibility
step consults a mock HOA governing document and flags 2 guideline risks (§4.2 surface integrity,
§4.3 colour / §4.4 architectural review) via a new `riskRow()` helper. Each risk expands to an inline
clause peek; its "Guideline §x →" link opens a **document modal** (`openHoaDoc`) showing the full HOA
doc scrolled to + highlighting the cited clause. Outcome: homeowner-responsible, 88% confidence →
auto-dispatch. Mock doc data lives in `hoa-document.js` (global `window.HOA_DOC`, loaded via
`<script src>` to avoid `file://` fetch/CORS). Scenario toggle is now 3-way (cycles clear→conflict→hoa).
A `grid_view` Home button in the header links back to the launcher.

**Deploy:** new `index.html` launcher (two cards → tenant-flow / agent-pipeline) + `netlify.toml`
(`publish="."`) so one Netlify deploy serves both flows at the site root. `tenant-flow.html` handoff
button now points to `agent-pipeline.html`, and both tenant-flow and the pipeline have a Home button.

**Verification:** `verify.cjs` (dependency-free headless-Chrome/CDP harness, Node built-ins only) drives
the pages and asserts behavior; all task probes + a regression probe pass (3-way toggle, 2 risk rows,
modal open/scroll/highlight/retarget/close, launcher nav, existing clear/conflict scenarios intact).

**Parallel-work note:** `app-config.js` (+ its `<script src>` in `agent-pipeline.html`) is a live-agent
config module (`window.LessenAgentConfig`, localStorage-backed endpoint config) added by a separate
workstream — NOT part of the HOA/launcher work. It does not collide with the pipeline globals; left as-is.

### `index.html` (original pipeline) — superseded; see `agent-pipeline.html` above
Single self-contained file. Both scenarios, all 5 steps each, animated.

- **Stack:** Tailwind via Play CDN (`cdn.tailwindcss.com`) + NeoBrut design tokens (CSS custom
  properties in `:root` AND mapped into `tailwind.config.theme.extend` so both utility classes
  and CSS vars work). No build step (hackathon speed). Node 16 is installed but no npm project.
- **Features:** animated 5-node stepper that fills as you advance; smooth screen transitions
  (`screenIn` keyframe); staggered field-card reveals; animated confidence meters + count-up
  numbers; **scenario toggle** (clear ↔ conflict) in the header; **autoplay** ("Watch it run")
  that auto-advances every 2.2s; keyboard arrows (←/→) to navigate; Back/Next controls.
- **Architecture (all in the one file, `<script>` at bottom):**
  - `STEP_TITLES` — the 5 step names.
  - `SCENARIOS` — `{ clear, conflict }`, each with `{name, wo, finalStatus, screens:[...]}`.
    Each `screens[i]` is a **function returning an HTML string** for that step's body.
  - HTML partial helpers: `field()`, `doc()`, `reason()`, `vendor()`, `scoreTile()`, `kv()`,
    `timeline()`, `choice()` — reusable NeoBrut-styled fragments.
  - Render: `renderStepper()`, `renderScreen()` (rebuilds `#screens`, re-triggers animations),
    plus `animateMeters/animateCounters/staggerReveals`.
  - Nav: `go(delta)` (Next/Back, wraps "Start over"), `setScenario(key)`, autoplay via
    `setAutoplay/tickAutoplay`.
- **Verified** in headless Chrome: loads with 0 console errors / 0 page exceptions; stepper
  renders 5 nodes; Step 1→2 advances; 6 field cards render; scenario toggle works; conflict
  responsibility screen renders with the 42% meter. (Verification was done with a throwaway
  CDP script, since removed.)

### `tenant-flow.html` — DONE & VERIFIED ✅
The **tenant-facing front-end** (from the whiteboard photo). Separate file; hands off to `index.html`.

- **Journey:** Report form → 5s "agent thinking" loader → Summary (agree/decline) → 5s loader →
  Confirmation (with SMS reassurance + 24h follow-up) OR Decline → human-takeover screen.
  Maps the whiteboard: submit form (desc/attach/unit) → summary(⚝) → Agree✅/✗ → route WO;
  "reassurance via SMS, time-gated 24h"; "Need an inspection instead?" branch.
- **Report form:** description (required), photo attach (drag/drop + thumbnails, client-side
  `URL.createObjectURL`, no upload), unit (required) + address, urgency segmented control,
  "inspection instead?" checkbox. Real client-side validation; state persists across screens.
- **Summary content:** hero = assigned vendor + ETA (per user's pick), plus contact (@), an
  issue recap (parsed badges), and a "$ — no cost to you / billed to landlord" line.
- **5s loaders between screens** (user request): full-screen NeoBrut loader with a bobbing logo
  mark, a progress bar to 100% over 5s, and **rotating Claude-Code-style verbs** ("Spelunking",
  "Puttering", "Pondering", "Noodling"…). Themed per transition (`parsing`/`dispatching`/
  `escalating`/`thinking`) via `LOADER_THEMES`. Skipped entirely under `prefers-reduced-motion`.
- **Handoff:** confirmation screen has a "See the agent work" button → `index.html`.
- **Verified** headless Chrome: form validation fires, both 5s loaders show with rotating verbs +
  progress, summary renders vendor/ETA, agree→done shows SMS+24h+link. 0 console errors.

#### ⚠️ AGENT / LLM INTEGRATION PLACEHOLDER (not yet wired)
In `tenant-flow.html`, search for **`AGENT / LLM INTEGRATION POINT`**. This is where our real
agent gets called: feed it the tenant report **+ lease / tenancy / vendor-contract documents**,
and it returns output (expected to be **TEXT** — exact format TBD, Haojie to confirm).
- `callAgent({report, documents})` — stubbed `throw` + commented example `fetch`. Wire here.
- `parseAgentText(text)` — TODO normaliser: agent text → summary object shape.
- `stubAgentSummary()` — local canned data so the prototype runs with no backend.
- `buildSummary()` — currently sync stub; when wired, `await callAgent()` inside the 5s loader
  window (the loader already covers real latency).
The same hook pattern should later back `index.html`'s parse/responsibility/routing steps.

## How to run / verify
- **Run:** open `index.html` directly in a browser (no server needed). Requires internet for the
  Tailwind CDN + Google Fonts.
- **Headless verify pattern used:** launch Chrome with
  `--headless=new --remote-debugging-port=9222 --user-data-dir=$(mktemp -d)`, then drive via CDP
  (`Page.navigate`, `Runtime.evaluate`). No puppeteer/ws installed — a raw-socket CDP client was
  hand-rolled. If you (Codex) want repeatable verification, prefer installing puppeteer or
  use the same CDP-over-rawsocket approach.

## Conventions / decisions locked in
- **Visual skin = NeoBrut** (not the soft screenshot look).
- **Tailwind CDN, single HTML file, no build step** — optimised for hackathon iteration.
- Work-order IDs and reference numbers are rendered in `.mono` per the design system rule.
- Colour semantics: **blue = info/active, orange = warning/urgent, lime = success/complete**.
  Lime is never used as an icon colour at small sizes (design-system rule).
- `prefers-reduced-motion` disables all transitions/animations.

## Good parallel work for Codex (non-overlapping with `index.html`)
Pick any of these — they don't touch the existing flow file, so we won't collide:
1. **Dashboard / list view** (`dashboard.html`) — the work-order list + stat cards screen
   (see `styleguide.html` "Demo screen" section) in NeoBrut, linking into the flow.
2. **Extract shared NeoBrut CSS** into `neobrut.css` so multiple pages reuse tokens/components
   instead of each page inlining them. (Coordinate before doing this — it touches `index.html`.)
3. **Reasoning-chain detail view** — a standalone deep-dive comparing the clear vs conflict
   reasoning chains side by side (one of the screenshots shows this).
4. **Clarifying-question interaction** — the chat turn where the agent asks the tenant the
   ambiguity question and resumes the pipeline based on the answer.
5. **Proper build setup** (Vite + Tailwind) if we decide to move off the CDN — would let us
   split components. Discuss first; changes the run story.

> If editing `index.html`, ping first — Claude owns it right now. Everything else is open.

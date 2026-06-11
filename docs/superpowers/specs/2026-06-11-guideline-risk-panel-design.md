# Guideline & Risk Panel + Post-Communication Re-assessment — Design

> Date: 2026-06-11
> Scope: `tenant-flow.html`, new `guideline-kb.js`, `app-config.js`
> Status: approved (brainstorming → implementation)

## Problem

A work order needs to be checked against the community's **guidelines knowledge base**
(a separate agent from the existing reasoning/summary agent). The result is a **Guideline
panel** listing per-clause **risks**, each with a severity and an optional manager-action
flag. After a work order is dispatched, the resident can send a **communication** to the
vendor; if that message introduces a new guideline conflict (e.g. asking the vendor to also
plant a flower), the system must **re-assess** the work order, surface the new conflict, and
show a **warning indicator** `[ N | ⚠ ]` above the Communication button.

The real guideline agent is not built yet, so this is **mock-driven now** but wired through
an agent **config stage** (`guidelineCheck`) so it can be swapped to a live agent later
without UI changes.

## Success criteria

1. The work-order **summary screen** and **detail page** both show a **Guideline panel**
   listing the guideline article and its risk rows.
2. Each **risk row** shows: a severity color (lime → amber → red for low → medium → high),
   a title, a source clause reference (in `.mono`), an expandable detail, and a green
   **ACT** chip *only on rows that need a manager decision* (`needsAction:true`).
3. The panel header has an **arrow (→)** that expands to show the **general guideline**
   (full text of the cited article).
4. On the detail page, when a work order has ≥1 conflict, a **`[ N | ⚠ ]` warning badge**
   appears next to the **Communication** button; `N` = conflict count. Clicking it scrolls
   to and opens the Guideline panel.
5. Sending a communication whose message matches `/flower|plant/i` triggers a mock
   re-assessment that **adds the Article C3 conflict** (severity high / red, `needsAction:true`),
   persists it, and re-renders so the warning badge and new red risk row appear.
6. A `guidelineCheck` stage is added to `app-config.js` so the check is config-driven and
   agent-ready (mock fallback when no live agent / `liveAgentEnabled` is off).

## Visual reference (whiteboard sketches)

- **Sketch 2** — "Guideline →" header (arrow opens the general guideline text on the right);
  below it a stack of risk rows: `RISK #1 / SOURCE …  [ACT]`, `RISK #2 / … [ACT]`.
- **Sketch 1** — an "assessing…" bar; a `[ 2 | ⚠ ]` cell indicator (count + warning triangle)
  positioned **above the Communication button**.

## Data model

### Guideline knowledge base — new file `guideline-kb.js`

Loaded via `<script src="guideline-kb.js"></script>` in `tenant-flow.html` (same pattern as
`hoa-document.js`, to avoid `file://` fetch/CORS). Encodes **only Article C (Gardening)** per scope.

```js
window.GUIDELINE_KB = {
  policyName: 'Elmwood Heights Community Policy',
  articles: [{
    id: 'C',
    title: 'Gardening',
    clauses: [
      { id: 'C1', title: 'Trimming of trees',
        text: 'Trees may only be trimmed into the shape of a circle.' },
      { id: 'C2', title: 'Cutting down trees',
        text: 'Only trees deemed dying or browning by a panel gardener may be cut down.' },
      { id: 'C3', title: 'Planting flowers',
        text: 'Residents may not plant flowers that were not originally there without prior approval.' },
    ],
  }],
};
```

### Risk shape (returned by the guideline check; mocked now)

```js
{
  id: 'risk-c1',
  title: 'Tree trimming shape',
  clauseId: 'C1',
  source: 'Gardening · C1',     // human-readable; clause id rendered in .mono
  severity: 'low',              // 'low' | 'medium' | 'high'  → lime | amber | red
  needsAction: false,           // true → green ACT chip (manager: decide dispatch)
  detail: 'Vendor is trimming the front tree. Allowed if trimmed into a circular shape (C1).',
}
```

### Summary object addition

`summary.guideline = { articleId: 'C', risks: [ ...risk ] }`.

- The gardening scenario **seeds one benign C1 risk** (`severity:'low'`, `needsAction:false`)
  so the panel is populated from the start and the post-communication C3 conflict is a clearly
  *new* arrival.
- Non-gardening scenarios may have `summary.guideline` absent → the panel does not render.

## Components (NeoBrut)

All new components mirror existing helpers in `tenant-flow.html` and use only design-system
tokens. No new colors beyond the palette; red severity uses a standard red (severity-only,
never an icon at <28px per the lime rule — applies generally to keep contrast).

### 1. `guidelineTile(summary)`

A collapsible panel using the **same `<details>`/`<summary>` pattern as `billingTile`** (works
without JS wiring, survives re-renders).

- **Header (`<summary>`):** a `policy`/`gavel` icon, the label **"Guideline"**, the article
  title, and an **arrow chip** (`arrow_forward`) that rotates / the caret pattern; expanding
  reveals the **general guideline** block = full text of every clause in the cited article.
- **Body:** the **general guideline** text, then the **risk rows** (`riskRow()` per risk).
- Injected in `screenSummary()` and `screenDetail()` **after `agentResponseTile`, before
  `billingTile`**. Renders nothing when `summary.guideline` is absent or has no risks.

### 2. `riskRow(risk)`

One row per risk:

- **Severity color** via left border + dot: `low → var(--lime-600)`, `medium →
  var(--orange-600)`, `high → red`. The design system has no red token, so add one
  `--red-600: #C4271C` (and `--red-50: #FBE9E7` for the row tint) to `:root`, harmonized
  with the existing saturated palette. (Color is never the only signal — severity is also
  labeled in text.)
- **Title** (bold) + **source** clause reference with the clause id in `.mono`.
- **Expandable detail** (native `<details>` nested, or inline expand) showing `risk.detail`
  and the cited clause text from `GUIDELINE_KB`.
- **ACT chip** on the right — rendered **only when `risk.needsAction === true`** — a green
  `badge-lime`-styled action pill reading **ACT**, meaning the overseeing manager must decide
  whether to dispatch a worker.

### 3. `guidelineWarnBadge(record)`

The `[ N | ⚠ ]` indicator from sketch 1.

- Two hard-bordered cells split by a 2px ink divider: left = count `N` (Barlow Condensed),
  right = `warning` triangle icon (`var(--orange-600)`).
- Rendered **next to the Communication button** in `screenDetail` (visually above it in the
  header cluster), **only when conflict count > 0** (conflict = a risk with `needsAction` or
  `severity` medium/high — see "Conflict count" below).
- It is a **button**: clicking scrolls the Guideline panel into view and opens it
  (sets the `<details open>` and `scrollIntoView({behavior:'smooth'})`).

### Conflict count (the `N`)

`N` = number of risks considered **conflicts**: risks with `needsAction === true` OR
`severity` of `medium`/`high`. The seeded benign C1 risk (`low`, no action) is **not** a
conflict, so `N` starts at 0; after the C3 mock conflict is added, `N` becomes 1.

## Mock re-assessment flow

In `setupCommModal()`'s `send(wo)`:

1. Keep the existing "Message sent" success alert.
2. Call new `reassessGuideline(wo, message)`:
   - If `liveAgentEnabled` and a `guidelineCheck` agent is configured → call that agent
     (placeholder hook, same try/await pattern as `buildSummary`), normalize its result into
     risk objects.
   - **Otherwise (mock):** if `message` matches `/flower|plant/i`, append the **C3 conflict**:
     ```js
     { id:'risk-c3', title:'Unauthorized flower planting', clauseId:'C3',
       source:'Gardening · C3', severity:'high', needsAction:true,
       detail:'Resident asked the vendor to also plant a flower. Article C3 prohibits planting flowers not originally present without prior approval.' }
     ```
     (Guard against duplicate insertion if C3 already present.)
3. Persist the updated `record.summary.guideline` to localStorage (`persistWorkOrder`-style
   update by id).
4. Re-render the detail screen (`showDetail(wo)`) after the modal closes, so the warning
   badge `[ 1 | ⚠ ]` and the new red C3 risk row appear.

## Config addition — `app-config.js`

Add to `STAGE_DEFINITIONS`:

```js
{
  id: 'guidelineCheck',
  name: 'Guideline / knowledge-base check',
  description: 'Re-assesses a work order against community guidelines (e.g. after a communication). Mocked in tenant-flow.html until wired.',
}
```

This automatically gives the stage a default agent mapping via the existing
`DEFAULT_STAGE_AGENTS`/`normalizeConfig` logic and surfaces it in the config UI — no other
config changes needed.

## Error handling

- `guideline-kb.js` missing → `guidelineTile` renders nothing (guard on `window.GUIDELINE_KB`).
- `summary.guideline` absent → panel + warning badge do not render.
- Live `guidelineCheck` agent error → fall back to no new risks (do not break the comm flow);
  log to console, same spirit as `buildSummary`'s catch.
- Duplicate C3 insertion guarded by clause-id check.

## Testing / verification

Extend the existing headless-Chrome (`verify.cjs`) approach with probes:

1. Gardening scenario summary screen renders the Guideline panel with the seeded C1 row;
   `N`-warning badge is **absent** initially (no conflicts).
2. Detail page renders the panel; arrow expands the general guideline text.
3. ACT chip is present on rows with `needsAction`, absent otherwise.
4. Opening the comm modal, sending a message containing "flower" → after re-render, the
   detail page shows `[ 1 | ⚠ ]` next to Communication, a new **red** C3 risk row with an
   ACT chip, and clicking the badge scrolls to / opens the panel.
5. Sending a message **without** "flower"/"plant" adds **no** conflict.
6. Config page lists the new `guidelineCheck` stage.
7. Regression: existing agent-response/billing tiles, comm modal, lightbox, edit flow intact;
   0 console errors.

## Out of scope (YAGNI)

- Articles A/B and clauses outside Article C.
- A real guideline agent implementation (only the config stage + mock + hook).
- Editing/dismissing risks from the UI.
- The `agent-pipeline.html` "behind the scenes" flow (this is tenant-flow only).

# NeoBrut Design System
**Version 1.0 · Light theme · Tailwind CSS**

A lightweight, opinionated design system for building facility management and operations products. NeoBrutalist aesthetic — hard borders, flat offset shadows, compressed display type, saturated split-complementary accents.

---

## Quick start

```html
<!-- Google Fonts — paste in <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;700&family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,400,1,0&display=swap" rel="stylesheet">
```

```css
/* CSS custom properties — paste in :root */
:root {
  --blue-50:  #E6EFFC;
  --blue-300: #7AAAE8;
  --blue-600: #0A4FBF;
  --blue-800: #063380;

  --orange-50:  #FDEEE5;
  --orange-300: #F0A06A;
  --orange-600: #D65905;
  --orange-800: #8A3903;

  --lime-50:  #F5FAD6;
  --lime-300: #D4E84A;
  --lime-600: #8FB800;
  --lime-800: #597300;

  --white:    #F2F5FB;
  --gray-50:  #E8EDF7;
  --gray-600: #525A6A;
  --ink:      #0D0D0D;

  --sp-1:  4px;
  --sp-2:  8px;
  --sp-3:  12px;
  --sp-4:  16px;
  --sp-6:  24px;
  --sp-8:  32px;
  --sp-12: 48px;
  --sp-16: 64px;

  --border:    2px solid var(--ink);
  --shadow-sm: 3px 3px 0 var(--ink);
  --shadow-md: 4px 4px 0 var(--ink);
  --shadow-lg: 6px 6px 0 var(--ink);

  --radius-none: 0px;
  --radius-sm:   4px;
  --radius-pill: 999px;

  --font-display: 'Barlow Condensed', sans-serif;
  --font-body:    'DM Sans', sans-serif;
  --font-mono:    ui-monospace, 'Cascadia Code', monospace;
  --font-icon:    'Material Symbols Sharp';
}
```

---

## 1. Colour

Palette derived from split complementary harmony. Primary blue at HSL 216°, split complement produces orange at 23° and lime at 66°. All three pushed to high saturation (S93–100%). Neutrals carry a subtle blue tint.

### Primary — Blue `HSL 216° S93%`

| Token | Hex | Usage |
|---|---|---|
| `--blue-50` | `#E6EFFC` | Tinted backgrounds, active nav state |
| `--blue-300` | `#7AAAE8` | Hover fill on primary elements |
| `--blue-600` ★ | `#0A4FBF` | Primary CTA, active states, links |
| `--blue-800` | `#063380` | Pressed/active dark state |

### Secondary — Orange `HSL 23° S97%`

| Token | Hex | Usage |
|---|---|---|
| `--orange-50` | `#FDEEE5` | Tinted background for warning surfaces |
| `--orange-300` | `#F0A06A` | Accent fill |
| `--orange-600` ★ | `#D65905` | Secondary accent, warning states |
| `--orange-800` | `#8A3903` | Pressed/dark warning state |

### Tertiary — Lime `HSL 66° S100%`

| Token | Hex | Usage |
|---|---|---|
| `--lime-50` | `#F5FAD6` | Tinted background for success surfaces |
| `--lime-300` | `#D4E84A` | Highlight badges, success fills |
| `--lime-600` ★ | `#8FB800` | Success accent, tertiary CTA |
| `--lime-800` | `#597300` | Pressed/dark success state |

### Neutrals — Blue-tinted

| Token | Hex | Usage |
|---|---|---|
| `--white` | `#F2F5FB` | Page background, card surfaces |
| `--gray-50` | `#E8EDF7` | Secondary surfaces, input backgrounds, nav hover |
| `--gray-600` | `#525A6A` | Muted text, labels, placeholders |
| `--ink` | `#0D0D0D` | Primary text, all borders, all shadows |

### Colour rules

- **Lime (`--lime-300`, `--lime-600`) is never used on icons** — too low contrast at small sizes. Lime is for badge/tag fills and success surfaces only.
- Semantic mapping: blue = informational/active, orange = warning/urgent, lime = success/complete.
- The orange secondary can double as a warning colour — keep it off decorative use to preserve that semantic weight.

---

## 2. Typography

### Typefaces

| Role | Family | Weight | Usage |
|---|---|---|---|
| Display | Barlow Condensed | 800 | All headings — compressed, uppercase |
| Body | DM Sans | 400 / 500 / 700 | All UI text, labels, metadata |
| Mono | ui-monospace, Cascadia Code | 400 | IDs, codes, order numbers |
| Icon | Material Symbols Sharp | — | See Icons section |

### Type scale

| Class | Size | Weight | Family | Transform | Usage |
|---|---|---|---|---|---|
| `.display` | 72px | 800 | Barlow Condensed | uppercase | Hero moments only |
| `.h1` | 48px | 800 | Barlow Condensed | uppercase | Page titles |
| `.h2` | 32px | 800 | Barlow Condensed | uppercase | Section headings |
| `.h3` | 22px | 700 | Barlow Condensed | uppercase | Card headings, subsections |
| `.label` | 11px | 700 | DM Sans | uppercase | Form labels, eyebrows — `letter-spacing: 0.12em` |
| `.body-lg` | 15px | 400 | DM Sans | none | Primary body copy — `line-height: 1.7` |
| `.body-sm` | 13px | 400 | DM Sans | none | Secondary text, metadata — `color: var(--gray-600)` |
| `.mono` | 12px | 400 | Mono stack | none | IDs, order numbers, codes |

### Typography rules

- All headings use `text-transform: uppercase` and `letter-spacing: 0.02em` (h1/h2) or `0.04em` (h3).
- Labels use `letter-spacing: 0.12em` — wider tracking gives visual separation from body copy.
- **Work order IDs and any reference numbers (e.g. `WO-004821`) must always be wrapped in `.mono`.** This applies in body copy, alerts, cards, table cells — everywhere without exception.
- Never mix display and body weights in the same line. Use colour (orange-600 for location/subheading) to create hierarchy below the main heading.

```html
<!-- Correct: WO number in mono, always -->
<p class="body-sm">Work order <span class="mono">WO-004821</span> has been routed.</p>

<!-- Correct: heading hierarchy -->
<div class="label">Work order · <span class="mono">WO-2026-004821</span></div>
<h2 class="h2">HVAC Unit Failure</h2>
<div style="font-family: var(--font-display); font-size: 18px; font-weight: 700;
            text-transform: uppercase; color: var(--orange-600);">
  123 Maple Street, Unit 4B
</div>
```

---

## 3. Spacing

4px base grid. All spacing is a multiple of 4. Use these tokens exclusively — never use arbitrary values.

| Token | Value | Primary usage |
|---|---|---|
| `--sp-1` | 4px | Icon gaps, tight inline spacing |
| `--sp-2` | 8px | Label-to-value, badge internal padding |
| `--sp-3` | 12px | Button padding-y, form field gaps |
| `--sp-4` | 16px | Card padding, section gaps |
| `--sp-6` | 24px | Card-to-card gaps, list row height |
| `--sp-8` | 32px | Section padding, modal padding |
| `--sp-12` | 48px | Page section rhythm |
| `--sp-16` | 64px | Hero padding, top-level layout |

### Tailwind mapping

```js
// tailwind.config.js
spacing: {
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '6': '24px',
  '8': '32px',
  '12': '48px',
  '16': '64px',
}
```

---

## 4. Border, Shadow & Radius

### Border

One border style system-wide. No exceptions.

```css
--border: 2px solid var(--ink); /* #0D0D0D */
```

### Shadow

Hard offset only. **No blur. No spread. No opacity.** This is the defining visual signature of the system.

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `3px 3px 0 var(--ink)` | Tags, badges, small cards |
| `--shadow-md` | `4px 4px 0 var(--ink)` | Buttons (default), input focus |
| `--shadow-lg` | `6px 6px 0 var(--ink)` | Cards, panels, modals |

### Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | **Default for all components** — buttons, cards, inputs, modals, nav, alerts, dropdowns |
| `--radius-pill` | `999px` | Badges and status chips **only** |
| `--radius-none` | `0px` | Reserved — apply only when explicitly required |

**Rule: `--radius-sm` is the default. Never leave a bordered component at 0px unless `--radius-none` has been deliberately specified.**

### Tailwind mapping

```js
// tailwind.config.js
borderRadius: {
  'none': '0px',
  'sm':   '4px',
  'pill': '999px',
},
boxShadow: {
  'sm': '3px 3px 0 #0D0D0D',
  'md': '4px 4px 0 #0D0D0D',
  'lg': '6px 6px 0 #0D0D0D',
},
borderWidth: {
  DEFAULT: '2px',
},
borderColor: {
  DEFAULT: '#0D0D0D',
},
```

---

## 5. Interaction states

The shadow system drives all interaction feedback. No dark overlays on interactive elements.

### Buttons and interactive cards

```css
/* Default */
box-shadow: var(--shadow-md);
transform: translate(0, 0);

/* Hover — element lifts away from shadow */
transform: translate(-2px, -2px);
box-shadow: var(--shadow-lg); /* grows to emphasise lift */
transition: transform 0.08s ease, box-shadow 0.08s ease;

/* Active / pressed — element collapses into shadow */
transform: translate(4px, 4px);
box-shadow: none;
```

### Clickable cards (full-card links)

```css
/* Hover only — subtle bg tint, no lift */
background: rgba(0, 0, 0, 0.04);
```

### Text links

```css
/* Hover — darken to 800-stop of the same colour */
color: var(--blue-800); /* from var(--blue-600) */
```

### Focus

```css
outline: 3px solid var(--blue-600);
outline-offset: 2px;
```

### Summary table

| Element | Hover | Active/Pressed |
|---|---|---|
| Buttons | Shadow grows + translate(-2px,-2px) | Shadow collapses + translate(4px,4px) |
| Clickable cards | `rgba(0,0,0,0.04)` bg tint | — |
| Text links | Colour darkens to 800-stop | — |
| Non-interactive cards | None | — |

---

## 6. Icons

**Library:** Material Symbols Sharp — filled style, sharp 90° corners.

```html
<!-- CDN load in <head> -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,400,1,0" rel="stylesheet">
```

```css
.icon {
  font-family: 'Material Symbols Sharp';
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  user-select: none;
}
```

```html
<!-- Usage -->
<span class="icon" style="font-size: 22px;">build</span>
```

### Size scale

| Class | Size | Usage |
|---|---|---|
| `icon-sm` | 18px | Inline with body text, table cells, metadata |
| `icon-md` | 22px | Buttons, nav items, form prefixes — **default** |
| `icon-lg` | 28px | Section headers, empty states, standalone indicators |
| `icon-xl` | 36px | Feature callouts, onboarding, hero moments only |

### Colour rules

Icons always inherit the text colour of their context.

| Context | Colour |
|---|---|
| Default | `var(--ink)` — `#0D0D0D` |
| Muted / secondary | `var(--gray-600)` — `#525A6A` |
| Active / CTA | `var(--blue-600)` — `#0A4FBF` |
| Warning / urgent | `var(--orange-600)` — `#D65905` |
| Success / complete | `var(--lime-600)` — `#8FB800` |
| On filled primary button | `#FFFFFF` |

**Never use `--lime-300` or `--lime-600` as an icon colour in contexts smaller than 28px** — contrast is insufficient.

### Starter set — facility management

| Icon name | Usage |
|---|---|
| `build` | Maintenance |
| `assignment` | Work order |
| `apartment` | Property |
| `group` | Vendors |
| `calendar_month` | Schedule |
| `warning` | Urgent (orange-600) |
| `check_circle` | Complete (lime-600) |
| `location_on` | Location |
| `schedule` | Timeline |
| `smart_toy` | AI agent (blue-600) |
| `receipt_long` | Invoice |
| `handyman` | Repair |
| `notifications` | Alerts |
| `contract` | Lease |
| `filter_list` | Filter |
| `search` | Search |
| `add` | Create new |
| `arrow_forward` | Navigate |
| `settings` | Settings |

---

## 7. Components

### Button

```html
<!-- Primary -->
<button class="btn btn-primary">
  <span class="icon icon-md">add</span>
  New work order
</button>

<!-- Secondary -->
<button class="btn btn-secondary">
  <span class="icon icon-md">warning</span>
  Mark urgent
</button>

<!-- Ghost -->
<button class="btn btn-ghost">
  <span class="icon icon-md">filter_list</span>
  Filter
</button>

<!-- Lime -->
<button class="btn btn-lime">
  <span class="icon icon-md">check_circle</span>
  Approve
</button>

<!-- Icon only -->
<button class="btn btn-ghost" aria-label="Settings">
  <span class="icon icon-md">settings</span>
</button>
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 700;
  padding: 10px 18px;
  border: var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.btn:hover  { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }
.btn:active { transform: translate(4px, 4px);   box-shadow: none; }
.btn:focus-visible { outline: 3px solid var(--blue-600); outline-offset: 2px; }

.btn-primary   { background: var(--blue-600);   color: #fff;           box-shadow: var(--shadow-md); }
.btn-secondary { background: var(--orange-600); color: #fff;           box-shadow: var(--shadow-md); }
.btn-ghost     { background: var(--white);       color: var(--ink);    box-shadow: var(--shadow-md); }
.btn-lime      { background: var(--lime-300);    color: var(--ink);    box-shadow: var(--shadow-md); }

.btn-sm { font-size: 12px; padding: 6px 12px; }
.btn-lg { font-size: 16px; padding: 14px 24px; }
```

---

### Badge / Tag / Status chip

Pill shape only (`--radius-pill`). Never use `--radius-sm` on badges.

```html
<span class="badge badge-lime">
  <span class="icon icon-sm">check_circle</span>
  Complete
</span>
<span class="badge badge-blue">In progress</span>
<span class="badge badge-orange">
  <span class="icon icon-sm">warning</span>
  Urgent
</span>
<span class="badge badge-neutral">Routine</span>
<span class="badge badge-ink">New</span>
```

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border: var(--border);
  border-radius: var(--radius-pill);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.badge-lime    { background: var(--lime-300);   color: var(--ink); }
.badge-blue    { background: var(--blue-50);    color: var(--blue-800);   border-color: var(--blue-600); }
.badge-orange  { background: var(--orange-50);  color: var(--orange-800); border-color: var(--orange-600); }
.badge-neutral { background: var(--gray-50);    color: var(--gray-600);   border-color: var(--gray-600); }
.badge-ink     { background: var(--ink);        color: #fff; }
```

---

### Card

```html
<!-- Static card -->
<div class="card">
  <div class="label">Work order · <span class="mono">WO-2026-004821</span></div>
  <h2 class="h2">HVAC Unit Failure</h2>
  <div style="font-family: var(--font-display); font-size: 18px; font-weight: 700;
              text-transform: uppercase; color: var(--orange-600);">
    123 Maple Street, Unit 4B
  </div>
  <p class="body-lg">Description text here.</p>
  <div style="display: flex; gap: var(--sp-2);">
    <span class="badge badge-orange">Urgent</span>
    <span class="badge badge-blue">In progress</span>
  </div>
</div>

<!-- Interactive card (clickable) -->
<div class="card card-interactive">...</div>
```

```css
.card {
  background: var(--white);
  border: var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  padding: var(--sp-4);
}
.card-interactive {
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.1s ease;
}
.card-interactive:hover {
  transform: translate(-2px, -2px);
  box-shadow: 8px 8px 0 var(--ink);
}
.card-interactive:active {
  transform: translate(4px, 4px);
  box-shadow: none;
}
```

---

### Form elements

```html
<div class="form-group">
  <label class="label">Work order title</label>
  <div class="input-wrapper">
    <span class="icon icon-sm input-prefix-icon">assignment</span>
    <input class="input input-icon-left" type="text" placeholder="e.g. HVAC failure">
  </div>
</div>

<div class="form-group">
  <label class="label">Priority</label>
  <select class="select">
    <option>Select priority</option>
    <option>Urgent</option>
    <option>Standard</option>
  </select>
</div>

<div class="form-group">
  <label class="label">Description</label>
  <textarea class="textarea" placeholder="Describe the issue..."></textarea>
</div>
```

```css
.input, .select, .textarea {
  width: 100%;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--ink);
  background: var(--white);
  border: var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  outline: none;
  transition: box-shadow 0.1s ease;
  appearance: none;
}
.input:focus,
.select:focus,
.textarea:focus { box-shadow: var(--shadow-md); }
.input::placeholder,
.textarea::placeholder { color: var(--gray-600); }
.textarea { resize: vertical; min-height: 96px; }

.form-group { display: flex; flex-direction: column; gap: var(--sp-2); }
.form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }

/* Icon prefix/suffix */
.input-wrapper      { position: relative; display: flex; align-items: center; }
.input-icon-left    { padding-left: 40px; }
.input-icon-right   { padding-right: 40px; }
.input-prefix-icon  { position: absolute; left: 10px; color: var(--gray-600); pointer-events: none; }
.input-suffix-icon  { position: absolute; right: 10px; color: var(--gray-600); pointer-events: none; }
```

---

### Navigation — tab bar

```html
<nav class="nav">
  <a class="nav-item active" href="#">
    <span class="icon icon-sm">assignment</span> Orders
  </a>
  <a class="nav-item" href="#">
    <span class="icon icon-sm">group</span> Vendors
  </a>
  <a class="nav-item" href="#">
    <span class="icon icon-sm">apartment</span> Properties
  </a>
  <a class="nav-item" href="#">
    <span class="icon icon-sm">smart_toy</span> AI
  </a>
</nav>
```

```css
.nav {
  display: flex;
  border: var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.nav-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: 12px var(--sp-4);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-600);
  border-right: var(--border);
  text-decoration: none;
  transition: background 0.1s;
}
.nav-item:last-child { border-right: none; }
.nav-item:hover      { background: var(--gray-50); }
.nav-item.active     { background: var(--blue-50); color: var(--blue-600); font-weight: 700; }
```

---

### Table

```html
<div class="table-wrapper">
  <table class="table">
    <thead>
      <tr>
        <th>Order ID</th>
        <th>Issue</th>
        <th>Status</th>
        <th>Priority</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="mono">WO-004821</span></td>
        <td>HVAC unit failure</td>
        <td><span class="badge badge-blue">In progress</span></td>
        <td><span class="badge badge-orange">Urgent</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

```css
.table-wrapper {
  border: var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  overflow-x: auto;
}
.table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: var(--font-body); }
.table th {
  background: var(--ink);
  color: #fff;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 10px var(--sp-4);
  text-align: left;
  border-right: 1px solid var(--gray-600);
}
.table th:last-child { border-right: none; }
.table td {
  padding: 10px var(--sp-4);
  border-bottom: 1px solid #E5E5E5;
  border-right: 1px solid #E5E5E5;
  vertical-align: middle;
}
.table td:last-child  { border-right: none; }
.table tr:last-child td { border-bottom: none; }
.table tr:hover td   { background: var(--gray-50); }
```

---

### Alert / Notice

```html
<!-- Info -->
<div class="alert alert-info">
  <span class="icon icon-lg" style="color: var(--blue-600); flex-shrink: 0;">smart_toy</span>
  <div>
    <div style="font-weight: 700; font-family: var(--font-body); margin-bottom: 4px;">AI agent assigned</div>
    <p class="body-sm" style="color: var(--ink);">
      Work order <span class="mono">WO-004821</span> has been automatically routed to TechCo.
    </p>
  </div>
</div>

<!-- Warning -->
<div class="alert alert-warning">
  <span class="icon icon-lg" style="color: var(--orange-600); flex-shrink: 0;">warning</span>
  <div>
    <div style="font-weight: 700; font-family: var(--font-body); margin-bottom: 4px;">Vendor response overdue</div>
    <p class="body-sm" style="color: var(--ink);">
      TechCo has not confirmed <span class="mono">WO-004821</span> within the 2-hour SLA window.
    </p>
  </div>
</div>

<!-- Success -->
<div class="alert alert-success">
  <span class="icon icon-lg" style="color: var(--lime-600); flex-shrink: 0;">check_circle</span>
  <div>
    <div style="font-weight: 700; font-family: var(--font-body); margin-bottom: 4px;">Work order resolved</div>
    <p class="body-sm" style="color: var(--ink);">
      <span class="mono">WO-004819</span> completed and signed off.
    </p>
  </div>
</div>
```

```css
.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border: var(--border);
  border-radius: var(--radius-sm);
}
.alert-info    { background: var(--blue-50);   border-left: 4px solid var(--blue-600); }
.alert-warning { background: var(--orange-50); border-left: 4px solid var(--orange-600); }
.alert-success { background: var(--lime-50);   border-left: 4px solid var(--lime-600); }
```

---

### Stat card

Used in dashboard summaries. The number is always in Barlow Condensed for maximum visual impact.

```html
<div class="stat-card">
  <div class="label">Open orders</div>
  <div class="stat-number" style="color: var(--blue-600);">42</div>
</div>
```

```css
.stat-card {
  background: var(--white);
  border: var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  padding: var(--sp-4);
}
.stat-number {
  font-family: var(--font-display);
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
}
```

---

## 8. Layout

### Page wrapper

```css
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--sp-12) var(--sp-8);
}

@media (max-width: 640px) {
  .page { padding: var(--sp-8) var(--sp-4); }
}
```

### Responsive grid

```css
/* Auto-fit card grid */
.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--sp-4);
}

/* Two-column form row */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
}

@media (max-width: 640px) {
  .form-row { grid-template-columns: 1fr; }
}
```

### App header pattern

```html
<header style="background: var(--ink); padding: 12px var(--sp-4);
               display: flex; justify-content: space-between; align-items: center;">
  <div style="font-family: var(--font-display); font-size: 20px; font-weight: 800;
              text-transform: uppercase; letter-spacing: 0.04em; color: #fff;">
    App <span style="color: var(--lime-300);">Name</span>
  </div>
  <!-- right side: icon buttons + avatar -->
</header>
```

---

## 9. Accessibility

- All interactive elements have visible `:focus-visible` outlines: `3px solid var(--blue-600)` at `2px offset`.
- Colour is never the only indicator of state — badges combine colour + label text + optional icon.
- Icon-only buttons always carry an `aria-label`.
- `prefers-reduced-motion` should disable all transitions: `* { transition-duration: 0ms !important; }`.
- Minimum touch target size on mobile: 44×44px. Icon-only buttons use `padding: 10px` to meet this.

---

## 10. Do / Don't

| Do | Don't |
|---|---|
| Use `--shadow-md/lg` with hard offset on all raised elements | Add blur or opacity to shadows |
| Use `--radius-sm` (4px) as default on all components | Leave bordered components at 0px radius |
| Wrap all work order IDs in `<span class="mono">` | Write bare `WO-004821` in any text context |
| Use `--radius-pill` for badges and chips only | Apply pill radius to buttons or cards |
| Use orange for urgency/warning signals | Use lime as an icon colour |
| Keep lime (`--lime-300`) for badge fills and success surfaces | Use lime on large background areas |
| Use Barlow Condensed 800 + uppercase for all headings | Use Barlow Condensed for body copy |
| Apply lift interaction (translate + shadow grow) on button hover | Use dark overlay for hover state on buttons |
| Use `rgba(0,0,0,0.04)` for clickable card hover | Lift-animate non-interactive cards |

---

*NeoBrut Design System v1.0 — generated June 2026*

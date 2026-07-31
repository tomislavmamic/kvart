---
name: Naš kvart
description: The public record of a Split neighbourhood — a map and a set of minutes, read on a phone in the street.
colors:
  maslina: "#007956"
  maslina-zivo: "#009767"
  maslina-noc: "#002c22"
  maslina-vez: "#ecfdf5"
  maslina-rub: "#a4f4cf"
  papir: "#ffffff"
  kamen-plitko: "#f4f4f5"
  kamen-tlo: "#e4e4e7"
  kamen-rub: "#d4d4d8"
  kamen-tih: "#9f9fa9"
  kamen-drugi: "#71717b"
  kamen-tekst: "#52525c"
  kamen-tinta: "#18181b"
  status-objavljeno: "#005986"
  status-objavljeno-ground: "#dff2fe"
  status-poslano: "#5d0ec0"
  status-poslano-ground: "#ede9fe"
  status-u-tijeku: "#953d00"
  status-u-tijeku-ground: "#fef3c6"
  status-rijeseno: "#005f46"
  status-rijeseno-ground: "#d0fae5"
  status-odbijeno: "#a30037"
  status-odbijeno-ground: "#ffe4e6"
  status-ceka: "#3f3f46"
  status-ceka-ground: "#e4e4e7"
  whatsapp: "#25d366"
  whatsapp-hover: "#1fb355"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  dense:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.06em"
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tabular-nums"
rounded:
  sm: "0.25rem"
  lg: "0.5rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  hairline: "0.25rem"
  tight: "0.5rem"
  snug: "0.75rem"
  base: "1rem"
  card: "1.25rem"
  roomy: "1.5rem"
  section: "2rem"
  chapter: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.maslina-zivo}"
    textColor: "{colors.papir}"
    rounded: "{rounded.full}"
    padding: "0.75rem 1.5rem"
    typography: "{typography.dense}"
  button-primary-hover:
    backgroundColor: "{colors.maslina}"
  button-secondary:
    backgroundColor: "{colors.papir}"
    textColor: "{colors.kamen-tekst}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
    typography: "{typography.dense}"
  button-secondary-hover:
    backgroundColor: "{colors.kamen-plitko}"
  card:
    backgroundColor: "{colors.papir}"
    textColor: "{colors.kamen-tinta}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  input:
    backgroundColor: "{colors.papir}"
    textColor: "{colors.kamen-tinta}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
    typography: "{typography.body}"
  badge-status:
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
    typography: "{typography.label}"
  chip-view:
    backgroundColor: "{colors.papir}"
    textColor: "{colors.kamen-tekst}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.625rem"
  chip-view-selected:
    backgroundColor: "{colors.maslina-zivo}"
    textColor: "{colors.papir}"
  panel-floating:
    backgroundColor: "{colors.papir}"
    textColor: "{colors.kamen-tekst}"
    rounded: "{rounded.xl}"
    padding: "0.75rem"
---

# Design System: Naš kvart

## Overview

**Creative North Star: "Zemljovid i zapisnik"** — the map and the minutes.

This system runs on two registers with different authority, and knowing which
one you are in is the first design decision on any screen. **The minutes** are
everything the initiative writes: proposals, statuses, documents, the record of
what was sent to the City and what came back. That register is ours to design,
and it is deliberately plain — a municipal register that earns trust by being
legible, dated and sourced rather than by being persuasive. **The map** is
everything the initiative did not author: land-use colours printed in the GUP's
own tumač znakova, seventy city-GIS layers, cadastral boundaries. That register
is *inherited*. Its colours are evidence, and evidence does not get restyled to
match a brand.

The material world is paper and stone. A quiet off-white ground, white surfaces
laid on it, olive used sparingly for anything you can act on. There are no
webfonts and no illustration; the only image in the product is a real aerial
photograph of the two neighbourhoods, and the only saturated colour outside the
accent is either a status or something the plan itself coloured. Corners are
generously rounded because the thing is read by neighbours on a phone, not by
analysts at a desk — the shape is warm even where the palette is sober.

What it is not: this is not a campaign. There are no slogans, no party colours,
no candidate faces. It is also not a SaaS product borrowing institutional
weight it hasn't got — no gradient hero, no abstract 3D, no logo wall. And it
is emphatically not the 2009 municipal portal that residents already expect
when they hear "prostorni plan": no grey nested tables, no clip-art, nothing
that breaks on a phone.

**Key Characteristics:**

- Two registers: authored minutes (designed) and inherited map (never restyled).
- Paper on stone: the ground is deep enough to separate surfaces on its own,
  so neither shadow nor outline has to.
- Olive marks action and affiliation only — never decoration.
- Zero font bytes: the system stack, on purpose.
- Warm geometry, sober colour: pills and generous radii, restrained palette.
- Phone in the street is the design scene, not the desktop.

## Colors

Two anchors, named for where the kvart actually is: **maslina**, the olive-pine
green of the Kozjak slope above it, and **kamen**, Split limestone. Everything
else is either a status or inherited from an official document.

### Primary

- **Maslina** (`maslina`): the voice of the system. Links, accent text,
  neighbourhood labels, the hover state of primary actions. This is the colour
  that says *you can act on this or this belongs to us*.
- **Maslina živa** (`maslina-zivo`): the surface of a primary action — the one
  filled, pill-shaped button on a screen. Slightly brighter than Maslina so a
  filled button reads as forward, not as a block of text colour.
- **Maslina noć** (`maslina-noc`): the dark ground behind the aerial hero, and
  the only near-black surface in the system. Deep enough that white type and a
  photograph both survive on it.
- **Maslina vez** (`maslina-vez`) with **Maslina rub** (`maslina-rub`): a tinted
  callout — pale ground, pale border — for the one block on a page that is a
  live invitation rather than information. Used for the WhatsApp group card.

### Tertiary — status

Six statuses, each a dark ink on its own pale ground. This is the product's
core vocabulary: a resident scanning the register reads status by colour before
reading a single word. The hues are chosen to be distinguishable at badge size,
not to harmonise.

- **Objavljeno** (`status-objavljeno` on `status-objavljeno-ground`): published,
  neutral-positive. Sky.
- **Poslano gradu** (`status-poslano` on `status-poslano-ground`): formally
  submitted. Violet — the colour of the record leaving our hands.
- **U tijeku** (`status-u-tijeku` on `status-u-tijeku-ground`): work confirmed.
  Amber.
- **Riješeno** (`status-rijeseno` on `status-rijeseno-ground`): resolved. The
  only status that borrows the brand's own hue, which is the point.
- **Odbijeno** (`status-odbijeno` on `status-odbijeno-ground`): refused. Rose,
  not red — a refusal is a fact to record, not an alarm to sound.
- **Na čekanju** (`status-ceka` on `status-ceka-ground`): dormant. Stone on
  stone; the absence of colour is the message.

### Neutral

- **Kamen tlo** (`kamen-tlo`): the page ground — and, where a line is still
  needed, the line. One value with two jobs, which is the whole point: it is
  set at exactly the separation a 1px border used to provide, so the ground can
  take that job over. See Elevation & Depth for the measurement.
- **Papir** (`papir`): every card, panel, field and floating surface. On Kamen
  tlo it stands on its own, with no outline.
- **Kamen plitko** (`kamen-plitko`): a half-step *up* from the ground, for
  grouped controls that should read as a surface without being full paper.
  Note the direction: the neutral ramp climbs from ground to paper. Nothing
  steps back down.
- **Kamen rub** (`kamen-rub`): the border of anything you can operate — inputs,
  selects, secondary buttons. One step darker than the ground so controls read
  as controls even when they sit on paper.
- **Kamen tih** (`kamen-tih`): timestamps and faint metadata.
- **Kamen drugi** (`kamen-drugi`): secondary text and section labels.
- **Kamen tekst** (`kamen-tekst`): running body copy.
- **Kamen tinta** (`kamen-tinta`): headings and anything that must be read first.

### External

- **WhatsApp** (`whatsapp` / `whatsapp-hover`): the platform's own brand green,
  used only on the button that joins the group. It is not part of the palette
  and must never be borrowed for anything else.

### Named Rules

**The Two Registers Rule.** Colour that came from an official document is
evidence, not decoration. GUP land-use fills, city-GIS layer colours and plan
legends are reproduced exactly as the source prints them, including when they
clash with Maslina and Kamen. Never harmonise a plan's palette to the brand;
the whole value of the map is that it shows what the plan says.

**The One Green Rule.** Maslina marks two things only: something you can act on,
and something that belongs to the kvart. It is never a background for mood,
never a decorative rule, never a heading colour. If a green element does not
answer "act" or "ours", it is wrong.

**The Rose-Not-Red Rule.** Refusal and error use Rose, never a pure alarm red.
The register reports outcomes; it does not editorialise them. Red is reserved
for map semantics that are genuinely about danger or exclusion.

## Typography

**Display / Body / Label Font:** the system stack (`system-ui`, `-apple-system`,
`Segoe UI`, `Roboto`, sans-serif).
**Data Font:** the system monospace stack, with tabular figures.

**Character:** deliberately unbranded. Type here does not perform personality —
it gets out of the way of a number, a date and a status. The system stack looks
native on the phone the site is actually read on, and costs zero bytes on a
connection that may be weak. Personality lives in the shapes and the colour
discipline, not in the letterforms.

### Hierarchy

- **Display** (800, `clamp(2.25rem, 6vw, 3rem)`, 1.08): the home hero only.
  Extrabold and tight-leaded so two short lines read as one statement over a
  photograph. One per site, not one per page.
- **Headline** (700, 1.5rem, 1.2): the page `h1`. Every route opens with one.
- **Title** (700, 1.125rem, 1.35): section and card headings inside a page.
- **Body** (400, 1rem, 1.6): running prose — descriptions, explanations,
  anything a person reads rather than scans. Cap measure at 65–75ch.
- **Dense** (400, 0.875rem, 1.5): instrument text — map panels, layer lists,
  table rows, metadata under a card. Legitimate where the screen is a control
  surface, never for prose a resident must actually read.
- **Label** (700, 0.75rem, +0.06em, uppercase): section eyebrows above a group
  of controls or content. Sparse; they structure, they do not decorate.
- **Data** (mono, 0.875rem, tabular): coordinates, areas, parcel numbers, any
  figure that appears in a column and must align.

### Named Rules

**The Zero-Byte Rule.** No webfonts. Not a display face, not an icon font, not
"just one weight". The system stack is a commitment to the slow-connection
requirement, and it is not up for renegotiation on aesthetic grounds.

**The Reading-Size Rule.** Prose is 1rem. The 0.875rem Dense role is for
instrument chrome only — map panels, dense tables, metadata lines. A paragraph
a resident is expected to read is never set at Dense, no matter how much copy
needs to fit. *Audit test: if it is a sentence in a `<p>` that carries meaning,
it is 1rem or larger.*

**The Croatian Typographic Rule.** Decimal comma, not point. Croatian plural
forms (1 ploha / 2–4 plohe / 5+ ploha). Dates in Croatian format. This applies
to every number the interface renders, including in map tooltips and downloads.

## Layout

**Container.** One centred column, `max-w-5xl` with `1rem` gutters and `2rem`
vertical padding, for every page except the map. Long-form reading pages
(documents, about, plan comparison) narrow further to `max-w-3xl` — measure
beats width.

**The map is not in the container.** `/karta` takes the whole viewport
(`fixed inset-0`) and drops the page shell entirely: no header bar, no footer,
no max-width. Its chrome floats over the map instead — a nav pill top-left, a
layer sidebar under it, a base/plan panel top-right. This is the one surface
where the content *is* the viewport, and the layout reflects that rather than
fighting it.

**Rhythm.** Vertical spacing runs on a small set of steps: `0.5rem` inside a
control, `0.75rem` between related lines, `1rem` between elements, `1.5rem`
inside a card, `2rem` between sections, `3rem` between chapters of a page.
Sibling groups use flex/grid `gap`, not per-element margins.

**Responsive.** Two breakpoints do nearly all the work: `sm` (640px) and `lg`
(1024px). Below `sm` everything is a single column, navigation collapses to a
burger, and side panels become bottom sheets. Between `sm` and `lg` the map's
side panels compete for width, so the parcel dossier falls back to a bottom
sheet rather than being squeezed. Design mobile first and let the desktop
inherit; the reverse produces layouts that only work at a desk.

### Named Rules

**The Bottom-Sheet Fallback Rule.** When two floating panels cannot both fit
beside the content at a given width, the secondary one becomes a bottom sheet
rather than shrinking. Three squeezed columns serve nobody.

## Elevation & Depth

**Tone carries depth; the line is the fallback.** Surfaces separate by climbing
the neutral ramp — `kamen-tlo` ground, `kamen-plitko` half-step, `papir`
surface — and a border appears only where that climb is too short to read.

**Tone can only carry it if the ground is deep enough, and this is measurable.**
A 1px `#e4e4e7` border against white separates at a contrast ratio of
**1.27 : 1**. That is the number the ground has to match to take the border's
job. Measured against a white surface:

| Ground | Ratio to `papir` | Carries separation alone? |
| --- | --- | --- |
| `#fafafa` (zinc-50) | 1.04 : 1 | No — the surface disappears |
| `#f4f4f5` (zinc-100) | 1.10 : 1 | Barely — only with generous surrounding space |
| `#e4e4e7` (`kamen-tlo`) | 1.27 : 1 | Yes — exactly what the border was giving |

So "tone instead of line" does not mean *delete the border*. It means **move the
ground to the value the border already had**. Deleting borders on a `#fafafa`
ground produces a page where cards have simply vanished.

Shadows are not part of the resting state of the interface. They exist for two
purposes only: something that genuinely floats above other content (map chrome
over the map, the parcel dossier), and a response to interaction (a proposal
card lifting fractionally on hover).

**Migration status.** The incumbent code still runs a `#fafafa` ground with a
1px border on nearly every surface (39 uses). The ground move is a whole-site
visual change and has not been made. Until it is, new work on an existing
`#fafafa` page keeps its borders — a half-migrated page is worse than either
end state.

### Shadow Vocabulary

- **Floating chrome** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`):
  panels that sit above the map. They need to read as *over*, not *in*.
- **Hover lift** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): the faintest
  possible response on an interactive card, paired with a border shift to
  Maslina. The border does the talking; the shadow just confirms it.

### Named Rules

**The 1.2 : 1 Rule.** A border is added when the contrast ratio between a
surface and whatever sits behind it falls below 1.2 : 1, and not otherwise.
That threshold keeps lines exactly where tone genuinely cannot work: form
fields and secondary buttons (white on white), and floating panels over the
map, where the "ground" is an aerial photograph with no tone to step against.
*Audit test: name the two colours and compute the ratio. If it is above 1.2 : 1,
the border is decoration.*

**The Climbing-Ramp Rule.** The neutral ramp goes one way — ground up to paper.
A panel nested inside a card does not step back down to a grey; it stays white
with more space around it, or it steps up. Three greys nested inside each other
read as mush no matter how carefully the steps are chosen.

**The Resting-Flat Rule.** Nothing has a shadow at rest unless it is physically
floating over other content. If you are tempted to add a resting shadow to make
a card "pop", the fix is a tonal step or more space around it.

## Shapes

Corners are generous and the system reads as warm because of it. Four radii,
each with a job:

- **Pill** (`full`): anything you press or select — primary buttons, view chips,
  status badges, the floating nav. The pill is the system's signature and the
  main reason a sober palette still feels neighbourly rather than bureaucratic.
- **Card** (`xl`, 0.75rem): cards, floating panels, and any container holding a
  group of things.
- **Control** (`lg`, 0.5rem): inputs, selects, secondary buttons, small
  containers inside a card.
- **Tag** (`sm`, 0.25rem): tiny inline markers — colour swatches, inline chips
  in dense chrome. Used where a pill would look bloated at 12px.

Borders are always exactly 1px. There are no double rules, no thick decorative
strokes, and no dividers heavier than `kamen-tlo`.

### Named Rules

**The Pressable-Is-Round Rule.** If it is pressable and small, it is a pill. If
it holds content, it is a card radius. Never a pill container or a square
button.

## Components

### Buttons

- **Shape:** fully rounded pill for primary, control radius (0.5rem) for
  secondary and inline actions.
- **Primary:** Maslina živa ground, white label, `0.75rem 1.5rem` padding.
  Exactly one per view — the single most useful next action.
- **Hover / Focus:** hover deepens to Maslina; focus shows a 2px Maslina
  outline offset from the shape. Transitions are colour-only, ~150ms.
- **Secondary:** white ground, `kamen-rub` 1px border, `kamen-tekst` label;
  hover fills to `kamen-plitko`.
- **On dark (hero only):** white ground with Maslina-800 label for the primary;
  a 1px white-70% border with white label for the companion.

### Chips

- **Style:** pill, white ground, `kamen-rub` border, 0.75rem semibold label.
- **State:** selected fills with Maslina živa and switches the label to white.
  Neutral "off" states (the *bez podloge* / *ne* choices) fill with
  `kamen-tinta` instead of Maslina, because "none selected" is a state, not an
  action.

### Cards / Containers

- **Corner Style:** card radius (0.75rem).
- **Background:** Papir on the `kamen-tlo` page ground.
- **Shadow Strategy:** none at rest — see Elevation & Depth.
- **Border:** none. The ground carries the separation; a card outlined against
  `kamen-tlo` is drawing the same edge twice. (Cards still on a `#fafafa` page
  keep their border until that page's ground moves — see Migration status.)
- **Internal Padding:** `1.25rem` for content cards, `1.5rem` for section
  panels.
- **Interactive cards** (proposal cards) shift their border to Maslina-400 on
  hover and pick up the faintest lift.

### Inputs / Fields

- **Style:** white ground, 1px `kamen-rub` border, control radius, `0.5rem
  0.75rem` padding, full width in forms.
- **Focus:** a visible 2px Maslina ring, offset by 2px. *This is currently
  missing from the form fields in the codebase and is a known gap against the
  WCAG AA commitment — new work must not copy the incumbent here.*
- **Error:** Rose border with the message set in `status-odbijeno` beneath the
  field, never colour alone.

### Navigation

- **Full-width bar** (every route except the map): white, 1px bottom border,
  brand wordmark left, inline links right at 0.875rem, active link in
  `kamen-tinta` and the rest in `kamen-drugi`. Collapses to a burger below
  `sm`.
- **Floating pill** (map only): the same wordmark and a burger inside a pill
  fixed top-left, with the page list in a dropdown card. Collapsed at every
  width, because on the map navigation is used once — on the way out. Escape
  and click-outside close it.

### Status Badge (signature)

The product's most characteristic component: a pill carrying one of six
statuses as dark ink on its own pale ground, 0.75rem semibold, never wrapping.
It appears anywhere a proposal appears. Its whole job is to be readable at a
glance in a list — which is why it is a filled pill and not a coloured dot or a
bare word.

### Floating Map Panel (signature)

White at 95% with a backdrop blur, card radius, 1px `kamen-tlo`, floating
shadow, a titled header row with a collapse control, and a scrollable body of
dense 0.75rem controls. Three of these coexist over the map (layers, base and
plan, parcel dossier) and they are the reason the map reads as an instrument
rather than a page. They collapse to a single labelled button rather than
disappearing.

## Do's and Don'ts

### Do:

- **Do** reproduce plan and GIS colours exactly as the source document prints
  them, even when they clash with the palette. The map is evidence.
- **Do** set prose at 1rem or larger; reserve 0.875rem for instrument chrome.
- **Do** give every interactive element a visible focus state — a 2px Maslina
  ring. WCAG AA is the floor, and the current form fields do not meet it.
- **Do** separate surfaces by climbing the neutral ramp (`kamen-tlo` →
  `kamen-plitko` → `papir`), and add a 1px line only where the ratio between a
  surface and its backdrop falls below 1.2 : 1.
- **Do** move the ground before removing borders. On a `#fafafa` page the two
  are not interchangeable — deleting the line there deletes the card.
- **Do** put exactly one filled Maslina action in a view, and make it the most
  useful next step.
- **Do** state absence plainly in empty states — "Još nema objavljenih
  dokumenata" — rather than hiding the section. An honest gap is part of the
  record.
- **Do** cite the source next to any figure or layer, and keep licence
  attribution visible; it is a condition of use, not a courtesy.
- **Do** design the phone first: single column, thumb-reachable, tap targets no
  smaller than 44px.
- **Do** write every number in Croatian conventions — decimal comma, correct
  plural form, Croatian dates.

### Don't:

- **Don't** add a webfont. Not for headings, not for icons, not "just one
  weight".
- **Don't** restyle, recolour or "clean up" a plan's palette to match the brand.
- **Don't** use Maslina decoratively — no green mood backgrounds, no green
  section rules, no green headings. It marks action and affiliation only.
- **Don't** give surfaces a resting shadow to make them pop; use a tonal step or
  more space.
- **Don't** outline a card that already stands on `kamen-tlo`. The ground and
  the border are the same value doing the same job, and doing it twice reads as
  a boxed-in layout.
- **Don't** nest a grey panel inside a card. If a group needs distinguishing,
  give it space or step it up, never back down the ramp.
- **Don't** ship a campaign artefact: no slogans, no party colours, no candidate
  imagery, no rallying language.
- **Don't** borrow SaaS credibility devices — gradient heroes, abstract 3D,
  stock photography of smiling people, "trusted by" logo walls. The initiative
  is informal and the design should not pretend otherwise.
- **Don't** reproduce the 2009 municipal portal: no grey nested data tables, no
  clip-art iconography, nothing that breaks below 640px.
- **Don't** invent a figure, a status, a count or a citation to fill a layout.
  If the data is not there, the design must show that it is not there.
- **Don't** borrow the WhatsApp green for anything other than the WhatsApp
  button.

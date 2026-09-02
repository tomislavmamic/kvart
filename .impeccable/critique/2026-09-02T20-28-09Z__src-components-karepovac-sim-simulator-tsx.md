---
target: /karepovac/sim
total_score: 28
max_score: 40
na_heuristics:
p0_count: 2
p1_count: 5
timestamp: 2026-09-02T20-28-09Z
slug: src-components-karepovac-sim-simulator-tsx
---
Method: single-agent (source review + live pass in Chrome on the production build at localhost:3100, 2026-09-02 evening, live data: calm, Vrboran 0,2–0,9 m/s). Mobile measured in a same-origin 390 × 716 px iframe because the browser tool cannot shrink the window below 1280 px. Screenshots: `.cache/hindcast/ux/impeccable/`. No `detect.mjs` run — the helper is not in this checkout.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | „Računam 16/28 sati” badge, pending chips on the strip and „Računam ovaj sat…” in the card cover the 20–40 s warm-up well. Nothing is announced to assistive tech: the card title changes with every hour and there is no `aria-live` region; the only landmarks are an `sr-only` h1 and one `section`. |
| 2 | Match System / Real World | 3 | The card speaks the resident's language („Ne znamo pouzdano”, „nosi prema jugoistoku”, „oko 23 h: jače”). The wind line leaks instrument jargon at 11 px: „sloj 25 m · Model (Open-Meteo)”; pins print „H₂S 1,51” with no unit and „šuti” next to „tišina”, two words for two different silences. |
| 3 | User Control and Freedom | 2 | Escape does nothing while the settings panel is open (measured: panel stays, focus stays on the close button). The exit button sits 6 px from the settings button, same size, same style, and leaves the page with no confirmation — the auditor hit it by mistake. URL state is good: hour, layers, point and scenario all survive a reload. |
| 4 | Consistency and Standards | 2 | Two identical 40 px icon squares at the top: ☰ opens settings, ✕ leaves the simulator. „Više” on the card opens the same panel as ☰. Pins mix an arrow glyph, „tišina”, „šuti” and „nema” for four kinds of absence. Zoom controls are MapLibre defaults at 29 px, off the 44 px floor the rest of the chrome respects. |
| 5 | Error Prevention | 2 | The exit trap above. Nine 11 px proposal dots are tappable and unlabelled; on a phone they are neither hittable nor explained until the panel is opened. A tap on the map always drops a point marker, including taps meant for a pin label. |
| 6 | Recognition Rather Than Recall | 3 | Legend on the card, colour-coded strip, night glyphs, hatched forecast — the strip previews when it was bad without reading. The proposal dots have no key on the map; their meaning lives only in the panel checkbox text. |
| 7 | Flexibility and Efficiency | 3 | Keyboard on the slider works (arrows, Home, End), play/pause, shareable URL, scenarios for testing. Missing the obvious accelerator for someone standing outside: „kod mene” from geolocation — the point card exists but only by clicking the map. |
| 8 | Aesthetic and Minimalist Design | 3 | Desktop is coherent. At the default zoom the three pins around the landfill (Vrboran, Pujanke, H₂S) collide into one unreadable stack; on 390 px the card takes 43 % of the viewport, the strip 15 %, and the icon row wraps into three lines. |
| 9 | Error Recovery | 3 | Unavailable hours are gaps that cannot be selected; „Nema podataka o vjetru” and „Ne znamo pouzdano” are honest states. A failed worker shows its message in the badge. No retry affordance. |
| 10 | Help and Documentation | 3 | „zašto?” reveals the reasons for the confidence word, which is the right depth at the right moment. The panel opens with a 60-word yellow paragraph before any control; correct, but it is the first thing on the panel. |
| **Total** | | **28/40** | **Good bones, two traps and an accessibility floor missed** |

All ten heuristics apply: this is an Operate surface.

## Design Specificity Verdict

Three things here could not be lifted from a generic weather or map product. **The situation card's vocabulary of doubt**: „Ne znamo pouzdano — model za ovaj sat nema pouzdan vjetar, pa ‚ništa' ne znači ‚čisto'” separates ignorance from cleanliness in one sentence, and „zašto?” exposes the reasons rather than a score. **The strip that previews the day**: −24 h … sada … +3 h with per-hour level chips, night glyphs and a hatched forecast means the shape of the day is readable before any scrubbing. **The point card**: click anywhere, get the same words for that spot plus a report button with the place already filled — the model claims, the nose checks.

What is stock: the map chrome. MapLibre's default zoom stack, a ☰ and a ✕ in floating squares, a right-hand settings column. That chrome is where both P0s live.

**Deterministic scan** — not run (`detect.mjs` absent). Manual sweep of `src/components/karepovac/sim/`: 95 raw `zinc-*`/`teal-*`/`amber-*`/hex occurrences; `zinc` is protected (byte-identical to Kamen), `teal` and `amber` are not in the palette and are new drift from this week's work (proposal markers, confidence word). Ten hard-coded sizes at 9–12 px in five files.

**Measured in the running page (desktop 1280 px)**: 19 interactive elements, **17 under 44 px** — nine proposal dots at 11 × 11, three zoom controls at 29 × 29, „zašto?” 47 × 20, „Više” 36 × 20, play 36 × 36, ☰ and ✕ 40 × 40. Text sizes: 9 px ×3, 10 px ×14, 11 px ×17, 12 px ×13, 16 px ×2, 18 px ×1 — **47 of 50 text nodes at or below 12 px**, including the one sentence a resident is meant to read under the title. Focus ring is present (`.fokus`, Maslina 2 px) on every button. Contrast: `zinc-500` on white/92 computes to 4,6 : 1, at the floor but at 10–11 px; `amber-700` „niska” 4,9 : 1; pin text 16 : 1. Load: 54 requests, 146 KB transferred warm; first useful frame 15–40 s after load on this machine because the plume is computed client-side.

## Overall Impression

This surface answers the five-second question. Open it and the first line says whether it smells, where, which way it is going and how sure the model is — and it says „we don't know” when it doesn't. The strip below tells you when. That is the product.

Around it sit two traps and a floor. The exit sits where the settings are, dressed the same. Escape is inert. Half the tappable things are smaller than a fingertip, and the proposal dots — the newest layer — are the smallest of all. On a phone the card is a third of the screen and the three pins at the landfill pile onto each other.

## What's Working

**„Ne znamo pouzdano” as a first-class state.** Not a warning banner, the headline. The reasons are one tap away and read like a person explaining, not a log.

**The strip as a preview, not a scrubber.** Chip colours per hour, night glyphs, hatching for the forecast: when it was bad and when it will be is visible before touching anything. Keyboard works on it.

**Point → report.** The click-anywhere card ends with „Javi za ovo mjesto” and the form opens with the location recorded. That closes the loop the product exists for.

## Priority Issues

### 1. [P0] The exit and the settings are twins, six pixels apart
**Why it matters:** ☰ and ✕ are the same 40 px white square with the same grey glyph, side by side at the top. One opens a panel, the other leaves the page and discards the hour, the point and the layers you set up. Measured by doing it: aiming for settings, the auditor left the simulator. On a phone, with the thumb, this will happen routinely. There is no confirmation and no „natrag” that restores state.
**Fix:** Give the settings control a label („Postavke”) so it is a pill, not a square; move the exit to the far right on its own, label it („Zatvori”), and make it a link that keeps the query string so the browser back button returns to the same state. Escape closes the panel and returns focus to the control that opened it.
**Suggested command:** `/impeccable harden`

### 2. [P0] Seventeen of nineteen tappable things are under the 44 px floor
**Why it matters:** The proposal dots are 11 px and unlabelled; the zoom controls are 29 px; „zašto?” and „Više” are 20 px tall; play is 36 px. The primary user is on a phone outdoors. The dots are the newest feature and the least hittable thing on the site.
**Fix:** Extend every hit area to ≥ 44 px without changing the visual (padding on the dots' button, MapLibre control buttons at 44 px, `min-h-11` on the text buttons, 44 px play). Keep the dot visual at 11 px; the target, not the glyph, grows.
**Suggested command:** `/impeccable adapt`

### 3. [P1] The three pins at the landfill collide at the default zoom
**Why it matters:** Vrboran, Pujanke and the H₂S station sit within 60 px of each other at the arrival zoom; their labels overlap into an unreadable stack (screenshot `desktop-dolazak.jpg`), exactly where the eye goes because the plume is there. On 390 px it is worse.
**Fix:** Below a zoom threshold, pins show the dot only and the label appears on hover/tap; the H₂S measurement pin keeps its label because it is the one number that is a measurement. Above the threshold, full labels.
**Suggested command:** `/impeccable adapt`

### 4. [P1] The sentence a resident is meant to read is set at Dense
**Why it matters:** The subtitle under the headline („Perjanica ne dotiče nijedno naselje oko plohe.”, „Model za ovaj sat nema pouzdan vjetar, pa ‚ništa' ne znači ‚čisto'.”) and the reasons behind „zašto?” are prose at 12 px on a white/92 ground. The Reading-Size Rule is explicit: a sentence that carries meaning is 1rem.
**Fix:** Subtitle and reasons at 1rem; the metadata line (wind, layer, source) may stay Dense. Reflow the icon row on narrow screens into two columns so the card does not grow.
**Suggested command:** `/impeccable typeset`

### 5. [P1] Hour changes are silent to assistive technology
**Why it matters:** Play, arrow keys and the strip all change the headline, the areas, the trend and the confidence with no announcement. A screen-reader user hears the slider value („22:00, sada, izmjereno”) but never the answer. There is no `main` landmark either.
**Fix:** Wrap the simulator in `main`; make the card's headline region `aria-live="polite"` with an atomic sentence („22:00, sada: nema naznaka mirisa u naseljima, pouzdanost srednja”) so each hour reads as one utterance.
**Suggested command:** `/impeccable harden`

### 6. [P1] Nine proposal dots by default, unexplained on the map
**Why it matters:** They are on by default, look like data, and nothing on the map says what they are until the panel is opened or one is hovered. On a phone hover does not exist.
**Fix:** Keep them on, but give them a tiny one-line key on the card's legend row („◌ predložene postaje”) and the 44 px target from issue 2; on tap the label shows, as it already does on hover.
**Suggested command:** `/impeccable clarify`

### 7. [P1] Off-palette colour for two new roles
**Why it matters:** The confidence word „niska” is `amber-700` and the proposal markers are `teal-*`. Neither is in the system; Kamen and Maslina carry chrome, status colours are the six badge tones. New roles invented in a week of work will multiply.
**Fix:** Confidence uses the status register (the existing warning tone); proposals use Maslina at reduced weight — they are „ours”, the exact case the One Green Rule allows.
**Suggested command:** `/impeccable polish`

## Cognitive Load

Arrival: one headline, two area chips, three icon facts, one confidence word with a link, one metadata line, one legend — seven things in a 200 px card. Comprehension in five seconds holds for the headline and the strip; the icon row is the first thing a first-timer skips. Panel: leads with a 60-word paragraph, then colour pickers and an emission slider labelled „1,0×” — instrument controls a follower never needs; correctly behind „Više”, but the paragraph should follow the controls, not precede them.

## Emotional Journey

Arrival on a calm evening reads as reassurance with honest doubt („ne znamo pouzdano”) — the right emotion. Scrubbing back to a yellow morning gives a small „so that's what I smelled” moment. The exit mis-tap produces the one anger beat in the flow: state gone, no way back except the browser.

## Persona Red Flags

- **Susjed koji prati, phone, WhatsApp link**: lands well; card first, map second. Loses the plume behind pins at the landfill; cannot hit dots or zoom; may exit by mistake.
- **Prijavitelj**: the point card → report path is the best flow on the site; nothing warns that the 0,1 km rounding will move their pin.
- **Moderator / Grad**: no path from here to the record or the report roses; the simulator is a cul-de-sac except the ✕.

## Minor Observations

- Play starts at „sada” and runs into the forecast first, then wraps to −24 h; a radar loop starts at the beginning.
- „Više” on the card and ☰ open the same panel; keep one, make the other a plain link into it.
- Pins: „šuti” (station silent), „tišina” (wind calm), „nema” (no measurement), „—” (not yet) are four words for absence; two would do.
- The panel's yellow paragraph is the most honest copy on the page and the least likely to be read where it is.
- The k1 pin prints „H₂S 1,51 19:00” with no unit; the unit is in the tooltip only.

## Questions to Consider

- Should „kod mene” (geolocate → point card) be the first control on a phone, above the map?
- Is the settings panel needed on the phone at all for the follower, or only the layer switches?
- When the model says „moguće” in a neighbourhood for three hours running, should the card offer the report button directly?

## Ispravljeno u istom danu (2. 9. 2026., navečer)

Provjereno na novoj proizvodnoj gradnji istim mjerenjem kao gore:

- **[P0 1]** Postavke su pilula s riječju („☰ Postavke”), izlaz je odvojena
  pilula s riječju („Zatvori ✕”) na desnom rubu. Escape zatvara ploču i
  vraća fokus na gumb koji ju je otvorio (izmjereno: `panelOpen: false`,
  fokus „Otvori postavke”).
- **[P0 2]** Cilj dodira: predložene postaje 11 → 44 px (pseudoelement, točka
  ostaje 11 px); MapLibreovi gumbi 29 → 44 px; „zašto?” i „Više” 20 → 44 px
  visine; reprodukcija 36 → 44 px; zatvaranje kartica 32 → 44 px. Prije: 17 od
  19 ispod praga; poslije: 0 od 18.
- **[P1 3]** Pribadače vjetra ispod uvećanja 13,4 nose samo točku, natpis na
  prelazak/fokus; mjerna pribadača (H₂S) uvijek nosi natpis. Pri dolasku
  osam pribadača je u kratkom obliku, ništa se ne preklapa.
- **[P1 4]** Podnaslov kartice i razlozi iza „zašto?” su 1rem (bilo 12 px).
- **[P1 5]** `main` oko simulatora; `aria-live="polite"` rečenica po satu
  („22:00, sada: nema naznaka mirisa u naseljima, pouzdanost srednja”).
- **[P1 6]** Legenda na kartici dobila „◌ predložene postaje” kad su točke
  uključene.
- **[P1 7]** Jantar i tirkiz izbačeni: pouzdanost „niska” je podcrtana riječ,
  prijedlozi su maslina (A), maslina tamna (B), kamen (C); „zašto?” je
  maslina, ne nebesko plava; „Javi za ovo mjesto” je maslina pilula.

Nije dirano: redoslijed odlomka i kontrola u ploči, četiri riječi za
odsutnost na pribadačama, smjer reprodukcije, „kod mene” s geolokacijom.
- Na širini ispod 640 px pilula „Zatvori” prekrivala je MapLibreov „+”; gumbi karte sad stoje ispod pilula (`.maplibregl-map .maplibregl-ctrl-top-right { top: 3.75rem }`). Izmjereno na 600 px: 18 od 18 ciljeva ≥ 44 px, preklopa nema.

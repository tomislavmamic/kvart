---
target: /karta
total_score: 23
max_score: 40
na_heuristics:
p0_count: 2
p1_count: 3
timestamp: 2026-07-31T21-37-25Z
slug: src-components-karta-map-client-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

Angle for this run, as requested: **what can a resident actually do with this information?** Findings are ordered by that, not by UX severity.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Active view scrolls off-screen; all three floating panels are titled "Karta kvarta"; klizač sides unlabelled |
| 2 | Match System / Real World | 2 | The map speaks of a **withdrawn** 2024 draft in the present tense ("predlaže"), and labels its layers "(javna rasprava)" 21 months after the consultation closed |
| 3 | User Control and Freedom | 3 | Escape closes dossier-then-panels in the right order; URL is complete state. Switching view silently discards manually enabled layers |
| 4 | Consistency and Standards | 2 | Black chip fill means both "off" (`ne`, `bez podloge`) and "selected" (`klizač`) in one panel; a 110 kV line is typeset identically to a telecom manhole |
| 5 | Error Prevention | 1 | k.č. 401/1 returns a green "dopušta stanovanje / 2.945 m² slobodne" verdict while two 110 kV lines cross it and 30% sits in a planned road corridor |
| 6 | Recognition Rather Than Recall | 2 | The landing view's colour key is behind a drawer labelled "Slojevi"; klizač years exist only in `aria-valuetext`; view ids ≠ labels |
| 7 | Flexibility and Efficiency | 3 | Full URL state, layer search, parcel *and* address search, keyboard-operable slider. No share button on a WhatsApp-distributed product |
| 8 | Aesthetic and Minimalist Design | 3 | Genuinely restrained, plan colours untouched. The flagship analysis' methodology is a ~1 400-character paragraph in a phone-height scroll box |
| 9 | Error Recovery | 2 | Absence statements are exemplary. The DOF basemap stalls 5–7 s with no fallback offered until three tiles have hard-failed |
| 10 | Help and Documentation | 3 | Every view described, every claim sourced and dated. Nothing says what K5 *permits*, or what to do next |
| **Total** | | **23/40** | **Acceptable — the display is excellent, the answers are not** |

## Design Specificity Verdict

**Specific in reasoning, generic on the surface — and roughly half the authored intelligence never reaches the screen.**

The thinking is unmistakably this-product-only. `dosje.ts` invents a relation vocabulary for the actual question (`nad / na / kroz` → "područje / na čestici / prolazi"). It excludes nine layers with a *measured* justification — "mjereno na 40 nasumičnih čestica: svaki od tih redaka pojavljuje se na 39/40 čestica… dakle opisuje kvart, a ne česticu". `zastoNije()` reconstructs why a parcel was excluded rather than staying silent. The ownership layer is refused *and the refusal is explained*. The Two Registers Rule is genuinely honoured on screen.

The shell is the default Leaflet dashboard costume: floating pill nav top-left, horizontal chip scroller, basemap panel top-right, bottom sheet under 1024px. That would be forgivable if it didn't actively suppress the bespoke work — the derived analysis' legend and its "56 čestica u 21 nakupini" headline sit behind a collapsed drawer labelled **"Slojevi"**, a generic GIS noun hiding a specific answer.

**Deterministic scan:** 9 findings, all `advisory`, all in `map-client.tsx`, all verified real literals — no false positives. Four are shadow/halo alphas (`rgba(0,0,0,.5/.7/.9)`); five are off-ramp type sizes (11px ×4, 13px ×1), and four of those five sit on nodes whose role is the documented 12px Label. The framing is off, though: these aren't palette drift, they're a gap in DESIGN.md's shadow vocabulary, which covers two resting/hover steps and says nothing about halos over raster imagery.

## Overall Impression

This is a serious piece of civic work whose interface is optimised for *proving the analysis exists* rather than *answering the question someone arrived with*. It ships 112 working layers and answers about two resident questions well. The biggest opportunity is not visual: it is that the pipeline already computed several answers the screen decided not to say.

## What's Working

1. **`NamjenaOdgovor` inverts the GIS convention.** Prose verdict first, above the data, with source and year attached, and a stated limit on its own authority: *"Uputa gdje gledati, ne potvrda — mjerodavni su akt i uvjeti gradnje."* That is the best sentence on the site. The `povoljno` flag correctly follows outcome rather than land-use code, so a road-locked parcel does not get a green frame.
2. **Absence is stated, not hidden.** "pretraženo 56 slojeva koji mogu nositi podatak o čestici" turns an empty result into evidence. "Nije u sloju slobodnih — na njoj već stoji zgrada" reconstructs the exclusion and hedges honestly.
3. **The URL is the complete state, and search is the keyboard route in.** Every view, layer, basemap, comparison, slider mode, parcel and zoom round-trips through the query string, so a WhatsApp link is a real deep link.

## Priority Issues

### [P0] The green verdict contradicts its own dossier

Verified live against the running API for k.č. 401/1:

- Verdict card, top, green: **"K5 — Poslovna namjena i stanovanje / Ova namjena dopušta stanovanje / Čestica je u sloju slobodnih: 2.945 m² stvarno slobodne površine."**
- Four screens below, under "Struja", styled like every other row: **"Dalekovodi 110 kV i 220 kV ×2 · kroz · nadzemna · napon (kV): 110."**
- And in the shipped file, never rendered: **`udio_koridora: 0,299`** — 30% of the parcel is inside a planned road corridor.

**42 of the 56 "free" parcels carry a corridor**, up to 57% (k.č. 603/1). The number is computed, shipped to the browser, and displayed nowhere.

*Why it matters:* this surface tells people what they may build on their own land. A confident wrong answer costs more than no answer, and credibility is the initiative's entire asset.

*Fix:* add `zapreke: {vrsta, opis, izvor}[]` to `Namjena`, populated server-side from the high-voltage layers and corridor intersections. Render inside the Namjena card **above** "Uputa gdje gledati". Suppress the `maslina-vez` frame whenever `zapreke.length > 0`. The `povoljno` predicate currently knows only about road access; it needs to know what physically crosses the land.

*Command:* `/impeccable harden`

### [P0] The map presents a withdrawn draft as a live proposal

Your own `/plan` page, line 201, says: *"Nacrt iz 2024. povučen je nakon javne rasprave i nije donesen. Prikazuje što je bilo predloženo, ne što je na snazi."*

The map says none of that. The dossier tells a resident, present tense, *"Nacrt izmjena iz 2024. ovdje predlaže K5 — …"*. The layer descriptions are labelled **"(javna rasprava)"** — twice — as though the consultation were open. It closed **18 October 2024**, 21 months ago; 286 comments were processed into a published report. `povučen` appears exactly once in the codebase, on a page `/karta` never links to.

*Why it matters:* against "Ništa bez izvora" and "absence stated, never filled", this is the sharpest inversion on the site. Someone can decide not to buy, not to build, or to object, based on a plan with no legal force that is not coming.

*Fix:* status and date on every 2024 surface — layer label, view description, dossier line. "Nacrt 2024. (povučen nakon javne rasprave, nije donesen)". Link the dossier line to `/plan`.

*Command:* `/impeccable clarify`

### [P1] All 24 draft-change polygons fall outside the kvart — and the view won't say so

Independently verified with `booleanIntersects` and `pointOnFeature`: of the 24 features in `gup-promjene-2015-2024.geojson`, **zero intersect the kvart boundary and zero have a representative point inside it.**

The view's copy reads *"9,4 ha na 24 mjesta"* with no "u kvartu" — but every other figure on this surface is per-kvart ("U kvartu ih je 56 u 21 nakupini"), so a neighbour reads it as theirs.

*Why it matters:* **"Nacrt 2024. ne mijenja ništa unutar Dračevca i Bilica"** is a real, reassuring, publishable finding that took work no resident could do. It is exactly the "analiza koju nitko ne radi" the positioning claims, and the interface is built to hide it behind a shrug.

*Note for the fix:* the dossier's per-parcel `nacrt` line fires on a point-in-polygon comparison of two **traced** sheets that `/plan` itself documents as accurate to only ±5 m — "premalo da se raspravlja o pojedinoj čestici". If the change polygons say nothing changes here, per-parcel "predlaže" lines inside the kvart are likely tracing noise at namjena boundaries. Reconcile the two before showing either.

*Command:* `/impeccable clarify`

### [P1] Planned road corridors are invisible as such

`ceste-sve.geojson` holds 5 383 features: 244 `ulica`, 26 `drzavna`, 16 `pjesacka`, 4 389 `dpu-povrsina`, and **708 corridors** (532 `koridor-nacrt` + 176 `koridor-vazeci`), of which **115 cross the kvart**. They render as unexplained pink/purple dashes under a layer labelled "Ceste, ulice i staze", appear in **no legend**, and `ceste-sve` is **absent from `U_DOSJEU`** — so a planned road across your parcel never reaches its dossier.

*Fix:* split the registry entry into `ceste` and `koridori`; label the latter "Planirani cestovni koridori (GUP)"; add both dash styles to the legend; add corridors to `U_DOSJEU` with `odnos: "kroz"`.

*Command:* `/impeccable clarify`

### [P1] The map holds none of the initiative's own record, and no route into it

113 layers from the state, the city and the EU; **zero** from the neighbourhood, though the schema already carries `lat`/`lng` on `prijedlog`. From `/karta` the only outbound content link is `/podaci` — no `/plan`, no `/prijavi`, no `/prijedlozi` outside the burger. The one filled Maslina action on the surface is hidden behind a hamburger and carries no location, so someone who *finds* a problem must retype where they were looking.

Success is "više uključenih susjeda". There is currently no pixel on the largest surface of the site that converts a viewer into a participant.

*Fix:* steps 1–3 of `plan-prijedlozi-na-karti.md`, which already specify this.

*Command:* `/impeccable shape`

### [P2] The landing answer is hidden behind a drawer called "Slojevi"

"Gdje se može graditi?" is the arrival view. On a phone it renders as unlabelled green and red blobs; the legend, the count and the parcel search are one tap away behind a generic GIS noun, and opening it covers 72% of the map.

*Fix:* a one-line non-modal strip under the chip row carrying count and key — "● slobodno ● bez pristupa · 56 čestica, 4,0 ha". Retitle each panel with its own job instead of the page `h1`.

*Command:* `/impeccable layout`

### [P2] No `<main>`, no headings, no landmarks in the panels

Confirmed live: `main` count **0**; the only landmark on the whole surface is `nav[aria-label="Pogled"]`; the only heading is the `sr-only` `h1`. `site-chrome.tsx:37` wraps every route in `<main>` *except* `/karta`, where the full-window branch returns `{children}` bare — the landmark went out with the header padding, though it isn't a layout container. "U OVOM POGLEDU" and "OSTALI SLOJEVI" are `<p>`, so a 113-checkbox list has no heading structure to jump by.

*Command:* `/impeccable harden`

## Persona Red Flags

**Casey (distracted mobile, from a WhatsApp link).** Grey rectangle and a spinner for 5–7 s. Coloured blobs with no key. The third question chip is clipped mid-word behind the mask fade, which over an aerial photo reads as a rendering bug rather than "scroll". Taps "Više (10)": the label flips to "Manje" and nothing visibly changes, because the ten new chips landed off-screen inside the scroller. Taps a green blob: a sheet takes 72% of the screen and the answer needs a *nested* scroll. Leaves without knowing whether he can build.

**Sam (screen reader / keyboard).** Materially better served than on most civic maps, and better than this morning: `role="dialog"` with `aria-modal` only where the claim is true, focus trap scoped to narrow, focus returned on close, a `role="status"` region that reads *"k.č. 392/3. Namjena K. Ne dopušta stanovanje. 1 tema s podacima."*, and a keyboard-operable comparison separator with `aria-valuetext`. Remaining flags: no `<main>`, no `h2`/`h3` outside the dossier, 14 chips in one flat tab run with no group label, and the "Slojevi 1" badge has no accessible name saying what the 1 counts.

**Marija, 63 (derived from PRODUCT.md — older residents are a real share of the kvart; K5 is the only route to housing).** Inherited k.č. 401/1; wants to know if her son can build. She reads the green box, sees "dopušta stanovanje" and "2.945 m²", and stops — she does not scroll past "UPRAVA I PLANOVI" to reach a heading called "STRUJA". She never learns about the 110 kV lines or the 30% road corridor. "K5", "PPUG" and "DTK" are undefined at the point of use. She cannot print, export or send the result to her son or to the City; the only download on the page is `granica.geojson`.

## Minor Observations

- All three floating panels are titled **"Karta kvarta"** — the page `h1`, not the panel's job.
- **"Svi slojevi" enables zero layers.** The name promises the opposite of what it does.
- Unknown `?pogled=` values fall back silently. View ids don't match labels ("Što vrijedi ovdje?" is `planovi-obuhvat`), so shared links are unreadable.
- The "Svi slojevi" description says namjena *"bira se desno, uz ortofoto"*. On mobile that panel is a bottom sheet — desktop truth in mobile-first copy, and `plan-struktura-karte.md`'s own test applies: *"Kad tekst mora zaobići raspored, raspored je pogrešan."*
- **The GUP legend has no K5 swatch** — the single most load-bearing fact in PRODUCT.md has no legend entry.
- Three representations of one thing: copy says changes are "crveno obrubljeno", the legend swatch is a red dashed line, the map draws solid red fills.
- `sirina_m`, `pristup_m`, `skupina_slobodno_m2` and `udio_koridora` are all computed per parcel, shipped, and never rendered.
- The "Istakni promjene" block is a `bg-zinc-100` panel nested inside the white sheet — against the Climbing-Ramp Rule.
- The two map place-labels measure 1.36:1 against the container grey. Their real backdrop is raster, so contrast is *unverifiable by composition* and rests entirely on a `text-shadow` that DESIGN.md never documents — load-bearing and unrecorded.
- Parcel search caps silently at 8 with no "više rezultata".
- Zero horizontal overflow and zero application console errors on all three views.

## Questions to Consider

1. The map has 113 layers and answers two questions well. Why is the **layer registry** the thing that scales and the **question set** the thing that doesn't?
2. The pipeline computed `udio_koridora: 0,299` for k.č. 401/1 and discarded it. **What else does the analysis already know that the screen decided not to say?**
3. All 24 draft changes fall outside the kvart, and the draft was withdrawn. Both are reassuring findings that took real work. Why does the interface present them as a live warning instead?
4. "Uputa gdje gledati, ne potvrda" is the most honest sentence on the site. **Would you still ship the green box if that sentence were deleted?** If not, the sentence is doing work the design should be doing.
5. Who is the first screen for — the neighbour asking "smijem li graditi?", or the initiative proving it did the work?

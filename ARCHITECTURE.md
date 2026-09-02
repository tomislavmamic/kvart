# Karepovac odour system — architecture and model audit

Status: living document. First written 2026-09-02 against commit `ff00376`
(before any model changes). Sections marked **[current]** describe what the
code does today; **[target]** describes the intended subsystem contract.
Experiment results and open problems live in `docs/STATUS.json`, not here.

The code base is Croatian (identifiers, comments, UI). This document is in
English because it is the integration contract across parallel work tracks;
file and symbol names are quoted verbatim.

---

## 1. What exists today

Three surfaces draw the plume, all from the same particle model
(`src/lib/dim.ts`):

| Surface | Route | Extent | Wind field basis | Particles | Purpose |
| --- | --- | --- | --- | --- | --- |
| Live card | `/karepovac`, `/karepovac/zrak` | 2.6 × 1.3 km (`OKVIR`) | `src/generated/karepovac-polje.ts` (220×108, base64) | 30 000 | "now" only, warmed through 2 real previous hours |
| Simulator | `/karepovac/sim` | 6.4 × 6.4 km centred on the landfill | `public/karepovac/sim-polje.bin` (256×256, binary) | 10 000 | 24 h back, now, 3 h forecast; MapLibre + Three.js |
| Offline puff model | `scripts/oblacici.py` + `scripts/bazdari-izvor.py` | 4.8 × 3.6 km, 25 m | own library of 36 directions × 4 depths | Gaussian puffs | source-strength calibration, wind-source ranking, yearly maps |

The simulator is the surface this project is about. The offline Python puff
model is *not* what users see; it exists for calibration and has physics
(Pasquill stability, Briggs σ growth, mixing-height lid) that the production
particle model does not have. Python with numpy/gdal is **not** installed on
the development machine at the time of writing, so the Python stack is
currently unrunnable here; every reproducible number in this project therefore
has to come from the TypeScript path.

### 1.1 How the plume is calculated today, step by step [current]

1. **Hourly inputs** (`src/lib/vjetar-sat.ts` → `satniVjetar`). For each
   hour of the timeline (30 hours: 6 warm-up, 24 past, now, 3 forecast):
   * wind direction and speed: measured AZO series Split-3 (station 305,
     4.3 km from the site, in the city) or Split-2 (304) where the hour is
     published; for the current hour, the freshest live observation from the
     priority list Vrboran (Neverin, 1.1 km) → Split-3 → Marjan → Split-2 →
     Pujanke → Solin → Žrnovnica → Split-aerodrom → LDSP METAR; otherwise
     Open-Meteo forecast 10 m wind at grid point 43.522/16.499;
   * mixing-layer depth: always Open-Meteo `boundary_layer_height`, floored
     to 25 m; never measured;
   * no stability class, radiation, cloud, temperature or precipitation.
2. **Wind field** (`src/lib/sim/polje.ts` → `slozi`). Precomputed unit
   fields for wind toward east and toward north at five mixing depths
   (25/55/120/260/600 m), each a 2-D mass-consistent adjustment
   ∇·(d·u)=0 over the DGU LiDAR DEM (`scripts/reljef_polje.py`,
   `scripts/izvedi-sim-polje.py`), where `d = clip(depth − (z − median z),
   10 m)`. Runtime field = `speed · (cos·E + sin·N)`, log-interpolated
   between depth levels. Velocities clipped at 3× free-stream, packed to
   bytes (128 = 0). One layer, no vertical structure, no thermal winds.
3. **Particle transport** (`src/lib/dim.ts` → `stvoriDimSirovo`, `korak`).
   Time runs at `UBRZANJE = 60` (1 display second = 1 real minute). Each
   display second the source emits `cestica / punjenje` particles
   (10 000 / 45 s = 222 /s) at 12 random Gaussian hot-spots inside the
   landfill polygon (`zarista`, seeded PRNG). Each particle moves with:
   * bilinear wind field velocity;
   * a plume-wide sinusoidal cross-wind "meander" (`vijuganje`);
   * divergence-free curl noise from a fixed 3-octave sine potential
     (`psi`), amplitude growing as √age (`sirenje`, `rastVrtloga`), scaled
     by `snaga`, and multiplied by a **calm-air enhancement**
     `zastoj = 1 + 4 · max(0, 1 − ū/1 m/s) · w(depth)` where `w` is 1 below
     60 m depth, 0 above 400 m (log-linear between).
   Particles die when they leave the 6.4 km frame or exceed `vijek = 160`
   display seconds (2.7 h). Time step is speed-adaptive so a particle moves
   ≤ 2 grid cells per step (`planSata`), 0.1–0.5 s display.
4. **Density** (`crtaj`). Particles are splatted on a 200×200 grid (32 m
   cells) with a 5×5 kernel, weight `min(1, age/0.6) · exp(−age/40 s)`
   (`raspad`: e-folding 40 real minutes), mass per particle chosen so that
   density is independent of particle count (`EMISIJA_PO_SEKUNDI = 2000`).
   Then 3 passes of a 3×3 blur. Mercaptans reuse the same particles with a
   birth-hour weight `PROFIL_MERKAPTANA[local hour]` (working-hours profile
   derived from the k2/k1 ratio).
5. **Timeline stepping** (`src/lib/sim/simulacija.ts`, `racunalo.worker.ts`).
   Each displayed hour is computed **independently in a worker from a cold
   start 3 hours earlier** (`zaSat`, `ZALET_SATI = 3`), stepping through the
   three previous hours' wind fields with `postaviPolje` (particles are kept,
   only the field changes), then through the displayed hour. Hours are
   scheduled nearest-to-selected first across ≤ 4 workers.
6. **Scaling to concentration** (`src/lib/sim/ljestvica.ts`,
   `src/lib/sim/zapis-gustoce.ts`). Density is mapped to "odour units" via
   `SIDRO_SIMULATORA = 76.2` (density that corresponds to the median H₂S
   measured at Karepovac 1, from a regression slope 0.0149 µg/m³ per density
   unit and background 1.27 µg/m³), then to a log colour ramp spanning
   0.03–100 × odour threshold (`MIRISNI_RASPON`). The user can multiply
   emission 0–5× (`JACINA`) as a what-if.
7. **Rendering** (`src/components/karepovac/sim/sim-scena.ts`). One byte
   texture per hour (log-encoded density) drawn as a subdivided Mercator
   quad in a MapLibre custom layer; colour ramp + emission multiplier are
   shader offsets. Wind is drawn as fading particle trails
   (`tragovi.ts`). Timeline is a range slider (`vremenska-crta.tsx`) with
   observed / now / forecast colouring; station pins show k1/k2 hourly
   values from the Zavod tables (`postaje-satno.ts`).

### 1.2 Calibration lineage [current]

* `scripts/bazdari-izvor.py` (Python, not the production model) calibrated
  emission strength 8.9 mg/s H₂S (95 % 6.4–12.0) on 12 962 hours at
  Karepovac 1 with the `spoj` wind (Split-3 direction, Marjan/LDSP speed);
  Spearman 0.107 overall, 0.131 on year 2; AUC of top-decile hours 0.61.
* `scripts/ocijeni-sim.ts` ran the **production** particle model as one
  continuous chain over the same hours and regressed density on H₂S; that
  gave `SIDRO_SIMULATORA` and `SIDRO_KARTICE`. The calm-air enhancement
  `ZASTOJNO_SIRENJE = 4` and `ZASTOJ_DUBINA.duboko = 400 m` were tuned on
  that run — on the *second* year ("godina izvan uzorka"), which therefore
  is **no longer an untouched validation set** for those parameters.
* Wind-source ranking (`docs/provjera-izvora-vjetra.md`): on 9 904 hours,
  night-time AUC for H₂S episodes: Marjan 0.59, Split-3 0.54, LDSP 0.51.
* Citizen reports: 15 reports (8 smelled, 7 not) from 2026-08-26 to 08-29,
  essentially one reporter at Dračevac 7B plus one Solin address. Too few
  to calibrate; usable only as a spatial sanity check.

The only receptor with a long record is the Karepovac 1/2 site: 676 m
**south-east** of the landfill centroid (azimuth 140°) in a valley 74 m below
the landfill top, while the affected neighbourhoods (Dračevac, Bilice) lie
at 282–293°. Every calibration number above is blind to the side people live
on.

---

## 2. Subsystem map

Each subsystem has an owner track, a contract and a status. "Status" is one
of: **missing**, **implicit** (exists but not separable), **present**,
**verified** (covered by the hindcast harness).

| # | Subsystem | Current files | Status | Gap summary |
| --- | --- | --- | --- | --- |
| 1 | Meteorological ingestion | `src/lib/vjetar.ts`, `vjetar-sat.ts`, `sim/vrijeme-satno.ts`, `arhiva-zraka.ts`, DB `wind_readings`, `mixing_readings` | present | no stability inputs (radiation, cloud, T, precipitation); no forecast archive; Vrboran has no history except our own archive (since 2026-08-29) |
| 2 | Terrain / topography | `scripts/reljef_polje.py`, `izvedi-sim-polje.py`, `public/karepovac/sim-polje.bin`, `public/geo/reljef/` | present | DEM only enters through a 2-D mass-consistent layer; no slope/aspect, no drainage-flow field, no land use / roughness |
| 3 | Atmospheric state | (none) | missing | no stability class, no inversion detection, no sea-breeze regime flag; depth is a modelled BLH from a 2–11 km grid |
| 4 | Wind-field reconstruction | `src/lib/sim/polje.ts`, `polje-dima.ts` | present | single point of wind + 2-D potential adjustment; no multi-station blending, no vertical shear, no thermally driven components |
| 5 | Stability / turbulence | `dim.ts` (`vrtlog`, `snaga`, `sirenje`, `zastoj*`) | implicit | visual curl noise tuned for appearance; only ū and depth modulate it; no Pasquill / Monin-Obukhov; no vertical dispersion |
| 6 | Odour source / emissions | `dim.ts` (`zarista`, `EMISIJA_PO_SEKUNDI`, `PROFIL_MERKAPTANA`), `karepovac-bazdarenje.ts` | implicit | constant H₂S rate, random hot-spots, no dependence on pressure/temperature/rain/operations/remediation phase; smaller northern cell not modelled |
| 7 | Plume / puff dispersion | `dim.ts`, `sim/simulacija.ts` | present | Lagrangian particles with fixed pool (→ throttled emission in calm, see §5.1), 2.7 h max memory, 6.4 km hard frame, ad-hoc decay 40 min |
| 8 | Observation / report ingestion | `sim/postaje-satno.ts` (Zavod tables), `dojave.ts`, DB `odour_reports`, `scripts/izvezi-dojave.ts` | present | AZO station 308 H₂S not ingested live; reports have no map-based location prompt; no negative-report campaign |
| 9 | Calibration | `scripts/bazdari-izvor.py`, `ocijeni-sim.ts`, `SIDRO_*` | present (Python unrunnable here) | single receptor on wrong side; slope CI 0.5–2×; tuning/validation split partially contaminated |
| 10 | Historical reconstruction | `sim/dohvat.ts`, `kadrovi.ts`, workers | present | only 24 h; each hour is an independent 4 h cold start; no persistence of computed fields |
| 11 | Forecasting | Open-Meteo hourly via `vrijeme-satno.ts` | present | 3 h only; raw 10 m grid wind, no downscaling, no ensemble, no persistence blending; forecast hours rendered identically to observed |
| 12 | Uncertainty / confidence | (none) | missing | no ensemble, no spread, no confidence field; sharp texture regardless of input quality |
| 13 | Map rendering | `sim-scena.ts`, `tragovi.ts`, `sim-karta.ts`, `oznake.ts` | present | log colour ramp with hard "threshold" step; no probability/fringe language; no animation between hours |
| 14 | Timeline / time navigation | `vremenska-crta.tsx`, `kadrovi.ts` | present | hourly slider, no scrubbing animation, no sub-hour interpolation, no "when will it change" cues |
| 15 | Alerts / status summaries | `zrak-rijeci.ts` (live card only) | implicit | no situation summary on the simulator: affected areas, trend, confidence, expected change |
| 16 | UI | `simulator.tsx`, `upravljacka-ploca.tsx`, `vjetar-kartica.tsx` | present | expert-oriented (colours, emission multiplier, layers) rather than "what is happening" first |
| 17 | Verification / testing | `dim.test.ts` canaries, `ocijeni-sim.ts`, `ocijeni-dojave-sim.ts`, `provjeri-dojave.ts` | implicit → **being built** as `scripts/hindcast/` | no repeatable replay, no persisted runs, no held-out set, no episode library, no UI screenshots |

---

## 3. Shared simulation data model [target]

### 3.1 Units and conventions

| Quantity | Unit | Convention |
| --- | --- | --- |
| Time | ISO 8601 UTC, hour start, `Date.toISOString()` form `2026-08-27T18:00:00.000Z` | Local time (Europe/Zagreb) only at the presentation edge. Zavod tables give *end* of hour in local time and are converted on ingest (`uUtc`). |
| Wind direction | degrees, meteorological (from which it blows), 0–360 | Never average angles; average u/v. |
| Wind speed | m/s | Station height as reported (10 m assumed). |
| Mixing depth | m above ground | Open-Meteo BLH, floored at 25 m. |
| Concentration | µg/m³ | H₂S at k1 / AZO 308; methyl+ethyl mercaptan at k2. |
| Model density | dimensionless `crtaj` units | Convert with slope 0.0149 µg/m³ per unit + 1.27 background (H₂S, k1 regression); treat as order of magnitude. |
| Odour units | multiples of odour threshold (H₂S 0.571 µg/m³, CH₃SH 0.138 µg/m³, Nagata 2003) | Used only for the colour scale. |
| Horizontal coordinates | WGS84 lon/lat for I/O; HTRS96/TM (EPSG:3765) metres in the Python solver; simulator frame = unit square over `SIM_POLJE.granice` (y grows south) | Receptors are placed by lon/lat → frame fraction → grid cell. |
| Grids | wind basis 256×256 over 6.4 km (25 m); density 200×200 (32 m) | Density cell area enters the mass normalisation. |

### 3.2 Public APIs

* `GET /api/karepovac/vjetar` → `{ satovi: SatniVjetar[], serije: Record<Postaja, SatniVjetar[]>, sada: Vjetar[] }` — the single wind-selection rule (`satniVjetar`). Revalidated every 15 min.
* `dohvatiCrtu(sada)` → `Crta` (28 `Kadar` + 6 warm-up), the frame contract the simulator page renders. Every `Kadar` carries `vrsta` (izmjereno/sada/prognoza), `dostupnost`, `izvor`, `stanje`, `ocitanja`.
* Hindcast harness (new, `scripts/hindcast/`): `SatUlaza`, `Opazanja`, `Prijemnik`, `Predikcija`, `Epizoda` in `tipovi.ts`; `vrtiModel(ulazi, prijemnici, opcije)` in `model.ts` runs the production model; `pokreni.ts` persists a run under `.cache/hindcast/runs/<id>/` and a summary under `docs/hindcast/<id>.json`.

### 3.3 Update frequencies and failure behaviour

| Input | Cadence | Cache | On failure |
| --- | --- | --- | --- |
| Neverin stations | 5 min, last value only | 15 min | station skipped; next in priority list |
| AZO Split-3/2 wind | hourly, published with ~1 h delay, rate-limited (429 unless ≥5 s between calls) | 15 min | hour falls back to live observation (current hour) or forecast model; labelled `izvor` |
| DHMZ hourly XML | hourly, Marjan wind often "−" | 15 min | skipped |
| METAR LDSP | 30 min | 15 min | skipped |
| Open-Meteo forecast (wind, BLH) | hourly model output | 15 min | hour becomes `nedostupno` (a gap in the timeline), never invented |
| Zavod k1/k2 tables | hourly, hours of delay, unvalidated | 30 min | pins show "no data" |
| DB archive (`wind_readings`, `mixing_readings`) | on every fetch, after response | — | write errors logged, never shown |

Rule: a missing input degrades to a *visible* gap or a *labelled* fallback,
never to a silent substitute. The forecast horizon is counted, not promised
(`slozCrtu` shortens it to the hours the model actually delivered).

---

## 4. Assumption inventory of the production plume model

Every assumption below is made by `src/lib/dim.ts` / `polje.ts` /
`simulacija.ts` today. "Evidence" states what supports it; "risk" what it
costs if wrong.

| # | Assumption | Where | Evidence | Risk |
| --- | --- | --- | --- | --- |
| A1 | One wind vector (from a station 1–16 km away or a 2–11 km model grid point) represents the free-stream wind over the whole 6.4 km frame for the whole hour | `slozi` | station ranking on H₂S (AUC ≤ 0.59) | direction error dominates at low speed; intra-hour shifts lost |
| A2 | Terrain effect = 2-D mass-consistent potential adjustment of a single layer of depth `BLH − (z − median z)`, min 10 m | `reljef_polje.py` | qualitative (flow goes around hills) | no over-ridge flow, no drainage winds, no channelling by valleys below the layer; shallow levels are nearly uniform ("zagušene") |
| A3 | Field is linear in free-stream wind, so unit E/N bases can be combined | `polje-dima.ts` | verified numerically (10⁻¹⁵) for the solver | fine |
| A4 | Depth interpolation between levels is log-linear | `razineDubine` | plausibility | minor |
| A5 | Velocities > 3× free-stream (over Kozjak) are clipped | `izvedi-sim-polje.py` | packing range | hill flow unphysical anyway |
| A6 | Emission is continuous and constant (H₂S); mercaptans follow a fixed hour-of-day profile | `korak`, `PROFIL_MERKAPTANA` | k2/k1 ratio profile | ignores pressure drops, temperature, rain, operations, remediation phase; **and see §5.1: pool saturation breaks continuity in calm** |
| A7 | 12 random hot-spots, seed 1, radius 2–6 cells, weights 0.35–1 | `zarista` | appearance ("mrlja vs dim") | spatial pattern is fiction; hot-spot positions do not follow gas wells/cover state |
| A8 | Time acceleration 60×, particle lifetime 160 s display = 2.7 h | `UBRZANJE`, `vijek` | display need | odour older than 2.7 h cannot exist; long calm nights truncated |
| A9 | Weight decay e-folding 40 display s = 40 real min, independent of stability | `raspad` | "what is not seen: vertical mixing" | day/night dilution identical; night persistence underestimated, day overestimated |
| A10 | Horizontal dispersion = fixed-form curl noise + sinusoidal meander, amplitude ∝ √age | `psi`, `vijuganje` | visual tuning; √t is qualitatively Taylor-like | not tied to σ_y(x, stability); no data-derived spread |
| A11 | Calm enhancement: turbulence ×(1+4) when ū<1 m/s under depth <60 m, fading to 0 by 400 m | `zastoj` | Spearman on k1 0.09→0.117 (tuned on year 2) | tuned on a single receptor; semi-contaminated validation |
| A12 | Particles leaving the 6.4 km frame are gone forever | `korak` | frame | recirculation (sea-breeze return, valley return) impossible |
| A13 | Each displayed hour = independent 4 h cold start | `zaSat`, `ZALET_SATI` | lifetime 2.7 h < 3 h | correct *given* A8; but emission phase artefact (§5.1) |
| A14 | Density 3×3 at the k1 cell is comparable to the station's hourly mean | `ocijeni-sim.ts` | none | end-of-hour snapshot vs hourly mean; 100 m vs point |
| A15 | Concentration = slope × density + background, slope from k1 regression | `SIDRO_SIMULATORA` | 95 % CI 0.5–2× | absolute intensity is order-of-magnitude |
| A16 | Mercaptan local hour uses CEST for months Apr–Oct, CET otherwise | `mjesniSat` | matches profile derivation | up to a week wrong at DST edges |
| A17 | Depth from Open-Meteo is the mixing depth over the landfill | `procitajDubine` | none | grid-point BLH over a coastal hill; sea/land contrast unresolved |
| A18 | Forecast wind = Open-Meteo 10 m wind, drawn like measured | `procitajModelskiVjetar` | none | no uncertainty, no bias correction |
| A19 | Smaller northern landfill cell is not a source | `maska_plohe` reads `features[0]` | none | reports from Solin/Matoševa may be misattributed |
| A20 | Zavod "< 0.1" = 0.05; "-" = missing; months with >50 % censored hours are dropped from calibration | `celija`, `postaje.py` | data-quality reasoning | fine |

---

## 5. Ranked sources of prediction error (audit result)

Ranked by expected impact on *where and when odour is predicted*, with the
evidence available before any new experiment. The hindcast harness is built
to measure each of these; ranks will be revised in `docs/STATUS.json`.

### 5.1 Wind input: direction noise at low speed and a single far-away point

Odour episodes happen at night in calm air (episodes 2.5× more frequent at
21 h than 13 h; median H₂S 1.8 µg/m³ in calm vs 1.1 in wind). Exactly then
the direction from Split-3 (4.3 km, sheltered urban site, median speed 2.0
vs 3.1 m/s at open sites) or from a forecast grid point is noise, and the
model transports the whole plume along it. The best available station
reaches only AUC 0.59 for k1 episodes. Production additionally uses
Split-3's sheltered *speed* as the transport speed (the Python calibration
deliberately did not). No multi-station blending, no local anemometer, and
Vrboran (1.1 km) has no evaluated history.

### 5.2 Numerical artefact: particle-pool throttling of emission in calm air

Measured in `scripts/hindcast/model.test.ts` ("kanarinac"): with 10 000
particles the pool fills in 45 display s; thereafter emission is limited to
the death rate, so at ≤ 2 m/s the source emits 18–100 % of nominal in
irregular 10-minute bursts whose phase depends on when the simulation was
started. The same hour computed as a continuous chain vs the production
4-hour cold start differs by up to 10× at the k1 receptor. This is in the
regime that matters most (calm nights) and directly corrupts intensity and
hour-to-hour consistency.

### 5.3 No vertical dimension / stability: dilution independent of day-night

Decay (`raspad`, 40 min) and lateral spread are constants; only the calm
enhancement reacts to depth. Daytime convective mixing (which dilutes fast)
and night-time stable layers (which keep odour at ground level for hours)
are indistinguishable except through BLH scaling of the calm term. The
Python puff model showed the stability class alone explains more of the k1
variance than the old transport model — that information is absent from
production.

### 5.4 Source term: constant emission, fictional hot-spots, one cell

Emission strength is a single calibrated number (CI 0.5–2×), hot-spots are
random, the mercaptan profile is a k2/k1 ratio derived from partly censored
data, and the northern cell is excluded. Landfill gas emission responds to
falling barometric pressure, cover temperature, rain, and to surface work
(the remediation is on-going and moves the source). This makes intensity —
and therefore the "how strong" answer — the least trustworthy output.

### 5.5 Calibration and evidence base: one receptor on the wrong side

All quantitative skill numbers come from k1/k2 (SE valley). There is no
measured ground truth on the NW side except 15 reports over four days. Any
improvement measured at k1 may not transfer to Dračevac/Bilice, and any
error in slope drainage toward the neighbourhoods is invisible. This is not
a model bug but bounds what can honestly be claimed; the harness must keep
reports (including "no smell") as a separate, spatially meaningful check.

Further, lower-ranked sources: 2.7 h lifetime and 6.4 km frame truncation
(A8, A12); end-of-hour snapshot vs hourly mean (A14); forecast hours
undistinguished and unbiased (A18); DST approximation (A16); the 25 m depth
floor and "zagušene" shallow field levels (A2).

---

## 6. Verification harness (`scripts/hindcast/`)

* `tipovi.ts` — shared types (inputs with provenance, observations,
  receptors, predictions, episodes, period roles).
* `ulazi.ts` — loads and aligns AZO wind (305/304), Marjan, LDSP, ERA5,
  archived Open-Meteo forecasts (`historical-forecast-api`, the model the
  site uses live), Zavod k1/k2 tables, AZO 308 H₂S, and citizen reports.
  Wind selection rules: `proizvodnja` (what the site would have used),
  `spoj`, single sources.
* `model.ts` — runs the **production** particle model (`dim.ts`) at
  receptors, in `proizvodnja` mode (independent 4 h cold start per hour,
  faithful) or `lanac` mode (continuous chain). Optional grid snapshots.
* `model.komad.ts` — one chunk in a child process (`node --import tsx`).
* `metrike.ts` — Spearman, AUC of top-decile, contingency (POD/FAR/CSI),
  null band (day-shifted observations), null models (climatology,
  persistence, wind-sector-only, calm-only), regime splits, day-bootstrap
  regression CI, report metrics.
* `pokreni.ts` — runs an experiment over a period, persists inputs,
  parameters, predictions, snapshots, metrics and model version id.

Period roles (fixed; do not tune on `provjera` or `zadrzano`):

| Role | Period | Note |
| --- | --- | --- |
| `ugadjanje` | 2024-09-01 → 2025-08-31 | year 1; earlier tuning also used it |
| `provjera` | 2025-09-01 → 2026-08-17 | year 2; the calm-enhancement was tuned on it, so it is *semi*-independent |
| `zadrzano` | 2026-08-18 → present | untouched by any tuning; includes the report window |

No future information may enter a hindcast hour: wind is the measured
value *for that hour* (which the site sees within ~1 h) or the archived
forecast; depth is the archived forecast; observations are never inputs.

---

## 7. Gates

* **Scientific gate**: a candidate model must beat the baseline on
  `provjera` *and* `zadrzano` on rank skill (Spearman, AUC), episode
  contingency (POD/FAR at quantile-matched threshold) and report
  agreement, with the null band and null models reported alongside.
* **Product gate**: deterministic screenshots of the simulator states
  (now, −1…−6 h, +1…+3 h, strong/weak/uncertain events, shifting wind,
  mobile/desktop, day/night) pass a five-second comprehension review.

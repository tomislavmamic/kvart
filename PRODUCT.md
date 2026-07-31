# Product

<!-- impeccable:product-schema 1 -->

Durable product truth for *Naš kvart*. Written in English to match the other
meta-documents (`AGENTS.md`, `CLAUDE.md`); everything user-facing is Croatian
and stays Croatian. Croatian product vocabulary is kept verbatim, because
translating it would lose the thing it names.

## Platform

web

## Users

**Primary: *susjed koji prati* — the resident who is already aware and comes
back to check what moved.** Not the first-timer with a complaint: the neighbour
who knows the initiative exists and returns to see what was sent to the City,
what came back, and what is resolved. If that visit goes badly, the site has
failed.

They arrive **on a phone, tapped from a link in the WhatsApp group**, often
outdoors or in passing. Desktop is the exception, not the norm. Small-screen,
thumb-reachable, quick-to-scan is the floor, not an adaptation.

Other roles the product implements (confirmed in code, not ranked above the
primary user):

- **Prijavitelj** — a resident submitting a problem through `/prijavi`. No
  registration, no account.
- **Moderator** — reviews submissions and publishes them as proposals, records
  status changes, uploads documents (`/admin`, password + signed session).
- **Grad Split and nadležne službe** — the counterpart that receives
  submissions and whose answers are recorded. They are an audience for the
  record even when they never visit.

## Product Purpose

One public place that gathers the problems and proposals of Dračevac and
Bilice, publicly tracks what was sent to the City of Split and what came of
it, and gathers neighbours who want to help.

**Success is more neighbours involved.** Not the resolved count, not plan
influence, not reach for its own sake — participation. This is why the primary
user is the follower rather than the first-timer: someone who came to look is
the only realistic source of someone who acts. The follower is the funnel.

## Positioning

Four things this does that the WhatsApp group cannot. All four hold; none is
decoration.

- **Javni trag prema Gradu** — a dated public record of what was sent, to whom,
  and what came back. Chat forgets. This does not.
- **Prostorni dokaz** — official plan, cadastre and infrastructure data
  assembled for this kvart specifically, at a resolution nobody else publishes
  for it.
- **Analiza koju nitko ne radi** — derived findings that take work no single
  resident could do: where housing is still possible, what the GUP draft
  changes, which parcels have no road access.
- **Trajna adresa** — a stable public address for the initiative that outlives
  any one chat group, phone, or person.

## Operating Context

**The conversation lives in WhatsApp; the record lives here.** WhatsApp is the
single live channel — daily talk, fast notices, agreement. Reddit is shelved:
the r/DracevacBilice community was never opened, and the link led to Reddit's
"community not found" page, which suggests random communities including NSFW
ones. The `redditUrl` field and `NEXT_PUBLIC_SUBREDDIT` gate remain, so opening
a subreddit later restores it without a code change. While the variable is
unset, nothing is said about Reddit at all.

**The proposal lifecycle** is the spine of the product:

1. A resident submits through `/prijavi` — no registration.
2. A moderator reviews (`pending` → `approved` / `rejected` / `merged`).
3. Approved submissions become public *prijedlozi* with a slug, neighbourhood,
   category, optional photos and coordinates.
4. Status moves through `objavljeno` → `poslano gradu` → `u tijeku` →
   `riješeno` / `odbijeno` / `na čekanju`, each change dated and annotated.
5. Correspondence and plan documents are attached under `/dokumenti`.

**Spatial planning is a real part of the operating scene**, not a feature.
Croatian instruments the product works against: **GUP** (generalni urbanistički
plan — 2015 in force, 2024 draft in public consultation), **UPU Bilice sjever**,
**DPU radne zone Dračevac**, **PPUG**. Parcels are *katastarske čestice* (k.č.)
within a *katastarska općina* (k.o.). Land use is *namjena*. The neighbourhood
unit of local government is the *gradski kotar / mjesni odbor*.

**The kvart is a work zone.** GUP gives it no pure residential land at all —
housing is possible only through K5 (business use that also permits dwelling).
This is verified against two independent sources and is not a georeferencing
error. It shapes what questions residents actually have.

## Capabilities and Constraints

**Built and working:**

- Public proposal register with status history, categories, neighbourhoods,
  photos and optional map coordinates.
- Submission form without registration, with rate limiting and moderator
  review.
- Document register (spatial plans, letters to the City, answers, minutes).
- `/karta` — a Leaflet map with **113 working layers** from DGU, ISPU/MGIPU,
  Hrvatske vode, Copernicus/EEA, Promet Split, HAKOM, the Grad Split GIS
  export, and OpenStreetMap; curated views over them; a per-parcel *dosje* that
  queries every layer at a clicked point.
- `/plan` — what the 2024 GUP draft changes inside the kvart, computed from the
  plan sheets, with the draft's own numbered justification where attributable.
- Derived analysis layers (e.g. parcels where housing is still possible) plus a
  standalone offline page at `public/slobodne-cestice.html`.
- Solar potential lookup (PVGIS) and cadastral parcel API.

**Not yet — do not present as available:** population grid, summer heat,
air quality, live buses, the green cadastre. These are registered as phase 2
and are shown as such.

**Technical constraints:**

- Next.js App Router on Vercel; Postgres via Drizzle; Vercel Blob for uploads.
- **The repository is public.** `public/geo/grad/katastar-vlasnistvo.geojson`
  names natural persons with OIB and records mortgages and easements. It is
  never committed, is listed in `.gitignore` *and* `.vercelignore`, and its
  layer is registered only under `next dev`. Committing it would be permanent
  publication, since it survives in history after deletion.
- `SHP.zip` (2.3 GB unpacked) is never extracted; members are read in place.
- Open-data licences require attribution (DOF 2023 under Otvorena dozvola, and
  others). Attribution is a condition of use, not a courtesy.

## Brand Commitments

- **Name:** *Naš kvart — Dračevac i Bilice*.
- **Ništa bez izvora.** Every factual claim is traceable to an official source.
  Never fabricate a number, a status, a citation, or a resolved count. When
  data is missing, say so plainly rather than filling the space.
- **Hrvatski, bez iznimke.** Everything user-facing is Croatian — including
  error states, empty states, metadata and download filenames.
- **Nestranačko i neformalno.** No party affiliation, no politician
  endorsements. The voice is a neighbour's, never a campaign's.
- **Anonimnost podnositelja.** Submitter names and contacts stay internal to
  moderators and are never published.

## Evidence on Hand

Real, in the repository:

- `public/geo/` — 101 GeoJSON layers plus WMS registrations; official spatial
  data for the kvart, catalogued with licences in `src/lib/datasets.ts` and on
  `/podaci`.
- `public/photos/kvart-strip.jpg` — aerial DOF 2023 strip of Bilice–Dračevac,
  used as the home hero.
- Traced GUP sheets (2015, 2024 draft) and the computed change set, with the
  draft's own item numbers where attributable.
- `public/slobodne-cestice.html` — self-contained analysis page for the wider
  east-Split window.
- Proposals, status updates and documents live in Postgres; counts on the home
  page are queried, never hard-coded.

**Absences future work must not fabricate:** there are no testimonials, no
press coverage, no case studies, no membership or signature numbers, no
funding or partnership claims, and no endorsements. The initiative is
informal; do not invent institutional weight it does not have.

## Product Principles

1. **The follower is the funnel.** The primary visit is a return visit, and its
   job is to make acting feel obvious and small. Someone who came to look is
   the only realistic source of someone who helps.
2. **The record outlasts the conversation.** Anything that matters must survive
   the group chat, the phone, and the person who wrote it. Permanence and
   datedness are the product, not metadata.
3. **Nothing without a source; absence stated, never filled.** Credibility is
   the whole asset. An honest gap costs less than a confident guess.
4. **A phone in the street is the real scene.** Weak connection, one hand,
   thirty seconds, older eyes. Anything that only works sitting at a desk does
   not work.
5. **A neighbour's voice, not a campaign's.** Plain, specific, non-partisan.
   The evidence argues; the copy does not need to.

## Accessibility & Inclusion

- **Older residents are a real share of the kvart.** Generous text size, strong
  contrast, large tap targets, and no reliance on hover or fine pointing.
- **WCAG AA is the floor**, held checkably: contrast ratios, visible focus
  states, complete keyboard paths, semantic structure.
- **Slower connections are normal.** Data-light by default; heavy map tiles and
  imagery must not make the site unusable on a weak mobile connection.

# Social Share Metadata Design

**Date:** 2026-08-11

## Goal

Make links from *Naš kvart* recognisable, factual, and useful when shared in
WhatsApp, Facebook, X, Slack, and other clients that read Open Graph or Twitter
Card metadata.

## Selected direction

Use one shared 1200 × 630 aerial card for every public page. The card carries
only the product identity — **Naš kvart** and **Dračevac · Bilice** — over a
real aerial image already licensed and attributed by the project. It does not
repeat the current page title inside the image.

The platform-rendered text below the image carries the route-specific title and
description. This avoids duplicate titles, keeps the image stable in social
caches, and makes every shared link visually identifiable as part of the same
public record.

## Default share card

- Size: 1200 × 630 px.
- Source image: an existing Dračevac/Bilice aerial photograph from
  `public/photos/`.
- Treatment: dark Maslina overlay sufficient for readable white text; no
  invented geography, illustration, stock image, gradient branding, or
  decorative data.
- Image text: `Naš kvart` and `Dračevac · Bilice` only.
- Image alternative text: `Zračna snimka Dračevca i Bilica s nazivom Naš kvart`.
- The same image is emitted for Open Graph and Twitter Card consumers.

## Default metadata

- Canonical metadata base: `https://kvart-sage.vercel.app`.
- Locale: `hr_HR`.
- Site name: `Naš kvart — Dračevac i Bilice`.
- Open Graph type: `website`.
- Twitter card type: `summary_large_image`.
- Default title: `Naš kvart — Dračevac i Bilice`.
- Default description: `Razgovaraj sa susjedima, istraži kvart, prati Karepovac te prijavi ili pregledaj probleme.`

Every public route must emit a title and description for ordinary metadata,
Open Graph, and Twitter Cards. Titles use the existing root template in the
browser; the social title is explicitly resolved so child pages never inherit
the homepage title by accident.

## Main journey copy

### Homepage

- Title: `Naš kvart — Dračevac i Bilice`
- Description: `Razgovaraj sa susjedima, istraži kvart, prati Karepovac te prijavi ili pregledaj probleme.`

### Karta

- Title: `Karta kvarta — Naš kvart`
- Description: `Istraži prostorne planove, katastarske čestice, javne površine i infrastrukturu Dračevca i Bilica.`

### Karepovac

- Title: `Praćenje zraka oko Karepovca — Naš kvart`
- Description: `Pratite pripremu mjernih postaja, metodologiju, podatke i načine uključivanja.`

Karepovac subpages retain their current specific titles and descriptions, with
the root title template applied to the browser title and the social title
resolved explicitly.

### Problemi

- Title: `Problemi i prijedlozi — Naš kvart`
- Description: `Pregledaj što su susjedi prijavili, što je poslano Gradu i dokle je stiglo rješavanje.`

### Prijava problema

- Title: `Prijavi problem — Naš kvart`
- Description: `Prijavi problem u Dračevcu ili Bilicama bez registracije. Prijavu pregledavamo prije javne objave.`

## Other public pages

Pages that already have a factual description keep it. Pages with title-only
metadata receive a short description derived from their visible introduction:

- Dokumenti: `Prostorni planovi, dopisi Gradu Splitu, odgovori i zapisnici važni za Dračevac i Bilice.`
- O inicijativi: `Saznaj kako stanovnici Dračevca i Bilica javno prate probleme, odgovore Grada i načine uključivanja.`

The GUP comparison, spatial-data catalogue, and Karepovac subpages keep their
existing descriptions.

## Individual proposals

Individual proposal pages use:

- the published proposal title as the page and social title;
- a plain-text excerpt of the published proposal description as the social
  description;
- whitespace collapsed to single spaces;
- at most 160 Unicode characters, shortened at a word boundary and ending in
  an ellipsis when truncated;
- the Problems overview description as a fallback when the proposal is not
  found or has no usable description.

Only already-public proposal fields are used. Submitter names, contacts,
moderation fields, ownership data, and other private values never enter
metadata.

## Architecture

- `src/lib/metadata.ts` owns the canonical base URL, default text, the helper
  that creates consistent ordinary/Open Graph/Twitter metadata, and the safe
  proposal-description excerpt function.
- `src/app/layout.tsx` defines the site-wide metadata base, site name, locale,
  card type, and homepage defaults.
- `src/app/opengraph-image.tsx` renders the shared aerial card with Next.js
  `ImageResponse` using a local project asset.
- `src/app/twitter-image.tsx` reuses the same image implementation so both
  protocols receive the same pixels and alternative text.
- Public page metadata objects use the shared helper. Dynamic proposal metadata
  uses the same helper after loading the public proposal.

No external image service, font download, database query, or runtime fetch is
added to the default image route. The system typeface remains intentional.

## Failure behaviour

- The share image is generated from a committed local asset, so it does not
  depend on a remote host at render time.
- A missing proposal receives the generic proposal title and Problems
  description; it never throws solely while creating metadata.
- If a proposal description is empty, the generic Problems description is
  used.
- Metadata contains absolute URLs derived from the stable production alias.

## Verification

Automated checks cover:

- default Open Graph and Twitter fields;
- page-specific social titles and descriptions;
- proposal excerpt whitespace, word-boundary truncation, Unicode, and fallback;
- no private proposal or submitter fields in metadata construction;
- the shared image route exports 1200 × 630 PNG metadata and meaningful alt
  text.

Build verification confirms Next.js recognises the image conventions. Live
verification fetches representative pages with a crawler user agent and checks
`og:title`, `og:description`, `og:image`, `twitter:card`, `twitter:title`,
`twitter:description`, and `twitter:image`. The emitted image URL must return
HTTP 200 with `image/png`.

## Out of scope

- Per-route or per-proposal custom images.
- Using proposal photographs in social cards.
- Changing visible page headings or body copy.
- Search ranking work beyond correct metadata.
- Updating cached previews already stored by external platforms; their cache
  refresh timing remains outside the application.

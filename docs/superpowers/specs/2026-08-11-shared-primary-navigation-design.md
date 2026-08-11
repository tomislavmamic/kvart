# Shared Primary Navigation Design

**Date:** 2026-08-11

## Goal

Make the four main ways to use *Naš kvart* immediately understandable without
showing the same choices in both the navbar and a second homepage card grid.
The existing aerial hero remains the visual centre of the landing page.

## Primary journeys

The product has four equal primary destinations:

1. **Razgovor** — open the neighbourhood WhatsApp group.
2. **Karta** — explore the neighbourhood map.
3. **Karepovac** — follow the Karepovac tracking project.
4. **Problemi** — review published problems and reach the submission action.

The labels remain short enough to scan as navigation. A short descriptor may
appear where the component has room:

- Razgovor — *WhatsApp grupa*
- Karta — *Istraži kvart*
- Karepovac — *Praćenje projekta*
- Problemi — *Prijavi ili pregledaj*

## Homepage

Keep the aerial photograph, location label, headline, motion behaviour,
reduced-motion behaviour, and DGU attribution. Replace the problem-focused
supporting sentence with the broader invitation: **“Razgovaraj sa susjedima,
istraži kvart i uključi se.”**

Replace the hero's two standalone buttons with a single four-destination
navigation dock at the bottom of the hero. This dock is the homepage's primary
navigation, so the standard header must not repeat the same four links above
it.

Remove the current homepage counters, recent-activity feed, database outage
notice, and “Kako ovo funkcionira?” panel. Those belong within the Problems
journey, not before the visitor has chosen a destination. The homepage should
not query proposal data after this change.

The landing page ends after the hero navigation and the ordinary site footer.
It should feel like one decisive first screen rather than a dashboard followed
by a menu.

## Shared navigation behaviour

Use one source of truth for the four destinations so labels, routes, active
states, and ordering cannot drift between the homepage dock, desktop header,
mobile menu, and floating map menu.

- On the homepage, the hero dock displays all four destinations without a
  second copy in the header.
- On other standard pages, the header displays the four destinations as its
  primary navigation.
- On narrow screens away from the homepage, the existing menu button opens a
  list containing the same four destinations.
- On the full-screen map, the floating menu contains the same primary
  destinations.

The WhatsApp destination opens in a new tab when a valid invite URL exists.
When it is not configured, “Razgovor” links to the initiative page instead of
disappearing or becoming a dead control.

## Secondary navigation

The following remain available but no longer compete with the four primary
journeys:

- Izmjene GUP-a
- Dokumenti
- Prostorni podaci
- O inicijativi
- Moderatorski pristup

On standard pages, the first four live under a single **Više** disclosure in
the header and remain directly available in the footer. Moderator access stays
in the footer. On the homepage, the compact header may show the brand and the
secondary **Više** disclosure only.

The disclosure must work with keyboard navigation, have an explicit accessible
name and expanded state, close on Escape and outside click, and close after a
route is selected.

## Visual treatment

Follow the existing “Zemljovid i zapisnik” system:

- system typeface only;
- white and stone surfaces;
- Maslina for actionable or initiative-owned elements only;
- no resting shadows except where the dock or menu genuinely floats over the
  aerial photograph;
- visible focus rings;
- minimum 44 px touch targets on coarse pointers;
- no decorative icons required to understand a destination.

The hero dock is one surface, divided into four clear destinations. On desktop
it is a four-column row. On small screens it becomes a two-by-two grid so all
four choices remain visible without horizontal scrolling. Each destination has
a short label, optional descriptor, and clear hover/focus state. The WhatsApp
item may use the platform colour only as a small identifying accent; it must
not turn the whole navigation into four competing coloured cards.

## Components and boundaries

- A shared navigation data module owns the primary and secondary destination
  definitions and resolves the WhatsApp fallback.
- A presentational primary-navigation component renders the shared definitions
  in `hero`, `header`, or `menu` variants without changing their meaning.
- `SiteHeader` decides whether the homepage uses the compact brand-only form
  and whether secondary navigation is expanded.
- `HomePage` remains responsible for the aerial hero and composes the hero
  variant; it no longer loads proposal data.
- `PlutajuciIzbornik` reuses the same definitions while retaining map-specific
  positioning and dismissal behaviour.

These boundaries keep navigation policy separate from visual placement and
make the four journeys independently testable.

## Data and failure behaviour

The homepage becomes independent of Postgres. A database outage therefore
cannot prevent visitors from reaching the map, Karepovac, WhatsApp, or the
problem register.

The only configuration-dependent destination is WhatsApp. An invalid or absent
invite uses `/o-inicijativi` as an honest fallback. No placeholder WhatsApp URL
is ever rendered.

## Verification

Automated checks should cover:

- the four primary destinations appear once in each relevant navigation
  context and in the approved order;
- the homepage does not call proposal queries;
- the homepage header does not duplicate the hero dock;
- the WhatsApp fallback is valid when the environment variable is absent;
- active states work for nested Karepovac and Problems routes;
- the secondary disclosure exposes every secondary destination and has correct
  accessible state.

Browser verification should inspect the homepage and one internal page at a
phone viewport and a desktop viewport. Confirm that all four choices are
visible, the hero remains legible, keyboard focus is visible, the secondary
menu dismisses correctly, and the map's floating navigation remains usable.

## Explicitly out of scope

- Redesigning the map, Karepovac pages, proposal register, or submission form.
- Adding a chat service or replacing WhatsApp.
- Adding new homepage statistics, activity summaries, imagery, testimonials,
  or claims.
- Reworking the established visual system beyond what the shared navigation
  requires.

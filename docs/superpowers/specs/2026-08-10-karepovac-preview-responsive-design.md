# Karepovac Responsive Header and Measurement Preview Design

## Job and audience

Residents should be able to open the Karepovac project page on a phone, tablet, or narrower desktop without the site navigation breaking. The first screen should also show how the monitoring view will work once stations begin reporting, while remaining unmistakably honest that the displayed values are examples rather than measurements.

## Selected direction

- Keep the full site navigation only where the brand, seven links, and primary action fit on one line. At narrower widths, show the existing hamburger navigation.
- Replace the empty grid in the overview hero with a permanent, static preview of the future monitoring view.
- Mark the preview twice: `Ogledni podaci` and `Nisu stvarna mjerenja`.
- Show three generic stations (`Postaja A`, `Postaja B`, `Postaja C`) around Karepovac. Do not imply real host locations or coordinates.
- Show Croatian-formatted sample H₂S readings, a sample timestamp, wind direction and speed, and a separately labelled wind-based spread estimate.
- Use olive only for the project's sample station measurements and sky blue for the wind estimate, preserving the existing evidence vocabulary.
- Do not show thresholds, health judgements, alerts, or an NH₃ value; none is supported by current measurements or calibration.

## Layout and states

- At widths below 1280 px, the site header stays on one line with the wordmark and hamburger. The full navigation appears from 1280 px upward.
- The preview keeps the existing white field, restrained grid, rounded container, and no decorative resting shadow.
- On wide screens, the map-like field occupies the right side of the hero. A compact information strip sits across its lower edge.
- On phones, station labels and the information strip stack without horizontal overflow; meaningful prose remains at least 1rem and touch targets remain at least 44 px.
- The left side of the hero and the following section continue to state that the project is in preparation and measurements have not started.

## Data and truth boundaries

- Preview values are local constants used only to demonstrate presentation. They are not fetched, stored, exported, or described as live.
- Station readings and the wind-derived estimate remain visually and textually distinct.
- The preview must remain understandable without colour alone.

## Verification

- Add a failing contract test for the preview disclaimer, the three generic stations, Croatian decimal commas, and the separation between measurement and estimate labels.
- Add a failing regression check for the header's compact/full-navigation breakpoint contract.
- Verify the focused tests red before implementation and green afterward.
- Run the full test suite, ESLint, the Impeccable detector, and a production build.
- Inspect or have the user inspect 390 px, 1024 px, and 1450 px widths. The 1024 px view must use the hamburger; the 1450 px view must keep the full navigation on one line.

## Non-goals

- No real sensor or weather API integration.
- No interactive map, timeline, station selector, or live refresh.
- No changes to other Karepovac pages, routes, project claims, or donation flows.

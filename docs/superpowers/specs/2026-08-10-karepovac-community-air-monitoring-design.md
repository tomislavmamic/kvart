# Karepovac Community Air Monitoring — Design Specification

- **Status:** Approved design
- **Date:** 2026-08-10
- **Product:** Naš kvart — Dračevac i Bilice
- **Primary surface:** `/karepovac`
- **Delivery model:** Community-science subproject with phased public launch

## Decision summary

Create a Karepovac subproject inside *Naš kvart* that lets residents fund, host,
and follow a small community air-monitoring network around the landfill. The
public page launches before the sensor network: it first explains the project,
shows a transparent equipment and operating budget, collects potential station
hosts, and links to an external donation mechanism after a lawful recipient is
confirmed.

Measurements become public only after the sensors complete a documented
collocation and calibration period. The page always distinguishes:

- measurements collected by community stations;
- official measurements published by the competent authority;
- modelled wind transport or plume estimates; and
- gaps, stale data, and readings that failed quality checks.

The initial network targets at least three H₂S/odour stations and one reliable
local wind input. H₂S is the primary specific gas for the pilot. Low-cost odour
fingerprint sensors may supplement it. NH₃ is added only after a candidate
module demonstrates useful low-concentration performance during collocation.

This is an umbrella design. Implementation is decomposed into linked issues for
the public page, donations and expenditure reporting, host intake, sensor
hardware, ingestion, calibration, mapping, modelling, and operations.

## Context

Karepovac already has an official monitoring station, and the Croatian air
quality portal publishes measurements including H₂S and NH₃. A community
network would not replace that station. Its value is spatial: several modest
stations can help residents understand when an odour event occurred, which
locations observed it, and whether the observations align with the wind.

Cheap gas sensors drift, react to temperature and humidity, and can respond to
other gases. A visually precise plume map built before field validation would
conflict with the product commitment **“Ništa bez izvora.”** The subproject
therefore uses a phased community-science model: participation and fundraising
can start immediately, while public concentration claims wait for calibration.

The primary user remains a neighbour arriving from WhatsApp on a phone. The
page must answer four questions quickly:

1. What is happening around Karepovac now?
2. How trustworthy is the displayed information?
3. How can I help fund the network?
4. Can I host a station at my home?

## Goals

1. Establish a stable public address for community monitoring of Karepovac.
2. Show measured gas readings and likely wind transport without presenting a
   model as direct observation.
3. Fund equipment, calibration, connectivity, maintenance, and replacement
   openly, with a visible goal and expenditure record.
4. Let residents volunteer gardens and balconies as potential station sites.
5. Protect volunteer contact details and exact home locations.
6. Publish the methodology, calibration history, source attribution, quality
   flags, and limitations alongside the readings.
7. Provide reusable, downloadable community measurements under an explicit
   open-data licence.
8. Grow the network only when added stations improve spatial coverage and can
   be maintained.

## Non-goals

- Replacing official or regulatory air-quality monitoring.
- Certifying compliance with exposure limits.
- Providing a worker-safety or emergency H₂S alarm.
- Claiming that a model shows the actual location of every emitted gas.
- Publishing an uncalibrated low-cost reading as a precise concentration.
- Measuring every compound responsible for landfill odour.
- Publishing volunteer names, contact details, exact home addresses, or exact
  residential coordinates by default.
- Processing card details or building an in-house payment system in the first
  phase.
- Promising donors a tax treatment, ownership interest, or particular result.

## Delivery phases

### Phase 0 — Governance and feasibility

- Identify the person or organization legally able to receive and spend
  donations for the subproject.
- Ask the official Karepovac station operator whether community sensors may be
  collocated nearby for a defined evaluation period.
- Confirm the public-data licence, privacy notice, host agreement, equipment
  ownership, maintenance responsibility, and process for withdrawing a hosted
  station.
- Publish the initial bill of materials and recurring-cost estimate.

No donation action becomes active until the recipient and terms are stated on
the page.

### Phase 1 — Public project page

Launch `/karepovac` with project status **“U pripremi”**, the funding goal,
budget breakdown, methodology, expected phases, frequently asked questions,
and calls to donate or volunteer a site. The page must not render invented live
data or placeholder stations.

### Phase 2 — Procurement and bench testing

- Buy at least three identical H₂S modules, duplicate odour fingerprint
  sensors, enclosures, communications hardware, and power equipment.
- Assemble nodes with temperature and humidity measurements.
- Run all nodes side by side to identify dead units, baseline offsets, noise,
  drift, communications failures, and enclosure effects.
- Record device, sensor, firmware, and assembly versions.

### Phase 3 — Collocation and calibration

- Operate the nodes together next to an official or otherwise suitable
  reference instrument when permission is available.
- Perform documented zero/span checks using appropriate certified gas and safe
  procedures.
- Derive versioned correction coefficients and quantify bias, precision,
  missingness, and environmental sensitivity.
- Publish a calibration report before publishing concentration values.

If a sensor type cannot support a useful quantitative result, retain it only
as a qualitative event indicator and label it accordingly.

### Phase 4 — Residential pilot

Select at least three hosts that provide useful upwind/downwind coverage under
common wind regimes. Run a 30-day commissioning period. A node is considered
operational when it achieves at least 90% valid-data availability during this
period, excluding documented maintenance windows.

### Phase 5 — Public measurements and wind transport

Publish quality-controlled readings, history, station health, wind context,
and a modelled transport layer. Public views use recent rolling aggregates and
historical hourly aggregates; raw high-frequency measurements remain
downloadable where their quality state is preserved.

### Phase 6 — Expansion

Add stations, NH₃, or additional odour proxies only after the pilot report
shows the need, expected information gain, maintenance cost, and validation
method.

## Public page design

### Page structure

The mobile-first page is ordered as follows:

1. **Current status** — preparation, calibration, pilot, live, degraded, or
   paused.
2. **What we know now** — latest valid observations, wind context, and a plain
   statement of uncertainty.
3. **Map** — community stations, official station, measurements, and modelled
   transport with separate controls and legends.
4. **Help build the network** — donation and host actions.
5. **Funding and spending** — goal, amount raised, committed purchases,
   invoices or receipts suitable for publication, and recurring costs.
6. **How measurement works** — equipment, siting, calibration, quality states,
   and limitations.
7. **Station history** — uptime, last valid reading, maintenance, and latest
   calibration.
8. **Open data and sources** — downloads, API documentation when available,
   official sources, model source, licence, and timestamps.
9. **Safety and contact** — community-science disclaimer and route for
   reporting a problem with a station or dataset.

### Map semantics

The map uses visually distinct layers:

- **Measured here:** station markers and observed rolling values.
- **Official measurement:** the official Karepovac station with its source and
  publication delay.
- **Estimated transport:** animated particles, path, or probability footprint
  generated from the wind field.
- **Uncertain or unavailable:** no interpolation disguised as a measurement;
  missing regions remain missing.

Every modelled frame displays its forecast/observation source, initialization
time, valid time, spatial resolution, and last update. The interface says
**“procijenjeni smjer širenja”**, not **“gdje je plin.”**

### Data freshness

Each station exposes:

- last received sample time;
- last valid sample time;
- aggregation interval;
- current quality state; and
- next expected maintenance or calibration date.

A stale station remains visible but cannot contribute to a current plume or
summary. The stale threshold is based on the node's configured reporting
interval and is shown in the methodology.

## Funding and expenditure reporting

The first version does not process payments. It links to an external campaign
or payment page operated by the named lawful recipient. *Naš kvart* stores and
publishes only the aggregate funding state and expenditure ledger needed for
transparency.

The budget separates:

- sensor modules;
- communications/controllers;
- weatherproof enclosures and mounts;
- power or solar equipment;
- calibration gas and reference work;
- connectivity and hosting;
- replacement sensors and maintenance; and
- contingency.

The ledger publishes date, purpose, supplier/payee where appropriate, amount,
category, and public supporting document. Donor identity is not published
unless a separate, explicit opt-in exists. No payment credentials or full
financial-account details enter the repository or public dataset.

## Volunteer station hosts

### Intake

The host form asks only for information needed to evaluate a site:

- name and private contact method;
- approximate location selected on a map;
- garden, balcony, roof, or other placement;
- mounting height and openness to airflow;
- nearby roads, chimneys, vents, grills, smoking areas, trees, or walls;
- availability of mains power, Wi-Fi, cellular reception, or solar exposure;
- ability to permit planned maintenance access; and
- consent choices for data and public map precision.

Submissions remain private to moderators. They do not become public proposals
and are not exposed through a public API.

### Selection and siting

Hosts are selected for coverage and measurement quality, not first-come order.
A site visit or structured photo review confirms mounting and local sources.
Sensors must be reachable without entering dangerous landfill, industrial, or
confined-space environments.

### Location privacy

The database stores exact coordinates only when required for dispersion work
and only with host consent. The public map defaults to an approximate point or
area displaced sufficiently to avoid identifying a particular residence. An
exact residential location is public only after separate explicit consent,
which may be withdrawn.

If a host withdraws, public history retains a non-identifying station code and
coarse area where scientifically necessary, while private contact and precise
location data are removed according to the retention policy.

## Measurement system

### Pilot equipment profile

The reference DIY profile is:

- a calibrated, temperature-compensated H₂S electrochemical module capable of
  resolving low-ppb changes;
- a Bosch BME688-class odour/VOC fingerprint sensor used only for relative
  pattern detection;
- temperature and humidity measured at the sensing inlet;
- an ESP32-class controller with authenticated reporting;
- mains, PoE, or a sized solar/battery supply;
- a shaded weatherproof enclosure with a replaceable hydrophobic gas vent; and
- a documented mount that keeps airflow representative and rain out.

The SPEC Sensors DGS-H₂S 968-036 and Winsen ZE803-H₂S are initial H₂S
candidates. The Winsen ZE801-NH₃ and Senovol AQM-NH₃ are evaluation candidates,
not approved fleet components. Procurement compares detection limit, accuracy,
cross-sensitivity, calibration method, expected life, replacement supply, and
total installed cost rather than headline digital resolution alone.

### Sampling and aggregation

Nodes sample frequently enough to diagnose brief events and sensor health.
The ingestion service retains immutable raw readings with device timestamps
and server receipt timestamps. Public current views use a rolling aggregate to
reduce noise; historical charts default to hourly aggregates. Aggregation never
removes the underlying quality state.

### Quality states

Every reading or aggregate is one of:

- `preliminary` — received but not yet through complete checks;
- `valid` — passed range, timing, environmental, calibration, and device-health
  checks;
- `suspect` — retained but excluded from current summaries and models;
- `invalid` — known failure, never treated as concentration evidence; or
- `missing` — expected data was not received.

Corrections are versioned. A corrected result retains links to the raw value,
calibration version, firmware, and sensor identity.

## Technical architecture

### Components

1. **Karepovac public page** — server-rendered project state and funding data,
   with a client map and charts loaded progressively.
2. **Private host intake** — dedicated form and moderator review flow, separate
   from public proposals.
3. **Device ingestion endpoint** — authenticated, rate-limited, append-only
   receipt of station payloads.
4. **Quality processor** — validates timestamps, ranges, environmental state,
   calibration version, duplicates, and device health.
5. **Aggregation worker** — produces rolling and hourly public series.
6. **Wind/model worker** — fetches or generates time-stamped wind fields and
   derived transport products independently of measurements.
7. **Operations admin** — manages station status, calibration, maintenance,
   quality overrides with audit history, hosts, funding totals, and expenses.
8. **Public export** — station metadata, quality-controlled readings,
   methodology version, and source attribution without private host data.

### Data flow

```text
station -> authenticated ingestion -> immutable raw reading
                                   -> quality processor
                                   -> rolling/hourly aggregate -> public page/API

weather source -> wind/model worker -> timestamped estimate -> map model layer

host form -> private moderator review -> approved station -> coarse public point

external donation channel -> moderator reconciliation -> public aggregate/ledger
```

Measured readings and model outputs remain separate records and API resources.
The frontend may combine them visually, but it cannot replace one with the
other when either source fails.

### Core records

The implementation should provide clear records for:

- subproject status and published methodology version;
- private host application and consent;
- station and public/private location;
- replaceable sensor installed in a station;
- firmware and enclosure configuration;
- calibration event and correction version;
- raw reading and server receipt;
- quality result and aggregate;
- model run and model frame;
- funding goal and aggregate raised amount;
- expenditure and supporting public document; and
- maintenance event and station incident.

## Failure and safety behavior

- **Station offline:** show it as stale, stop using it in current summaries,
  and alert moderators.
- **Clock drift or duplicate payloads:** preserve receipt evidence, reject the
  affected readings from valid aggregates, and surface a device incident.
- **Out-of-range temperature/humidity:** mark affected gas readings suspect or
  invalid according to the sensor specification.
- **Calibration expired:** keep history visible but do not call current values
  validated.
- **Official feed unavailable:** state that the source is unavailable; do not
  substitute community data under the official label.
- **Wind/model unavailable:** retain measurements and hide the estimated
  transport layer with an explanation.
- **Donation reconciliation delayed:** show the last reconciliation date.
- **Host withdrawal:** stop collection promptly and execute the documented
  location/contact retention policy.
- **Possible hazardous concentration:** never instruct a resident to approach
  the source. Link to official emergency guidance and clearly state that the
  community node is not a safety instrument.

## Privacy and security

- Host applications, contact details, exact residential coordinates, consent
  records, and access instructions are moderator-only data.
- Public station identifiers are random and reveal no address or host name.
- Device credentials are unique, revocable, hashed or otherwise stored using
  an appropriate server-side secret mechanism, and never bundled into public
  code.
- Ingestion is rate-limited and validates payload size, schema, time skew, and
  station identity.
- Administrative edits to quality, calibration, funding, expenses, and station
  state are audited.
- Public exports are generated from an allowlisted schema to prevent accidental
  publication of private columns.

## Verification

### Software verification

- Unit tests for payload parsing, time handling, calibration application,
  quality-state transitions, aggregation, staleness, and coarse-location
  generation.
- Contract tests proving measured and modelled data cannot be confused.
- Integration tests from authenticated ingestion through public aggregate.
- Authorization tests for host data, exact coordinates, device credentials,
  expenditure editing, and calibration overrides.
- Privacy snapshot tests for every public API and downloadable export.
- Mobile and desktop tests for map controls, stale/error states, donation and
  host calls to action, keyboard access, and WCAG AA contrast/focus behavior.

### Field verification

- Side-by-side repeatability test for all purchased nodes.
- Documented zero/span checks.
- Reference collocation report covering bias, precision, missingness,
  temperature/humidity effects, and cross-sensitivity limitations.
- 30-day residential commissioning with at least 90% valid-data availability
  per operational station.
- Event review comparing station observations, wind, official data where
  available, and known local interference reports.

## Launch criteria

The fundraising/volunteer page may launch when the recipient, budget, privacy
notice, host terms, and project status are truthful and complete.

Quantitative community gas readings may launch only when:

1. at least three nodes have completed bench testing and collocation;
2. the calibration report and correction version are published;
3. station siting and public location privacy have been reviewed;
4. quality flags, staleness, source timestamps, and failure states work;
5. the 30-day commissioning target is met or exceptions are explicitly
   disclosed; and
6. the page states that readings are indicative community measurements, not
   regulatory or safety measurements.

The modelled transport layer may launch only when it shows initialization,
valid time, source, resolution, update time, and uncertainty, and when failure
of the model cannot suppress or alter measured observations.

## Follow-up issue decomposition

The umbrella epic should link at least these implementation issues:

1. Karepovac public project and methodology page.
2. Funding goal, aggregate donations, and expenditure ledger.
3. Private volunteer-host intake and consent management.
4. Pilot hardware bill of materials and node prototype.
5. Authenticated station ingestion and station-health monitoring.
6. Calibration, correction, and quality-control pipeline.
7. Public readings, charts, and open-data export.
8. Wind-data evaluation and estimated transport model.
9. Karepovac map experience and station privacy treatment.
10. Operations runbook, maintenance, incident handling, and recurring costs.

## Product language

All public copy is Croatian and follows the existing neighbourly,
non-partisan voice. Recommended labels include:

- **Praćenje zraka oko Karepovca**
- **Projekt je u pripremi**
- **Izmjereno na ovoj postaji**
- **Službena mjerna postaja**
- **Procijenjeni smjer širenja prema vjetru**
- **Kvaliteta podatka**
- **Zadnje valjano mjerenje**
- **Pomozite kupiti i održavati opremu**
- **Ponudite mjesto za mjernu postaju**
- **Ovo je indikativno mjerenje građanske mreže, a ne službeno ni sigurnosno
  mjerenje.**

No page state implies an existing partnership, permission, donation total,
station host, calibrated sensor, or live measurement until that fact exists
and has a source.

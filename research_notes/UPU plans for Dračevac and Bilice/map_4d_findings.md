# Map 4.d of the April 2025 GUP draft, and map 4.c of the GUP in force (checked 23 Sep 2026)

## Sources
- Draft sheet list: https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/planovi-na-javnom-uvidu/izmjene-i-dopune-generalnog-urbanistickog-plana-splita-za-ponovnu-javnu-raspravu
- Map 4.d "Područja i dijelovi primjene planskih mjera zaštite", Prijedlog za ponovnu javnu raspravu (April 2025), 1:10 000: https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/4_d%20Podrucja%20i%20dijelovi%20primjene%20planskih%20mjera%20zastite.pdf
- Report on the 2024 public consultation (Izvješće o javnoj raspravi, 26 Mar 2025, KLASA 350-02/21-04/4). Downloaded earlier in this session as mpgi_gup_2025.pdf; I couldn't recover the exact file URL. It is published on the split.hr report page: https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-i-strateskoj-studiji-o-utjecaju-na-okolis-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita
- GUP in force, map 4.c "Obuhvat detaljnijih planova" (2008 amendments sheet, EntryId 3179 = 6321). The 2014 amendment sheet for 4.c (EntryId 6322) covers only Trsteničke uvala: https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId=3179&Command=Core_Download
- GUP in force, consolidated text, SGGS 55/14 (EntryId 6130).

## Map 4.d legend (verified from the PDF text layer)
- Hatched red: plan in force. Blue grid: boundary of a UPU still to be made.
- Green: "područje urbane sanacije". Orange: "područje urbane preobrazbe". Yellow: "neuređeni dio neizgrađenog građevinskog područja prema PPUG-u Splita".
- "Popis planova užeg područja za koje je propisana obveza izrade (radni naziv)": 34 entries. Those relevant here:
  - 17. UPU Mostine
  - 18. UPU Dračevac 2
  - 19. UPU Harakovac – područje između Mostina i Karepovca
  - 20. UPU Kila
  - 25. UPU gradskog projekta Karepovac
- Plans in force nearby: 16 DPU dijela područja Dračevac (23/04), 26 DPU radne zone Dračevac, 36 UPU Bilice II–Mostine (12/98), 42 UPU Dujmovača–Smokovik zapad, 43 UPU Bilice sjever (7/09).

## What the map shows (visual reading of the rendered sheet)
- **UPU 18 Dračevac 2** is the residential north-east of Dračevac, east of the work-zone DPU. It is mostly green (sanacija) with yellow (neuređeno).
- **UPU 17 Mostine** lies south-west, below Bilice II–Mostine. It is mostly green with some yellow.
- **UPU 19 Harakovac** lies between Mostine and Karepovac. It is mostly yellow with patches of green.
- **UPU 36 Bilice II–Mostine** (in force) is hatched over yellow and orange.
- **UPU 43 Bilice sjever** (in force) is orange (preobrazba) with yellow.

## Areas
Measured by filling the region inside the thick plan outlines at 3× render. This excludes the outline width, so it undercounts by about 10–18%. Check: UPU Bilice II–Mostine measures 22.2 ha against an official 26.22 ha; DPU radne zone Dračevac measures 13.7 ha against an official 15.27 ha.

| Plan | Measured | Corrected estimate |
|---|---|---|
| UPU 18 Dračevac 2 | 27.1 ha | ≈30 ha |
| UPU 17 Mostine | 44.4 ha | ≈50 ha |
| UPU 19 Harakovac | 46.4 ha | ≈52 ha |

## Overlay with the site's kvart polygons
Source: public/geo/granica.geojson. I assumed the same sheet frame as the site's 2024 namjena georeference in scripts/trace-plans.py: afin (M_PO_PT, 490300.41, 4817117.25), zakret 0, page 4791×1332 pt. The site's building footprints line up with the sheet's buildings by eye, to within tens of metres.

- **Dračevac polygon (73.6 ha):**
  - UPU 18 Dračevac 2: 36%
  - UPU 19 Harakovac: 24%
  - DPU radne zone Dračevac: 16%
  - Region outside every mapped plan (mostly the strip along the GUP boundary, plus the edge of Karepovac): ≈17%
  - Rest: slivers
- **Bilice polygon (34.6 ha):**
  - UPU Bilice II–Mostine (in force): 62%
  - Unenclosed region along the GUP boundary: ≈18%
  - UPU 19 Harakovac: 8%
  - DPU radne zone Dračevac: 5%

## GUP in force (SGGS 55/14 text plus the 2008 map 4.c)
- Map 4.c already shows residential Dračevac (the future "Dračevac 2"), Mostine and Harakovac with a blue grid, "obveza izrade urbanističkog plana uređenja".
- Čl. 105: "Utvrđuje se obveza izrade urbanističkih i provedbenih dokumenata prostornog uređenja za obuhvate prema kartografskom prikazu … 4.c". Until those plans exist, permits are possible only for a list of exceptions: parts of the street network, infrastructure and similar.
- Čl. 104: in low-consolidated areas (niskokonsolidirana područja), building is allowed on the basis of plans in force, or of prescribed plans. Only where no plan is prescribed is building allowed directly from the GUP.
- Čl. 73, rule 3.1, M1: new construction, replacement and reconstruction go "uz izradu provedbenog dokumenta … ukoliko je … utvrđena obveza izrade, a za ostalo temeljem ovog Plana".
- Not verified:
  - which urban rule (urbano pravilo) applies to residential Dračevac (3.1 is likely);
  - whether the City in practice refuses permits there today. The "uvjeti za izgrađene dijelove" paragraph allows "ili na drugi način utvrđen ovom Odlukom", which may open a route.

## Draft rules (Odredbe, April 2025)
- **Čl. 103(1):** in neuređeni, preobrazba and sanacija areas, building is allowed only on the basis of a narrower plan.
- **Čl. 103(4):** in other areas where the GUP asks for a plan, direct GUP application is allowed until the plan exists (the "preporuka" regime).
- **Čl. 105(5):** exceptions until the UPU exists: streets, small infrastructure, public buildings, R2 recreation up to 5,000 m², recycling yards. No houses.
- **Čl. 108(1):** buildings whose use conflicts with the planned zoning may only be maintained and reconstructed within their existing footprint.

## Consultation report (2024 round)
- **No. 150:** Bilice II (Gradski kotar Mejaši) has more than 100 family houses in a K5 zone. The request to rezone to M1 was refused as outside the scope of the decision to amend; "ozakonjenje građevina ne predstavlja kriterij za prenamjenu".
- **No. 128:** Bilice II, K5→M1. Refused on the same grounds.
- **No. 142:** UPU Bilice II–Mostine has held the area "u svojstvu taoca" for 24 years. The family filed a 2022 initiative and never got an answer. City reply: such requests will be considered in the new-generation GUP and/or in amendments to the narrower plan.
- **No. 47/48:** residents of Ulica Bilice 2 (21-signature petition) asked for Z5→K5. Refused as outside the scope.
- **No. 208 (a designer acting as authorised representative):** asked to lift the ban on building permits until the UPU exists for k.č. 1025, 1024/1 and 1024/2 (no k.o. given). Refused: 1024/1 and 1024/2 are correctly marked neuređeno; 1025 is in an urbana sanacija area. Site-specific, and the location is not confirmed.
- **County environment department:** questioned "33 nova UPU-a" and 47 DPUs, noting the UPU areas are mostly built up and such plans often stay "mrtvo slovo na papiru". City reply: the new UPUs are sanation or transformation plans, "što je zakonom propisana obveza".
- **Public presentation, 3 Oct 2024:** Gorana Barbarić said the sanation conditions are in draft čl. 106, with the aim of securing a basic street network, public facilities and green space.

## Also seen
- split.hr "Planovi na javnom uvidu" (Sept 2026) lists UPU sjeverozapadno od križanja ulica Put Stinica i Put Supavla, so that plan appears to be at public inspection now. Not opened.

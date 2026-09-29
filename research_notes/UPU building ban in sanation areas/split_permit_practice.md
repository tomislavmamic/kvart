# Split's permitting practice in areas with a prescribed but unadopted UPU (2014–2026)

Scope: how the City of Split has actually handled building-permit applications for new houses and residential buildings in low-consolidated "urbana sanacija" areas. In these areas the GUP in force (SGGS 55/14, map 4.c from the 2008 amendments) prescribes a UPU that has never been adopted. The notes also cover whether the buildings of the last ~10 years there were permitted. Research date: 27 Sep 2026.

**Method note, for the report writer.** The main evidence is new and primary. It comes from the Ministry's public spatial-planning register, ISPU ([Geoportal ISPU](https://ispu.mgipu.hr/)), layer group "Registar dozvola/akata".

- **What was harvested.** I queried every act drawn on three layers inside the 2025 draft's prescribed-UPU polygons:
  - "Akt za građenje građevine" (building acts)
  - "Lokacijska dozvola" (location permits)
  - "Akt za uporabu građevine" (use acts, which include legalisation decisions)
- **How.** The layers were rendered from the public WMS (`https://ispu.mgipu.hr/api/v1/gis/wms`). The public identify service (`https://ispu.mgipu.hr/api/v1/gis/identify`) was then called on each drawn feature; it needs no login or captcha.
- **Where.** The polygons came from the repo's `public/geo/gup-grad/planski-rezim-2025.geojson`: UPU , Mostine, Harakovac, Kila, zapadni dio Kamena, Žnjan 2, Orišac (mixed-use zone) and sjeverni Stobreč. I also queried the site's Dračevac and Bilice kvart polygons.
- **What each record gives.** Act type, klasa, dates, outcome, type of works, use, address, k.č., a short description, and the issuing body. Addresses and parcel numbers of private permits are left out of these notes, and the raw permit list (`split_permit_practice - ISPU akti.csv`) is not published; the klasa is enough to request each act.
- **Check against the GUP in force.** Each permit point was placed on map 4.c of the GUP in force ("Obuhvat detaljnijih planova", 2008 sheet, [EntryId 3179](https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId=3179&Command=Core_Download)). The georeference is the repo's affine for the 2008 land-use sheet, which uses the same CAD template: same page size, 1333×4848 pt, rotated 270°. I then checked each point for the blue "obveza izrade UPU" grid.
- **Check against the draft.** Points were also placed on draft map 4.d (April 2025), using the repo's 2025 affine.
- **The "clean" sample.** A point counts as clean when it is:
  - at least 30 m inside the draft UPU polygon;
  - at least 30 m from any plan in force;
  - on the 4.c blue grid.
- **Outputs.** The full list is saved next to these notes as `split_permit_practice - ISPU akti.csv`, with three figures (`split_permit_practice - 4c *.jpg`). The scripts are in the session scratchpad (`harvest.py`, `clean.py`, `fig4c.py`).
- **Limits.**
  - The permit texts themselves could not be opened. The ISPU link `dozvola.mgipu.hr/pregled/...` returned a maintenance page, so the legal reasoning in each permit is unknown.
  - ISPU completeness is not guaranteed.
  - The plan-map georeferences carry an error of roughly ±10–30 m.

## 1. Did Split issue permits for new residential buildings inside prescribed-UPU areas, 2014–2026?

### Takeaway
Yes, routinely. The Ministry's register shows about 57 approvals (56 building permits and one 2016 rješenje o uvjetima građenja) for **new** residential or residential-business buildings, issued 2016–Sept 2026. All sit inside areas that map 4.c of the GUP in force marks "obveza izrade UPU" and that have no plan in force.

- **Where they are:**
  - Dračevac: 6
  - Mostine: 5
  - Kila: 12
  - western Kamen: 14
  - Orišac: 11
  - northern Stobreč: 7
  - Žnjan 2: 2 in the clean sample
- **What they are:** single houses, and also multi-unit blocks of 6, 9, 13 and 42 flats.
- **Trend:** issuance continued, and accelerated, after the 2024/2025 GUP drafts. Nine or more permits were issued in the Kila and Kamen areas alone in 2026.

### Cited findings
**Dračevac (draft "UPU " area; residential NE Dračevac)**

All are k.o. Split, issued by the Grad Split permit office. Source: [ISPU Registar akata](https://ispu.mgipu.hr/), CSV. All points lie on the 4.c blue grid.

| Klasa | Date | Parcel / address | Building |
|---|---|---|---|
| UP/I-361-03/20-01/000010 | 17 Mar 2021 | — | New residential-business building |
| UP/I-361-03/21-01/000049 | 6 Jul 2021 | — | One flat and one business unit (apartment) |
| UP/I-361-03/21-01/000240 | 21 Jul 2022 | — | Po+Pr+1K+N, one flat and one shop |
| UP/I-361-03/19-01/000158 | 4 May 2023 | — | Residential building with 3 flats |
| UP/I-361-03/23-01/000111 | 30 Jan 2025 | — | "građenje zgrade" Po+Pr+2K, 2 flats, 2 business units, 2 garages |
| UP/I-361-03/22-01/000095 | 14 May 2025 | — | "građenje zgrade", 1 flat and 1 office |

Related acts:
- **Location permits (lokacijske dozvole) for the same projects:**
  - UP/I-350-05/21-01/000045 (29 Mar 2023; the Po+Pr+2K building with 2 flats and 2 business units)
  - UP/I-350-05/23-01/000022 (23 Aug 2024)
- **Amendments:**
  - UP/I-350-05/26-01/000004 amended the location permit on 14 Apr 2026.
  - UP/I-361-03/26-01/000082 amended the building permit on 27 Jul 2026.
- **Reconstructions of houses:**
  - UP/I-361-03/22-01/000029 (29 Dec 2022, second floor added, 3 flats)
  - UP/I-361-03/21-01/000054 (9 Oct 2023, loft)
- **Pending:** new-build application UP/I-361-03/25-01/000080 (residential), "Obrada predmeta".

Source for all of the above: [ISPU](https://ispu.mgipu.hr/); see `split_permit_practice - 4c Dracevac Mostine.jpg`.

**Mostine (draft "UPU Mostine"), k.o. Split**

| Klasa | Date | Parcel / address | Building |
|---|---|---|---|
| UP/I-361-03/20-01/000145 | 4 Jan 2021 | — | Two warehouses, two tourist apartments, two duplex flats |
| UP/I-361-03/20-01/000124 | 12 Oct 2021 | — | Po+P+2K, 6 flats and garage |
| UP/I-361-03/21-01/000265 | 21 Mar 2022 | — | Po+Pr+2+N, 3 flats and 3 business units; preceded by location permit UP/I-350-05/21-01/000004 of 26 Mar 2021 |
| UP/I-361-03/23-01/000035 | 31 Mar 2023 | — | Residential |
| UP/I-361-03/23-01/000252 | 29 Aug 2025 | — | Po+Pr+3K, 6 flats, 7 business units, 13-space garage |

- **Close to a plan in force:** a further 2015 permit (UP/I 361-03/14-01/00082, residential-business) and two 2020 permits (3 flats + 4 apartments; 6 flats + 5 business units) lie within 30 m of the edge of UPU Mejaši–Dragovode / DPU P26. I excluded them from the clean count.

Source: [ISPU](https://ispu.mgipu.hr/).

**Kila (draft "UPU Kila"), k.o. Split**

- **Approved new residential buildings:**
  - 2017: one permit
  - 2019: stambeno-poslovna zgrada "Kila"
  - 2020: Po+P+2K+N
  - 2022: two permits, one for a building with 4 units
  - 2024
  - 2025
  - 2026: five permits, of which UP/I-361-03/26-01/000088 (29 Jun 2026) is a building with 6 flats; UP/I-361-03/24-01/000244 (9 Jun 2026) is "sklop od četiri zgrade povezane podzemnom garažom"
- **2023 amendments:** a series of amended permits for one group of buildings. One of them (UP/I-361-03/23-01/000096) describes 13 flats with 12 garage spaces.

Source: [ISPU](https://ispu.mgipu.hr/); `split_permit_practice - 4c Kila Kamen.jpg`.

**Western Kamen (draft "UPU zapadnog dijela Kamena"), k.o. Kamen**

- **Approved:**
  - 2016: rješenje o uvjetima građenja
  - 2017
  - 2020
  - 2021: two permits
  - 2022: three permits, one of them 6 flats (UP/I-361-03/21-01/000238, Hrvatskih vitezova)
  - 2023: 9 flats (UP/I-361-03/22-01/000259)
  - 2025
  - 2026: four permits (17 Feb, 24 Feb, 16 Jun, 29 Jul)
- **Pending since 2025–26 (10 applications):** includes a 30-flat building (UP/I-361-03/25-01/000062) and a 7-flat building (UP/I-361-03/25-01/000193).

Source: [ISPU](https://ispu.mgipu.hr/).

**Orišac mixed-use zone and northern Stobreč**

- **Orišac:** 11 clean new-build permits, plus one reconstruction (UP/I-361-03/21-01/000036). They include:
  - UP/I-361-03/20-01/000226 (18 May 2021, Po+Pr+3K+N, **42 flats**, 54 parking spaces)
  - permits of 20 Jun, 21 Oct and 17 Nov 2025
  - permits of 12 Jun, 2 Sep, 14 Sep and 23 Sep 2026
- **Northern Stobreč:** 7, plus one permit described as a reconstruction to 6 flats (UP/I-361-03/19-01/000147). They include:
  - UP/I-361-03/23-01/000258 (4 Apr 2024: 9 flats and 7 offices)
  - two residential-business permits on 5 May and 8 Jun 2026

Source: [ISPU](https://ispu.mgipu.hr/); `split_permit_practice - 4c Orisac Stobrec.jpg`.

**The site's kvart polygons**
- **Dračevac:** the same 6 new-build permits as above.
- **Bilice:**
  - one new residential permit, UP/I-361-03/19-01/000101 (9 Dec 2020, 2 units)
  - one reconstruction, UP/I-361-03/20-01/000035 (23 Feb 2023)
  - Most of Bilice lies inside UPU Bilice II–Mostine (1998, in force), so it is not a prescribed-but-unadopted case.

Source: [ISPU](https://ispu.mgipu.hr/).

**Location on the plans**
- **GUP in force:** all clean points fall inside the blue "obveza izrade urbanističkog plana uređenja" grid of map 4.c ([4.c, 2008 sheet](https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId=3179&Command=Core_Download)). The City's GUP page confirms this 2008 sheet is the one in force; the 2014 amendment covers only Trstenik ([GUP Splita page](https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gup-splita)).
- **The draft:** on draft map 4.d (April 2025), most clean Dračevac/Mostine/Kila/Kamen permit points fall on land shaded **urbana sanacija** (green), some on **neuređeno** (yellow). Five Dračevac points — the 406/x cluster (2022, 2025 ×2 and its 2026 amendment) and the discontinued 2021 case beside it — plus a few Kamen/Kila points fall on unshaded land inside the UPU outline. Under draft čl. 103(3) such unshaded land would still be buildable directly ([map 4.d](https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/4_d%20Podrucja%20i%20dijelovi%20primjene%20planskih%20mjera%20zastite.pdf); CSV column `4d_2025_rezim`).

**What the GUP in force says on paper.** Map 4.c is binding through čl. 105: "Utvrđuje se obveza izrade urbanističkih i provedbenih dokumenata prostornog uređenja za obuhvate prema kartografskom prikazu … 4.c". "Do donošenja provedbenih dokumenata" it allows permits only for:
- streets
- infrastructure
- port works
- public buildings
- small recreation areas

The M1 part of rule 3.1 (čl. 73) allows new building "uz izradu provedbenog dokumenta … ukoliko je ovim odredbama utvrđena obveza izrade provedbenog dokumenta, a za ostalo temeljem ovog Plana". Rule 3.1 then gives direct-building parameters: Ppmin 500 m², kig 0.3, E=Po+P+2, max footprint 250 m²; [GUP SGGS 55/14](https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId=6130&Command=Core_Download).

**The official name of rule 3.1.** An Upravni sud u Splitu legalisation judgment describes a Split house as lying "u zoni M1-mješovita namjena pretežito stambena u niskokonsolidiranom području oznake 3.1.-Sanacija, uređivanje i urbana obnova djelomično izgrađenih prostora mješovite izgradnje". That is the official title of rule 3.1 in the GUP in force ([UsIgr-256/2015-14, 14 Jul 2017](https://odluke.sudovi.hr/Document/View?id=e43be9b5-2c66-4c43-b70f-6bc107efb56a)).

### Inferences
- **The freeze was not applied in practice.** Whatever the GUP text says, the permit office did not treat the 4.c obligation as a freeze on new houses in these areas. At least ~57 new-build approvals, single houses and multi-flat blocks alike, were issued there after 2014, up to and including September 2026.
- **The resident's premise is supported by the register.** New buildings in these areas were in fact built with permits, alongside the much larger legalised stock (see section 5).
- **The draft has had no effect yet.** Issuance did not slow after the September 2024 draft or the April 2025 draft. An unadopted draft has no legal effect on permits, and 2025–2026 are among the busiest years in the sample.
- **Not every draft-UPU point would be frozen under the draft.** A few permit points fall on land that draft map 4.d leaves unshaded. Whether each specific parcel would be frozen under the draft depends on its 4.d shading.

### Gaps
- **The office's legal basis is unknown.** I could not read the permit texts, so I could not see which GUP provision the permit office relied on. Candidates: rule 3.1's "a za ostalo temeljem ovog Plana"; čl. 49's "ili na drugi način utvrđen ovom Odlukom"; or a view that the 2008 4.c obligation does not bite. dozvola.mgipu.hr "pregled" was under maintenance. A Right to Information request to the Upravni odjel for two or three of the permits listed above would settle it.
- **Coverage is partial.** ISPU completeness is not guaranteed. My pixel-based harvesting can miss acts whose drawn footprints overlap others. Counts are minimums.
- **Not every area was harvested.** I did not harvest Visoka, Kman, Sirobuja, Put Supavla/Put Stinica or the rest of the eastern suburbs. Sirobuja, Stobreč, Šine–Vidovac and Mejaši–Dragovode have UPUs in force, so they are not "prescribed-unadopted" cases.

## 2. Did the City refuse permits citing the missing UPU?

### Takeaway
I found **no evidence** that Split refused a house permit because the UPU was missing: none in court decisions, and none in the pattern of register refusals. There are refusals in the sample areas, but several refused parcels later received a permit without any UPU, which is inconsistent with a categorical UPU bar. The only documented request to lift "nemogućnost donošenja akata o gradnji do donošenja UPU-a" is consultation objection no. 208, and it refers to the **draft**.

### Cited findings
**Refusals ("Rješenje o odbijanju zahtjeva") in the clean sample**

| Area | Klasa | Date | Parcel / project |
|---|---|---|---|
| Kila | UP/I-361-03/22-01/000178 | 23 Nov 2023 | — |
| Kila | UP/I-361-03/24-01/000056 | 20 Nov 2024 | — |
| Kila | UP/I-361-03/23-01/000247 | 21 Jan 2025 | reconstruction, Kila 20 |
| Kila | UP/I-361-03/24-01/000168 | 27 Mar 2025 | — |
| Kila | UP/I-361-03/24-01/000149 | 14 Jul 2026 | — |
| Kamen | UP/I-361-03/21-01/000198 | 14 Feb 2024 | — |
| Kamen | UP/I-361-03/23-01/000158 | 15 Apr 2024 | — |
| Kamen | UP/I-361-03/23-01/000172 | 21 Mar 2025 | — |
| Mostine | UP/I-361-03/24-01/000249 | 30 Jun 2026 | — |
| Dračevac | UP/I-350-05/23-01/000050 | 10 Apr 2025 | — |

- **After the Dračevac refusal:** a new location-permit application for the same parcel (UP/I-350-05/26-01/000041, "stambeno-poslovna") is pending.

Source: [ISPU](https://ispu.mgipu.hr/).

**The same parcels were later approved without a UPU**

| Parcel | Refused | Approved |
|---|---|---|
| Kila 3296/2 | 23 Nov 2023 | 13 May 2025 (UP/I-361-03/24-01/000239) |
| Kila 3294/14 | 20 Nov 2024 | 6 May 2026 (UP/I-361-03/25-01/000028) |
| Kila 3235/1 | 27 Mar 2025 | 21 May 2026 (UP/I-361-03/25-01/000104) |
| Kamen 993/3 | 15 Apr 2024 | 19 Aug 2025 (UP/I-361-03/24-01/000104) |
| Kamen 980/2 | 14 Feb 2024 | 17 Feb 2026 (UP/I-361-03/24-01/000243) |

Source: [ISPU](https://ispu.mgipu.hr/).

**Court decisions**
- **Searches run** in the national database ([odluke.sudovi.hr](https://odluke.sudovi.hr/)):
  - "Generalnog urbanističkog plana Splita" + "urbanističkog plana uređenja" (629 hits)
  - + "obveza izrade" (364)
  - "GUP-a Splita" + "provedbenog dokumenta" (56)
  - "urbano pravilo 3.1" / "urbanog pravila 3.1" (0)
  - "Obuhvat detaljnijih planova" (0)
  - "do donošenja urbanističkog plana uređenja" + "Grada Splita"
  - "članka 79. stavka 3." + Split
- **What turned up for Split:** legalisation refusals (mostly Marjan and public-use zones), a Mertojak school location permit, and suspensions pending a Visoki upravni sud review of the GUP's Marjan provisions (e.g. [Us I-794/2025-7](https://odluke.sudovi.hr/Document/View?id=84294bdc-bfc6-4221-af84-d59379bc947c)). I found no Split case turning on a missing UPU.
- **Contrast case elsewhere in the county.** The mechanism is applied in other places. The Upravni sud u Splitu upheld the county office's (Ispostava Makarska) 2019 refusal of a location permit in Baška Voda because the land lay "unutar područja za koje je propisana obveza donošenja Urbanističkog plana uređenja". The court quoted ZPU čl. 79(3): "do donošenja urbanističkog plana uređenja … ne može se izdati lokacijska dozvola i građevinska dozvola za građenje nove građevine" ([UsIgr-268/2020-6, 19 Nov 2020](https://odluke.sudovi.hr/Document/View?id=a7677b81-269b-4dd7-bac5-07bb287edcff)). A similar reconstruction-permit refusal by the county office in the Makarska area was upheld in [UsIgr-102/2019-8](https://odluke.sudovi.hr/Document/View?id=96035dd9-81f5-4994-87c1-8c16db9f0e68).

**Objection no. 208 (2024 consultation)**
- **The request:** a designer acting for owners of  and 1024/2 (k.o. not stated) wrote: "zahtijeva se ukidanje nemogućnosti donošenja akata o gradnji do donošenja UPU-a za navedeno područje kao i proširenje zone uređenog građevinskog područja na predmetne čestice".
- **Earlier acts on the land:** the objection notes a legalisation decision (UP/I-361-03/13-04/02405) and an earlier rješenje o uvjetima građenja (UP/I 361-03/10-01/0143) for residential buildings there. ISPU dates them 17 Jul 2015 and 10 Feb 2011.
- **The City's refusal:** it dealt with the road corridor and the neuređeno classification. It said  and 1024/2 are correctly neuređeno and 1025 "nalazi u izgrađenom građevinskom području koje je označeno kao područje urbane sanacije". It did not say whether a freeze already exists under the GUP in force ([Izvješće o javnoj raspravi, 26 Mar 2025, pp. 284–285](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-i-strateskoj-studiji-o-utjecaju-na-okolis-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita); ISPU search for both klasas).

### Inferences
- **The refusals were not about the UPU.** A refusal later followed by approval on the same parcel, with no UPU adopted in between, cannot have rested on a UPU requirement. Those refusals were more likely about project parameters: height, distance from the boundary, access. This is inference; the refusal texts were not read.
- **No sign of a UPU-based barrier in Split.** Nothing in the courts or the register suggests Split applies a UPU-based barrier to houses in these areas. By contrast, the county office has applied the statutory ZPU čl. 79(3) bar where a PPU designates UPU-obligation areas (the Baška Voda case).

### Gaps
- **Refusal grounds.** The reasons for the 2023–2026 refusals, and for the 10 Apr 2025 Dračevac location-permit refusal, are unknown without the decisions.
- **Where the no. 208 parcels are.** The acts' geometry (ISPU `search-geom`) is not public, so their location (k.o.) remains unconfirmed.
- **Other sources not checked.** I did not search the Pučki pravobranitelj reports, and I found no Visoki upravni sud decision on this question.

## 3. What have officials said about building being blocked or allowed pending UPUs, and about the draft's freeze?

### Takeaway
The clearest official statement is in the City's own **Obrazloženje** to the April 2025 draft. It says the law now limits mandatory UPUs to neuređeno, preobrazba and sanacija areas. In those areas "prije njegovog donošenja ne može se izdati lokacijska dozvola i građevinska dozvola za građenje nove građevine". Elsewhere, where a UPU is only recommended, permits can be issued before the plan. The draft newly maps "urbana sanacija" areas (map 4.d), and so it would bring most of the eastern suburbs under that statutory bar.

Officials have never said publicly that the bar already applies under the GUP in force. The City's own permit record shows it did not apply it. No news article found quotes an official on a "zabrana gradnje" or "moratorij" for these areas.

### Cited findings
**Obrazloženje, April 2025 draft**
- **§2.1.1.4, the key passage:** "Važećim Zakonom je temeljito izmijenjena obveza izrade … obveza izrade UPU-a je reducirana samo na neuređene dijelove građevinskog područja i na izgrađene dijelove … planirane za urbanu preobrazbu ili urbanu sanaciju. GUP-om je, sukladno Zakonu, propisana obveza izrade UPU-a za sva ta područja, ali je ujedno zadržana obveza preporuka izrade većeg broja UPU-a … uz bitnu razliku: na područjima na kojima je Zakonom prozvana obveza donošenja UPU-a, prije njegovog donošenja ne može se izdati lokacijska dozvola i građevinska dozvola za građenje nove građevine, dok je na područjima planske obveze preporuke donošenja UPU-a izdavanje navedenih akata moguće i prije donošenja tog plana." ([Obrazloženje ID GUP, April 2025, p. 6](https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/3_%20Obrazlozenje.pdf))
- **§2.1.1.2:** the draft's alignment with the law says "određeni su dijelovi građevinskog područja planirani za urbanu preobrazbu i urbanu sanaciju". It continues: "Područja urbane sanacije su većinom nisko konsolidirana područja na istočnom dijelu grada, na kojima je prisutna dugogodišnja nezakonita gradnja, a ozakonjenje nezakonito izgrađenih zgrada je utvrdilo status nezakonite gradnje kao trajne i velikim dijelom nepromjenjive činjenice u prostoru" (same source, pp. 5–6).
- **p. 25, on legalisation:** "nakon opće legalizacije objekata … od 2012. pa nadalje Grad Split je dobio cca 15000 'novih postojećih' građevina ali koje su protivne planskim odredbama". Hence reconstruction conditions in the draft are made "istovjetni uvjetima za novu gradnju" (same source).

**The draft text itself** (amending decision čl. 116, new GUP čl. 103(1)) lists the areas "na kojima je gradnja moguća samo temeljem prostornog plana užeg područja odnosno ne dozvoljava se neposredna provedba GUP-a":
1. neuređeni dijelovi
2. izgrađeni dijelovi planirani za urbanu preobrazbu
3. izgrađeni dijelovi planirani za urbanu sanaciju

- **Where plans are only recommended (čl. 103(4)):** GUP-direct building remains possible.
- **Čl. 104 of the GUP in force** (the low-consolidated three-route rule) is deleted (čl. 117).
- **New čl. 105(5):** until the plans are adopted, it allows permits only for streets, small infrastructure, port works, public buildings, small recreation areas and recycling yards. Apart from recycling yards, this is the same list as čl. 105 of the GUP in force.

Source: [ID GUP Odredbe, April 2025, pp. 144–145](https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/1_%20Odredbe%20za%20provedbu.pdf).

**The statute behind it.** ZPU NN 153/13 čl. 79:
- (1): UPU is obligatory "za neuređene dijelove građevinskog područja i za izgrađene dijelove tih područja planiranih za urbanu preobrazbu ili urbanu sanaciju".
- (3): "Do donošenja urbanističkog plana uređenja … ne može se izdati akt za građenje nove građevine".
- (4): reconstruction and like-for-like replacement are exempt.

Source: [ZPU NN 153/13](https://narodne-novine.nn.hr/clanci/sluzbeni/2013_12_153_3220.html). The 2017 wording, "lokacijska dozvola i građevinska dozvola", is quoted in [UsIgr-268/2020-6](https://odluke.sudovi.hr/Document/View?id=a7677b81-269b-4dd7-bac5-07bb287edcff).

**Public presentation, 3 Oct 2024 (minutes)**
- **Gorana Barbarić** (Zavod, responsible planner), asked about the conditions for sanation of illegally built areas: they are "propisani u članku 106. izmjena GUP-a", and "intencija bila osigurati osnovnu prometnu mrežu (proširiti prometnice), osigurati javne sadržaje i zelene površine".
- **Dragan Žuvela** (director of the Zavod) described the amendment as "sanacijsko-represivna".
- **Teo Vojković** (head of the department) said the aim was "rasterećenje prostora kako bi grad prodisao".
- **Not recorded:** no participant or official raised or explained a freeze on houses.

Source: [Izvješće 26 Mar 2025, zapisnik, pp. ~130–134](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-i-strateskoj-studiji-o-utjecaju-na-okolis-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita).

**Repeat presentation, 16 May 2025 (minutes).** Officials present: Maja Mijota, Dragan Žuvela, Gorana Barbarić, Ružica Batinić Santro. Nothing on UPU freezes was raised; the questions were about a Stobreč archaeological park and a "PO" label ([Izvješće o ponovnoj javnoj raspravi, 2 Sep 2026, pp. 50–51](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-ponovnoj-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-za-ponovnu-javnu-raspravu)).

**Thematic council session, 30 Oct 2025**
- **Mayor Tomislav Šuta:** "Preispitat ću sve kod čega se utvrde otvorena ili sporna pitanja" ([split.hr, 30 Oct 2025](https://split.hr/clanak/odrzana-tematska-sjednica-gradskog-vijeca-o-izmjenama-i-dopunama-ppug-a-i-gup-a)).
- **The report's status:** HRT reported that the Zavod and the Upravni odjel had prepared the repeat-consultation report three months earlier, "no ono nije upućeno u daljnju proceduru".
- **The opposition's charge:** the delay helps builders "jer sada nisu jasna urbanistička pravila". The motion to finish the amendments within 15 days failed 11–13 ([HRT, 30 Oct 2025](https://vijesti.hrt.hr/hrvatska/split-rasprava-o-gup-u-uz-medusobno-optuzivanje-za-pogodovanje-12404488)).
- **Not found:** in these reports, a statement about houses being blocked in sanation areas.

**Later statements**
- **The repeat-consultation report** is signed 2–3 Sep 2026 by the Upravni odjel za urbanizam. It notes that the procedure will be finished under the old ZPU (NN 153/13…67/23), per NN 155/25 čl. 236(2) ([Izvješće o ponovnoj javnoj raspravi, p. 1](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-ponovnoj-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-za-ponovnu-javnu-raspravu)).
- **22 Sep 2026:** Šuta announced a 45-day call for initiatives for future GUP amendments. Dragan Žuvela said "Split [je] prostornoplanski poprilično zapušten grad" ([Dalmatinski portal, 22 Sep 2026](https://dalmatinskiportal.hr/split-je-prostornoplanski-zapusten-duilovo-ide-putem-znjana-suta-otkrio-velike-projekte-koji-ce-mijenjati-grad)).

**Earlier official**
- **Teo Vojković** (then head of the department), February 2016: the legalisation surplus "will be used for construction of roads and infrastructure in the eastern part of the city" ([Index.hr, 3 Feb 2016](https://www.index.hr/vijesti/clanak/split-rijesio-86-posto-zahtjeva-za-legalizaciju-u-drzavni-proracun-se-slilo-156-milijuna-kuna/872620.aspx)).

### Inferences
- **The City's framing: the freeze comes with the new designation.** The City presents the freeze as a statutory consequence of designating urbana sanacija and neuređeno areas, and the draft newly designates them. On that framing, and consistent with its permit practice, the GUP in force did not trigger the bar in these areas, and the draft would.
- **The City has never said it outright.** It has never said in terms "the freeze already exists" or "the freeze is new". This matches what a sibling researcher found in the same documents (see `gup_text_in_force_vs_draft.md`).

### Gaps
- **No press on the freeze.** Searches of Slobodna Dalmacija, Dalmacija Danas, Dalmatinski portal, Index, HRT and tportal, on terms such as zabrana gradnje, moratorij, UPU, Kila, Mostine and sanacija, found no article explicitly about a pending building freeze in the eastern suburbs. Slobodna Dalmacija's paywalled archive could not be searched directly.
- **Council minutes not read.** I did not read the full minutes of the October 2025 thematic session; I relied on split.hr and HRT summaries.

## 4. What do the public-consultation reports say about being unable to build until a UPU?

### Takeaway
In the 2024 consultation (report of 26 Mar 2025, 426 pp.) only **one** objection explicitly asks to lift the draft's "nemogućnost donošenja akata o gradnji do donošenja UPU-a": no. 208, refused on classification grounds. The City's replies say three things:
- the urban-rule concept is **unchanged** from the GUP in force; only the term "urbana obnova" was aligned with the law's "sanacija"/"preobrazba";
- the new UPUs are "sanacijski" plans required by law;
- in the GUP in force, the 3.1 parameters act as "mehanizam zaštite prostora do donošenja planova užeg područja". That implies direct building under those parameters pending the plans.

The repeat consultation of May 2025 (report of 2 Sep 2026) contains **no** objection about a UPU freeze.

### Cited findings
**2024 report: scale and the county's warning**
- **Scale:** the 2024 consultation drew 510 submissions: 17 public bodies, 8 users, 261 natural and legal persons ([Izvješće o ponovnoj javnoj raspravi, Prilog 2, p. 11](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-ponovnoj-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-za-ponovnu-javnu-raspravu)).
- **No. 8(b), the county environment department:** it questioned the "33 nova UPU-a". It argued "površine pod UPU-ima u najvećoj mjeri izgrađene" and that such plans "često … ostaju 'mrtvo slovo na papiru', a prostor unutar obuhvata tih planova se najčešće do njihova donošenja devastira bespravnom izgradnjom".
- **The City's reply:** "Broj planova užeg područja čija se izrada propisuje je nešto reduciran u odnosu na važeći GUP … Situacija u kojoj Generalni urbanistički plan postaje provedbeni dokument je anomalija u sustavu planiranja". The strategic-study annex adds: "Novoplanirani UPU-i imaju status sanacijskog plana ili plana urbane preobrazbe što je zakonom propisana obveza" ([Izvješće 26 Mar 2025, pp. 148, 322–323](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-i-strateskoj-studiji-o-utjecaju-na-okolis-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita)).

**2024 report: the individual replies**
- **No. 73, point 28** (a designer's comment on footprint limits). Reply: "Važeći prostorni plan daje u urbanim pravilima (1.3, 1.5, 3.1, 3.2) parametar 'maksimalna tlocrtna površina pod nadzemnim dijelom građevine za slobodnostojeće građevine' … u nisko konsolidiranim područjima, koja su urbano neopremljena, služi kao mehanizam zaštite prostora do donošenja planova užeg područja" (same report, p. 194).
- **No. 107** (proposal to redefine rule 3.1 as "ruralna sanacija"). Reply: "Osnovni koncept urbanih pravila nije mijenjan u odnosu na važeći Plan … samo je termin 'urbana obnova' usklađen s pojmovima iz Zakona o prostornom uređenju – 'sanacija' i 'preobrazba'" (same report, pp. 213–214).
- **No. 70** (building in a D-zone between the hospitals). Reply: under the GUP in force business uses there were conditioned on a competition and a UPU. It then says "ne radi se o zoni urbane preobrazbe, sanacije niti neuređenom građevinskom području za koje bi bila obvezna izrada UPU-a". So direct-application parameters are added "kako bi se omogućila neposredna provedba" (same report, p. 188). This is the City's operating logic: a UPU is obligatory, and blocks direct building, only in the three statutory categories.
- **No. 208:** see section 2.

**Other related objections (none is about a UPU freeze on houses)**
- Nos. 47–48, 128, 142 and 150 (Bilice II rezoning; covered in the earlier report).
- No. 106: "urbana sanacija" wording in čl. 75 for Žnjan. The reply points to the DPU in force and says deadlines for narrower plans are "nije predmet generalnog urbanističkog plana".
- No. 193: a house on  under UPU Šine–Vidovac. Reply: "nije predmet izmjene i dopune GUP-a nego prostornog plana užeg područja".
- No. 51: a Vidovac monastery access road blocked by legalised buildings.

Source: same report.

**2025 repeat consultation**
- **Scale:** 30 submissions (8 public bodies, 22 persons) plus 2 late. Comments were allowed only on parts changed after the first consultation (ZPU čl. 104).
- **Keyword search found no freeze objection.** The only "akata o gradnji" / "sanacija" hits concern the deleted Put Sirobuje road corridor (no. 14).
- **The Put Sirobuje reply:** the City explains that the corridor "i dalje formalno postoji – ucrtan je u važeći Urbanistički plan uređenja područja Sirobuja". It adds that ISPU's "žute točke" (acts 1968–2015) were digitised by MPGI from 2022, with possible location errors.
- **Other finding:** no objection about Dračevac, Bilice or Harakovac.

Source: [Izvješće o ponovnoj javnoj raspravi, 2 Sep 2026, pp. 2, 44, 55–67](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-ponovnoj-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-za-ponovnu-javnu-raspravu); [PDF](https://split.hr/DesktopModules/EasyDNNNews/DocumentDownload.ashx?portalid=0&moduleid=2192&articleid=23082&documentid=16565).

### Inferences
- **The draft's freeze drew almost no attention.** Very few objectors raised it, possibly because the draft's freeze is buried in map 4.d plus čl. 103/105, not stated in plain words. The City never explained in a reply whether owners in sanation areas could build today. No. 73's reply implicitly treats the GUP in force as allowing direct building (with parameters) pending the plans.

### Gaps
- **No objection-by-objection read.** My search was by keyword ("UPU", "sanacij", "do donošenja", "zabran", "akata o gradnji", "nemogućnost", place names), so objections using other words could be missed.
- **Missing annex.** The attached graphic annexes of objections (e.g. no. 208's parcel map) are not published.

## 5. How much of the recent stock is legalised vs permitted vs illegal after 2011?

### Takeaway
In the draft UPU areas studied, legalisation decisions (rješenja o izvedenom stanju, mostly issued 2013–2016) outnumber new-build permits by more than 15 to 1:
- **:** ~120 legalisation decisions vs 6 new-build permits
- **Mostine:** ~146 vs 5
- **Kila:** ~200 vs 12
- **Western Kamen:** ~170 vs 14
- **Harakovac:** ~25 vs 0

Citywide, Split received ~13,600 legalisation requests by 2016, and the City later spoke of ~15,000 "novih postojećih" buildings. I found no statistics on illegal building after the 21 Jun 2011 cut-off in these neighbourhoods.

### Cited findings
**ISPU "Akt za uporabu" layer: legalisation decisions dated 2012–2026**

| Area | Legalisation decisions | Of which refused | Undated |
|---|---|---|---|
| — | 120 | 4 | +12 |
| Mostine | 146 | 0 | +13 |
| Harakovac | 25 | 1 | +3 |
| Kila | 200 | 0 | +21 |
| Kamen zapad | 170 | 1 | +23 |
| Dračevac kvart | 134 | 4 | — |
| Bilice kvart | 64 | 0 | — |

- **By year** (the five UPU areas together): 2013: 59; 2014: 268; 2015: 183; 2016: 62; 2017: 35; 2018: 17; after 2018 single digits.

Source: [ISPU](https://ispu.mgipu.hr/); harvested counts, minimums.

**Citywide figures**
- **2016:** Split had received 13,608 legalisation cases, resolved 8,660 (86.83%), and issued 6,786 positive decisions, with 268 rejected. The legalisation surplus was earmarked for roads "in the eastern part of the city" (Teo Vojković, [Index.hr, 3 Feb 2016](https://www.index.hr/vijesti/clanak/split-rijesio-86-posto-zahtjeva-za-legalizaciju-u-drzavni-proracun-se-slilo-156-milijuna-kuna/872620.aspx)).
- **2025:** "cca 15000 'novih postojećih' građevina" from legalisation since 2012 ([Obrazloženje, April 2025, p. 25](https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/3_%20Obrazlozenje.pdf)).

**Ongoing legalisation disputes.** Refused legalisations are still being litigated in 2025–2026: several Upravni sud u Splitu judgments uphold refusals under the illegal-buildings act čl. 6(1) (zone conflicts, mostly Marjan/public-use), e.g. [Us I-1274/2025-8](https://odluke.sudovi.hr/Document/View?id=fa92a950-2b8e-4608-aa7a-8bf077428b52) and [Us I-1344/2025-6](https://odluke.sudovi.hr/Document/View?id=aa7e8689-bc9e-4070-bba7-004797df6831).

**Building inspection.** Public reporting found concerns Marjan, not the eastern suburbs:
- In 2024 the City sent the building inspection a priority list of 47 buildings on Marjan.
- Deputy mayor Bojan Ivošević said one demolition was being carried out "čak 7 godina nakon pravomoćnosti" ([Baustela, 2 Sep 2024](https://baustela.hr/novosti/budenje-drzavnog-inspektorata-zapocelo-rusenje-bespravne-gradnje-u-splitu/)).
- One ISPU-linked inspection case in the courts concerns a 2024 removal order for an illegal extension to a legalised house ([Us I-1824/2024-12, 24 Jul 2025](https://odluke.sudovi.hr/Document/View?id=11bb0b81-f388-42e7-8a8f-3a2c49da3e46)).

**Orthophoto comparison, Dračevac NE.** DGU orthophotos compared: DOF5 2011, the legalisation reference image (`https://geoportal.dgu.hr/services/dof/wms`, layer DOF5_2011), and the 2025/26 orthophoto (`https://geoportal.dgu.hr/services/inspire/orthophoto_2025_2026/wms`). Nearly all houses of the NE Dračevac cluster are already present in 2011. The post-2011 changes visible at 0.6 m/pixel are infill on individual plots, several of which coincide with the permits in section 1. This is my visual comparison, not a count.

### Inferences
- **The stock is mostly legalised, not permitted.** Most of the building stock in these sanation areas is pre-2011 construction legalised in 2013–2016, not buildings built with permits. In Dračevac, the permitted new builds since 2014 number in single digits.
- **Two corrections to the resident's picture.** The belief that "many new buildings were built there in the last 10 years (with permits)" is right about permits being issued, and in Kila, Kamen, Orišac and Stobreč also about multi-flat blocks. For Dračevac the absolute numbers are small. A good part of what may look "new" is legalised pre-2011 stock, or completion and extension of legalised houses.

### Gaps
- **No official neighbourhood figures.** There are no official counts of post-2011 illegal buildings, or of inspection cases, per mjesni odbor or gradski kotar (Mejaši, Kamen, Pujanke, Sirobuja…). I found no such statistic.
- **No city-level permit statistics.** The DZS publishes permit statistics, but I did not extract Split-level series. They would not separate UPU areas anyway.
- **No building count.** A proper count of buildings present in 2025 but absent in 2011 would need a footprint-change analysis (DOF 2011 vs 2025/26). I did not do one.

## 6. The earlier report's open item: does the City in practice refuse permits for new houses in residential Dračevac today?

### Takeaway
No, according to the Ministry's register. In residential NE Dračevac, inside the 4.c "obveza izrade UPU" area and the draft's "UPU ", the City issued:
- new-build permits in 2021 (×2), 2022, 2023 and 2025 (×2);
- location permits in 2023 and 2024;
- a building-permit amendment in July 2026.

One new-build application is in processing. The only refusal seen is one location permit on 10 Apr 2025 ("Novogradnja"), grounds unknown, and a new application for the same parcel is pending. So the "freeze" under the GUP in force exists on paper in the text reading, but not in practice. The freeze neighbours fear would come only if the draft (čl. 103(1) + map 4.d sanacija shading) is adopted.

### Cited findings
**The Dračevac acts**
- **New-build permits:**
  - UP/I-361-03/20-01/000010 (17 Mar 2021)
  - UP/I-361-03/21-01/000049 (6 Jul 2021)
  - UP/I-361-03/21-01/000240 (21 Jul 2022)
  - UP/I-361-03/19-01/000158 (4 May 2023)
  - UP/I-361-03/23-01/000111 (30 Jan 2025)
  - UP/I-361-03/22-01/000095 (14 May 2025)
- **Location permits:** UP/I-350-05/21-01/000045 (29 Mar 2023) and UP/I-350-05/23-01/000022 (23 Aug 2024).
- **Amendments:**
  - UP/I-350-05/26-01/000004 (14 Apr 2026, location permit)
  - UP/I-361-03/26-01/000082 (27 Jul 2026, building permit)
- **Refused location permit:** UP/I-350-05/23-01/000050 (10 Apr 2025).
- **Pending:** UP/I-361-03/25-01/000080, UP/I-350-05/26-01/000041 and UP/I-350-05/26-01/000034 (the last is business use).
- **Where they sit:** all inside the 4.c blue grid. On draft 4.d, the 2021 (×2) and 2023 permits and the pending 409/4 application sit on "urbana sanacija"; the 406/x cluster (2022, 2025 ×2) sits on unshaded land.

Source: [ISPU](https://ispu.mgipu.hr/); [4.c](https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId=3179&Command=Core_Download); [4.d](https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/4_d%20Podrucja%20i%20dijelovi%20primjene%20planskih%20mjera%20zastite.pdf); figure `split_permit_practice - 4c Dracevac Mostine.jpg`.

**Who issued them.** The issuing body in the records is "Grad Split, Upravni odjel za urbanizam, prostorno uređenje i zaštitu okoliša, Odsjek za izdavanje akata prostornog uređenja i gradnje". In a 2023 court case it appears as "Upravni odjel za urbanizam i izgradnju, Odsjek za izdavanje akata prostornog uređenja i gradnje" ([ISPU](https://ispu.mgipu.hr/); [Usž-1673/2025-2](https://odluke.sudovi.hr/Document/View?id=374c17d6-cd8d-4760-818a-1750cf04d600)).

### Inferences
- **What to tell neighbours.** Today an owner in residential Dračevac can, and recently did, obtain a building permit for a new house or small residential-business building under the GUP's direct parameters. The draft would end that on the parcels it shades as urbana sanacija or neuređeno.
- **How the proposal should be framed.** The earlier report's framing, "the freeze is already the City's rule", should be qualified. It is arguably the text of the GUP in force, but it is not the City's practice. The real change would come with the 2025 draft if adopted. The earlier report's recommendation to ask that residential Dračevac be a "preporuka" area, or be left unshaded, therefore targets the actual source of a future freeze.

### Gaps
- **The refusal's grounds.** Whether the 10 Apr 2025 Dračevac location-permit refusal had anything to do with the UPU obligation is unknown without the decision text. A request to the Upravni odjel, or to the applicant, would settle it.

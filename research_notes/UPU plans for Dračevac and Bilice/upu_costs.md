# Cost of producing a UPU (Urbanistički plan uređenja) in Croatia, focused on Split

Research date: 23 Sept 2026. Currency rule: pre-2023 HRK figures are converted at 7.53450 HRK/EUR. "bez PDV-a" means VAT (25%) is excluded. Every figure below is labelled verified (with a URL) or inference.

Overall picture: I found **no published per-plan contract value for any City of Split UPU**, whether in media, city web pages or searchable EOJN summaries. Split's plan decisions only say "financira se iz Proračuna Grada Splita". What the evidence does show is two very different price levels:
- **(a) The price public buyers actually pay.** Recent contracts and estimates for a UPU, or for amendments to one, mostly fall between about **€15,000 and €30,000 without VAT**. They bunch just under the €26,540 limit for simple procurement (*jednostavna nabava*) and the €30,000 NPOO grant cap.
- **(b) The architects' chamber (HKA) tariff.** For a new 50–200 ha residential UPU at 1:1000 it gives roughly **€65k–€255k (about €1,050–1,550/ha)**, using the tariff's implied rate of about 120 HRK (€16) per standard hour ("norma sat", the chamber's unit of estimated work). It gives about twice that at today's hourly rates.

Supporting studies and the geodetic base are extra in both cases.

---

## 1. What did the City of Split pay for specific UPUs?

### Takeaway
Split's decisions to start plans (*odluke o izradi*) name the city budget as the funder but give no amount. There is no per-contract figure online for UPU Bilice, Šine–Vidovac, Žnjan, Kila or the GUP amendments. Split's payment-transparency database does show payments to planning firms, but it doesn't say which plan each payment was for.

### Cited Findings
- **UPU northwest of the Put Stinica / Put Supavla junction (Lovret), decision of 23 March 2023, Službeni glasnik Grada Splita 23/2023:** Art. 12 says "Izrada Plana financirat će se iz Proračuna Grada Splita za 2023. godinu". No amount is given.
  - The UPU is drawn at 1:1000 on a cadastral-geodetic base ("katastarsko geodetskoj podlozi u HTRS … u mjerilu 1:1000").
  - The county ruled that neither a screening for strategic environmental assessment (SPUO) nor a full SPUO is needed.
  - An urban-architectural design competition was held first, and the winning entry (Kezić & Šverko) is a binding input to the plan. This means the city bought a competition in addition to the UPU.
  - Source: [Službeni glasnik Grada Splita 23/2023 – Odluka o izradi UPU Put Stinica/Put Supavla](https://split.hr/Portals/0/adam/Contents/l9lHOskPX061RyqHuugxXQ/Link/Odluka%20o%20izradi%20Urbanisti%C4%8Dkog%20plana%20ure%C4%91enja%20podru%C4%8Dja%20sjeverozapadno%20od%20kri%C5%BEanja%20ulica%20Put%20Stinica%20i%20Put%20Supavla.pdf)
- **Amendments (izmjene i dopune, "ID") to DPU radne zone Dračevac, decision of 11 Aug 2022, Sl. gl. 41/2022:** the area is about **15.27 ha**, and Art. 12 says it is "financirat će se iz Proračuna Grada Splita za 2022. godinu". No amount is given. Source: [Odluka o izradi ID DPU radne zone Dračevac (MPGI copy)](https://mpgi.gov.hr/UserDocsImages/Zavod/Odluke_o_izradi/Splitsko_dalmatinska/22_09_13_DPUrzDracevac-ID.pdf)
- **UPU Šine–Vidovac:** the plan text says CPA d.o.o. (Zagreb) was selected through public procurement after the 2008 decision (Sl. gl. 16/08). The price is not stated in the snippet. Source: [UPU područja Šine (split.hr)](https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?language=hr-HR&Command=Core_Download&EntryId=3307&PortalId=0)
- **Split's "Planovi u izradi" page** lists the plans now in preparation, with no financing amounts:
  - ID PPUGS and ID GUP (decision 44/21)
  - UPU Put Stinica/Put Supavla (2023)
  - UPU Turska kula (2025)
  - UPU Slatine 4 (2025)
  - UPU gradske luke Istočna obala (2025)

  Source: [split.hr – Planovi u izradi](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/planovi-u-izradi)
- **Split's iTransparentnost portal** publishes every payment from the city budget, searchable by recipient. It is available as an open JSON API (`api.otvorenigrad.hr/itransparentnost/isplate`, header `LC-Tenant: grad-split`). I queried it on 23 Sept 2026. Payment records carry an account code (konto) but **no project description**. The totals below are gross cash payments, probably including VAT:
  - URBOS d.o.o. (Split): 3 payments, **€6,990.18** total. These were 2021 (€1,659.04 + €2,046.25, konto 4263) and 11 May 2023 (€3,284.89, konto 4264 "Ostala nematerijalna proizvedena imovina").
  - GISPLAN d.o.o. (Split; the maker of recent Split PPU amendments): 7 payments, **€45,194.60**, 2021–2024, konta 3237/4263.
  - PORTICUS d.o.o.: 1 payment, **€21,568.89**, 2023, konto 3237. Porticus prepared the Žnjan/Duilovo UPU proposal.
  - AG PLANUM d.o.o.: €640.39, 2022, konto 4264.
  - Environmental consultancies: OIKON d.o.o. **€32,268.24** (2022–23) and DVOKUT ECRO d.o.o. **€86,231.00** (2023–26, 15 payments).
  - Survey firm Geoprojekt d.d.: €267,054 (2021–26), which mixes many kinds of work.
  - Source: [iTransparentnost – Grad Split](https://transparentno.moj.split.hr/isplate). After about 25 queries the API began returning "Forbidden", so the search was not exhaustive.
- **Firms linked to Split's PPU amendments:** URBOS d.o.o. and GISplan d.o.o. are named as makers of the PPU grada Splita amendments. Source: [split.hr – ID PPUGS](https://www.split.hr/gradska-uprava/gradsko-vijece/sjednice-gradskog-vijeca/lgs.axd?t=16&id=18407)

### Inferences
- The small, spread-out payments (for example URBOS €7k over three years) fit the pattern of plans paid in phase instalments. A common split is 30% on signing, 40% after public consultation and 30% on the final proposal (see Bol, section 2). This also suggests Split's contracts per plan are in the tens of thousands of euros, not hundreds of thousands. This is inference, because the payments cannot be tied to a named plan.
- The city usually runs an urban-architectural design competition before a UPU, as with Put Stinica/Put Supavla, Žnjan/Duilovo and Gredelj/Zagrepčanka in Zagreb. Competitions have their own budget (see Zagreb in section 2). A residents' initiative should budget for one only if it wants a design-led plan.

### Gaps
- No Split contract (ugovor) value was found for UPU Bilice sjever, Bilice II–Mostine, Šine–Vidovac, Žnjan, Kila or ID GUP. The EOJN (eojn.nn.hr) notices and the city's register of contracts (registar ugovora) could not be searched through the tools available. The next step is to download Split's "Registar ugovora" / "Plan nabave" from EOJN and filter CPV 71410000-5 (urban planning services).
- The iTransparentnost dataset has a contracts view, but the city has switched it off (`prikazUgovora:false`), so payments can't be linked to contracts.
- Line items in Split's budget (positions for "prostorno-planska dokumentacija") were not extracted.

---

## 2. What do comparable Croatian cities pay? (€/ha where possible)

### Takeaway
Recent public prices for a UPU, or for amendments to one, are low and cluster around €15k–€30k without VAT. That is because buyers stay under the simple-procurement limit (€26,540 for services) and the NPOO grant cap (€30,000). Hardly any source gives both a price and an area, so a reliable market €/ha figure could not be calculated.

### Cited Findings
- **Zagreb, 2023 procurement plan (Plan nabave 2023):** item 512-2023-EBV "IZRADA URBANISTIČKOG PLANA UREĐENJA ISTOČNI KOLODVOR" is estimated at **€26,500**, CPV 71240000-2, simple procurement. Procurement plans state values without VAT.
  - The same plan also lists:
    - "Stručna podloga prostornih planova – šume i šumsko zemljište" (a forestry study supporting spatial plans), €42,400, open procedure
    - Running urban-architectural competitions (Zagrepčanka, Gredelj), €26,600 each
    - "Izrada prostornih podloga" (spatial base maps), €6,250
  - Source: [Grad Zagreb – Plan nabave 2023](https://www.zagreb.hr/UserDocsImages/Nabava/PLAN%20NABAVE%202023.pdf)
- **Općina Bol, 2014:** one tender covering both the 2nd ID of PPUO Bol **and** ID of UPU naselja Bol.
  - Estimated value **135,000 HRK bez PDV (≈ €17,918)**, 185 days.
  - Payment 30% on signing, 40% after public consultation, 30% on the final proposal.
  - Source: [Općina Bol – Javna nabava UPU Bol](https://opcinabol.hr/javna-nabava-upu-bol/)
- **Općina Blato (Korčula), 2025 capital-investment report:** a grant of **€18,000** for ID UPU Krtinja and €30,000 for a full new-generation ID PPUO, both through "ePlanovi". €10,737.50 was actually spent on plans in 2025. Source: [Općina Blato – Izvješće o realizaciji kapitalnih ulaganja 2025](https://www.blato.hr/dokumenti/materijali-za-sjednicu/materijali-za-sjednice-2026-godina/materijali-za-10-sjednicu-vijeca-1/2541-izvj-kap-ulag-2025/file)
- **Grad Pula, NPOO ePlanovi 2024–2025:** **€186,000 (100% grant)** covers ID PPUG, ID GUP **and seven UPUs**, which is 9 plans at about €20.7k each on average. Source: [Grad Pula – ePlanovi](https://www.pula.hr/hr/novosti/gradski-projekti/detail/27581/izrada-prostornih-planova-nove-generacije-putem-elektronickog-sustava-eplanovi/)
- **Općina Vrbanja, 2024:** ID PPUO estimated at **€20,800 bez PDV**, 12 months. The notice says services under **€26,540** are exempt from the formal procurement procedure. Source: [fondovieu.gov.hr – nabava 2105](https://fondovieu.gov.hr/nabave/2105)
- **State co-financing in Split-Dalmatia County, 2018 (MPGI):** 11 contracts worth 408,630 HRK in total, each capped at 50% of the plan price. Because the grants are at most half the price, the implied minimum plan prices are:

  | Plan | Grant (HRK) | Implied total plan price |
  |---|---|---|
  | UPU "Srida Sela", Tučepi | 14,750 | ≥ 29,500 HRK (≈ €3,915) |
  | UPU groblja Osoje, Dicmo | 9,375 | ≥ 18,750 HRK (≈ €2,489) |
  | UPU naselja Podhumlje–jug, Komiža | 12,190 | ≥ 24,380 HRK (≈ €3,236) |

  Source: [MGIPU – Split: Za izradu 11 prostornih planova više od 408 tisuća kuna](https://mpgi.gov.hr/print.aspx?id=7391&url=print&page=1)
- **Grad Vis:** contract with Urbanistički institut Hrvatske for UPU Parja–Rogačić (port) and UPU poslovne zone Parja. Split-Dalmatia County co-financed it. No value is published. Source: [Grad Vis – Prostorni i urbanistički planovi](https://www.gradvis.hr/prostorni-i-urbanisticki-planovi/)
- **Zadar (unverified, search snippet only):** a 2024 contract with a Split firm for a UPU concept design and amendments to an existing UPU was reported at about €15,000. The source page (057info.hr, 6 Nov 2025) returned 403 and could not be checked. Source: [057info](https://www.057info.hr/vijesti/2025-11-06/bobo/)
- **HKA worked examples, 2012, under the 1999 tariff (NN 85/99), "kn neto" = without VAT.** These are the chamber's official tariff prices, not market prices:

  | Example | Scale | HKA range (HRK) | € equivalent | €/ha |
  |---|---|---|---|---|
  | UPU of a whole settlement, 150 ha, ~7,000 residents | 1:2000 | 973,000–1,167,000 | €129k–155k | ≈ €860–1,030 |
  | Coastal UPU with protected urban core, 26.34 ha | 1:1000 | 337,000–405,000 | €44.7k–53.8k | ≈ €1,700–2,040 |
  | Mixed-use K/T zone, 11.18 ha | not stated | 115,000–137,000 | €15.3k–18.2k | ≈ €1,370–1,630 |
  | Warehouse/service zone, 22.24 ha | 1:1000 | 217,600–261,400 | €28.9k–34.7k | ≈ €1,300–1,560 |
  | Tourist-zone UPU, 128 ha | 1:2000 | 846,600–1,015,000 | €112k–135k | ≈ €880–1,050 |

  Source: [HKA – Primjeri izračuna cijene usluge izrade dokumenata prostornog uređenja (2012)](https://www.arhitekti-hka.hr/files/file/pdf/2012/URBANIZAM_CIJENE.pdf)

### Inferences
- The 2023–2025 public prices are well below the HKA tariff, by a factor of 3–10. Zagreb's Istočni kolodvor estimate (€26,500) sits exactly under the €26,540 limit. That suggests buyers set the scope to fit simple procurement, or pay only for the amendments/final phases, rather than paying the tariff. A first-time UPU for a 50–200 ha lived-in residential area (Dračevac, Bilice) needs more work than an amendment. It is unlikely to be done well for under about €25k, and a realistic public-sector price is about **€30k–€80k bez PDV** for the plan alone. This is inference: I found no Split contract with an area to anchor it.
- Most of the "€18–30k" figures are **amendments (ID)** financed by NPOO, not new UPUs, and NPOO caps grants at €30k. They set a floor, not a benchmark for a new residential UPU.

### Gaps
- No verified contract gives **both** a € value and an area in ha for a new residential UPU in Solin, Kaštela, Trogir, Omiš, Makarska, Šibenik, Rijeka or Poreč. The area of UPU Istočni kolodvor wasn't retrieved, so its €/ha can't be computed.
- EOJN award notices (obavijesti o sklopljenim ugovorima) are the best source for the next pass.

---

## 3. Ancillary costs (geodetic base, SPUO, conservation, traffic and landscape studies, public consultation)

### Takeaway
The HKA standard explicitly leaves these outside the planner's fee ("posebno se ugovara", i.e. contracted separately), and Split sometimes adds a design competition. Almost no published unit prices were found. For Split the environmental assessment may not be needed: the county waived both screening and full SPUO for the Put Stinica UPU.

### Cited Findings
- **HKA Pravilnik 2013, Art. 37 §6:** research and documentation work — including "Znanstvena dokumentacija", "Stručne podloge (sektorski planovi, sektorske studije)", "Valorizacija prostorne dokumentacije", "Idejna rješenja zgrada" and "Idejna rješenja prometnica i infrastrukture" — is **"posebno se ugovara"**. Art. 5 says preliminary works ("Prethodni radovi") are not included in the plan price. Managing the whole job ("vođenje izrade") is **10–20%** of the planning price. Source: [HKA Pravilnik o standardu usluga arhitekata 2013](https://arhitekti-hka.hr/files/file/komora/akti/pravilnici/Pravilnik-o-standardu-usluga-arhitekata-HKA-2013.pdf)
- **Geodetic base:** Split's UPUs are drawn at 1:1000 on a cadastral-geodetic base in the HTRS coordinate system ([Odluka UPU Put Stinica/Supavla](https://split.hr/Portals/0/adam/Contents/l9lHOskPX061RyqHuugxXQ/Link/Odluka%20o%20izradi%20Urbanisti%C4%8Dkog%20plana%20ure%C4%91enja%20podru%C4%8Dja%20sjeverozapadno%20od%20kri%C5%BEanja%20ulica%20Put%20Stinica%20i%20Put%20Supavla.pdf)). The only priced "spatial base" item found was Zagreb's 2023 "Izrada prostornih podloga za potrebe planiranja i razvoja grada", **€6,250** ([Zagreb Plan nabave 2023](https://www.zagreb.hr/UserDocsImages/Nabava/PLAN%20NABAVE%202023.pdf)).
- **Pag, 2016 contract register:** Geodetski zavod Rijeka received 100,000 HRK (≈ €13,272) for ongoing updates to the city's GIS spatial-management system (Atlas 14). This is GIS work, not a UPU base. Source: [Grad Pag – evidencija ugovora 2016](https://pag.hr/images/evidencija_ugovora/2ugg2016.pdf)
- **SPUO / screening:** Split-Dalmatia County decided that UPU Put Stinica/Put Supavla needs neither a screening nor a full SPUO (opinion of 10 March 2023) ([Odluka](https://split.hr/Portals/0/adam/Contents/l9lHOskPX061RyqHuugxXQ/Link/Odluka%20o%20izradi%20Urbanisti%C4%8Dkog%20plana%20ure%C4%91enja%20podru%C4%8Dja%20sjeverozapadno%20od%20kri%C5%BEanja%20ulica%20Put%20Stinica%20i%20Put%20Supavla.pdf)). Split paid environmental consultancies OIKON €32,268 (2022–23) and DVOKUT ECRO €86,231 (2023–26). Which projects these were for is not given ([iTransparentnost](https://transparentno.moj.split.hr/isplate)).
- **Other supporting studies (Zagreb 2023):** a sector study for spatial plans on forests, **€42,400**; running an urban-architectural competition, **€26,600** ([Zagreb Plan nabave 2023](https://www.zagreb.hr/UserDocsImages/Nabava/PLAN%20NABAVE%202023.pdf)).
- **Investor-paid supporting studies (Rijeka, Krnjevo 2016–17):** the investor separately paid Arhitektonski biro Turato and Urbanistički studio Rijeka for "analize, stručne podloge i projekte". The city accepted these as the basis for the plan. Source: [Grad Rijeka – Ugovor o financiranju izrade UPU Krnjevo](https://www.rijeka.hr/wp-content/uploads/2017/03/Zaklju%C4%8Denje-Ugovora-o-financiranju-izrade-Urbanisti%C4%8Dkog-plana-ure%C4%91enja-dijela-podru%C4%8Dja-Krnjevo-s-trgova%C4%8Dkim-dru%C5%A1tvom-ARTURUS-VERONA-d.o.o..pdf)

### Inferences
Planning ranges for a 50–200 ha lived-in area in Split (inference, bez PDV; none found as published unit prices):
- **Geodetic base, 1:1000:** probably the biggest extra, roughly €150–400/ha, so €10k–60k.
- **SPUO:** a screening elaborate costs a few thousand €. A full strategic study costs €15k–40k and is likely avoidable for a residential UPU consistent with the GUP, as at Put Stinica.
- **Conservation input:** €3k–10k, and only if heritage (e.g. old village cores) is present. That is relevant for Bilice/Mostine and parts of Dračevac.
- **Traffic study:** €5k–20k.
- **Landscape study:** €5k–15k.
- **Public consultation:** costs are negligible, mainly the notice in Slobodna Dalmacija, venue and printing, and are usually inside the planner's fee (HKA Art. 4 §7 includes attending meetings).
- **Design competition (optional):** €25k–60k including prizes.

### Gaps
- No published tender or price list for a posebna geodetska podloga per ha for UPU purposes, for an SPUO strategic study, or for konzervatorska podloga was found. The next step is EOJN, CPV 71355000 (surveying) and 90711000 (environmental assessment).

---

## 4. Who pays: city budget vs. an interested party (Art. 167–168 ZPU); state/EU co-financing

### Takeaway
By default the city pays. A landowner or other interested party may pay part or all of the cost through a financing contract (*ugovor o financiranju*, Art. 167 ZPU). Only when **all** owners in the plan area fund it **fully** may they pick and pay the planner directly (Art. 168 §1). Every Split decision found names the city budget. Rijeka's Krnjevo is a documented investor-financed example. State co-financing (MPGI, 50% cap, 2018) and NPOO (up to €30k per plan, 100%, 2024) have existed but mostly go to amendments.

### Cited Findings
- **MPGI opinion 350-01/20-02/190 (19 May 2020):**
  - Art. 167 §1 ZPU lets "vlasnik zemljišta … ili druga zainteresirana osoba" bear all or part of the cost of a UPU through a financing contract (ugovor o financiranju uređenja građevinskog zemljišta) with the city.
  - Art. 168 §1 allows the funders to choose and pay the planner directly only when the UPU covers land whose owners "u cijelosti financiraju njegovu izradu".
  - Partial financing by some owners does not remove public-procurement rules.
  - Source: [MPGI – Ugovor o financiranju uređenja građevinskog zemljišta i izrada UPU-a](https://mpgi.gov.hr/pristup-informacijama-16/zakoni-i-ostali-propisi/upute-objasnjenja-i-misljenja-3987/zakon-o-gradnji/ugovor-o-financiranju-uredjenja-gradjevinskog-zemljista-i-izrada-upu-a/7048)
- **Rijeka, UPU Krnjevo (2016–2017):**
  - The decision to start the plan (Sl. novine Grada Rijeke 13/16, Art. 9) said it would be "financirati isključivo iz sredstava investitora".
  - The investor ARTURUS VERONA d.o.o. contracted Urbanistički studio Rijeka directly on 1 June 2016.
  - The city signed a financing contract based on Art. 63 §2, 167 and 168 ZPU. It must be published in the city's official gazette.
  - The city's role was described as guaranteeing the investor that the plan would be adopted "što je kvalitetnije i brže moguće".
  - The contract amount is not in the published document.
  - Source: [Grad Rijeka – Krnjevo](https://www.rijeka.hr/wp-content/uploads/2017/03/Zaklju%C4%8Denje-Ugovora-o-financiranju-izrade-Urbanisti%C4%8Dkog-plana-ure%C4%91enja-dijela-podru%C4%8Dja-Krnjevo-s-trgova%C4%8Dkim-dru%C5%A1tvom-ARTURUS-VERONA-d.o.o..pdf)
- **Art. 63 §2 ZPU:** money for plans adopted by the city council comes "iz sredstava državnog proračuna, proračuna jedinica lokalne i područne (regionalne) samouprave te iz drugih izvora" (quoted in the Krnjevo document above).
- **Split practice:**
  - UPU Put Stinica/Supavla: city budget 2023 ([Odluka](https://split.hr/Portals/0/adam/Contents/l9lHOskPX061RyqHuugxXQ/Link/Odluka%20o%20izradi%20Urbanisti%C4%8Dkog%20plana%20ure%C4%91enja%20podru%C4%8Dja%20sjeverozapadno%20od%20kri%C5%BEanja%20ulica%20Put%20Stinica%20i%20Put%20Supavla.pdf))
  - ID DPU radne zone Dračevac: city budget 2022 ([Odluka](https://mpgi.gov.hr/UserDocsImages/Zavod/Odluke_o_izradi/Splitsko_dalmatinska/22_09_13_DPUrzDracevac-ID.pdf))
  - ID PPUGS/GUP: city budget ([Odluka 44/21, MPGI copy](https://mpgi.gov.hr/UserDocsImages//Zavod/Odluke_o_izradi/Splitsko_dalmatinska//21_10_06_PPUGSplit-ID.pdf))
- **State co-financing, 2018:** MPGI co-financed local plans in Split-Dalmatia County "najviše do 50% od ukupnog iznosa cijene izrade plana". 3 of the 11 grants were UPUs (Tučepi, Dicmo, Komiža). Source: [MGIPU 2018](https://mpgi.gov.hr/print.aspx?id=7391&url=print&page=1)
- **NPOO "ePlanovi" (NPOO.C2.3.R3-I7.01), 2024:**
  - Grants of **€1,000–€30,000 per project**, 100% intensity, for local governments.
  - The total allocation grew €11M → €14M → €17M.
  - Applications ran 1 Feb – 30 June 2024.
  - It covers PPUO/PPUG, GUP and UPU; a UPU is eligible only if the higher-level plan is also submitted.
  - Sources: [fondovieu.gov.hr – poziv 93](https://fondovieu.gov.hr/pozivi/93); [MPGI – Javni poziv ePlanovi](https://mpgi.gov.hr/UserDocsImages/17365)
- **County co-financing:** Split-Dalmatia County co-financed Vis's UPUs. Source: [Grad Vis](https://www.gradvis.hr/prostorni-i-urbanisticki-planovi/)

### Inferences
- A **residents' initiative** can't realistically use Art. 168 direct selection, because that needs all owners to finance the plan fully. Its options are:
  - (a) asking the city to fund the plan from the budget, which is the standard route in Split;
  - (b) a partial-financing contract under Art. 167, with the city still running the procurement;
  - (c) paying for a preliminary expert study or design brief itself, as in Krnjevo, which the city may accept as a basis for the plan.
- The NPOO window closed in 2024, and the NRRP ends in 2026. No current state grant for new UPUs was identified.

### Gaps
- No Split UPU financed by a private investor or interested party was found. Other researchers covering the Split UPU inventory may find one, for example in commercial or tourist zones.
- No current (2025–2026) MPGI grant programme for local plans was found.

---

## 5. Published price lists and guidance (HKA)

### Takeaway
Croatia has no legally binding fee scale. The HKA *Pravilnik o standardu usluga arhitekata* (2013) is still in force for spatial plans. It sets the fee as standard hours × the firm's own hourly rate, with the hours taken from area-based "obračunske jedinice" (OJ, points per ha) and a formula. That makes it a transparent, defensible method for estimating cost per hectare.

### Cited Findings
- **Status of the rules:** the 2013 HKA Pravilnik stays in force for spatial plans until a new spatial-planning standard is adopted. The new Pravilnik o standardu usluga arhitekata u području gradnje (NN 48/2025, in force 25 March 2025) covers construction only. Source: [UKAH – Novi Pravilnik (2025)](https://ukah.hr/2025/03/18/novi-pravilnik-o-standardu-usluga-arhitekata-u-podrucju-gradnje/)
- **Fee formula (HKA 2013, Art. 4):**
  - Fee: **Cpl = Ns × Cs**, where Ns is the number of standard hours and Cs is the planner's own hourly rate, "izračunava izvršitelj prema stvarnim troškovima".
  - Hours: **Ns = m × OJⁿ**. For a UPU at 1:1000, m = 0.5358–0.6425 and n = 0.9675–0.9677 (Table 11).
  - Sample points from Table 11: 5,000 OJ → 2,031–2,440 h; 10,000 OJ → 3,972–4,772 h; 20,000 OJ → 7,767–9,332 h; 50,000 OJ → 18,848–22,650 h.
  - Source: [HKA Pravilnik 2013](https://arhitekti-hka.hr/files/file/komora/akti/pravilnici/Pravilnik-o-standardu-usluga-arhitekata-HKA-2013.pdf)
- **Points per ha (HKA 2013, Art. 37), for 1:1000 and 1:2000 UPUs.** Plans at 1:2000 take 15% fewer points.
  - Area band points:

    | Area band | OJ/ha |
    |---|---|
    | <1 ha | 400 |
    | 1–2 ha | 300 |
    | 2–5 ha | 250 |
    | 5–10 ha | 200 |
    | 10–20 ha | 160 |
    | 20–40 ha | 150 |
    | 40–60 ha | 120 |
    | 60–100 ha | 110 |
    | 100–200 ha | 90 |
    | 200–300 ha | 80 |
    | 300–500 ha | 70 |
    | >500 ha | 50 |

  - Planned density: 10 / 30 / 60 OJ/ha for <40 / 40–100 / >100 residents per ha.
  - Urban structure: 30 OJ/ha for a city centre, 15 OJ/ha for "urbana struktura u izgradnji".
  - Centrality: **25 OJ/ha for a centre over 150,000 residents** (Split).
  - Special factors: sea 50; Adriatic area 15; protected urban core 20; motorway 5; and others.
  - Source: [HKA Pravilnik 2013](https://arhitekti-hka.hr/files/file/komora/akti/pravilnici/Pravilnik-o-standardu-usluga-arhitekata-HKA-2013.pdf)
- **Fee split by phase for "UPU dijela naselja" (HKA Table 10):** starting points 10%, objectives 30%, draft proposal 40%, public-consultation proposal 10%, adoption 10%. Source: same.
- **Implied hourly rate:** the 2012 HKA example (26.34 ha, 6,980 OJ, 1999 tariff) gave 337,000–405,000 HRK. Under the 2013 formula that is 2,805–3,370 h, i.e. **≈120 HRK/h (≈ €15.93/h)**. So the two chamber schemes match at about €16 per standard hour at 2012 prices. Sources: [HKA 2012 examples](https://www.arhitekti-hka.hr/files/file/pdf/2012/URBANIZAM_CIJENE.pdf) and [HKA 2013 Pravilnik](https://arhitekti-hka.hr/files/file/komora/akti/pravilnici/Pravilnik-o-standardu-usluga-arhitekata-HKA-2013.pdf); the calculation is mine.

### Inferences
**HKA-method estimate for a residential UPU in Split, 1:1000** (my calculation). Points per ha used: area band + 30 (density 40–100/ha) + 15 (urban structure in construction) + 25 (Split, over 150k) + 15 (Adriatic area). No sea, protected-core or relief points are added.

| Area | OJ | Standard hours (Ns) | At €16/h (2012-equivalent HKA rate) | Per ha |
|---|---|---|---|---|
| 50 ha | 10,250 | 4,068–4,887 | €65k–78k | ≈ €1,300–1,560 |
| 100 ha | 19,500 | 7,579–9,106 | €121k–145k | ≈ €1,210–1,450 |
| 200 ha | 35,000 | 13,347–16,039 | €213k–256k | ≈ €1,060–1,280 |

- At a current firm rate of roughly €30–40/h (an assumption, not sourced), these figures roughly double.
- They also exclude surveys, studies and VAT.
- In practice public buyers pay far less than the HKA figures (section 2). The HKA figure is best read as a "professional full-scope" ceiling, and the €25k–80k market figures as the real-world floor/median.
- If Bilice/Mostine has a protected old core over 25% of the area, add 20 OJ/ha, about +10%.

### Gaps
- There is no published HKA reference hourly rate for 2023–2026 in EUR. The "Jednostavni cjenik usluga" PDF could not be parsed ([HKA](https://www.arhitekti-hka.hr/files/File/komora/akti/pravilnici/Jednostavni_cjenik_usluga.pdf)).

---

## 6. Duration and staffing as cost drivers

### Takeaway
On paper Split sets about 5–6 months of deadlines for a UPU. Real plans take 1.5–3+ years because of consultation rounds and approvals. The HKA hours for 50–200 ha (about 4,000–16,000 standard hours) mean a multi-disciplinary team of roughly 3–6 people over 1–2 years.

### Cited Findings
- **Split UPU Put Stinica/Put Supavla (2023), Art. 11 deadlines:**
  - requests from public bodies: 30 days
  - draft proposal: 60 days
  - public consultation: 30 days
  - final draft: 15 days
  - final proposal: 15 days
  - original copies after publication: 15 days

  Source: [Odluka](https://split.hr/Portals/0/adam/Contents/l9lHOskPX061RyqHuugxXQ/Link/Odluka%20o%20izradi%20Urbanisti%C4%8Dkog%20plana%20ure%C4%91enja%20podru%C4%8Dja%20sjeverozapadno%20od%20kri%C5%BEanja%20ulica%20Put%20Stinica%20i%20Put%20Supavla.pdf)
- **Split ID DPU Dračevac (2022) deadlines:** requests 15 days, draft 30 days, public consultation 8 days. Source: [Odluka](https://mpgi.gov.hr/UserDocsImages/Zavod/Odluke_o_izradi/Splitsko_dalmatinska/22_09_13_DPUrzDracevac-ID.pdf)
- **Contract durations elsewhere:** Bol ID PPUO+UPU, 185 days ([Bol](https://opcinabol.hr/javna-nabava-upu-bol/)); Vrbanja ID PPUO, 12 months ([fondovieu](https://fondovieu.gov.hr/nabave/2105)); Pula ePlanovi package, 4 July 2024 – 31 Dec 2025 ([Pula](https://www.pula.hr/hr/novosti/gradski-projekti/detail/27581/izrada-prostornih-planova-nove-generacije-putem-elektronickog-sustava-eplanovi/)).
- **Delays in practice:** the Put Stinica/Put Supavla UPU, decided in March 2023, was still listed as "u izradi" in 2026 ([split.hr – Planovi u izradi](https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/planovi-u-izradi)).

### Inferences
- About 7,600–9,100 standard hours (the 100 ha case) is roughly 4–5 person-years at about 1,700 productive hours a year. That is not credible for a €30k contract. Low-priced contracts must rely on heavy reuse of GUP data, the city's own staff, or a thin plan. A residents' initiative should argue for a realistic budget, citing the HKA method, so the plan isn't underfunded.
- The time the city's own department spends running the process (organising consultation, commissions, public-body requests) is an unpriced city cost on top of the contract.

### Gaps
- No Croatian data on actual UPU team sizes was found.

---

## 7. A defensible cost estimate for UPU Dračevac and UPU Bilice

### Takeaway
Per UPU, excluding VAT (all inference, built from the sources above):

| Area | (A) Market-realistic public contract, plan + base + studies | (B) HKA full-scope, plan only, at €16/h (≈ double at €30–40/h) |
|---|---|---|
| 50 ha | €40k–90k | €65k–78k |
| 100 ha | €60k–140k | €121k–145k |
| 200 ha | €90k–220k | €213k–256k |

- Add 25% VAT when the city is the buyer, since the city cannot reclaim input VAT on this.
- Suggested single planning figure for the initiative: **about €1,000–1,500/ha all-in, excluding VAT, for a new 1:1000 residential UPU in Split, and at least €50k per plan.** Section 5 shows the HKA per-ha values behind this; section 2 shows the market floor.

### Cited Findings
- Basis: HKA 2013 formula and points ([HKA Pravilnik 2013](https://arhitekti-hka.hr/files/file/komora/akti/pravilnici/Pravilnik-o-standardu-usluga-arhitekata-HKA-2013.pdf)); HKA 2012 examples at €860–2,040/ha ([HKA 2012](https://www.arhitekti-hka.hr/files/file/pdf/2012/URBANIZAM_CIJENE.pdf)); market floor of €18k–30k per UPU or amendment ([Zagreb 2023](https://www.zagreb.hr/UserDocsImages/Nabava/PLAN%20NABAVE%202023.pdf), [Pula](https://www.pula.hr/hr/novosti/gradski-projekti/detail/27581/izrada-prostornih-planova-nove-generacije-putem-elektronickog-sustava-eplanovi/), [Blato](https://www.blato.hr/dokumenti/materijali-za-sjednicu/materijali-za-sjednice-2026-godina/materijali-za-10-sjednicu-vijeca-1/2541-izvj-kap-ulag-2025/file), [NPOO €30k cap](https://fondovieu.gov.hr/pozivi/93)); simple-procurement limit of €26,540 ([fondovieu nabava 2105](https://fondovieu.gov.hr/nabave/2105)).

### Inferences
- Pricing each neighbourhood separately gives two procurements, each likely above €26,540 once the geodetic base is included, so the city would need an open procedure (EOJN). A combined procurement split into two lots is also possible.
- To argue it is affordable: two UPUs at about €100k–300k in total are a tiny share of Split's 2025 budget of about €392M (the budget figure is from [Dalmacija Danas](https://www.dalmacijadanas.hr/izglasan-rekordni-proracun-grada-splita-iznosi-vise-od-390-milijuna-eura/)).

### Gaps
- The ranges would be firmer with Split's own EOJN award values for recent UPUs (Slatine 4, Turska kula, Put Stinica). Check the EOJN "Registar ugovora – Grad Split" for CPV 71410000.

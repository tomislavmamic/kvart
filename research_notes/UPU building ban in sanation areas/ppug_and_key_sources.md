# PPUG, GUP, izvješća and national rules: how Split drew the land where a UPU is obligatory (neuređeni dio / urbana sanacija), 2024–2026

Method and conventions
- Collected 28 Sept 2026. Every document below was downloaded with `curl -L` into `data/sources/planovi/ppug/` (gitignored), and PDFs were extracted with PyMuPDF to a `.txt` next to them with `=== str. N` markers. Page numbers ("p.") are **PDF page numbers** of the local file (1-based), which for the plan texts coincide with the printed "Stranica N od M".
- Quotations are verbatim. The only change: PyMuPDF renders the font ligatures of the izvješća as `Ɵ`, `ﬁ`, `ﬂ`; I normalised them back to `ti`, `fi`, `fl`. `[…]` marks an omission I made. In the izvješća the "Sažetak prijedloga/primjedbe" is the City's summary of the objection, not the objector's words; I paraphrase the requests in English and quote only the City's answers.
- Abbreviations: ZPU 153/13 = Zakon o prostornom uređenju NN 153/13 (amended 65/17, 114/18, 39/19, 98/19, 67/23); ZPU 155/25 = new Zakon o prostornom uređenju NN 155/25 (in force 1 Jan 2026); Pravilnik 152/23 = Pravilnik o prostornim planovima NN 152/23; GUP1/PPUG1 = izvješće o (prvoj) javnoj raspravi (rujan–listopad 2024); GUP2/PPUG2 = izvješće o ponovnoj javnoj raspravi (svibanj 2025).
- Related notes: `national_law_history.md` (law history), `gup_text_in_force_vs_draft.md` (GUP texts). See section 8 for one correction to `national_law_history.md`.

---

## 1. Documents downloaded

All local paths are relative to `data/sources/planovi/ppug/`.

| # | Document | Date / stage | URL | Local file(s) | Pages |
|---|---|---|---|---|---|
| 1 | ID PPUG Splita – **Odredbe za provedbu** | Prijedlog za ponovnu javnu raspravu, travanj 2025 | https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Prostornog%20plana%20ure%C4%91enja%20Grada%20Splita%20za%20ponovnu%20javnu%20raspravu/1_%20Odredbe%20za%20provedbu.pdf | `idppug_2025_ponovna_1_odredbe.pdf/.txt` | 84 |
| 2 | ID PPUG – **Obrazloženje** | same | …/3_%20Obrazlozenje.pdf (same folder) | `idppug_2025_ponovna_3_obrazlozenje.pdf/.txt` | 29 |
| 3 | ID PPUG – kartografski prikaz **4.3 Građevinska područja – Split središnji dio**, 1:5 000 | same (AutoCAD PDF created 22 Apr 2025) | …/4_Gradevinska%20podrucja-4_3_Split%20sredisnji%20dio.pdf | `idppug_2025_ponovna_4_3_gradevinska_podrucja_split_sredisnji.pdf/.txt` | 1 sheet |
| 4 | ID PPUG – **4.4 Građevinska područja – Split istok-Kamen-Stobreč**, 1:5 000 | same (created 22 Apr 2025) | …/4_Gradevinska%20podrucja-4_4_Split%20istok-Kamen-Stobrec.pdf | `idppug_2025_ponovna_4_4_gradevinska_podrucja_split_istok_kamen_stobrec.pdf/.txt` | 1 sheet |
| 5 | ID PPUG – 4.2 Prikaz izmjena i dopuna Odredbi (tracked changes) | same | …/4_2_%20Prikaz%20izmjena%20i%20dopuna%20Odredbi%20za%20provedbu.pdf | `idppug_2025_ponovna_4_2_prikaz_izmjena_odredbi.pdf/.txt` | 117 |
| 6 | ID PPUG – 4.1 Sažetak za javnost | same | …/4_1_%20Sazetak%20za%20javnost.pdf | `idppug_2025_ponovna_4_1_sazetak.pdf/.txt` | 5 |
| 7 | ID PPUG – 0. Opći dio | same | …/0_%20%20Opci%20dio.pdf | `idppug_2025_ponovna_0_opci_dio.pdf/.txt` | 9 |
| 8 | Official listing page of the ponovna JR PPUG files (all 24 file names/URLs) | live page | https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/planovi-na-javnom-uvidu/izmjene-i-dopune-prostornog-plana-uredjenja-grada-splita-za-ponovnu-javnu-raspravu | `page_idppug_2025_ponovna_jr.html`, `ponovna_urls.txt` | – |
| 9 | ID PPUG – **Odredbe**, first prijedlog | Prijedlog, rujan 2024 (JR 19 Sep–18 Oct 2024) | https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?language=hr-HR&Command=Core_Download&EntryId=13958&PortalId=0 (server file name "1_ID PPUG Split - Odredbe za provedbu.pdf") | `idppug_2024_prva_1_odredbe.pdf/.txt` | 81 |
| 10 | ID PPUG – **Obrazloženje**, first prijedlog | rujan 2024 | same pattern, EntryId=13979 ("3_ID PPUG Split - Obrazlozenje.pdf") | `idppug_2024_prva_3_obrazlozenje.pdf/.txt` | 27 |
| 11 | ID PPUG – 4.3 and 4.4 Građevinska područja, first prijedlog | rujan 2024 (AutoCAD PDF created 9 Sep 2024) | EntryId=13970 (4.3), 13971 (4.4) | `idppug_2024_prva_4_3_…pdf`, `idppug_2024_prva_4_4_…pdf` (+ .txt) | 1 + 1 |
| 12 | ID PPUG – 4.2 Prikaz izmjena Odredbi; 4.1 Sažetak, first prijedlog | rujan 2024 | EntryId=13981; 13984 | `idppug_2024_prva_4_2_prikaz_izmjena_odredbi.pdf`, `idppug_2024_prva_4_1_sazetak.pdf` | 107; 4 |
| 13 | Obavijest o javnoj raspravi ID PPUG (KLASA 350-02/21-04/3, 11 Sep 2024) | 2024 | https://split.hr/DesktopModules/EasyDNNNews/DocumentDownload.ashx?portalid=0&moduleid=2760&articleid=19420&documentid=13275 (notice page: https://split.hr/natjecaji/detalj-natjecaja/javna-rasprava-o-prijedlogu-izmjena-i-dopuna-prostornog-plana-uredjenja-grada-splita-i-strateskoj-studiji-o-utjecaju-na-okolis-izmjena-i-dopuna-prostornog-plana-uredjenja-grada-splita) | `obavijest_jr_2024-09-12_ppug.pdf/.txt`, `page_jr_2024_ppug_natjecaj.html` | 2 |
| 14 | **PPUG na snazi**, pročišćeni tekst Odredbi (Sl. gl. 46/20) | in force (Sl. gl. 31/05, 38/20, 46/20) | EntryId=8878 | `ppug_na_snazi_procisceni_odredbe_SG46-20.pdf/.txt` | 46 |
| 15 | PPUG na snazi – Legenda građevinskih područja (it is a JPEG, 300 dpi scan of 2011) | in force | EntryId=3166 | `ppug_na_snazi_gradevinska_podrucja_legenda.jpg` | – |
| 16 | PPUG na snazi – Veza listova (sheet index, 33 A3 sheets) | in force | EntryId=3132 | `ppug_na_snazi_gradevinska_podrucja_veza_listova.pdf` (image only) | 1 |
| 17 | PPUG na snazi – Građevinska područja naselja, **listovi 11–16** (JPEG scans of cadastral sheets, 2011) | in force | EntryId=3143 … 3148 (List N = 3132+N) | `ppug_na_snazi_gradevinska_podrucja_list_11.jpg` … `_16.jpg` | 6 sheets |
| 18 | Page listing all in-force PPUG files | live | https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/planovi-na-snazi/ppu-grada-splita | `page_planovi-na-snazi_ppu-grada-splita.html` | – |
| 19 | **Izvješće o javnoj raspravi – GUP** (KLASA 350-02/21-04/4, URBROJ 2181-1-10-1/3-25-607, 26 Mar 2025) | 1st JR | https://mpgi.gov.hr/UserDocsImages//dokumenti/Prostorno/Planovi/Izvjesca/Splitsko-dalmatinska//31.3.2025.Split.GUP.pdf (also on split.hr: EasyDNN articleid=20457 documentid=15067) | `izvjesce_prva_GUP_2025-03-31.pdf/.txt` | 426 |
| 20 | **Izvješće o javnoj raspravi – PPUG** (KLASA 350-02/21-04/3, URBROJ 2181-1-10-1/2-25-278, 25 Mar 2025) | 1st JR | https://mpgi.gov.hr/UserDocsImages//dokumenti/Prostorno/Planovi/Izvjesca/Splitsko-dalmatinska//31.3.2025.Split.pdf (split.hr: articleid=20455 documentid=15066) | `izvjesce_prva_PPUG_2025-03-31.pdf/.txt` | 211 |
| 21 | **Izvješće o ponovnoj javnoj raspravi – GUP** (URBROJ 2181-1-10-1/1-26-679, Split, 02. rujna 2026; uploaded 3.9.2026) | ponovna JR | page https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-ponovnoj-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-za-ponovnu-javnu-raspravu ; PDF https://split.hr/DesktopModules/EasyDNNNews/DocumentDownload.ashx?portalid=0&moduleid=2192&articleid=23082&documentid=16565 | `izvjesce_ponovna_GUP_2026.pdf/.txt` | 105 |
| 22 | **Izvješće o ponovnoj javnoj raspravi – PPUG** (URBROJ 2181-1-10-1/1-26-326, Split, 02. rujna 2026) | ponovna JR | page https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-ponovnoj-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-prostornog-plana-uredjenja-grada-splita ; PDF …&articleid=23081&documentid=16564 | `izvjesce_ponovna_PPUG_2026.pdf/.txt` | 126 |
| 23 | Zakon o prostornom uređenju **NN 155/25** | in force 1 Jan 2026 | https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2315.html | `zpu_NN155-25_2315.html/.txt` | – |
| 24 | Zakon o prostornom uređenju **NN 153/13** (original text) | 2014–2025 | https://narodne-novine.nn.hr/clanci/sluzbeni/2013_12_153_3220.html | `zpu_NN153-13_3220.html/.txt` | – |
| 25 | ZID ZPU **NN 65/17** and **NN 39/19** (for the amended definitions, art. 79 and art. 146) | 2017, 2019 | https://narodne-novine.nn.hr/clanci/sluzbeni/2017_07_65_1494.html ; https://narodne-novine.nn.hr/clanci/sluzbeni/2019_04_39_801.html | `zpu_izmjene_NN2017_07_65_1494.*`, `zpu_izmjene_NN2019_04_39_801.*` | – |
| 26 | **Pravilnik o prostornim planovima NN 152/23** (verified: NN 152/2023, 19 Dec 2023, br. dok. 2228; in force 1 Jan 2024). HTML has the articles; the annexes (Prilozi 1–4) exist only as images in the PDF | – | https://narodne-novine.nn.hr/clanci/sluzbeni/2023_12_152_2228.html ; PDF https://narodne-novine.nn.hr/eli/sluzbeni/2023/152/2228/pdf | `pravilnik_NN152-23_2228.html/.txt`, `pravilnik_NN152-23_2228.pdf` (106 MB) + `_pdf.txt` | 102 |
| 27 | ID GUP – Odredbe and Obrazloženje, prijedlog za ponovnu JR (copies, so the notes do not depend on the scratchpad) | travanj 2025 | https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/1_%20Odredbe%20za%20provedbu.pdf and …/3_%20Obrazlozenje.pdf | `gup_2025_ponovna_1_odredbe.pdf/.txt`, `gup_2025_ponovna_3_obrazlozenje.pdf/.txt` | 149; 32 |
| 28 | Listing pages (izvješća list, 4 izvješće pages, planovi u izradi, planovi na javnom uvidu) | live | https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama etc. | `page_*.html` | – |
| 29 | Page of the **2016 (not adopted)** ID PPUG procedure, found under the URL given in the task | 2016 | https://split.hr/natjecaji/detalj-natjecaja/prijedlog-izmjena-i-dopuna-prostornog-plana-ure%C4%91enja-grada-splita | `page_prijedlog_idppug_2016_nedoneseno.html` | – |

Notes on the list
- The task URL `…/natjecaji/detalj-natjecaja/prijedlog-izmjena-i-dopuna-prostornog-plana-uređenja-grada-splita` (row 29) is **not** the 2024/2025 procedure. Its files (lgs.axd ids 16892–16944) are "ID PPUG Splita_…_prijedlog za JR", and its izvješće (lgs.axd id 17888) is dated "2017_01_04". The same numbering block holds the 2017 Konačni prijedlog (ids 18391–18409). The City says that procedure was never adopted (PPUG1 #22, p. 141: "Gradsko vijeće te izmjene i dopune nije usvojilo, u idućem ih sazivu nije ni razmatralo, a sama Odluka je definitivno stavljena van snage 2022. godine (Službeni glasnik Grada Splita br. 8/22)"). I did not download its documents.
- For the ponovna JR the Građevinska područja map is split by area, not into 33 A3 sheets (list in section 5.3).
- `idppug_2025_ponovna_4_2_gradevinska_podrucja_split_zapad.pdf` also sits in the folder. I did not download it; another process wrote it at 15:59:32. I left it in place.

---

## 2. National law: definitions, UPU obligation, ban, "UPU-level detail" alternative

### 2.1 ZPU 153/13 (text in force 2014–2025)
- Definitions, art. 3(1), original numbering (65/17 renumbered them: 11→11, 20→21, 21→22, 22→23, 34→36, 35→37):
  - pt 11: "izgrađeni dio građevinskog područja je područje određeno prostornim planom koje je izgrađeno"
  - pt 20: "neizgrađeni dio građevinskog područja je područje određeno prostornim planom planirano za daljnji razvoj"
  - pt 21: "neuređeni dio građevinskog područja je neizgrađeni dio građevinskog područja određen prostornim planom na kojemu nije izgrađena planirana osnovna infrastruktura"
  - pt 22 (original): "osnovna infrastruktura je prometna površina preko koje se osigurava pristup do građevne čestice, odnosno zgrade, javno parkiralište, građevine za odvodnju otpadnih voda i niskonaponska elektroenergetska mreža"
  - pt 34: "urbana preobrazba je skup planskih mjera i uvjeta kojima se bitno mijenjaju obilježja izgrađenog dijela građevinskog područja promjenom urbane mreže javnih površina, namjene i oblikovanja građevina, i/ili rasporeda, oblika i veličine građevnih čestica"
  - pt 35 (original): "urbana sanacija je skup planskih mjera i uvjeta kojima se poboljšava karakter izgrađenog dijela građevinskog područja i urbane mreže javnih površina devastiranih nezakonitim građenjem"
  - Source: [ZPU NN 153/13](https://narodne-novine.nn.hr/clanci/sluzbeni/2013_12_153_3220.html)
- **NN 65/17, art. 3** (in force 15 Jul 2017) narrowed osnovna infrastruktura and widened sanacija:
  - new pt 23: "»23. osnovna infrastruktura je građevina za odvodnju otpadnih voda i prometna površina preko koje se osigurava pristup do građevne čestice, odnosno zgrade«"
  - new pt 37: "»37. urbana sanacija je skup planskih mjera i uvjeta kojima se poboljšava karakter izgrađenih područja unutar i izvan granica građevinskog područja devastiranih nezakonitim građenjem i na drugi način«"
  - Source: [NN 65/17](https://narodne-novine.nn.hr/clanci/sluzbeni/2017_07_65_1494.html)
- **NN 39/19, art. 1** (in force 25 Apr 2019) rewrote art. 3. This numbering and wording held until 31 Dec 2025:
  - pt 13: "izgrađeni dio građevinskog područja je područje određeno prostornim planom koje je izgrađeno"
  - pt 23: "neizgrađeni dio građevinskog područja je područje određeno prostornim planom planirano za daljnji razvoj"
  - pt 24: "neuređeni dio građevinskog područja je neizgrađeni dio građevinskog područja određen prostornim planom na kojemu nije izgrađena planirana osnovna infrastruktura"
  - pt 25: "osnovna infrastruktura je građevina za odvodnju otpadnih voda prema mjesnim prilikama određenim prostornim planom i prometna površina preko koje se osigurava pristup do građevne čestice, odnosno zgrade"
  - pt 40: urbana preobrazba, unchanged wording
  - pt 41: "urbana sanacija je skup planskih mjera i uvjeta kojima se poboljšava karakter izgrađenih područja unutar i izvan granica građevinskog područja devastiranih nezakonitim građenjem i na drugi način"
  - Source: [NN 39/19](https://narodne-novine.nn.hr/clanci/sluzbeni/2019_04_39_801.html)
- **Who draws the parts:**
  - PPUG, art. 76(1): "2. neizgrađeni dio građevinskog područja naselja, izdvojenog građevinskog područja izvan naselja i izdvojenog dijela građevinskog područja naselja, za koje se ne donosi generalni urbanistički plan te neuređeni dio tih područja 3. dio građevinskog područja naselja, […] za koje se ne donosi generalni urbanistički plan, planiran za urbanu preobrazbu i urbanu sanaciju"
  - GUP, art. 78(1): "1. neizgrađeni dio građevinskog područja naselja i izdvojenog građevinskog područja izvan naselja za koje se donosi generalni urbanistički plan te neuređeni dio tih područja 2. dio građevinskog područja naselja i izdvojenog građevinskog područja izvan naselja, planiran za urbanu preobrazbu i urbanu sanaciju"
- **UPU-level detail instead of a UPU:**
  - PPUG, art. 76(3): "Prostorni plan uređenja grada, odnosno općine može za dijelove građevinskog područja, za koje se prema ovom Zakonu obvezno donosi urbanistički plan uređenja, propisivati uvjete provedbe zahvata u prostoru s detaljnošću propisanom za urbanistički plan uređenja."
  - GUP, art. 78(3): "Generalni urbanistički plan može za dijelove građevinskog područja za koje se prema ovom Zakonu obvezno donosi urbanistički plan uređenja propisivati uvjete provedbe zahvata u prostoru s detaljnošću propisanom za urbanistički plan uređenja."
- **Obligation and ban, art. 79 (original):**
  - "(1) Urbanistički plan uređenja donosi se obvezno za neuređene dijelove građevinskog područja i za izgrađene dijelove tih područja planiranih za urbanu preobrazbu ili urbanu sanaciju."
  - "(2) Donošenje urbanističkog plana uređenja nije obvezno za područje iz stavka 1. ovoga članka za koje su prostornim planom uređenja, odnosno generalnim urbanističkim planom propisani uvjeti provedbe zahvata u prostoru s detaljnošću propisanom za urbanistički plan uređenja."
  - "(3) Do donošenja urbanističkog plana uređenja na područjima iz stavka 1. ovoga članka, odnosno propisivanja uvjeta provedbe zahvata u prostoru iz stavka 2. ovoga članka ne može se izdati akt za građenje nove građevine."
  - "(4) Iznimno od stavka 3. ovoga članka, akt za građenje može se izdati za rekonstrukciju postojeće građevine i za građenje nove građevine na mjestu ili u neposrednoj blizini mjesta prethodno uklonjene postojeće građevine unutar iste građevne čestice, kojom se bitno ne mijenja namjena, izgled, veličina i utjecaj na okoliš dotadašnje građevine."
  - NN 65/17, art. 20: "U članku 79. stavku 1. iza riječi: »sanaciju« dodaju se riječi: »unutar građevinskog područja«."
  - NN 39/19, art. 19: "U članku 79. stavku 3. riječ: »akt« zamjenjuje se riječima: »lokacijska dozvola i građevinska dozvola«."
  - Sources: [ZPU NN 153/13](https://narodne-novine.nn.hr/clanci/sluzbeni/2013_12_153_3220.html); [NN 65/17](https://narodne-novine.nn.hr/clanci/sluzbeni/2017_07_65_1494.html); [NN 39/19](https://narodne-novine.nn.hr/clanci/sluzbeni/2019_04_39_801.html)
- **Lokacijska dozvola, art. 146:**
  - (1) pt 3, original: "je donesen urbanistički plan uređenja, ako se dozvola izdaje na području za koje je ovim Zakonom propisana obveza njegova donošenja." (Renumbered pt 4 by NN 65/17.)
  - (2), original: exempts only replacement and reconstruction.
  - **NN 39/19, art. 45** (in force 25 Apr 2019) replaced (2): "»(2) Stavak 1. podstavak 4. ovoga članka ne odnosi se na izdavanje lokacijske dozvole za: 1. rekonstrukciju postojeće građevine 2. građenje nove građevine na mjestu ili u neposrednoj blizini mjesta prethodno uklonjene postojeće građevine unutar iste građevne čestice, kojom se bitno ne mijenja namjena, izgled, veličina i utjecaj na okoliš dotadašnje građevine 3. građenje nove zgrade koja ima pristup na prometnu površinu te mogućnost rješavanja odvodnje otpadnih voda prema mjesnim prilikama određenim prostornim planom.«"
  - Source: [NN 39/19](https://narodne-novine.nn.hr/clanci/sluzbeni/2019_04_39_801.html)
  - The City's izvješća rely on this point 3 (section 7, group F).
- **Urban sanation measures, art. 53:**
  - (2): plans prescribe implementation conditions, guidelines "i mjere za urbanu sanaciju ako su potrebne."
  - (5): "Mjere za urbanu sanaciju propisuju se prostornim planom za područja na kojima pretežu zgrade ozakonjene na temelju posebnog zakona."
  - (6): "Područja iz stavka 4. ovoga članka planiraju se kao posebne zone urbane sanacije u kojima se propisuju uvjeti provedbe zahvata u prostoru ovisno o pretežnom postojećem stanju."
- **Transitional rule for old PPUGs, art. 201:**
  - "(1) Jedinice lokalne samouprave dužne su dopuniti prostorne planove uređenja velikih gradova, gradova ili općina, […] na način da u njima odrede neuređene dijelove građevinskih područja i izgrađene dijelove tih područja planirane za urbanu preobrazbu u skladu s ovim Zakonom u roku od dvanaest mjeseci od dana stupanja na snagu pravilnika iz članka 56. stavka 3. ovoga Zakona."
  - "(2) Do ispunjenja obveze iz stavka 1. ovoga članka neuređenim dijelom građevinskog područja smatraju se neizgrađeni dijelovi građevinskog područja određeni prostornim planovima uređenja velikih gradova, gradova ili općina, […] koji su na snazi na dan stupanja na snagu ovoga Zakona."
  - "(3) Do ispunjenja obveze iz stavka 1. ovoga članka izgrađenim dijelovima građevinskih područja planiranim za urbanu preobrazbu u smislu ovoga Zakona smatraju se dijelovi građevinskog područja određeni za urbanu obnovu prostornim planovima koji su na snazi na dan stupanja na snagu ovoga Zakona."

### 2.2 ZPU 155/25 (in force 1 Jan 2026)
- Definitions, art. 3:
  - pt 12: "građevinsko područje je područje određeno prostornim planom za gradnju i budući razvoj, a koje se sastoji od građevinskog područja naselja, izdvojenog dijela građevinskog područja naselja i izdvojenog građevinskog područja izvan naselja"
  - pt 33: "osnovna infrastruktura je građevina za odvodnju otpadnih voda prema mjesnim prilikama određenim prostornim planom i prometna površina preko koje se osigurava pristup do građevne čestice, odnosno zgrade"
  - pt 60: "urbana preobrazba je skup planskih mjera i uvjeta kojima se bitno mijenjaju obilježja izgrađenog dijela građevinskog područja […]. Urbana preobrazba obuhvaća postupke promjene i intervencije unutar izgrađenog dijela građevinskog područja grada, kao što su novi projekti i nova gradnja na mjestu oštećenih i devastiranih površina prijašnje gradnje […]"
  - pt 61: "urbana sanacija je skup planskih mjera i uvjeta kojima se stanje prostornog nereda dovodi u funkcionalno i planski uređeno stanje odnosno poboljšava karakter izgrađenih područja unutar i izvan granica građevinskog područja devastiranih nezakonitim građenjem ili na drugi način"
  - Source: [ZPU NN 155/25](https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2315.html)
- **No definition of izgrađeni, neizgrađeni or neuređeni dio exists in ZPU 155/25.** I searched the whole text for "neuređen", "izgrađeni dio" and "neizgrađen". The new law uses "površine koje nisu opremljene osnovnom infrastrukturom" and "dijelove građevinskih područja koji nisu izgrađeni i opremljeni osnovnom infrastrukturom".
- Art. 45(1): "Postojeća građevinska područja, utvrđena važećim prostornim planovima gradova odnosno općina i Prostornim planom Grada Zagreba, ne mogu se širiti dok god unutar njih postoje površine koje nisu opremljene osnovnom infrastrukturom."
- Art. 77(5): "Mjere za urbanu sanaciju propisuju se za područja na kojima se pretežito nalaze zgrade ozakonjene na temelju posebnog zakona, za koja se propisuju svi uvjeti provedbe zahvata u prostoru prostornim planom sukladno ovom Zakonu."
- **UPU-level detail instead of a UPU:**
  - PPUG, art. 103(3): "Prostorni plan uređenja grada odnosno općine može za područja za koja se prema ovom Zakonu obvezno donosi urbanistički plan uređenja propisivati uvjete provedbe zahvata u prostoru s detaljnošću propisanom za urbanistički plan uređenja, osim za područja koja su planirana za urbanu komasaciju."
  - GUP, art. 105(3): "Generalni urbanistički plan može za područja za koja se prema ovom Zakonu donosi urbanistički plan uređenja propisivati uvjete provedbe zahvata u prostoru s detaljnošću propisanom za urbanistički plan uređenja, osim za područja koja su planirana za urbanu komasaciju."
- **UPU obligation, art. 106:**
  - "(2) Urbanistički plan uređenja donosi se za: 1. dijelove građevinskih područja koji nisu izgrađeni i opremljeni osnovnom infrastrukturom 2. postojeće i izgrađene dijelove građevinskih područja za koje se planira urbana preobrazba i/ili urbana sanacija 3. […] kulturno-povijesne cjeline […] 4. […] pomorskog dobra 5. […] urbana komasacija."
  - "(3) Do donošenja urbanističkog plana uređenja iz stavka 2. točaka 2. do 5. ovoga članka, zahvati u prostoru na tom području provode se na temelju prijelaznih mjera iz prostornog plana šireg područja, kojima se propisuju uvjeti rekonstrukcije postojeće građevine i građenja nove građevine na mjestu ili u neposrednoj blizini mjesta prethodno uklonjene postojeće građevine unutar iste građevne čestice, kojom se bitno ne mijenja namjena, izgled, veličina i utjecaj na okoliš dotadašnje građevine."
  - "(4) Izrada urbanističkog plana uređenja nije obvezna za područja iz stavka 2. točaka 1., 2., 3. i 4. ovoga članka, za koja su prostornim planom šireg područja propisani uvjeti provedbe zahvata u prostoru s detaljnošću propisanom za urbanistički plan uređenja."
- **Lokacijska dozvola, art. 180:**
  - (1) pt 4: "da je donesen urbanistički plan uređenja, ako se dozvola izdaje na području za koje je ovim Zakonom propisana obveza njegova donošenja"
  - "(2) Odredba stavka 1. točke 4. ovoga članka ne odnosi se na izdavanje lokacijske dozvole za: 1. rekonstrukciju postojeće građevine 2. građenje nove građevine na mjestu ili u neposrednoj blizini mjesta prethodno uklonjene postojeće građevine […] 3. građenje nove zgrade koja ima pristup na postojeću javnu prometnu površinu te mogućnost rješavanja odvodnje otpadnih voda prema mjesnim prilikama određenim prostornim planom, ako se takvim građenjem ne sprečava opremanje drugog građevinskog zemljišta."
- **Transitional, art. 236(2):** "Postupci izrade i donošenja prostornih planova odnosno njihovih izmjena i dopuna započeti do 31. prosinca 2023. prema odredbama Zakona o prostornom uređenju (»Narodne novine« br. 153/13., 65/17., 114/18., 39/19., 98/19. i 67/23.) dovršit će se sukladno odredbama toga Zakona."
  - Both ponovna izvješća (GUP2 p. 55; PPUG2 p. 93) invoke this. The Split ID GUP/PPUG are therefore being finished under ZPU 153/13.

---

## 3. Pravilnik o prostornim planovima NN 152/23

Status
- Published NN 152/2023, 19 Dec 2023; "stupa na snagu 1. siječnja 2024. godine" (art. 60).
- The City treats it as **not binding** for these amendments, because they started before 31 Dec 2023. PPUG1 #6 a), p. 136: "U cilju buduće jednostavnije provedbe, u mjeri u kojoj je bilo moguće, određeni pojmovi su na odgovarajući način usklađeni s pojmovima iz članka 4. Pravilnika o prostornim planovima (NN 152/23), iako to nije zakonska obveza."
- The same izvješća cite the **old** Pravilnik NN 106/98 (with amendments 39/04, 45/04, 163/04, 148/10, 9/11) as the governing one for map scale. See PPUG1 #90 a) in section 7.

Articles
- **Art. 39:**
  - "(1) Građevinsko područje sastoji se od izgrađenog i/ili neizgrađenog dijela."
  - "(2) Izgrađeni dio građevinskog područja određuje se na način da obuhvaća skup građevnih čestica određen prostornim planom i izgrađene, odnosno uređene površine javne namjene."
  - "(3) Neizgrađeni dio građevinskog područja sastoji se od uređenog i/ili neuređenog dijela. Uređenim dijelom smatraju se površine opremljene osnovnom infrastrukturom, a koje čine prostornu cjelinu planiranu prostornim planom."
  - Source: NN p. 52, PDF p. 12, [Pravilnik NN 152/23](https://narodne-novine.nn.hr/clanci/sluzbeni/2023_12_152_2228.html)
- **Art. 58(2), transitional, for new-generation plans:** "Izgrađeni, neizgrađeni-uređeni i neuređeni dijelovi građevinskog područja određuju se sukladno zakonu kojim se uređuje prostorno uređenje kojim se, na temelju važećih prostornih planova jedinica lokalne samouprave, vodeći računa o analizi postojećeg stanja u prostoru, važećim prostornim planovima užeg područja, izdanim aktima za provedbu prostornih planova i važećoj građevinskoj dozvoli."
  - This is the only delineation method the Pravilnik gives. It asks the planner to take account of existing plans, the actual state, narrower plans, issued implementation acts and valid building permits.
- **Art. 24:**
  - (2) pt 3: "mjere za urbanu sanaciju ili urbanu preobrazbu, ako su takve mjere potrebne"
  - (5): "Mjere za urbanu sanaciju, odnosno urbanu preobrazbu, propisuju se odredbama za provedbu prostornog plana povezanima s grafičkim dijelom prostornog plana."
- **Art. 47:** "Podloga za izradu grafičkog dijela prostornog plana su službene karte izrađene u skladu s propisima iz područja državne izmjene i katastra nekretnina te druge službene rasterske karte i vektorski skupovi podataka dostupni u modulu ePlanovi Editor."

Annexes (image-only in the PDF; I read them visually, so treat the wording as transcribed)
- **Prilog 1 "Pregled prostornih tema"**, layer "1.2. GRAĐEVINSKA PODRUČJA" (KN-2-1), PDF pp. 27–28 = NN pp. 67–68:
  - For PPU (column 9) and GUP (column 10) alike, each građevinsko područje type has sub-themes "Izgrađeno", "Neizgrađeno", "Neuređeno". Examples: KN-2-1-3302/3303/3304 for PPU; KN-2-1-4302/4303/4304 for GUP.
  - "Neuređeno" is drawn as red hatching with a dashed border.
- **Prilog 1**, PDF p. 30 = NN p. 70 (theme names transcribed from the image):
  - layer "1.3.2. Smjernice za izradu prostornih planova užih područja / Provedba s detaljnošću UPU-a" (KN-3-2) has themes "Područje u obvezi izrade urbanističkog plana uređenja" and "Područje provedbe s detaljnošću urbanističkog plana uređenja";
  - layer "1.3.3. Mjere za urbanu sanaciju ili urbanu preobrazbu" (KN-3-3) has themes "Područje urbane sanacije" (URS) and "Područje urbane preobrazbe" (URP), for PPU and GUP.
- **Prilog 4 "Kartografski prikazi"**, PDF p. 102 = NN p. 142:
  - map "1.2. Građevinska područja" (layers OB-1-1, KN-2-1) is drawn at **1:5.000 for both PPU and GUP** ("nema" for UPU);
  - map "1.3. Provedba prostornog plana" (KN-3-1…3-3) at 1:25.000 for PPU and "1:10.000 ili 1:5.000" for GUP.
  - Footnote (transcribed from the image): "Napomena: Kada se za dijelove građevinskog područja određene prostornim planom propisuju uvjeti provedbe zahvata u prostoru s detaljnošću urbanističkog plana uređenja, dijelovi kartografskog prikaza 1.1. Namjena prostora koji prikazuju te dijelove stvaraju se u mjerilu 1:5.000, 1:2.000 ili 1:1.000."
- Reading: under the new-generation rules, the neuređeni dio is a **GUP-level** theme too, drawn at 1:5 000. Split's drafts, made under the old rules, draw it only on the PPUG sheet 4 and copy it into GUP map 4.d (1:10 000).

---

## 4. PPUG in force (Sl. gl. 31/05, 38/20, 46/20 pročišćeni tekst)

- **Art. 5** (p. 3): "Namjena površina je određena u mjerilu 1:25.000. U slučaju dvojbe oko granica građevinskog područja mjerodavan je kartografski prikaz br. 4 Građevinska područja naselja u mjerilu 1:5.000."
- **Art. 6** (p. 3): "Izgrađeni dio građevinskog područja je utvrđen na temelju podataka iz Hrvatske osnovne karte 1:5.000, reambulirane 2001. godine te ortofoto snimke iz 2002. godine. U izgrađeni dio građevinskog područja uključene su sve izgrađene čestice bez obzira na namjenu i urbanističku definiranost prostora. U izgrađene dijelove građevinskog područja nisu uključene sve izdvojene pojedinačne manje građevine. U izgrađene dijelove građevinskog područja u smislu ovog Prostornog plana podrazumijevaju se i područja utvrđena u članku 8 kao niskokonsolidirana. Linija razgraničenja je povučena približno po granicama čestica izgrađenog ili pretežito izgrađenog djela područja. Neizgrađene dijelove građevinskog područja čine sve neuređene i neizgrađene površine veće od 5000m2."
- **Art. 13, last paragraph** (p. 11): "Građevinska područja naselja razgraničena su na izgrađeni i neizgrađeni dio mješovite namjene te ucrtana u katastarskim planovima u mjerilu 1:5.000, u grafičkom dijelu elaborata Prostornog plana, kartografski prikaz broj 4. „Građevinska područja naselja”."
- **Art. 83** (pp. 40–41), only outside the GUP: in "izgrađena područja" where a detailed plan is obligatory, building before that plan is allowed if among other conditions "građevna čestica se nalazi uz javni put u funkciji (minimalne širine 4m) ili je izdana lokacijska dozvola za javni put". **The 4 m road test is already in the PPUG in force** (the 2005 plan; the 2020 amendment 38/20 concerned only Karepovac).
- **Legend** of the Građevinska područja naselja map (JPEG, "m 1:5000"): only two classes, "izgrađeno" and "neizgrađeno". It has lines for "granice obvezne izrade UPU-a" and "granice obvezne izrade DPU-a". **There is no "neuređeno" class.**
- **Sheets** (EntryId 3133–3165): 33 A3 JPEG scans of cadastral sheets, some derived from 1:2880. Izgrađeno is dark yellow, neizgrađeno light yellow, drawn in blocks.
- **Answer to task 1c:** the in-force PPUG does **not** distinguish a neuređeni dio. Under ZPU 153/13 art. 201(2), however, its neizgrađeni dijelovi ("sve neuređene i neizgrađene površine veće od 5000m2") count as neuređeni until the PPUG is amended.
- **Sheet index for east Split** (Veza listova): Split is sheets 1–13 and Kamen/Stobreč 14–16, Žrnovnica 17–21. East Split falls on sheets **11** (north coast, Dujmovača/Bilice area), **12** (interior east, Mostine/Dračevac/Kila area), **13** (south coast, Žnjan/Pazdigrad), **14–15** (Kamen), **16** (Stobreč). I placed the neighbourhoods by position on the index; the scans are not legible at the resolution I checked.

---

## 5. PPUG draft (rujan 2024 → travanj 2025)

### 5.1 Odredbe (ponovna, travanj 2025; the 2024 wording is identical unless noted)
- **Art. 5(2)** (ID čl. 7, p. 7): "Namjena površina je određena u mjerilu 1:25.000. U slučaju dvojbe oko granica građevinskog područja mjerodavan je kartografski prikaz br. 4 Građevinska područja u mjerilu 1:5.000."
- **Art. 6(1)** (ID čl. 8, p. 7): "Građevinsko područje se sastoji od izgrađenih i neizgrađenih dijelova u funkciji daljnjeg razvoja područja. Unutar neizgrađenih dijelova građevinskog područja utvrđeni su neuređeni dijelovi na kojima nije izgrađena planirana osnovna infrastruktura: građevina za odvodnju otpadnih voda (kojom se omogućava priključenje građevne čestice na javni ili vlastiti sustav odvodnje otpadnih voda) i prometna površina preko koje se osigurava pristup do građevne čestice. Izgrađeno, neizgrađeno i neuređeno građevinsko područje prikazano je na kartografskom prikazu br. 4. „Građevinska područja“ (listovi 4.1. -4.7.). Neizgrađeni dijelovi građevinskog područja koji nisu prikazani kao neuređeni smatraju se „uređenima“."
- **Art. 6(2)** (p. 7): "Izgrađeni dio građevinskog područja je utvrđen na temelju podataka iz ortofoto snimke iz 2021. godine. U izgrađeni dio građevinskog područja uključene su sve izgrađene čestice bez obzira na namjenu i urbanističku definiranost prostora. U izgrađene dijelove građevinskog područja nisu uključene sve izdvojene pojedinačne manje građevine."
  - Compared with the in-force art. 6, the draft dropped the 5000 m² rule and the sentence that niskokonsolidirana areas count as izgrađeni.
- **Art. 13(7)** (p. 20): "Građevinska područja naselja razgraničena su sukladno članku 6. stavku 1. ovih odredbi te ucrtana u katastarskim planovima u mjerilu 1:5.000, u grafičkom dijelu elaborata Prostornog plana, kartografski prikaz broj 4. „Građevinska područja ”."
- **Art. 83** (ID čl. 81, pp. 75–76):
  - (1)–(2), outside the GUP: they repeat the 2005 rule, now for "izgrađena i neizgrađena „uređena“" areas. Pt 2 conditions include "građevna čestica se nalazi uz javnu prometnu površinu u funkciji (minimalne širine 4 m) ili je izdana građevinska dozvola za građenje javne prometne površine.," and "postoji mogućnost priključenja na javni ili vlastiti sustav odvodnje otpadnih voda,".
  - (4): "Za neizgrađena neuređena građevinska područja omogućava se rekonstrukcija postojećih građevina i građenje nove građevine na mjestu ili u neposrednoj blizini mjesta prethodno uklonjene postojeće građevine unutar iste građevne čestice, kojom se bitno ne mijenja namjena, izgled, veličina i utjecaj na okoliš dotadašnje građevine, dok je izgradnja novih građevina moguća samo posrednom provedbom – na temelju prostornog plana užeg područja (urbanističkog plana uređenja)."
  - (5): "Grafički prikaz neuređenih građevinskih područja na kartografskom prikazu br. 4 „Građevinska područja“ je usmjeravajućeg karaktera, što znači da je mogućnost gradnje na građevnim česticama koje su prikazane kao „uređene“ uvjetovana kumulativnim ispunjavanjem sljedećih uvjeta: da se građevna čestica nalazi uz prometnu površinu u funkciji minimalne širine 4 m ili da je izdana građevinska dozvola za građenje prometne površine sukladno odredbama ovog Plana, da postoji mogućnost priključenja na javni ili vlastiti sustav odvodnje otpadnih voda i na niskonaponsku električnu mrežu, te da se obavezno osigura koridor za rekonstrukciju prometne površine (prostor rezervacije proširenja) sukladno članku 41. stavku 13."
    - "Usmjeravajućeg karaktera" works in one direction only. A parcel shown as uređen may still fail the 4 m / sewer / electricity test. Nothing lets a parcel shown as neuređen be treated as uređen.
  - (6), **new in 2025** (not in the 2024 text, pp. 72–73): "U slučaju kada izmjenom katastarskog plana, primjerice spajanjem čestica, nastane situacija u kojoj je samo dio građevne čestice označen kao neuređen, dok je preostali dio označen kao uređen ili izgrađen, gradnja na predmetnoj čestici je moguća neposrednom provedbom PPUG-a, ako su zadovoljeni uvjeti iz prethodnog stavka. U ovoj situaciji, ukoliko je dio čestice označen kao izgrađen, za čitavu česticu se primjenjuju uvjeti gradnje za izgrađeni dio građevinskog područja."
    - It was added in answer to objection PPUG1 #73 (section 7).
- **Art. 85(3)** (p. 76): "GUP-om će se detaljnije razgraničiti zone različitih uvjeta korištenja i razraditi odgovarajući uvjeti uređenja i građenja te zaštite i sanacije prostora. GUP-om će se odrediti i obveza izrade prostornih planova užeg područja unutar njegovog obuhvata."
- **Art. 86** (ID čl. 84, pp. 77–78):
  - "(1) Područja unutar obuhvata PPUG-a, a izvan obuhvata GUP-a, na kojima je gradnja je moguća samo temeljem prostornog plana užeg područja, odnosno ne dozvoljava se neposredna provedba PPUG-a, su neuređeni dijelovi neizgrađenog dijela građevinskog područja prikazani na kartografskim prikazima 3.4 „Područja i dijelovi primjene planskih mjera zaštite“ i 4. „Građevinska područja naselja“."
  - "(3) Na područjima za koja se PPUG-om propisuje obveza izrade prostornog plana užeg područja, a koja ne spadaju u područja iz stavka 1. ovog članka, do izrade prostornog plana užeg područja gradnja je moguća neposrednom provedbom PPUG -a, u skladu s odredbama PPUG -a."
  - (7) lists 23 UPUs, all outside the GUP (Slatine, Korešnica, Žrnovnica, Sitno, Srinjine, Perun). **The PPUG draft contains no list of neuređeni areas inside the GUP.** In 2024 the lead-in read "Prostornim planom se utvrđuje obveza izrade sljedećih urbanističkih planova uređenja"; in 2025 it reads "…utvrđuje potreba izrade…".
  - (8), **new in 2025**: "Za neuređene dijelove građevinskog područja izrada UPU-a je obvezna, dok je na preostalom području preporučena. Odlukom o izradi urbanističkog plana uređenja može se odrediti uži ili širi obuhvat tog plana od obuhvata određenog ovim Planom, […]"
    - The 2024 (8) had only the obuhvat sentence (p. 76 of the 2024 file).
    - The SPUO note in the PPUG2 izvješće, p. 14, item 12, confirms the change: "Članak 86. – Dopunjeno da je za neuređene dijelove građevinskog područja izrada UPU-a obvezna, dok je na preostalom području preporučena."

### 5.2 Obrazloženje (ponovna; the 2024 text is the same on these points)
- p. 5 (2024: p. 4): "Članak 6. - Detaljnije su definirani pojmovi „građevinsko područje“ i „građevinsko područje naselja“, te uveden pojam „neuređeni dijelovi građevinskog područja“. Brisani su dijelovi temeljeni na propisima koji više nisu na snazi. (Temelj: točka 1.3 a)"
- p. 11 (2024: p. 10): "Članak 83.- Mjere provedbe su preispitane u odnosu na zakonsku obvezu određivanja neuređenih dijelova neizgrađenog građevinskog područja, te propisan način postupanja u slučaju naknadne izmjene katastarskog plana. […]"
  - The phrase from "te propisan način" onward is new in 2025.
- p. 11: "Članak 86. – Revidirana obveza potreba izrade prostornih planova užeg područja (usklađenje sa Zakonom). […]"
- **p. 16, section "4. GRAĐEVINSKA PODRUČJA"** (identical on p. 16 of 2024). This is **the only explanation of how the neuređeni dio was drawn:**
  - "Prikaz građevinskih područja u mjerilu 1:5000, umjesto dosadašnje podjele na 33 lista formata A3, podijeljen je na kartografske prikaze 4.1 – 4.7 (4.1 Slatine, 4.2 Split-zapad, 4.3 Split-središnji dio, 4.4 Split-istok, Kamen, Stobreč, 4.5 Žrnovnica, 4.6 Sitno Gornje i Sitno Donje, 4.7 Srinjine) radi cjelovitosti i preglednosti prikaza po naseljima."
  - "− prilagodba prikaza građevinskih područja granicama katastarskih čestica na ažuriranim digitalnim katastarskim podlogama. Građevinska područja važećeg Plana prikazana su na skeniranim listovima katastra (od kojih su neki izvedeni iz mjerila 1:2880) georeferenciranim u HDKS sustavu. Uredbom o informacijskom sustavu prostornog uređenja (NN 115/15), koja je donesena na temelju Zakona o prostornom uređenju, propisana je obveza izrade kartografskih prikaza prostornog plana u službenoj kartografskoj projekciji HTRS96/TM, na digitalnom katastarskom planu (DKP). Prilikom „prebacivanja“ građevinskih područja na nove katastarske podloge izvršene su određene prilagodbe i korekcije koje se ne smatraju proširenjem građevinskog područja,"
  - "− ažurirani su podaci o izgrađenosti građevinskih područja prema stvarnom stanju. Sukladno zakonskim propisima kojima je definiran izgrađeni dio građevinskog područja (područje određeno prostornim planom koje je izgrađeno), neizgrađeni dio građevinskog područja (područje određeno prostornim planom planirano za daljnji razvoj) te neuređeni dio građevinskog područja (neizgrađeni dio građevinskog područja određen prostornim planom na kojemu nije izgrađena planirana osnovna infrastruktura), a s obzirom na protek vremena i promjene u prostoru, ovim je izmjenama napravljena detaljna analiza svih građevinskih područja te je izmijenjena podjela građevinskog područja na izgrađeni, neizgrađeni i neuređeni dio a sukladno stvarnom stanju na terenu prikazanom na službenoj državnoj digitalnoj ortofoto karti i na temelju recentnih zračnih snimaka."
- pp. 15–16, UPUs outside the GUP: new UPU obligations were justified by neuređeno land. Examples: "proširenje na kontaktno neuređeno građevinsko područje" (UPU br. 18 and br. 20); "propisana obveza izrade UPU-a sjeveroistočnog dijela naselja Žrnovnica s Amižićima – br. 23 (većinom neuređeno građevinsko područje)".
- **Not found** in either Obrazloženje: a 4 m road width, a sewer-network map, a parcel-size threshold, the date of the DKP or the ortofoto, or any list of neuređeni areas. The 4 m criterion appears only in Odredbe art. 83(5) and in the **GUP** Obrazloženje (6.1). The DKP year comes from an izvješće answer (PPUG1 #90 a): "digitalnom katastarskom planu iz 2021. godine".

### 5.3 Kartografski prikaz 4 (draft), and the east-Split sheets
- **Sheet list** (ponovna, 1:5 000):
  - 4.1 Slatine
  - 4.2 Split zapad
  - **4.3 Split središnji dio**
  - **4.4 Split istok-Kamen-Stobreč**
  - 4.5 Žrnovnica
  - 4.6 Gornje Sitno i Donje Sitno
  - 4.7 Srinjine
- **East Split = sheet 4.4, plus the eastern edge of 4.3.** Place-name labels found in the PDF text:
  - 4.4: BILICE, MOSTINE, DRACEVAC, KILA, KAMEN, STOBREČ area (ORIŠAC, SIROBUJA/KAMENSKI PUT, DUILOVO, BRNIK, KITOZE), PAZDIGRAD, ŽNJAN, and the TTTS/Vrbica/Korešnica area at the east edge.
  - 4.3: BILICE, MOSTINE, PAZDIGRAD, ŽNJAN, MERTOJAK, VISOKA, SMOKOVIK, STOCI, DRAGOVODE, PUJANKE, MEJAŠI.
- **Legend of 4.4** (text layer and rendered image):
  - "GRAĐEVINSKO PODRUČJE NASELJA I IZDVOJENI DIO GRAĐEVINSKOG PODRUČJA NASELJA": three columns, headed IZGRAĐENO, NEIZGRAĐENO and NEUREĐENO in the rendered legend. Yellow = izgrađeno, pale yellow = neizgrađeno (= "uređeno"), hatched pale yellow = neuređeno. The same three columns apply to mješovita namjena, D, T and R.
  - "IZDVOJENO GRAĐEVINSKO PODRUČJE IZVAN NASELJA": columns "NEIZGRAĐENO | NEUREĐENO" (R1 golf).
  - Title block: "Faza izrade: Prijedlog za ponovnu javnu raspravu", "Mjerilo kartografskog prikaza: 4.4 1:5 000", "Suglasnost na plan prema članku 108. Zakona o prostornom uređenju (NN 153/13 i 65/17, 114/18, 39/19, 98/19 i 67/23)".
- **Base map: cadastral.**
  - The PDFs are vector AutoCAD plots with parcel outlines and k.č. numbers as text (1.6 pt font). Sheet 4.4 has 13,935 numeric labels, 8,499 of them in "N/M" form; sheet 4.3 has 24,741.
  - The polygons for izgrađeno, neizgrađeno and neuređeno follow parcel boundaries.
  - The City's own description of the base is the "digitalni katastarski plan iz 2021. godine" (PPUG1 #90 a).
- **Extent** (visual check of 4.4 around Dračevac, Mostine and Kila): most unbuilt land away from existing streets is hatched **neuređeno**. The pale-yellow "uređeno" strips are narrow and run along existing roads. I did not measure areas.
- **2024 vs 2025:** a rough pixel comparison of 4.3 and 4.4 shows scattered local changes consistent with the accepted objections. The building-footprint layer is also rendered differently, so I did not quantify parcel-level changes.

---

## 6. GUP draft (ponovna, travanj 2025)

### 6.1 Obrazloženje §2.1.1.2–2.1.1.4 (pp. 5–6; local copy `gup_2025_ponovna_3_obrazlozenje.txt`)
- **2.1.1.2** (p. 5–6):
  - "Sukladno Zakonu, urbana preobrazba je „skup planskih mjera i uvjeta kojima se bitno mijenjaju obilježja izgrađenog dijela građevinskog područja promjenom urbane mreže javnih površina, namjene i oblikovanja građevina, i/ili rasporeda, oblika i veličine građevnih čestica“, a urbana sanacija je „skup planskih mjera i uvjeta kojima se poboljšava karakter izgrađenih područja unutar i izvan granica građevinskog područja devastiranih nezakonitim građenjem i na drugi način“. Područja urbane preobrazbe i urbane sanacije određena su na kartografskom prikazu 4.d Područja i dijelovi primjene planskih mjera zaštite. Područja urbane preobrazbe najvećim dijelom obuhvaćaju kompleksne zahvate Gradskih projekata."
  - "Područja urbane sanacije su većinom nisko konsolidirana područja na istočnom dijelu grada, na kojima je prisutna dugogodišnja nezakonita gradnja, a ozakonjenje nezakonito izgrađenih zgrada je utvrdilo status nezakonite gradnje kao trajne i velikim dijelom nepromjenjive činjenice u prostoru, stvarajući neplanski urbaniziran prostor kojem nedostaju važni elementi funkcionalnih naselja, prije svega sustav javnih prometnih površina svih razina te javni sadržaji i površine u javnom korištenju."
- **2.1.1.3** (p. 6): "Sukladno Zakonu, neuređeni dio građevinskog područja je definiran kao dio neizgrađenog građevinskog područja na kojem nije izgrađena planirana osnovna infrastruktura: građevina za odvodnju otpadnih voda (kojom se omogućava priključenje građevne čestice na javni ili vlastiti sustav odvodnje otpadnih voda) i prometna površina preko koje se osigurava pristup do građevne čestice. Neuređeni dio građevinskog područja određen je PPUG-om, na kartografskom prikazu građevinskih područja, pri čemu se načelno, kao osnovni kriterij „uređenosti“ uzima mogućnost priključenja na postojeću prometnu površinu u funkciji, minimalne širine 4 m, uz obavezno osiguranje koridora za rekonstrukciju te prometne površine (osiguranje prostora rezervacije proširenja). Neuređeni dio građevinskog područja prikazan je na kartografskom prikazu GUP-a 4.d Područja i dijelovi primjene planskih mjera zaštite, s obzirom na to da podrazumijeva obvezu izrade UPU-a pojašnjenu sljedećom točkom."
- **2.1.1.4** (p. 6): "Važećim Zakonom je temeljito izmijenjena obveza izrade prostornih planova užeg područja […], odnosno obveza izrade UPU-a je reducirana samo na neuređene dijelove građevinskog područja i na izgrađene dijelove građevinskog područja koji su planirani za urbanu preobrazbu ili urbanu sanaciju. GUP-om je, sukladno Zakonu, propisana obveza izrade UPU-a za sva ta područja, ali je ujedno zadržana obveza preporuka izrade većeg broja UPU-a za područja koja ne spadaju u nijednu od ove tri kategorije (kao planska preporuka, a ne zakonska obveza), uz bitnu razliku: na područjima na kojima je Zakonom prozvana obveza donošenja UPU-a, prije njegovog donošenja ne može se izdati lokacijska dozvola i građevinska dozvola za građenje nove građevine, dok je na područjima planske obveze preporuke donošenja UPU-a izdavanje navedenih akata moguće i prije donošenja tog plana. […]"
- Elsewhere in the GUP Obrazloženje there is nothing more on neuređeno or sanacija delineation. The only other mentions are ozakonjenje (p. 2, pp. 24–25) and "neuređenih zelenih površina" (unrelated).

### 6.2 Odredbe (local copy `gup_2025_ponovna_1_odredbe.txt`)
- **Art. 103** (ID čl. 116, pp. 143–144):
  - "(1) Područja unutar obuhvata GUP-a na kojima je gradnja moguća samo temeljem prostornog plana užeg područja odnosno ne dozvoljava se neposredna provedba GUP-a, ako ovim odredbama ili Zakonom nije određeno drugačije, su: 1. neuređeni dijelovi neizgrađenog dijela građevinskog područja 2. izgrađeni dijelovi građevinskog područja planirani za urbanu preobrazbu 3. izgrađeni dijelovi građevinskog područja planirani za urbanu sanaciju"
  - "(2) Područja iz prethodnog stavka prikazana su na kartografskom prikazu 4.d „Područja i dijelovi primjene planskih mjera zaštite“."
  - "(4) Na područjima za koja se GUP-om propisuje izrada prostornog plana užeg područja, a koja ne spadaju u područja iz stavka 1. ovog članka, do izrade prostornog plana užeg područja gradnja je moguća neposrednom provedbom GUP-a, u skladu s odredbama GUP-a."
- **Art. 105:**
  - (2) (p. 144): "Utvrđuje se obveza/preporuka izrade prostornih planova užeg područja za obuhvate prema kartografskom prikazu br. 4.d „Područja i dijelovi primjene planskih mjera zaštite“, u mjerilu 1:10.000."
  - (5) (p. 145): until UPUs are adopted, only street network, small infrastructure, public/social buildings, R2 recreation up to 5000 m² and recycling yards may be permitted.
- **Art. 106:**
  - (1) (p. 145): "Neuređeni neizgrađeni dijelovi građevinskog područja većinom obuhvaćaju nisko konsolidirana područja na istočnom dijelu grada, a određeni su PPUG-om Splita. To su područja na kojima nije izgrađena planirana osnovna infrastruktura: građevina za odvodnju otpadnih voda (kojom se omogućava priključenje građevne čestice na javni ili vlastiti sustav odvodnje otpadnih voda) i prometna površina preko koje se osigurava pristup do građevne čestice sukladno odredbama ovog Plana. […]"
  - (2) (pp. 145–146): "Urbana sanacija se odnosi prvenstveno na područja s prevladavajućom ozakonjenom izgradnjom koja se zadržava u prostoru, a planskim mjerama se intervenira u cilju poboljšanja karaktera i prostornog standarda područja. Područja urbane sanacije su većinom nisko konsolidirana područja na istočnom dijelu grada […]. Na kartografskom prikazu 4.d „Područja i dijelovi primjene planskih mjera zaštite“ su označene veće homogene površine urbane sanacije, ali osim njih postoji niz manjih područja za koja je urbana sanacija poželjna i potrebna, a koji ujedno podrazumijevaju i postupke urbane preobrazbe. […]"
  - (3) (p. 146): "S obzirom na to da su u istočnom dijelu grada međusobno isprepletena neuređena građevinska područja i područja urbane sanacije, u postupku izrade propisanih urbanističkih planova uređenja će se istodobno slijediti smjernice iz stavka 1. i 2. ovog članka"

---

## 7. Objections in the four izvješća (neuređeno / izgrađeno / sanacija / UPU obligation)

Coverage
- I split all four izvješća into numbered entries: GUP1 293, PPUG1 155, GUP2 32, PPUG2 23. I then searched them for "sanacij", "neuređen", "uređen…", "izgrađen… dio", "infrastruktur", "pristup", "UPU", "preobrazb", "zabran", "4.d", "akt… za građenje", "do donošenja". Every hit was read.
- Below is every entry on the neuređeno/izgrađeno split, urbana sanacija, the UPU obligation or the building ban. Entries that only mention UPU in passing (UPU Sirobuja road corridors, Marjan UPU and so on) are left out.
- **No objection in any of the four izvješća asks to remove a parcel from "urbana sanacija" as such.** The only sanacija-related items are GUP1 #208 (answer places k.č. 1025 in sanacija), GUP1 #107 (concept) and GUP1 #70 (UPU dropped where there is no sanacija/neuređeno).
- **All parcel-level neuređeno disputes were decided in the PPUG izvješća, not the GUP ones.** The one exception is GUP1 #208.
- Page = PDF page of the local izvješće file.

### 7.1 Parcel-level objections (neuređeno ↔ uređeno / izgrađeno), grouped by the City's reason

**A. Accepted: the owner showed that a built public road (and sewer) reaches the parcel, or that jointly owned parcels can be reached through a neighbouring one**

| Izvješće, no. | Page | Parcels (k.č., k.o.) | Request (paraphrase) | City's answer (verbatim) |
|---|---|---|---|---|
| PPUG1 #37 | 147–148 | 5312/2, 5312/3, 5306, 5307 k.o. Srinjine | neuređeno → neizgrađeno; "pristupni put širine 3 m", power, water | "PRIHVAĆA SE" |
| PPUG1 #45 | 149–150 | 7172/1, /3, /4, /5, /6, /7, /8 k.o. Split (Sirobuja) | neuređeno → neizgrađeno (uređeno); all infrastructure; parcellation per UPU Sirobuja | "PRIHVAĆA SE" |
| PPUG1 #46 | 150 | 3 (south part) k.o. Stobreč | → izgrađeno or neizgrađeno; access and sewer via Trenkova ulica | "PRIHVAĆA SE" |
| PPUG1 #65 and #102 | 158; 170 | 1359, 1360, 1361, 1373/1, 1373/2 k.o. Stobreč | same owners, so access and sewer can be secured; easement | "PRIHVAĆA SE" (both) |
| PPUG1 #70 | 160 | 2425 k.o. Stobreč | → neizgrađeno (uređeno); link to Ulica kralja Stjepana Držislava with sewer | "PRIHVAĆA SE" |
| PPUG1 #71 | 160 | 7203/1 k.o. Split | same; Ulica sestara Karmelićanki with sewer | "PRIHVAĆA SE" |
| PPUG1 #72 | 160 | 148/1, 157, 158, 159 k.o. Stobreč | → izgrađeno or uređeno; same owner; Put Sirobuje | "PRIHVAĆA SE" |
| PPUG1 #75 | 161 | 1174, 1173/1–/7, /9, /11–/16 k.o. Kamen | same owner as izgrađeno 1173/8, /10; Put Gušćera | "PRIHVAĆA SE" |
| PPUG1 #79 | 162 | 7317/2, 7316/2, 7316/3, 7313/1, 7309/3, 7309/4, 7317/3 k.o. Split | same owners as uređeno neighbours; Put Orišca / Konzum Sirobuja road | "PRIHVAĆA SE" |
| PPUG1 #99 | 169 | 7315/3, 7316/1, 7317/1, 7309/1 k.o. Split | same | "PRIHVAĆA SE" |
| PPUG1 #91 | 167 | 5581/1–/3, 5554/1–/4, 5555, 5556/1–/3 k.o. Žrnovnica | owners secured road access and set aside parcels for the road | "PRIHVAĆA SE" |
| PPUG1 #13 | 138–139 | 5765 k.o. Žrnovnica | → izgrađeni; surrounded by built plots | "PRIHVAĆA SE" |
| PPUG1 #101 | 169–170 | part of 1951/4 k.o. Kamen | correct the izgrađeno/neuređeno line to include a legalised house (Rješenje o izvedenom stanju 2022) | "PRIHVAĆA SE" |

**B. Partly accepted: moved out of neuređeno but not into izgrađeno, because the land is unbuilt**

| Izvješće, no. | Page | Parcels | City's answer (verbatim) |
|---|---|---|---|
| PPUG1 #24 | 141–142 | 10260/38, 10260/39 k.o. Split (asked izgrađeno; asphalt road, sewer, lighting, photos) | "DJELOMIČNO SE PRIHVAĆA Označava kao „neizgrađeno građevinsko područje“, što u naravi i jest." |
| PPUG1 #48 a) | 150–151 | 10260/23, /48, /42, /41, /39, /1 k.o. Split (Duilovo) | "a) DJELOMIČNO SE PRIHVAĆA Kat.čest.zem. 10260/23, 10260/42, 10260/41, 10260/39 k.o. Split su označene kao „neizgrađeno građevinsko područje (mješovita namjena)“, a kat.čest.zem. 10260/48 i 10260/1 k.o. Split kao „izgrađeno građevinsko područje (mješovita namjena)“." |
| PPUG1 #87 | 164 | 7189, 7190, 7191 k.o. Split (asked izgrađeno) | "DJELOMIČNO SE PRIHVAĆA Predmetne čestice su označene kao „neizgrađeno građevinsko područje“, što u naravi i jesu." |
| PPUG1 #73 | 160 | 7310/1, 7312/1, 7312/2, 7313/1, 7313/3 k.o. Split | "DJELOMIČNO SE PRIHVAĆA Sve su predmetne čestice uvrštene u neizgrađeno građevinsko područje, osim k.č. 7313/3 (površine 540 m2), za koju je utvrđeno da nije izgrađena prometna površina preko koje se osigurava pristup do građevne čestice. S obzirom na to da se katastarski operat praktički svakodnevno mijenja provedbom geodetskih elaborata, uvodi se dodatna odredba (stavak 6. članka 83.) […]" |

**C. Rejected: no built road reaches the parcel (a cadastral path, or access only from a state road, does not count)**

| Izvješće, no. | Page | Parcels | City's answer (verbatim) |
|---|---|---|---|
| PPUG1 #98 | 168–169 | 1545/10, 1546/2, 1545/12 k.o. Kamen (claims "pristupni put širine 4 m", water, power, septic tank; says the 2017 ID PPUG had accepted her) | "NE PRIHVAĆA SE Na temelju dostupnih podataka utvrđeno je da nije izgrađena prometna površina preko koje se osigurava pristup do predmetnih građevnih čestica. U slučaju da se prometna površina na k.č. 1545/1 produlji, odnosno izvede do predmetnih čestica, moguća je primjena članka 146. stavka 2. točke 3. Zakona o prostornom uređenju." |
| PPUG2 #7 (repeat of #98) | 98–99 | same | "NE PRIHVAĆA SE Primjedba nije predmet ponovne javne rasprave ali se daje dodatno obrazloženje odbijanja: Predmetne čestice su označene kao neuređeni dio građevinskog područja, sukladno Zakonu o prostornom uređenju, koji definira neuređeni dio građevinskog područja kao „neizgrađeni dio građevinskog područja određen prostornim planom na kojemu nije izgrađena planirana osnovna infrastruktura“. Nesporno je da postoji katastarska čestica puta, ali prema dostupnim podacima, sama prometna površina nije izgrađena, te podnositeljica nije priložila nikakav dokaz u tom smislu (npr. recentnu fotografiju na kojoj se vidi izvedena cesta, u slučaju da digitalne ortofoto snimke nisu ažurne). U prethodnom odgovoru ukazano je na mogućnost primjene članka 146. stavka 2. točke 3. tada važećeg Zakona o prostornom uređenju. Stupanjem na snagu novog Zakona o prostornom uređenju (NN 155/25), ta je mogućnost zadržana u članku 180. stavku 2. točki 3., ali uz strože uvjete, prema kojima je nužno osigurati pristup na postojeću javnu prometnu površinu te utvrditi da se građenjem ne onemogućava opremanje drugog građevinskog zemljišta. Slijedom navedenog, primjena navedene odredbe i dalje je moguća, ali podliježe provjeri ispunjenja svih zakonom propisanih uvjeta u konkretnom slučaju." |
| PPUG1 #106 | 170–171 | 6125–6130 k.o. Žrnovnica (access via Put Vrbovnika, "betonirani i uređeni put") | "NE PRIHVAĆA SE Na temelju dostupnih podataka utvrđeno je da nije izgrađena prometna površina preko koje se osigurava pristup do predmetnih građevnih čestica. K.č. 6364 k.o. Žrnovnica je čestica potoka. U slučaju da se izvede prometna površina do predmetnih čestica, moguća je primjena članka 146. stavka 2. točke 3. Zakona o prostornom uređenju." |
| PPUG2 #5 (repeat of #106) | 97–98 | same | "NE PRIHVAĆA SE Ostaje se pri prethodno danom odgovoru, uz napomenu da se predmetne čestice nalaze unutar obuhvata GUP-om planiranog Urbanističkog plana uređenja „TTTS“. Stoga je urbanistički opravdano i logično da se u okviru izrade tog plana osigura primjerena prometna povezanost predmetnih čestica, umjesto da se eventualna gradnja razmatra na temelju postojećeg, neadekvatnog pristupa. […]" (continues as in PPUG2 #7 on art. 146/180) |
| PPUG1 #74 | 160–161 | 2338, 2339 k.o. Stobreč | "NE PRIHVAĆA SE Utvrđeno je da nije izgrađena prometna površina preko koje se osigurava pristup do predmetnih građevnih čestica. Susjedne čestice koje se navode imaju pristup s državne ceste koji ne samo da ne treba dodatno opterećivati, već treba težiti realizaciji alternativnog pristupa." |
| PPUG1 #80, #89, #100 | 162; 164; 169 | 7353/1–/4, 7354/4 k.o. Split (three separate submissions) | "NE PRIHVAĆA SE Utvrđeno je da nije izgrađena prometna površina preko koje se osigurava pristup do predmetnih građevnih čestica. Postojeće pristupe s državne ceste ne treba dodatno opterećivati. (Pristup s državne ceste je dozvoljen samo iznimno, isključivo uz posebne uvjete i suglasnost nadležnih javnopravnih tijela)." |
| PPUG1 #82 | 162–163 | 7164/3, 7165 k.o. Split | "NE PRIHVAĆA SE Utvrđeno je da nije izgrađena prometna površina preko koje se osigurava pristup do predmetnih građevnih čestica." |
| PPUG1 #117 | 173–174 | 7358 k.o. Split | "NE PRIHVAĆA SE Na predmetnom području nije izgrađena osnovna infrastruktura (prometna površina preko koje se osigurava pristup do građevne čestice niti građevina za odvodnju otpadnih voda)." |
| **GUP1 #208** | 284–285 | k.č. 1025, 1024/1, 1024/2 (k.o. not stated) | Request: remove the road corridor; parcels "i dalje spadaju pod neuređeno građevinsko područje iako se po infrastrukturi ne razlikuju od okolnih čestica s izgrađenim objektima"; "zahtijeva se ukidanje nemogućnosti donošenja akata o gradnji do donošenja UPU-a". Answer: "NE PRIHVAĆA SE Detaljno preispitivanje planiranih pristupnih prometnica u obuhvatu GUP-a nije predmet ovih izmjena i dopuna; […] Zakon o prostornom uređenju definira neuređeni dio građevinskog područja kao neizgrađeni dio građevinskog područja određen prostornim planom na kojemu nije izgrađena planirana osnovna infrastruktura, te su k.č. 1024/1 i 1024/2 ispravno označene, dok se k.č. 1025 nalazi u izgrađenom građevinskom području koje je označeno kao područje urbane sanacije." |

**D. Rejected: the parcel is not neuređeno anyway, or the label is "correct in nature", or relabelling would change nothing**

| Izvješće, no. | Page | Parcels | City's answer (verbatim) |
|---|---|---|---|
| PPUG1 #119 | 175 | 7697/564–/569, /596, /597, /612–/616 k.o. Split | "NE PRIHVAĆA SE Primjedba je neutemeljena. Sve navedene čestice se nalaze ili u izgrađenom, ili neizgrađenom dijelu naselja, niti jedna nije označena kao neuređena." |
| PPUG1 #81 | 162 | 3313, 3314, 3315/1 k.o. Split | "NE PRIHVAĆA SE Primjedba je nejasna. Navedene čestice se nalaze u izgrađenom građevinskom području." |
| PPUG1 T3.a #6 | 178 | 2398 k.o. Stobreč ("definirano je kao neuređeno građevinsko područje") | "NE PRIHVAĆA SE Predmetno zemljište nije prenamijenjeno, mali južni dio se nalazi u izgrađenom dijelu građevinskog područja a veći dio ostaje u neizgrađenom, samo je Prijedlogom izmjena i dopuna Plana dodatno označen kao neuređen, što u naravi jest." |
| PPUG1 #84 | 163 | 5996/2, 5997 k.o. Žrnovnica (asked izgrađeno; access, pending lokacijska dozvola) | "NE PRIHVAĆA SE Radi se o neizgrađenom građevinskom području za koje su, kako podnositelj i sam navodi u primjedbi, GUP- om propisana pravila provedbe (namjena M1, urbano pravilo 3.1), koja bi bila potpuno ista i da se predmetne čestice neutemeljeno proglase „izgrađenima“." |
| PPUG1 #69 | 159–160 | 513–521 k.o. Kamen (asked "uređeno") | "NE PRIHVAĆA SE Cca 25% površine navedenih katastarskih čestica je u obuhvatu GUP-a, u građevinskom je području i predstavlja koridor ceste, dok je preostalih cca 3516 m2 u obuhvatu PPUG-a, od čega se 1554 m2 nalazi u neizgrađenom „uređenom“ građevinskom području. Ako je intencija primjedbe pravilno shvaćena, traži se proširenje građevinskog područja, što nije moguće prihvatiti […]" |

**E. Rejected on procedure (not a subject of the ponovna JR)**

| Izvješće, no. | Page | Parcels | City's answer (verbatim) |
|---|---|---|---|
| PPUG2 #9 | 100 | 5539 ("uređena") and 5545 ("izgrađena") k.o. Žrnovnica, with evidence | "NE PRIHVAĆA SE Primjedba se ne može prihvatiti jer nije predmet ponovne javne rasprave. […] Za gradnju na predmetnim čestima preporuča se razmatranje mogućnosti primjene članka 180. stavka 2. točke 3. Zakona o prostornom uređenju (NN 155/25)." |
| PPUG2 #8 | 99–100 | 5585 k.o. Žrnovnica ("neizgrađena, neuređena"; lost access when the Korešnica road was re-routed after PPUG1 #43; asks for access corridors drawn "kao „uvjeti provedbe s detaljnošću propisanom za UPU“ sukladno članku 76. stavku 3.") | "NE PRIHVAĆA SE […] Međutim, definiranje uvjeta provedbe zahvata s detaljnošću urbanističkog plana uređenja nije moguće jer nije u skladu s ciljevima izrade Plana koji su određeni Odlukom o izradi. […] Na ovom se primjeru jasno očituju posljedice izostanka izrade UPU-a za neuređene dijelove grada, unatoč tome što je njihova izrada bila obvezna. Upravo je odredba članka 146. stavka 2. točke 3. ranijeg Zakona o prostornom uređenju omogućila zaobilaženje te obveze, dopuštajući izdavanje akata za građenje uz tek minimalne uvjete pristupa i odvodnje, bez cjelovite planske razrade koju bi UPU osigurao. Rješavanje ovako nastalih posljedica izlazi, međutim, izvan okvira ovog postupka izmjena i dopuna Plana. […]" See also 7.2 for the Ministry opinion quoted in this answer. |

### 7.2 Statements of rule (UPU obligation, sanacija, UPU-level detail)

| Izvješće, no. | Page | Subject | City's words (verbatim) |
|---|---|---|---|
| PPUG1 T2 #3 d) (MO Srinjine); also T2.a #1 a) (MO Žrnovnica), T3 #66 f) (DAS) | 132–134; 134–135; 158–159 | asks for a single UPU for Srinjine | "Sukladno Zakonu o prostornom uređenju obvezu izrade urbanističkog plana uređenja moguće je propisati samo za neuređene dijelove građevinskog područja i za izgrađene dijelove tih područja planiranih za urbanu preobrazbu ili urbanu sanaciju unutar građevinskog područja. U tom smislu se, gdje je primjereno, u grafičkom i tekstualnom dijelu uvodi termin „preporuka izrade“ ili „potreba izrade“." |
| GUP1 #70 a) | 187–188 | zone D3 (2.7) near the hospitals, where the GUP in force required a UPU | "DJELOMIČNO SE PRIHVAĆA […] a ne radi se o zoni urbane preobrazbe, sanacije niti neuređenom građevinskom području za koje bi bila obvezna izrada UPU-a, više ne postoji osnova za posredno preispitivanje ove zone […]. Izmjenama i dopunama Plana se stoga, kako bi se omogućila neposredna provedba na temelju istog, propisuju prostorni pokazatelji za gradnju građevina zdravstvene namjene." |
| GUP1 #25 | 164 | asks to repeal PUP Pazdigrad and fold it into the GUP | "NE PRIHVAĆA SE Primjedba se ne može prihvatiti jer se procedura stavljanja izvan snage prostornog plana, sukladno Zakonu o prostornom uređenju, na odgovarajući način provodi kao i za donošenje novog plana, a Odlukom o izradi predmetnih izmjena i dopuna nije određena mogućnost propisivanja uvjeta provedbe zahvata u prostoru s detaljnošću propisanom za UPU." |
| PPUG1 #48 b) | 150–151 | repeal DPU istočnog dijela Duilova | "[…] a Odlukom o izradi izmjena i dopuna (ni GUP-a, ni PPUG-a) nije određena mogućnost propisivanja uvjeta provedbe zahvata u prostoru s detaljnošću propisanom za UPU." |
| PPUG2 #8 (the Ministry opinion the City quotes) | 99–100 | when a PPUG/GUP may give UPU-level detail | "U tom kontekstu se navodi mišljenje nadležnog Ministarstva (KLASA: 360-01/24-02/96; URBROJ: 531-08-1-24-2, Zagreb, 21.03.2024.) u kojem je pojašnjeno sljedeće: „U odluci o izradi prostornog plana uređenja, odnosno generalnog urbanističkog plana mora se odrediti neposredna provedba za određeno područje, odnosno za određeni zahvat u prostoru, a navedeni planovi osim tekstualnog dijela propisanih uvjeta provedbe zahvata u prostoru s detaljnošću propisanom za urbanistički plan uređenja, moraju sadržavati i grafički dio, odnosno moraju sadržavati i odgovarajuće kartografske prikaze za neposrednu provedbu propisane za urbanistički plan uređenja izrađene u mjerilu propisanom za urbanistički plan uređenja.“" |
| PPUG2 zapisnik (Korešnica) | 89 | asks whether "čl. 76. st. 3. Zakona" (UPU-level detail in the PPUG) can be used | "-Odgovor Gorana Barbarić: Daje odgovor da to nije predmet odluke o izradi plana, te da je trebalo u odluci o izradi biti prozvano da će se raditi detaljnija razrada plana." |
| GUP1 #107 | 213–214 | rule 3.1: redefine urbana sanacija as "ruralna sanacija" | "NE PRIHVAĆA SE Osnovni koncept urbanih pravila nije mijenjan u odnosu na važeći Plan (jer isto nije predmet ovih izmjena i dopuna); u konkretnom slučaju samo je termin „urbana obnova“ usklađen s pojmovima iz Zakona o prostornom uređenju – „sanacija“ i „preobrazba“. Ruralna sanacija nije termin definiran predmetnim Zakonom, a upitno je uvoditi takav pojam u građevinskom području naselja na kojem je planirana gradnja." |
| GUP1 #73, pt 28) | 189–195 | footprint cap | "[…] u nisko konsolidiranim područjima, koja su urbano neopremljena, služi kao mehanizam zaštite prostora do donošenja planova užeg područja." |
| GUP1 T1 #8 b) (Splitsko-dalmatinska županija, UO za zaštitu okoliša) | 148 | critique of 33 new UPUs | The county wrote: "Činjenica je da su površine pod UPU-ima u najvećoj mjeri izgrađene, a nedostatak infrastrukturnih i popratnih sadržaja mogao je biti sagledan i kroz odredbe GUP-a. […] postupak donošenja takvih detaljnih planova uređenja dugotrajan, kompliciran, financijski zahtjevan i često takvo planovi ostaju "mrtvo slovo na papiru", a prostor unutar obuhvata tih planova se najčešće do njihova donošenja devastira bespravnom izgradnjom." City's answer: "b) NE PRIHVAĆA SE Broj planova užeg područja čija se izrada propisuje je nešto reduciran u odnosu na važeći GUP. […] Situacija u kojoj Generalni urbanistički plan postaje provedbeni dokument je anomalija u sustavu planiranja. […]" |
| GUP1 #142 | 244–245 | owners of k.č. 613/1, 613/2, 612/2, 611/2, 610/2, 531 k.o. Split say UPU Bilice II–Mostine has held the area "u svojstvu taoca" for 24 years | "NE PRIHVAĆA SE […] Prijedlozi podneseni u sklopu inicijative […] će biti razmotreni u postupku donošenja novog GUP-a – kao „plana nove generacije“ i/ili izmjena i dopuna važećeg prostornog plana užeg područja, uz prethodnu izradu potrebne prometne studije. […]" |
| PPUG1 #90 a) | 164–167 | why the GUP map shows fewer buildings than the PPUG map | "[…] Sukladno članku 17. Pravilnika o sadržaju, mjerilima kartografskih prikaza, obveznim prostornim pokazateljima i standardu elaborata prostornih planova (NN 106/98, 39/04, 45/04, 163/04, 148/10 (prestao važiti), 9/11), kartografski prikazi izrađuju se za: - Prostorni plan uređenja općine ili grada na topografskoj karti u mjerilu 1:25.000, a građevinska područja naselja utvrđuju se na katastarskom planu u mjerilu 1:5.000 - Generalni urbanistički plan na osnovnoj državnoj karti u mjerilu 1:5.000 i/ili 1:10.000 Dakle, kartografski prikaz građevinskih područja PPUG-a je izrađen digitalnom katastarskom planu iz 2021. godine, a kartografski prikazi GUP-a na Hrvatskoj osnovnoj karti, (prijašnjeg naziva Osnovna državna karta) čija je godina izvornika 1989. […]" |
| SPUO note in PPUG2 izvješće | 13–14 | list of changes in the ponovna prijedlog | "11. Članak 83. – U mjerama provedbe Plana navode se uvjeti gradnje u situaciji izmjena katastarskog plana" and "12. Članak 86. – Dopunjeno da je za neuređene dijelove građevinskog područja izrada UPU-a obvezna, dok je na preostalom području preporučena. […]" |

### 7.3 Public presentations (zapisnici, reproduced in the izvješća)

| Where | Page | Verbatim |
|---|---|---|
| GUP1, javno izlaganje 3 Oct 2024 (Duilovo landowner says her parcels have road, telecom, power, water and sewer, and cannot be neuređeni) | 131 | "Gorana Barbarić upućuje da se primjedba s dokazima vezano za uređeno/neuređeno građevinsko područje podnese i da ukoliko se utvrdi da su čestice opremljene infrastrukturom primjedba će biti usvojena." |
| PPUG1, javno izlaganje (Srinjine: land with no roads, water or power should not be building land) | 116 | "-Odgovor Gorana Barbarić Kao što vidite ovo područje bez infrastrukture je evidentirano u Prijedlogu Izmjena i dopuna Plana označeno je kao neuređeno građevinsko područje." |
| PPUG1, same session | 117 | "-Odgovor Gorana Barbarić […] Istočni dijelovi grada su označeni kao područja sanacije za koje se moraju raditi detaljniji planovi, i to je alat kojim će se u većem mjerilu preispitati pojedine zone, te se onda detektirati prostori koji se mogu prenamijeniti u parkove." |

---

## 8. What this tells us about how parcels were included in or excluded from the UPU obligation

1. **There are two different mechanisms, drawn at different scales on different bases.**
   - **Neuređeni dio:**
     - Drawn only in the **PPUG**, sheets 4.1–4.7, at 1:5 000.
     - The polygons follow parcel boundaries on the 2021 digital cadastral plan (DKP).
     - The GUP copies it onto map 4.d at 1:10 000 (GUP Obrazloženje 2.1.1.3; Odredbe art. 106(1): "određeni su PPUG-om Splita").
   - **Urbana sanacija:**
     - Drawn only in the **GUP** (4.d, 1:10 000, on the 1989 HOK base).
     - It is the old GUP's "urbana obnova" relabelled (GUP1 #107), laid over the east-side urban rules and niskokonsolidirana areas (GUP Obrazloženje 2.1.1.2; Odredbe art. 106(2)).
     - No parcel-level criterion for sanacija appears anywhere.
   - GUP art. 106(2) itself says 4.d shows only "veće homogene površine urbane sanacije". Smaller areas where sanacija is "poželjna i potrebna" are not mapped.
2. **The neuređeno criterion as written.**
   - Law and Odredbe: no built "građevina za odvodnju otpadnih voda" **and** no built "prometna površina preko koje se osigurava pristup" (PPUG art. 6(1)).
   - GUP Obrazloženje: "načelno" connection to an existing working road at least 4 m wide, plus a widening corridor.
   - PPUG Odredbe art. 83(5) repeats the 4 m test, but only as a further condition for parcels shown as *uređen*.
   - The 4 m figure is already in art. 83 of the PPUG in force.
   - Izgrađeno comes from the **2021 ortofoto** (art. 6(2)).
   - The PPUG Obrazloženje says only that the three-way split followed "stvarnom stanju na terenu prikazanom na službenoj državnoj digitalnoj ortofoto karti i na temelju recentnih zračnih snimaka". No sewer data, road-width data, parcel-size threshold, GIS method or list of areas is published.
3. **The criterion as applied, judging from the ~30 decided objections, is whether a road surface is visibly built up to the parcel.**
   - Road width was not decisive. A 3 m path was accepted (PPUG1 #37). A parcel with a claimed 4 m cadastral path was rejected because "sama prometna površina nije izgrađena" (PPUG1 #98, PPUG2 #7).
   - Access only from a **state road** does not count (PPUG1 #74, #80, #89, #100).
   - **Common ownership** with a parcel that touches a built street does count (PPUG1 #65, #72, #75, #79, #99, #102).
   - Sewer is mentioned in acceptances (a street "koja ima proveden sustav kanalizacije") but is decisive in only one rejection (PPUG1 #117).
   - Evidence is expected from the owner: "(npr. recentnu fotografiju na kojoj se vidi izvedena cesta, u slučaju da digitalne ortofoto snimke nisu ažurne)" (PPUG2 #7). The presenter promised at the GUP presentation that proven infrastructure would lead to acceptance.
   - Requests to be reclassified as *izgrađeno* are refused when the land is unbuilt ("što u naravi i jest"). The City is willing to move such land from neuređeno to neizgrađeno-uređeno.
4. **How parcels came out of the UPU obligation between the two drafts.** Only through individual owner objections in the PPUG procedure (group A/B). Two text changes followed:
   - art. 83(6), which lets a parcel only partly marked neuređen be built directly after a cadastral merger (from PPUG1 #73);
   - art. 86(7)–(8): UPUs outside the GUP became "potreba izrade", with an explicit statement that a UPU is obligatory only for neuređeni dijelovi.
   - Nothing in the GUP izvješća moved land out of **urbana sanacija**, and no objector asked for that.
5. **Legal points visible in the documents.**
   - (a) Under ZPU 153/13 art. 78(1) pt 1 the **GUP** "određuje" the neuređeni dio inside its area. The Split drafts have the PPUG determine it and the GUP only show it (GUP Obrazloženje 2.1.1.3, "prikazano je neuređeno građevinsko područje (određeno PPUG-om)"). PPUG art. 86(1) itself speaks only of areas outside the GUP.
   - (b) Until the PPUG is amended, ZPU 153/13 art. 201(2) makes every *neizgrađeni* part of the 2005 PPUG (unbuilt blocks over 5 000 m²) count as neuređeno. The drafts replace this block-level presumption with a parcel-level map.
   - (c) The City itself tells owners of neuređeno parcels to use the **lokacijska-dozvola exception**: old ZPU art. 146(2) pt 3 as inserted by NN 39/19 (new building with access to a road and a local sewage solution), now ZPU 155/25 art. 180(2) pt 3 (access to an *existing public* road; must not prevent servicing other land). So the ban on neuređeno land is not absolute for a lokacijska dozvola. In PPUG2 #8 (pp. 99–100) the City also says this exception is why no UPUs were made for neuređeni parts: "Upravo je odredba članka 146. stavka 2. točke 3. ranijeg Zakona o prostornom uređenju omogućila zaobilaženje te obveze, dopuštajući izdavanje akata za građenje uz tek minimalne uvjete pristupa i odvodnje, bez cjelovite planske razrade koju bi UPU osigurao."
   - **Correction to `national_law_history.md`:** it says (line 216) that pt 3 "is new; it did not exist in old ZPU art. 146", and its table treats NN 39/19 as changing art. 79(3) only. NN 39/19 art. 45 in fact rewrote art. 146(2) and added this pt 3 from 25 Apr 2019; the City's izvješća (PPUG1 #98, #106; PPUG2 #5, #7) rely on it.
   - (d) The UPU-level-detail alternative (ZPU 153/13 arts. 76(3) and 78(3); ZPU 155/25 arts. 103(3) and 105(3)) was expressly **not used**, because the 2021 Odluka o izradi did not provide for it (GUP1 #25, PPUG1 #48 b), PPUG2 #8, PPUG2 zapisnik p. 89). The City relies on an MPGI opinion of 21 Mar 2024 (KLASA 360-01/24-02/96). That opinion says the Odluka o izradi must specify direct implementation, and the plan must then carry UPU-scale maps.
6. **Pravilnik 152/23** would put izgrađeno/neizgrađeno/neuređeno on a 1:5 000 map for the GUP as well, and would have planners take account of "izdanim aktima za provedbu prostornih planova i važećoj građevinskoj dozvoli" (art. 58(2)). The City says the Pravilnik is not binding for these amendments.

---

## 9. Open questions and things not found

- **No methodology document for the neuređeno delineation was found.** There is no GIS layer, no sewer-network overlay and no dated ortofoto list. The only dates given are ortofoto 2021 (izgrađeno) and DKP 2021 (base). The PPUG sheets are vector PDFs (sheet 4.4: ~112,000 drawing paths), so the hatched neuređeno polygons could be extracted to GIS and intersected with parcels and GUP 4.d. That was not done here.
- **No text list of neuređeni areas inside the GUP** exists in the PPUG or GUP drafts; they exist only graphically.
- I did not find whether the GUP 4.d copy of neuređeno matches PPUG sheets 4.3/4.4 exactly (different bases: HOK 1989 vs DKP 2021).
- **Adoption status as of 28 Sep 2026:** both ponovna izvješća are dated 2 Sep 2026 and were uploaded 3 Sep 2026. I found no Konačni prijedlog or council decision for the 2024–2026 procedure on split.hr. The Konačni prijedlog files found (lgs.axd 18391–18409) belong to the non-adopted **2017** procedure.
- The **k.o. of GUP1 #208** (k.č. 1024/1, 1024/2, 1025) is not stated in the izvješće.
- I did not check the old Pravilnik NN 106/98 with amendments (39/04, 45/04, 163/04, 9/11), which the City says governs, for any legend or definition of neizgrađeni/neuređeni. A scratchpad copy of the 1998 original exists from earlier work.
- Not downloaded:
  - the MPGI opinion KLASA 360-01/24-02/96 (21 Mar 2024) on UPU-level detail. It is quoted only in PPUG2 #8, and I did not find it published;
  - the MPGI instruction "Transformacija prostornih planova i primjena Pravilnika o prostornim planovima (NN 152/23)" (https://mpgi.gov.hr/…/19671);
  - the 2016–2017 ID PPUG documents (lgs.axd 16937–16944, 18391–18409). PPUG1 #98 says that procedure had accepted putting Kamen parcels 1545/10 etc. into izgrađeno;
  - PPUG ponovna sheets 4.1, 4.2 and 4.5–4.7, and the 37 MB "4.3. Prikaz Izmjena i dopuna grafičkog dijela".
- The in-force PPUG sheet index gives numbers but no legible place names at the resolution checked. The neighbourhood assignment of sheets 11–16 in section 4 is by position only.
- The Pravilnik annexes are image-only; the sub-theme names in section 3 are my visual transcription.

import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";

import { Navod } from "@/components/gup-dokument/navod";
import { GradnjaPrikaz, type ZbrojDozvola } from "@/components/gup-grad/gradnja-prikaz";
import type { PodaciDozvola } from "@/lib/gup-grad/gradnja-dozvole";
import { KATEGORIJA_PO_ID, SKUPINE_GRADNJE, uzorakKategorije } from "@/lib/gup-grad/gradnja";
import { ucitajMjestaGradnje, ucitajOdredbeGradnje, ucitajZbrojGradnje } from "@/lib/gup-grad/gradnja-podaci";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Gdje se po novom GUP-u neće moći graditi",
  description:
    "Karta Splita unutar granice GUP-a: gdje se po novom GUP-u neće moći graditi ništa novo, gdje se može graditi, ali ne stambena zgrada, a gdje i stambena. Za svako mjesto i razlog.",
});

const ha = (v: number) => Math.round(v).toLocaleString("hr-HR");
const posto = (v: number) => `${Math.round(v * 100).toLocaleString("hr-HR")} %`;
const broj = (v: number) => v.toLocaleString("hr-HR");
const vanjska = "fokus text-emerald-700 underline";


/** Zbroj dozvola iz public/geo/gup-grad/gradnja-dozvole-2025.json (gradnja-dozvole.py); null ako ga nema. */
async function zbrojDozvola(): Promise<ZbrojDozvola | null> {
  try {
    const d = JSON.parse(
      await readFile(path.join(process.cwd(), "public", "geo", "gup-grad", "gradnja-dozvole-2025.json"), "utf8"),
    ) as PodaciDozvola;
    const izdane = d.akti.filter((a) => a.ishod === "izdana");
    return {
      izdanih: izdane.length,
      gradjevinskih: izdane.filter((a) => a.postupak === "građevinska").length,
      uObradi: d.akti.length - izdane.length,
      cestica: d.cestice.filter((c) => c.akti.length && (c.zeleno_m2 > 0 || c.plan_m2 > 0)).length,
      odDatuma: d.od_datuma,
    };
  } catch {
    return null;
  }
}

/** DPU-i po kojima su izdane dozvole za nove stambene zgrade (planovi-dozvole.py). */
async function stambeniDpuI(): Promise<string[]> {
  try {
    const d = JSON.parse(await readFile(path.join(process.cwd(), "data", "gup-grad", "planovi-dozvole-2025.json"), "utf8")) as {
      dpu_stambeni?: string[];
    };
    return d.dpu_stambeni ?? [];
  } catch {
    return [];
  }
}

export default async function GradnjaPage() {
  const [zbroj, odredbe, mjesta, dozvoleZbroj, stambeniDpu] = await Promise.all([
    ucitajZbrojGradnje(),
    ucitajOdredbeGradnje(),
    ucitajMjestaGradnje(),
    zbrojDozvola(),
    stambeniDpuI(),
  ]);
  const k = zbroj.po_kategoriji_ha;
  const s = zbroj.po_skupini_ha;
  const udio = (v: number) => v / zbroj.ukupno_ha;
  const zauzeto = k.zgrada + k.okucnica + k.koristeno + k.ulica;
  const planNeDopusta = k["rezerva-prometa"] + k.koridor + k["bez-zgrada"] + k["samo-rekonstrukcija"] + k.neizgradivo;
  const stambenoMjesovito = zbroj.po_namjeni_ha["M/K5"]?.stambeno ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-zinc-500">
        <Link href="/planovi" className="fokus underline">
          Planovi
        </Link>{" "}
        · novi GUP (prijedlog izmjena i dopuna, travanj 2025.)
      </p>
      <h1 className="mt-1 text-2xl font-bold">Gdje se po novom GUP-u neće moći graditi</h1>
      <p className="mt-2 max-w-3xl text-zinc-600">
        Kad Gradsko vijeće donese novi GUP, za svako mjesto unutar granice GUP-a vrijedit će jedan od odgovora: ne može se graditi
        ništa novo, može se graditi ali ne stambena zgrada, može i stambena, javno je zemljište, ili ondje odlučuje detaljni plan (DPU)
        koji je već na snazi. Karta za svako mjesto kaže odgovor i razlog.
      </p>

      <div className="mt-4">
        <GradnjaPrikaz zbroj={zbroj} odredbe={odredbe} mjesta={mjesta} dozvoleZbroj={dozvoleZbroj} stambeniDpu={stambeniDpu}>
          <section className="max-w-3xl text-zinc-600">
            <h2 id="odgovori" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
              Pet odgovora na karti
            </h2>
            <p className="mt-3">
              Kad Gradsko vijeće donese novi GUP, za svako privatno mjesto unutar granice GUP-a vrijedit će jedan od tri odgovora.
              Javno zemljište karta pokazuje zasebno.
            </p>
            <ul className="mt-2 space-y-1.5">
              {(
                [
                  [
                    "nista",
                    <>
                      <strong className="text-zinc-900">Ne može se graditi ništa novo.</strong> Mjesto je već izgrađeno, ulica je,
                      park ili plaža, pravila dopuštaju samo obnovu postojećih zgrada, čeka se UPU ili je slobodni komad premalen.
                    </>,
                  ],
                  [
                    "nestambeno",
                    <>
                      <strong className="text-zinc-900">Može se graditi, ali ne stambena zgrada.</strong> Smjet će se graditi npr.
                      škola, hotel, radionica ili dvorana, ali ne kuća ni zgrada sa stanovima.
                    </>,
                  ],
                  [
                    "stambeno",
                    <>
                      <strong className="text-zinc-900">Može se graditi i stambena zgrada</strong>, sama ili s poslovnim prostorom.
                    </>,
                  ],
                  [
                    "javno",
                    <>
                      <strong className="text-zinc-900">Javno zemljište.</strong> Vlasnik je država, Grad ili županija, ili je to vojna
                      zona. Ne broji se ni u jedan od tri odgovora, bilo izgrađeno ili ne.
                    </>,
                  ],
                  [
                    "plan",
                    <>
                      <strong className="text-zinc-900">Odlučuje DPU.</strong> Na slobodnom zemljištu na kojem je već na snazi detaljni plan
                      uređenja (DPU) gradi se samo po tom planu (<Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>), a on može
                      dopustiti i drukčiju namjenu od GUP-a. Gdje su po DPU-u već izdane dozvole za nove stambene zgrade, karta to
                      zemljište ubraja u stambeno.
                    </>,
                  ],
                ] as const
              ).map(([sk, tekst]) => (
                <li key={sk} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/15"
                    style={uzorakKategorije(KATEGORIJA_PO_ID[SKUPINE_GRADNJE[sk].glavna])}
                  />
                  <span>{tekst}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex gap-2.5">
              <span
                aria-hidden
                className="mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/15"
                style={uzorakKategorije(KATEGORIJA_PO_ID["uz-cestu-stambeno"])}
              />
              <span>
                <strong className="text-zinc-900">Šrafirano</strong> znači: može, ali samo uz uvjet. To je neuređeno područje: ulica i
                kanalizacija koje plan ondje predviđa još nisu izgrađene. GUP traži UPU, ali dok ga nema, dozvola se može dobiti
                kad do čestice vodi ulica izgrađena u punoj širini koju joj plan određuje (za pristupnu ulicu pojas od 10 m s
                kolnikom od barem 5,5 m) i kad se čestica može priključiti na kanalizaciju.
              </span>
            </p>
            <p className="mt-3 flex gap-2.5">
              <span
                aria-hidden
                className="mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/15"
                style={uzorakKategorije(KATEGORIJA_PO_ID["stambeno-dozvola"])}
              />
              <span>
                <strong className="text-zinc-900">Što tamnije, to bliže gradnji.</strong> Zelena i plava idu od svijetle (neuređeno:
                nema pristupne ceste ili kanalizacije) preko srednje (slobodno) do tamne: zatražena dozvola, a najtamnije izdana
                dozvola (lokacijska ili građevinska, od 2020.). Što se ne može graditi, karta zatamni. Sve čestice iz istog zahtjeva ili dozvole karta računa
                zajedno, kao jednu građevnu česticu, a izbliza među njima crta tanku među. Zahtjev ili dozvola na neuređenom zemljištu
                znače da je uvjet ulice i kanalizacije riješen, pa to zemljište više nije šrafirano.
              </span>
            </p>
            <details className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
              <summary className="fokus cursor-pointer font-semibold text-zinc-900">Što znače pojmovi</summary>
              <dl className="mt-2 space-y-2">
                {(
                  [
                    ["Namjena", "Za što je zemljište predviđeno: stanovanje, poslovanje, park, ulica… Vidi se na listu 1 novog GUP-a, karti namjene."],
                    [
                      "UPU (urbanistički plan uređenja)",
                      "Detaljniji plan za jedan dio grada: ulice, čestice, pravila gradnje. Donosi ga Grad. Gdje ga GUP traži, nova gradnja čeka taj plan.",
                    ],
                    [
                      "Neuređeno područje",
                      "U planu: neuređeni dio građevinskog područja. Zemljište predviđeno za gradnju na kojem još nisu izgrađene ulice i odvodnja koje plan predviđa. GUP ondje traži UPU, a do tada se dozvola može dobiti tek kad do čestice vodi ulica izgrađena u punoj širini koju joj plan određuje i kad se čestica može priključiti na kanalizaciju ili vlastiti sustav odvodnje.",
                    ],
                    [
                      "Urbana sanacija i preobrazba",
                      "Dijelovi grada koje GUP želi urediti (sanacija) ili temeljito preoblikovati (preobrazba). Ondje nove zgrade neće biti dok se ne donese UPU.",
                    ],
                    [
                      "Urbano pravilo",
                      "Pravila gradnje za jedan dio grada: visina, koliko čestice smije biti pod zgradom, najmanja čestica. Neka dopuštaju samo obnovu postojećih zgrada.",
                    ],
                    ["Najmanja čestica za gradnju", "U planu: najmanja građevna čestica. Najmanja površina na kojoj pravila dopuštaju novu zgradu."],
                    [
                      "Rekonstrukcija i zamjena",
                      "Radovi na postojećoj zgradi, ili nova zgrada umjesto nje na istom mjestu. Na karti: „obnova ili zamjena”.",
                    ],
                    ["List 1, list 4.d", "Pojedini crteži novog GUP-a. Poveznice vode na to mjesto na listu."],
                  ] as const
                ).map(([pojam, znacenje]) => (
                  <div key={pojam}>
                    <dt className="font-semibold text-zinc-900">{pojam}</dt>
                    <dd>{znacenje}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </section>

          <section className="mt-12 max-w-3xl text-zinc-700">
            <h2 id="sto-kaze" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
              Što karta kaže
            </h2>
            <p className="mt-3">
              Većina je već zauzeta. {ha(zauzeto)} ha ({posto(udio(zauzeto))}) čine zgrade s pripadajućim dvorištima, ulice,
              parkirališta, parkovi, igrališta i okoliš škola. Na još {ha(planNeDopusta)} ha slobodnog zemljišta novi GUP neće
              dopustiti novu zgradu. Ondje su parkovi, zaštitno zelenilo, rekreacija i plaže, zemljište koje se čuva za ulice i
              groblja, dijelovi gdje se postojeće zgrade smiju samo obnoviti, teren na kojem se ne može graditi i {ha(k.koridor)} ha
              pojaseva ulica između blokova.
            </p>
            <p className="mt-2">
              Za {ha(k["stambeno-dozvola"])} ha slobodnog zemljišta za stambenu zgradu već je izdana dozvola, a za još{" "}
              {ha(k["stambeno-zahtjev"])} ha zatražena. Bez dozvole i bez uvjeta nova stambena zgrada moći će stajati na{" "}
              {ha(k.stambeno)} ha, gotovo sve ({ha(stambenoMjesovito)} ha) u
              mješovitim zonama, gdje se stanovanje miješa s poslovanjem. Zeleno na karti je samo ono mjesto na kojem zgrada smije
              stajati: 5 m od ulice i 3 m od susjeda. Zajedno s tim odmacima (dvorištem, prilazom) i kad se susjedne slobodne čestice
              spoje u jedno gradilište, to je {broj(mjesta.stambeno.od_250_m2)} gradilišta od ukupno {ha(mjesta.stambeno.ha)} ha, od
              toga {broj(mjesta.stambeno.od_500_m2)} od barem 500 m² (koliko GUP obično traži za slobodnostojeću kuću) i{" "}
              {broj(mjesta.stambeno.od_1000_m2)} od barem 1.000 m². Ništa od toga nije u vlasništvu države, Grada, županije ni
              njihovih tvrtki, prema evidenciji Grada. Još {broj(mjesta["uz-cestu-stambeno"].od_250_m2)} gradilišta je u neuređenom
              području, tek kad do njih dođu ulica i kanalizacija. Ostatak čestica uz postojeće zgrade, premalen da se odvoji za novu
              zgradu, ne broji se: to je {ha(k["ostatak-kuce"])} ha.
            </p>
            <p className="mt-2">
              {ha(s.javno)} ha je javno zemljište: {ha(k.javno)} ha u vlasništvu države, Grada ili županije (prema evidenciji Grada) i{" "}
              {ha(k.vojska)} ha vojne zone. Na {ha(k["gradski-projekt"])} ha slobodnog zemljišta u gradskim projektima (Kopilica,
              Poljud, Karepovac, Duilovo, obala…) neće se graditi dok se projekt ne odobri, a onda samo ono što projekt predvidi.
            </p>
            <p className="mt-2">
              Na {ha(k["ceka-upu"])} ha slobodnog zemljišta u područjima urbane sanacije i preobrazbe novi GUP zaustavit će novu
              gradnju dok Grad ne donese UPU.
            </p>
            <p className="mt-2">
              U neuređenom području GUP također traži UPU, ali se do tada smije graditi kad do čestice vodi ulica izgrađena u punoj
              planiranoj širini i kad se čestica može priključiti na kanalizaciju. To je {ha(k["uz-cestu-stambeno"] + k["uz-cestu-nestambeno"])} ha:{" "}
              {ha(k["uz-cestu-stambeno"])} ha u zonama za stanovanje i {ha(k["uz-cestu-nestambeno"])} ha u gospodarskim i
              turističkim zonama, gdje stambene zgrade neće biti ni nakon UPU-a.
            </p>
            <p className="mt-2">
              Dio grada već ima detaljniji plan na snazi, a novi GUP kaže da se ondje gradi samo po njemu. Urbanistički planovi
              (UPU: Sirobuja, Šine i Vidovac, Stobreč, Bilice, Mejaši i Dragovode…) namjenu GUP-a u pravilu ne mijenjaju, pa ondje
              karta pokazuje namjenu GUP-a. Detaljni planovi (DPU) je mogu mijenjati: uz Mall of Split, gdje GUP crta poslovnu
              zonu, po DPU-u se grade stambene zgrade. Zato smo provjerili u kojim su DPU-ima izdane dozvole za nove stambene
              zgrade. Takvih je osam (Žnjan sjeverno od Bračke, oko Gospe od Žnjana, Bračka i Velebitska, istočno od potoka
              Radoševac, Duilovo, Križine, zona K5 sjeverno od Vukovarske i P26 uz Mall of Split), i u njima je{" "}
              {ha(zbroj.stambeno_pod_dpu_ha)} ha zemljišta u zonama za gradnju karta ubrojila u stambeno, i kad ga GUP vodi kao
              poslovno; u tumaču klika piše da ondje vrijedi DPU, a ne GUP. U
              ostalim DPU-ima na {ha(s.plan)} ha odlučuje plan, a karta ne zna što dopušta: njihove crteže nismo pročitali.
            </p>
            <p className="mt-2">
              Koja su to područja i zašto, pročitaj na stranici{" "}
              <Link href="/gup/zabrana" className="fokus font-semibold text-emerald-700 underline">
                Zabrana nove gradnje do donošenja UPU-a
              </Link>
              .
            </p>
          </section>

          <section className="mt-12 max-w-3xl text-zinc-700">
            <h2 id="kako" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
              Kako karta odlučuje
            </h2>
            <p className="mt-3">
              Za svako mjesto karta postavlja ista pitanja, redom kojim bi ih postavio netko tko želi graditi. Boju i razlog određuje
              prva zapreka na koju naiđe.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>
                <strong className="text-zinc-900">Je li zemljište privatno?</strong> Ako je prema evidenciji Grada Splita vlasnik
                država, Grad ili županija, ili je to vojna zona (posebna namjena, npr. Lora), karta ga boji kao javno zemljište i ne
                broji ga ni u jedan odgovor. Evidencija vlasnika za većinu čestica nema podatak, pa javnog zemljišta ima i više nego
                što karta pokazuje.
              </li>
              <li>
                <strong className="text-zinc-900">Je li mjesto već zauzeto?</strong> Zgrade (iz katastra i gradskog 3D modela),
                gradilišta, ulice, parkirališta, javne ustanove, igrališta, trgovi, groblja i parkovi. Uz svaku zgradu ide i njezino
                dvorište: onoliko čestice koliko pravila za nju traže. To je tlocrt zgrade podijeljen s najvećim dopuštenim udjelom
                izgrađenosti, a nikad manje od najmanje čestice za gradnju. Postojeća zgrada smjet će se obnoviti ili zamijeniti, ali
                uz nju se nova neće moći dodati. Zgrada troši svoju česticu: na ostatku čestice nova zgrada može stajati samo ako se
                taj ostatak sam može odvojiti u novu česticu, od barem 400 m² i posvuda širok barem 10 m. Inače je to „ostatak
                čestice uz postojeću zgradu” i ne spaja se ni sa susjednim česticama. Zato se ne broje slobodni komadi koji se omotaju
                oko kuće na maloj čestici.
              </li>
              <li>
                <strong className="text-zinc-900">Predviđa li plan ondje zgrade?</strong> Po{" "}
                <Navod id="list-namjena-2025">listu 1</Navod> novog GUP-a (karti namjene): u parku, zaštitnom zelenilu, zoni
                rekreacije i na plaži ne, osim manjih pratećih građevina. Zemljište koje list ne boji nijednom bojom čuva se za ulice,
                prugu, groblja i infrastrukturu. Golf igralište (R5) je bez zgrada, osim pratećih. Isto vrijedi za uske neobojene
                pojaseve ulica između blokova. Njih smo izdvojili iz
                samog crteža lista, jer bi ih čitanje po boji pripisalo susjednoj zoni.
              </li>
              <li>
                <strong className="text-zinc-900">Dopuštaju li pravila gradnje novu zgradu?</strong> U zonama za stanovanje GUP
                svakom dijelu grada daje vlastita pravila gradnje (<Navod id="list-urbana-pravila-2025">list urbanih pravila</Navod>
                ). U dovršenim naseljima ta pravila dopuštaju samo obnovu ili zamjenu postojećih zgrada. Gdje se na snimci iz zraka
                (ortofotu) vidi da se teren ne može graditi, karta kaže da se ne može. U gradskim projektima (urbano pravilo GP)
                gradit će se tek po odobrenom projektu za cijelo područje, i samo ono što projekt predvidi.
              </li>
              <li>
                <strong className="text-zinc-900">Može li se graditi bez čekanja na UPU?</strong> U područjima urbane sanacije i
                preobrazbe (<Navod id="list-planske-mjere-2025">list 4.d</Navod>) gradit će se samo po UPU-u (
                <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>). Dok ga nema, postojeće zgrade smiju se samo obnoviti ili
                zamijeniti. U neuređenom području GUP također traži UPU, ali i prije njega nova zgrada smije se graditi kad do čestice
                vodi ulica izgrađena u punoj širini koju joj plan određuje (<Navod id="kolni-pristup-2025">čl. 49.f st. 1.</Navod>;
                za pristupnu ulicu pojas od 10 m s kolnikom od barem 5,5 m,{" "}
                <Navod id="profil-pristupne-ulice-2025">čl. 32.</Navod>) i kad se čestica može priključiti na kanalizaciju ili vlastiti
                sustav odvodnje (<Navod id="neuredeno-infrastruktura-2025">čl. 106. st. 1.</Navod>; Zakon o prostornom uređenju, NN
                155/25, čl. 180. st. 2. t. 3.). Iznimno je dovoljan prilaz širok 3 m (
                <Navod id="pristup-iznimke-2025">čl. 49.f st. 4. i 5.</Navod>). Ulicu i kanalizaciju karta ne može provjeriti za
                svaku česticu, pa to zemljište boji šrafirano. Javne i društvene zgrade
                (škole, vrtići, domovi zdravlja) smiju se graditi i prije UPU-a (<Navod id="clanak-105-popis-2025">čl. 105. st. 5.</Navod>).
              </li>
              <li>
                <strong className="text-zinc-900">Je li čestica zapravo put?</strong> Uska (najviše 9 m) i duga čestica smatra se
                putom ako njome prolazi put ucrtan u OpenStreetMap, ako graniči s barem 10 čestica kojima služi kao prilaz, ili ako
                dugom stranom leži uz ulicu (rub ceste, nogostup). Na putu se neće graditi, a susjedne čestice ne mogu se preko
                njega spojiti. Poljske trake jedna uz drugu nisu put: svaka ima tek nekoliko susjeda, a spojene bočno postaju
                gradilište. Pravila smo provjerili na ortofotu: na slučajnom uzorku čestica koje je karta proglasila putom i na
                najvećima koje nije.
              </li>
              <li>
                <strong className="text-zinc-900">Ima li dovoljno mjesta za novu česticu?</strong> Slobodni komad mora biti barem
                velik kao najmanja čestica za gradnju koju pravila traže za taj dio grada. To smije doseći i zajedno sa slobodnim
                susjedom iste namjene. Uz to mora imati dio koji je posvuda širok barem 10 m i velik barem 400 m² (koliko GUP u većini područja traži za dvojnu kuću). Zato otpadaju
                pojasevi uz putove, ostaci dvorišta i prolazi između zgrada, i kad bi zbrojeni bili dovoljno veliki. Na kraju, zgrada
                mora biti 5 m od javne ulice i 3 m od susjednih čestica: kad se ti odmaci oduzmu, mora ostati barem 150 m² mjesta za zgradu
                široku barem 8 m (tu najmanju kuću pretpostavili smo mi; GUP je ne propisuje). Karta boji samo mjesto na
                kojem zgrada smije stajati; odmak oko njega je dvorište ili prilaz, a ne mjesto za zgradu.
              </li>
              <li>
                <strong className="text-zinc-900">Dopušta li plan ondje stanovanje?</strong> Da u stambenim zonama (S), mješovitim
                zonama (M1–M3) i poslovnim zonama sa stanovanjem (K5). Ne u zonama javne i društvene, gospodarske, poslovne,
                turističke, športske, lučke i posebne namjene.
              </li>
              <li>
                <strong className="text-zinc-900">Je li za mjesto zatražena ili izdana dozvola?</strong> Iz registra akata na geoportalu
                ISPU uzimamo lokacijske i građevinske dozvole za novu gradnju izdane od 2020. i zahtjeve u obradi. Njihove čestice
                računamo zajedno, kao jednu građevnu česticu: dozvola je već odlučila da je dovoljno velika, pa ondje ne vrijede
                „premalo”, „uska čestica, zapravo put” ni ostatak uz postojeću zgradu, a neuređeno zemljište postaje uređeno. Stambena
                ili nestambena dozvola ide u svoju skupinu, kao „zatražena dozvola” ili „izdana dozvola”.
              </li>
              <li>
                <strong className="text-zinc-900">Je li ondje na snazi detaljni plan?</strong> Gdje je na snazi plan užeg područja (
                <Navod id="list-planske-mjere-2025">list 4.d</Navod>, granice s ISPU-a), gradi se samo po njemu (
                <Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>). UPU-i namjenu GUP-a u pravilu ne mijenjaju, pa ondje
                vrijedi namjena GUP-a. DPU je može mijenjati: granicu DPU-a karta crta iscrtkano, a slobodno zemljište u njemu blago
                posvijetli („odlučuje DPU”), osim u DPU-ima po kojima su izdane dozvole za nove stambene zgrade, gdje je
                zemljište u zonama za gradnju u stambenim stavkama (slobodno, neuređeno, zatražena ili izdana dozvola). U tumaču klika piše koji je to plan. Izgrađeno, javno
                zemljište, putovi i teren koji nije za gradnju ostaju svoji, jer ne ovise o planu.
              </li>
            </ol>
          </section>

          <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
            <h2 id="izvori" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
              Izvori i ograničenja
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Karta koristi isti izračun kao stranica{" "}
                <Link href="/gup#kako-je-izracunato" className={vanjska}>
                  Split po GUP-u
                </Link>{" "}
                (način brojanja „po odredbama”). Područje je podijeljeno na kvadratiće od oko 2 m. Namjenu i pravila gradnje
                pročitali smo s PDF listova prijedloga GUP-a iz travnja 2025. Zgrade su iz katastra (DGU) i gradskog 3D modela.
                Ulice, parkirališta i parkovi su iz gradskih podataka i OpenStreetMapa, a dio smo ručno provjerili na ortofotu.
                Tamna crta obrubljuje zone za stanovanje i prati iste kvadratiće kao boje karte (preko neupisanih putova je
                zatvorena). Uz granicu zone pogreška može biti 5–10 m, pa za česticu uz granicu vrijedi ono što piše na samom listu.
              </li>
              <li>
                Granice sanacije, preobrazbe i neuređenog područja precrtane su s{" "}
                <Navod id="list-planske-mjere-2025">lista 4.d</Navod>. Granice detaljnijih planova koji su već na snazi preuzete su
                s ISPU-a, državnog sustava prostornih planova. Gdje takav plan vrijedi, gradit će se po njemu. Njegovu namjenu i pravila
                ovdje nismo provjerili, pa karta slobodno zemljište ondje pokazuje kao „odlučuje plan”.
              </li>
              <li>
                Dozvole su iz registra akata na geoportalu ISPU (Ministarstvo prostornoga uređenja): sve lokacijske i građevinske
                dozvole i zahtjevi koji diraju zelene čestice karte i slobodne čestice pod planom na snazi. Karta pokazuje one izdane od
                2020. (starije su istekle ako gradnja nije počela) i zahtjeve u obradi. Čestice jednog akta su iz njegova popisa
                katastarskih čestica, pa klik na bilo koju pokaže cijelu skupinu. Odbijeni i povučeni zahtjevi nisu na karti, kao ni
                dozvole za ulice, kanalizaciju i drugu infrastrukturu: one obuhvaćaju desetke čestica, javnih i privatnih, a ne znače
                da se na njima gradi kuća.
              </li>
              <li>
                Vlasnik je iz GIS izvoza Grada Splita (stanje 3. 10. 2025.), iz kojeg karta uzima samo je li vlasnik država, Grad ili
                županija. Za oko 60 % zemljišta u granici GUP-a izvoz vlasnika ne navodi, a za vojnu zonu na Lori ne navodi državu, pa
                je karta prepoznaje po namjeni.
              </li>
              <li>
                Karta ne provjerava privatne vlasnike i suvlasnike, vodi li do čestice ulica dovoljne širine, priključke, nagib i tlo, zaštitu kulturne baštine i
                krajobraza, pojas uz more i vodotoke, ni posebne uvjete nadležnih tijela. Ništa od toga ne može „ne može” pretvoriti
                u „može”, ali može obrnuto. Prije kupnje ili gradnje zatraži od Grada lokacijsku informaciju: službeni podatak o tome
                koji planovi i koja namjena vrijede za tvoju česticu.
              </li>
              <li>
                Karta pokriva samo područje GUP-a (unutar iscrtkane granice). Za ostatak Splita vrijedi Prostorni plan uređenja
                Grada Splita, i ondje karta ništa ne boji.
              </li>
            </ul>
          </section>
        </GradnjaPrikaz>
      </div>
    </div>
  );
}

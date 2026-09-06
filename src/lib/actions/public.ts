"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/lib/db";
import { helpPledges, odourReports, submissions } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { storeFile } from "@/lib/upload";
import { NEIGHBORHOODS, CATEGORIES, ODOUR_STRENGTHS } from "@/lib/constants";
import type { Neighborhood, Category, OdourStrength } from "@/lib/constants";
import { smijeUpisati, zapisiZrak } from "@/lib/arhiva-zraka";
import { DOPUSTENE_MINUTE, krajEpizode } from "@/lib/dojava-trajanje";
import { procitajMjesto } from "@/lib/mjesto";
import { satniVjetar } from "@/lib/vjetar-sat";
import { PRIJEDLOZI_POSTAJA } from "@/lib/sim/prijedlozi-postaja";
import { OGRADA_PONUDE, provjeriPonudu } from "@/lib/ukljuci-se";

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitProblem(formData: FormData): Promise<SubmitResult> {
  // Honeypot: real users never fill this hidden field.
  if (formData.get("website")) return { ok: true };

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return {
      ok: false,
      error: "Previše prijava u kratkom vremenu. Pokušajte ponovno za sat vremena.",
    };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "");
  const category = String(formData.get("category") ?? "");
  const submitterName = String(formData.get("name") ?? "").trim() || null;
  const submitterContact = String(formData.get("contact") ?? "").trim() || null;

  if (title.length < 5 || title.length > 200) {
    return { ok: false, error: "Naslov mora imati između 5 i 200 znakova." };
  }
  if (description.length < 20 || description.length > 5000) {
    return { ok: false, error: "Opis mora imati između 20 i 5000 znakova." };
  }
  if (!(neighborhood in NEIGHBORHOODS)) {
    return { ok: false, error: "Odaberite kvart." };
  }
  if (!(category in CATEGORIES)) {
    return { ok: false, error: "Odaberite kategoriju." };
  }

  const photoUrls: string[] = [];
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrls.push(await storeFile(photo));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Greška pri spremanju fotografije." };
    }
  }

  // Lokacija s karte, ako je došla.
  //
  // Tablica prijava nema stupce za koordinate (prijedlozi ih imaju), pa se
  // dopisuje na kraj opisa, odvojena i označena — moderator je vidi i prenosi
  // na prijedlog pri objavi. Vrijednosti se ovdje provjeravaju PONOVNO, jer
  // su iz upita i prošle su kroz preglednik: poveznicom se ne smije podmetati
  // tekst u prijavu.
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const kcSirovi = String(formData.get("kc") ?? "");
  const uOkviru =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 43.5 &&
    lat <= 43.55 &&
    lng >= 16.45 &&
    lng <= 16.54;
  const kc = /^[0-9]{1,6}(\/[0-9]{1,4})?$/.test(kcSirovi) ? kcSirovi : null;
  const opis = uOkviru
    ? `${description}\n\n— Lokacija s karte: ${
        kc ? `k.č. ${kc}, ` : ""
      }${lat.toFixed(6)}, ${lng.toFixed(6)}`
    : description;

  await db.insert(submissions).values({
    title,
    description: opis,
    neighborhood: neighborhood as Neighborhood,
    category: category as Category,
    submitterName,
    submitterContact,
    photoUrls,
  });

  return { ok: true };
}

/** Koliko unatrag dojava smije ići; dalje od toga sat se više ne pamti točno. */
const NAJSTARIJA_DOJAVA_DANA = 30;

/**
 * Koliko dojava na sat primamo: po pregledniku i, kao široka gornja granica,
 * po adresi. Dvadeset po nosu pokriva i dojavitelja koji javlja svakih pet
 * minuta kroz epizodu; šezdeset po adresi pokriva zgradu na istom NAT-u.
 */
const OGRADA_DOJAVA = { poDojavitelju: 20, poAdresi: 60 } as const;

/**
 * Razmak između dvaju upisa arhive vjetra koje pokrenu dojave; ista ograda
 * kakvu drže `/api/karepovac/vjetar` i pregled (`arhiva-zraka.ts`).
 */
const OGRADA_ARHIVE = { kljuc: "dojava", razmakMs: 5 * 60_000 } as const;

/**
 * Dojava sama osigura vjetar za svoj sat.
 *
 * Arhivu vjetra (`wind_readings`) inače pune samo simulator i pregled; u
 * tihom tjednu prođe i više od dana bez posjeta, AZO-ov prozor od 24 sata
 * istekne i sat dojave ostane bez vjetra zauvijek — a stranica obećava da
 * će stići. Zato se poslije spremljene dojave, iza odgovora (`after`),
 * dohvati satni vjetar istim pravilom kao za simulator i zapiše. Ograda je
 * ista kao drugdje, pa deset dojava u epizodi ne znači deset dohvata.
 * Greška ovdje ne dira dojavu: ona je već spremljena.
 */
async function arhivirajVjetarZaDojavu(): Promise<void> {
  if (!smijeUpisati(OGRADA_ARHIVE)) return;
  try {
    const vjetar = await satniVjetar(new Date());
    await zapisiZrak(vjetar.sada, vjetar);
  } catch (greska) {
    console.error("dojava: arhiva vjetra nije upisana", greska);
  }
}

export async function prijaviMiris(formData: FormData): Promise<SubmitResult> {
  // Honeypot: real users never fill this hidden field.
  if (formData.get("website")) return { ok: true };

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Oznaka preglednika: nasumična, bez veze s identitetom (vidi
  // `src/lib/dojavitelj.ts`). Prima se samo ako izgleda kao ono što taj
  // modul piše — tuđi sadržaj u tom stupcu ne bi imao nikakvu svrhu.
  const sirovaOznaka = String(formData.get("reporterId") ?? "");
  const reporterId = /^[0-9a-f]{32}$/.test(sirovaOznaka) ? sirovaOznaka : null;

  // Ograda ide po pregledniku, ne po adresi: susjedi na istom mobilnom
  // operateru dijele jednu javnu adresu, a epizoda mirisa je baš trenutak
  // kad ih javlja najviše. Adresa ostaje kao široka gornja granica protiv
  // skripte koja bi oznaku mijenjala sa svakim pozivom.
  if (!checkRateLimit(ip, { bucket: "dojava-adresa", max: OGRADA_DOJAVA.poAdresi })) {
    return {
      ok: false,
      error:
        "S ove mreže smo u zadnjih sat vremena primili neobično mnogo dojava. Pokušajte za koju minutu.",
    };
  }
  if (
    reporterId &&
    !checkRateLimit(reporterId, { bucket: "dojava", max: OGRADA_DOJAVA.poDojavitelju })
  ) {
    return {
      ok: false,
      error: `Iz ovog preglednika smo u zadnjih sat vremena primili ${OGRADA_DOJAVA.poDojavitelju} dojava — za jedan nos je to dosta. Pokušajte kasnije.`,
    };
  }

  // Dojava „ne smrdi" vrijedi koliko i „smrdi" — bez nje se ne zna koliko
  // je često smrdjelo, nego samo koliko je ljudi javilo.
  const smelled = String(formData.get("smelled") ?? "da") !== "ne";
  const strength = String(formData.get("strength") ?? "");
  // Adresa je zamijenila kvart i slobodnu napomenu: kvart nijedna karta nije
  // prikazivala, a napomenu nitko nije mogao pretvoriti u brojku.
  const place = String(formData.get("place") ?? "").trim() || null;
  const ongoing = String(formData.get("ongoing") ?? "") === "1";
  // Trajanje je razred, ne mjerenje: prima se samo ono što obrazac nudi.
  const sirovoTrajanje = Number(formData.get("trajanjeMin"));
  const durationMin = DOPUSTENE_MINUTE.includes(sirovoTrajanje)
    ? sirovoTrajanje
    : null;
  const mjesto = procitajMjesto(formData.get("lat"), formData.get("lng"));

  if (smelled && !(strength in ODOUR_STRENGTHS)) {
    return { ok: false, error: "Odaberite koliko se jako osjetilo." };
  }
  if (place && place.length > 120) {
    return {
      ok: false,
      error: "Adresa je predugačka — skratite je na 120 znakova.",
    };
  }

  // Sat dolazi iz preglednika, pa se ovdje provjerava ponovno. Bez ispravnog
  // sata dojava se ne može spojiti s vjetrom i ne vrijedi ništa, a sat u
  // budućnosti ili od prije godinu dana pokvario bi ružu.
  const kada = new Date(String(formData.get("kada") ?? ""));
  const sada = Date.now();
  if (Number.isNaN(kada.getTime())) {
    return { ok: false, error: "Odaberite dan i sat." };
  }
  if (kada.getTime() > sada + 3_600_000) {
    return { ok: false, error: "Odabrani sat još nije došao." };
  }
  if (kada.getTime() < sada - NAJSTARIJA_DOJAVA_DANA * 86_400_000) {
    return {
      ok: false,
      error: `Javiti se može za zadnjih ${NAJSTARIJA_DOJAVA_DANA} dana.`,
    };
  }
  // Minuta se zaokružuje na pet, ne na puni sat. Sat bi bio pregrub: epizoda
  // koja počne u 14.50 i traje petnaest minuta prelazi u sljedeći sat, pa je
  // nosi vjetar obaju sati — a zaokružena na 14.00 cijela bi pripala prvomu.
  // Pet minuta je i dovoljno grubo da o dojavitelju ne govori više od potrebe.
  const KORAK_MS = 5 * 60_000;
  const occurredAt = new Date(Math.floor(kada.getTime() / KORAK_MS) * KORAK_MS);

  // Kraj razdoblja izvodi se iz trajanja, a ne iz drugog odabira sata:
  // epizoda kraća od sata je jedan sat s mirisom, dulja se razlije na
  // onoliko sati koliko doista pokriva, jer se vjetar mogao okrenuti.
  // Vrijedi i za „nije smrdjelo”: tko je bio vani cijelu večer i ništa nije
  // osjetio, opisao je više sati tišine, a `satiDojave` ih broji jednako.
  const endedAt = krajEpizode(occurredAt, durationMin);

  try {
    await db.insert(odourReports).values({
      occurredAt,
      endedAt,
      durationMin,
      // „Još traje” ima smisla samo za miris; tišina koja „još traje” nije
      // opažanje nego prognoza.
      ongoing: smelled && ongoing,
      smelled,
      // Kad se nije osjetilo, jačine nema — a ne „slabo”.
      strength: smelled ? (strength as OdourStrength) : null,
      place,
      reporterId,
      lat: mjesto?.lat ?? null,
      lng: mjesto?.lng ?? null,
    });
  } catch {
    return {
      ok: false,
      error: "Dojava nije spremljena. Provjerite vezu i pokušajte ponovno.",
    };
  }
  after(arhivirajVjetarZaDojavu);
  return { ok: true };
}

export type PonudaRezultat =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /**
       * Ponuda je bila valjana, ali nije zapisana — baza nije odgovorila.
       * Obrazac tada nudi drugi put (grupa, popis #28), a ne samo „pokušajte
       * ponovno”: tko je jednom rekao „mogu”, ne smije otići bez traga.
       */
      nijeZapisano?: true;
    };

/** Postaje koje obrazac smije navesti; sve ostalo je podmetnuto poveznicom. */
const POZNATE_POSTAJE: ReadonlySet<string> = new Set(
  PRIJEDLOZI_POSTAJA.map((p) => p.id),
);

/**
 * Ponuda pomoći za mjerne postaje — bez uplate, bez obveze.
 *
 * Isti obrambeni red kao kod dojava: skriveno polje za robote, pet upisa na
 * sat po IP-u, pa provjera koju obrazac već obavlja u pregledniku i koja se
 * ovdje ponavlja jer preglednik nije naš. Tablica `help_pledges` možda još
 * nije stvorena na poslužitelju (shema se gura rukom), pa upis ne smije
 * srušiti stranicu: vraća se pošten odgovor i drugi put do ljudi.
 */
export async function ponudiPomoc(formData: FormData): Promise<PonudaRezultat> {
  // Honeypot: real users never fill this hidden field.
  if (formData.get("website")) return { ok: true };

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip, OGRADA_PONUDE)) {
    return {
      ok: false,
      error: "Pet ponuda na sat je najviše što primamo. Pokušajte ponovno kasnije.",
    };
  }

  const provjera = provjeriPonudu(
    {
      vrste: formData.getAll("vrsta").map(String),
      postaja: String(formData.get("postaja") ?? ""),
      podrucje: String(formData.get("podrucje") ?? ""),
      kontakt: String(formData.get("kontakt") ?? ""),
      poruka: String(formData.get("poruka") ?? ""),
    },
    POZNATE_POSTAJE,
  );
  if (!provjera.ok) return provjera;

  const { ponuda } = provjera;
  try {
    await db.insert(helpPledges).values({
      kinds: [...ponuda.vrste],
      stationId: ponuda.postaja,
      area: ponuda.podrucje,
      contact: ponuda.kontakt,
      message: ponuda.poruka,
    });
  } catch (e) {
    // Tablica `help_pledges` nastaje tek s `npm run db:push`; ako je nema,
    // svaki upis pada. Stanovnik dobiva pošten odgovor, ali i tko vodi
    // poslužitelj mora vidjeti da ponude propadaju — inače nitko ne sazna.
    console.error("help_pledges: upis ponude nije uspio", e);
    return {
      ok: false,
      nijeZapisano: true,
      error:
        "Ponuda nije zapisana: baza trenutačno ne odgovara. Nije do vas — pokušajte za koji sat, ili se javite drugim putem.",
    };
  }
  return { ok: true };
}

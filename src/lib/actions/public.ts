"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { odourReports, submissions } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { storeFile } from "@/lib/upload";
import { NEIGHBORHOODS, CATEGORIES, ODOUR_STRENGTHS } from "@/lib/constants";
import type { Neighborhood, Category, OdourStrength } from "@/lib/constants";
import { procitajMjesto } from "@/lib/mjesto";

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

export async function prijaviMiris(formData: FormData): Promise<SubmitResult> {
  // Honeypot: real users never fill this hidden field.
  if (formData.get("website")) return { ok: true };

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return {
      ok: false,
      error: "Previše dojava u kratkom vremenu. Pokušajte ponovno za sat vremena.",
    };
  }

  // Dojava „ne smrdi" vrijedi koliko i „smrdi" — bez nje se ne zna koliko
  // je često smrdjelo, nego samo koliko je ljudi javilo.
  const smelled = String(formData.get("smelled") ?? "da") !== "ne";
  const strength = String(formData.get("strength") ?? "");
  const neighborhood = String(formData.get("neighborhood") ?? "");
  const place = String(formData.get("place") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const ongoing = String(formData.get("ongoing") ?? "") === "1";
  // Oznaka preglednika: nasumična, bez veze s identitetom (vidi
  // `src/lib/dojavitelj.ts`). Prima se samo ako izgleda kao ono što taj
  // modul piše — tuđi sadržaj u tom stupcu ne bi imao nikakvu svrhu.
  const sirovaOznaka = String(formData.get("reporterId") ?? "");
  const reporterId = /^[0-9a-f]{32}$/.test(sirovaOznaka) ? sirovaOznaka : null;
  const mjesto = procitajMjesto(formData.get("lat"), formData.get("lng"));

  if (smelled && !(strength in ODOUR_STRENGTHS)) {
    return { ok: false, error: "Odaberite koliko se jako osjetilo." };
  }
  if (!(neighborhood in NEIGHBORHOODS)) {
    return { ok: false, error: "Odaberite kvart." };
  }
  if (place && place.length > 120) {
    return { ok: false, error: "Ulica ili orijentir smije imati najviše 120 znakova." };
  }
  if (note && note.length > 500) {
    return { ok: false, error: "Napomena smije imati najviše 500 znakova." };
  }

  // Sat dolazi iz preglednika, pa se ovdje provjerava ponovno. Bez ispravnog
  // sata dojava se ne može spojiti s vjetrom i ne vrijedi ništa, a sat u
  // budućnosti ili od prije godinu dana pokvario bi ružu.
  const kada = new Date(String(formData.get("kada") ?? ""));
  const sada = Date.now();
  if (Number.isNaN(kada.getTime())) {
    return { ok: false, error: "Odaberite kada se miris osjetio." };
  }
  if (kada.getTime() > sada + 3_600_000) {
    return { ok: false, error: "Vrijeme dojave ne može biti u budućnosti." };
  }
  if (kada.getTime() < sada - NAJSTARIJA_DOJAVA_DANA * 86_400_000) {
    return {
      ok: false,
      error: `Javiti se može za zadnjih ${NAJSTARIJA_DOJAVA_DANA} dana.`,
    };
  }
  // Sat se zaokružuje jer se vjetar ionako vodi po punom satu; točnija minuta
  // ne bi dodala ništa, a rekla bi o dojavitelju više nego što treba.
  const occurredAt = new Date(Math.floor(kada.getTime() / 3_600_000) * 3_600_000);

  // Kraj razdoblja: dojava time postaje raspon sati, a svaki sat nosi svoj
  // vjetar. Kraj prije početka ili predaleko u budućnosti nije raspon nego
  // pogreška unosa, pa se odbija umjesto da tiho pokvari ružu.
  let endedAt: Date | null = null;
  const sirovKraj = String(formData.get("doKada") ?? "");
  if (smelled && sirovKraj) {
    const kraj = new Date(sirovKraj);
    if (Number.isNaN(kraj.getTime())) {
      return { ok: false, error: "Odaberite kada je miris prestao." };
    }
    if (kraj.getTime() < kada.getTime()) {
      return { ok: false, error: "Kraj mirisa ne može biti prije početka." };
    }
    if (kraj.getTime() > sada + 3_600_000) {
      return { ok: false, error: "Kraj mirisa ne može biti u budućnosti." };
    }
    endedAt = new Date(Math.floor(kraj.getTime() / 3_600_000) * 3_600_000);
  }

  try {
    await db.insert(odourReports).values({
      occurredAt,
      endedAt,
      ongoing: smelled && ongoing,
      smelled,
      // Kad se nije osjetilo, jačine nema — a ne „slabo”.
      strength: smelled ? (strength as OdourStrength) : null,
      neighborhood: neighborhood as Neighborhood,
      place,
      note,
      reporterId,
      lat: mjesto?.lat ?? null,
      lng: mjesto?.lng ?? null,
    });
  } catch {
    return { ok: false, error: "Dojava nije spremljena. Pokušajte ponovno." };
  }
  return { ok: true };
}

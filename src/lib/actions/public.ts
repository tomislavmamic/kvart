"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { storeFile } from "@/lib/upload";
import { NEIGHBORHOODS, CATEGORIES } from "@/lib/constants";
import type { Neighborhood, Category } from "@/lib/constants";

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

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

  await db.insert(submissions).values({
    title,
    description,
    neighborhood: neighborhood as Neighborhood,
    category: category as Category,
    submitterName,
    submitterContact,
    photoUrls,
  });

  return { ok: true };
}

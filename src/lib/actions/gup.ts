"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { gupIspravci } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { OGRADA_ISPRAVKA, provjeriIspravak } from "@/lib/gup-grad/ispravci";

export type IspravakRezultat = { ok: true } | { ok: false; error: string };

/** Prijedlog ispravka čestice s karte provjere GUP-a. */
export async function predloziIspravak(formData: FormData): Promise<IspravakRezultat> {
  // Honeypot: pravi posjetitelj ovo skriveno polje ne popunjava.
  if (formData.get("website")) return { ok: true };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip, OGRADA_ISPRAVKA)) {
    return { ok: false, error: "Previše prijedloga u kratko vrijeme. Pokušajte ponovno za sat." };
  }
  const provjera = provjeriIspravak(Object.fromEntries(formData.entries()));
  if (!provjera.ok) return provjera;
  try {
    await db.insert(gupIspravci).values(provjera.ispravak);
  } catch (e) {
    // Tablica `gup_ispravci` nastaje tek s `npm run db:push`.
    console.error("gup_ispravci: upis prijedloga nije uspio", e);
    return { ok: false, error: "Prijedlog nije zapisan: baza trenutačno ne odgovara. Pokušajte kasnije." };
  }
  return { ok: true };
}

import { NextResponse } from "next/server";
import { nadiCestice } from "@/lib/dosje";

/**
 * Traženje čestice po broju ili adresi.
 *
 * Postoji zato što je dosje — jedino zbog čega ova stranica postoji — dosad
 * bio dostupan isključivo klikom u poligon. Tipkovnicom se do njega nije
 * moglo doći nikako: geometrija na karti nema `tabindex`, pa je korisnik koji
 * ne rukuje mišem mogao proći kroz svaku kontrolu na stranici i ne vidjeti
 * nijednu česticu. WCAG AA je zapisan kao pod, a ovo je bio zid.
 *
 * Usput rješava i pitanje koje mišem nema odgovora: „znam svoj broj čestice,
 * gdje je?” Dosad se to tražilo zumiranjem i pogađanjem.
 */
export const revalidate = 3600;

export async function GET(request: Request): Promise<Response> {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ pogodci: [] });
  if (q.length > 40)
    return NextResponse.json({ error: "Predug upit." }, { status: 400 });

  try {
    return NextResponse.json({ pogodci: await nadiCestice(q) });
  } catch (e) {
    console.error("Traženje čestice nije uspjelo:", e);
    return NextResponse.json(
      { error: "Traženje nije moguće." },
      { status: 500 }
    );
  }
}

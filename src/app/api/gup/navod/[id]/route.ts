/**
 * Ulomak navoda GUP-a za skočni prozor: `/api/gup/navod/<id>` → Ulomak
 * (src/lib/gup-dokument/model.ts). Svi navodi su poznati pri gradnji, pa je
 * svaki odgovor statična datoteka.
 */
import { imenaNavoda, razrijesi } from "@/lib/gup-dokument/navodi";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await imenaNavoda()).map((id) => ({ id }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = await razrijesi(id);
  if (!u) return Response.json({ error: "Nepoznat navod." }, { status: 404 });
  return Response.json(u);
}

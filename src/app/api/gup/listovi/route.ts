/**
 * Podaci o kartografskim prikazima GUP-a (veličina, razine pločica,
 * uklapanje): `/api/gup/listovi` → { <id lista>: List }. Treba ih skočni
 * prozor čestice da isječe službeni list oko čestice. Statično.
 */
import { ucitajListove } from "@/lib/gup-dokument/podaci";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(await ucitajListove());
}

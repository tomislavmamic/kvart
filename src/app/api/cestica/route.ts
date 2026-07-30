import { NextResponse } from "next/server";
import { dosjeZaTocku } from "@/lib/dosje";

/**
 * Dosje čestice za kliknutu točku: što je na njoj, kroz nju i nad njom.
 *
 * Račun je na poslužitelju jer su slojevi zajedno 7,6 MB, a odgovor
 * nekoliko kilobajta (vidi src/lib/dosje.ts). Slojevi se čitaju s diska i
 * ostaju u memoriji, pa je prvi poziv nakon hladnog starta sporiji.
 */
export const revalidate = 3600;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  // Isto ograničenje kao /api/solar — točka mora biti u okolici Splita.
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 43.4 ||
    lat > 43.6 ||
    lng < 16.3 ||
    lng > 16.7
  ) {
    return NextResponse.json({ error: "Točka je izvan područja." }, { status: 400 });
  }

  try {
    const dosje = await dosjeZaTocku(lng, lat);
    return NextResponse.json(dosje);
  } catch (e) {
    console.error("Dosje čestice nije sastavljen:", e);
    return NextResponse.json(
      { error: "Dosje nije moguće sastaviti." },
      { status: 500 }
    );
  }
}

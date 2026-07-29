import { NextResponse } from "next/server";

/**
 * Proxy prema JRC PVGIS API-ju: za kliknutu točku vraća procjenu godišnjeg
 * prinosa fotonaponskog sustava. Drži se u backendu radi keširanja i da se
 * ne otkriva vanjski API izravno pregledniku.
 */
export const revalidate = 86400; // dan

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  // Ograniči na šire područje Splita — spriječi zloupotrebu kao općeg proxyja.
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 43.4 ||
    lat > 43.6 ||
    lon < 16.3 ||
    lon > 16.7
  ) {
    return NextResponse.json(
      { error: "Točka je izvan područja." },
      { status: 400 }
    );
  }

  const pvgis = new URL("https://re.jrc.ec.europa.eu/api/v5_3/PVcalc");
  pvgis.searchParams.set("lat", lat.toFixed(5));
  pvgis.searchParams.set("lon", lon.toFixed(5));
  pvgis.searchParams.set("peakpower", "1"); // 1 kWp referentni sustav
  pvgis.searchParams.set("loss", "14");
  pvgis.searchParams.set("outputformat", "json");

  try {
    const res = await fetch(pvgis.toString(), {
      headers: { "User-Agent": "nas-kvart-split/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "PVGIS trenutno nedostupan." },
        { status: 502 }
      );
    }
    const data = await res.json();
    const totals = data?.outputs?.totals?.fixed;
    if (!totals) {
      return NextResponse.json(
        { error: "Nema podataka za ovu točku." },
        { status: 502 }
      );
    }
    // E_y = godišnja proizvodnja (kWh) za 1 kWp; H(i)_y = godišnja iradijacija.
    return NextResponse.json({
      kwhPerKwp: Math.round(totals.E_y),
      irradiation: Math.round(totals.H_i_y ?? totals["H(i)_y"] ?? 0),
    });
  } catch {
    return NextResponse.json(
      { error: "Greška pri dohvaćanju podataka." },
      { status: 502 }
    );
  }
}

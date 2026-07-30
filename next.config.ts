import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Dosje čestice (/api/cestica) čita slojeve s diska iz public/geo/grad.
   *
   * Provjereno na Next 16.2: praćenje datoteka i bez ovoga pokupi cijeli
   * public/, pa je pravilo trenutačno suvišno. Stoji jer ruta o tim
   * datotekama ovisi u izvođenju, a ne kroz uvoz — bez zapisa bi promjena
   * u praćenju srušila rutu tek na Vercelu, i to bez traga u gradnji.
   *
   * Izuzeti se ne može ovom polugom: za istu rutu uključivanje nadjačava
   * outputFileTracingExcludes, a i sam public/ se svejedno prenosi. Da
   * čestice s vlasništvom ne odu u oblak brine .gitignore (datoteka nije u
   * repozitoriju) i SAMO_LOKALNO u map-views.ts (sloj nije u registru).
   */
  outputFileTracingIncludes: {
    "/api/cestica": ["public/geo/grad/**/*.geojson"],
  },
};

export default nextConfig;

import { MapClient } from "@/components/karta/map-client";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Karta kvarta",
  description:
    "Istraži prostorne planove, katastarske čestice, javne površine i infrastrukturu Dračevca i Bilica.",
});

export default function MapPage() {
  return (
    <div>
      {/* Naslov i opis žive u bočnoj traci; ovdje ostaju samo za čitače
          zaslona i tražilice, da karta dobije cijelu visinu prozora. */}
      <h1 className="sr-only">Karta kvarta</h1>
      <MapClient />
    </div>
  );
}

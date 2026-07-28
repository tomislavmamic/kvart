import type { Metadata } from "next";
import { MapClient } from "@/components/karta/map-client";

export const metadata: Metadata = {
  title: "Karta kvarta",
  description:
    "Interaktivna karta Dračevca i Bilica: planovi, zelenilo, mobilnost, infrastruktura, javni prostori i rizici na jednoj karti.",
};

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

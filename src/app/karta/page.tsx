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
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Karta kvarta</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Odaberite pogled i istražite Dračevac i Bilice kroz otvorene podatke —
          što je planirano, gdje je zelenilo, kako stoji infrastruktura i gdje su
          rizici. Za slobodno kombiniranje slojeva otvorite „Prilagodi”.
        </p>
      </div>
      <MapClient />
    </div>
  );
}

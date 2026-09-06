"use client";

import { useEffect } from "react";

import { ObrazacDojave } from "./obrazac";

/**
 * Kad stranica padne, obrazac ostaje.
 *
 * Stranica ispod obrasca čita bazu (dosadašnje dojave, arhiva vjetra), a
 * obrazac za slanje ne treba ništa od toga — spremanje ide svojim putem i
 * često uspije sekundu poslije neuspjelog čitanja (hladni start, spavanje
 * baze). Zato ova granica ne pokazuje „nešto je pošlo po zlu” nego isti
 * obrazac, s jednom rečenicom o brojkama kojih nema.
 */
export default function DojavaGreska({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("dojava: stranica nije prošla", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold tracking-tight text-kamen-tinta">
        Kakav je zrak?
      </h1>
      <div className="mt-4">
        <ObrazacDojave />
      </div>
      <p
        role="status"
        className="mt-10 text-base leading-7 text-kamen-drugi"
      >
        Dosadašnje dojave i ruža trenutačno se ne mogu učitati; dojava se
        svejedno sprema.{" "}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="fokus inline-flex min-h-11 items-center rounded font-semibold text-maslina-tamna underline underline-offset-4"
        >
          Pokušaj ponovno učitati
        </button>
      </p>
    </div>
  );
}

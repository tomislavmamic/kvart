import type { Metadata } from "next";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Prijavi problem" };

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Prijavi problem ili prijedlog</h1>
      <p className="mt-2 text-zinc-600">
        Bez registracije, traje minutu. Što konkretniji opis i fotografija —
        veća šansa da se stvar pomakne.
      </p>
      <div className="mt-8">
        <SubmitForm />
      </div>
    </div>
  );
}

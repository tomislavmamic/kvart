import { StranicaIzdanja } from "@/components/gup-dokument/stranica-izdanja";
import { izdanje, ZADANO_IZDANJE } from "@/lib/gup-dokument/izdanja";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "GUP Splita: tekst i kartografski prikazi",
  description:
    "Generalni urbanistički plan Splita na snazi (pročišćeni tekst, Sl. gl. 55/14): cijeli tekst odredbi po člancima i svi kartografski prikazi, s izdanjem iz 2006. i prijedlogom izmjena iz 2025.",
});

/** Plan na snazi. Ostala izdanja su na /gup/dokument/2006 i /gup/dokument/2025. */
export default function GupDokumentPage() {
  return <StranicaIzdanja izd={izdanje(ZADANO_IZDANJE)!} />;
}

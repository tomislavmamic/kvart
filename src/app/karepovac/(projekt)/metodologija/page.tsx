import {
  EvidenceRegister,
  PageIntro,
  SectionHeading,
} from "@/components/karepovac/project-components";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Kako mjerimo",
  description:
    "Objašnjavamo kako ćemo provjeravati senzore, ocjenjivati pouzdanost mjerenja i prikazivati njihova ograničenja.",
});

export default function MetodologijaPage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Što provjeravamo prije objave mjerenja">
        <p>
          Mjerenja još nisu počela. Jeftini senzori ne reagiraju samo na plin
          koji želimo pratiti. Na njih utječu temperatura, vlaga, drugi plinovi
          i vrijeme uporabe. Zato mjerenja nećemo objaviti čim uključimo uređaj.
        </p>
      </PageIntro>

      <section className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
        <SectionHeading title="Što želimo pratiti">
          <p>
            U početku želimo pratiti sumporovodik (H₂S). Promjene povezane s
            neugodnim mirisom možemo pratiti dodatnim senzorima, ali iz njih
            nećemo zaključivati o pojedinom plinu. Amonijak (NH₃) dodat ćemo
            samo ako se senzor pokaže dovoljno pouzdanim.
          </p>
        </SectionHeading>
        <dl className="overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          <MethodRow term="H₂S" value="Glavni plin u prvom pokusnom radu. Vrijednost ćemo objaviti samo uz provjeren ispravak i oznaku pouzdanosti." />
          <MethodRow term="Pokazatelj neugodnog mirisa" value="Može upozoriti na pojavu ili promjenu mirisa, ali ne pokazuje koji je plin prisutan." />
          <MethodRow term="NH₃" value="Dodat ćemo ga samo ako usporedna mjerenja pokažu da ga odabrani senzor može korisno pratiti pri očekivanim niskim koncentracijama." />
          <MethodRow term="Vjetar" value="Smjer i brzina vjetra zaseban su podatak za procjenu mogućeg smjera širenja. Njime nećemo popunjavati mjesta na kojima nema mjerenja." />
        </dl>
      </section>

      <section>
        <SectionHeading title="Kako provjeravamo uređaje">
          <p>
            Svaki uređaj proći će isti postupak. Ako se u nekom koraku pokaže
            nepouzdanim, to ćemo jasno navesti umjesto da podatke uljepšavamo.
          </p>
        </SectionHeading>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-kamen-tlo bg-kamen-tlo sm:grid-cols-5">
          {[
            ["Sastavljanje", "Sastavit ćemo uređaj i zabilježiti inačice senzora, elektronike, kućišta i programa."],
            ["Zajednička provjera", "Usporedit ćemo uređaje i provjeriti razlike, šum, pomak, prekide te utjecaj kućišta."],
            ["Usporedba", "Usporedit ćemo uređaje s pouzdanim mjerenjem kada ono bude dostupno."],
            ["Ispravci", "Zabilježit ćemo inačice ispravaka, pogrešku i poznata ograničenja."],
            ["Pokusni rad", "Tijekom 30 dana provjeravat ćemo rade li uređaji redovito, možemo li ih održavati i jesu li lokacije prikladne."],
          ].map(([title, body]) => (
            <li key={title} className="bg-white p-5">
              <h3 className="font-bold text-kamen-tinta">{title}</h3>
              <p className="mt-3 text-base leading-7 text-kamen-tekst">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionHeading title="Izvor ostaje uz podatak">
          <p>
            Boja i naziv govore je li nešto izmjereno na našoj postaji,
            preuzeto iz službenog izvora ili procijenjeno modelom.
          </p>
        </SectionHeading>
        <div className="mt-7">
          <EvidenceRegister />
        </div>
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-950 sm:p-8">
        <h2 className="text-xl font-bold">Ovo nije sigurnosni alarm</h2>
        <p className="mt-3 max-w-3xl leading-7">
          Buduća očitanja bit će orijentacijska mjerenja naših postaja. Ne
          potvrđuju usklađenost s propisima, ne zamjenjuju službeni nadzor i ne
          smiju se koristiti za zaštitu radnika ili hitne odluke.
        </p>
      </section>
    </div>
  );
}

function MethodRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="grid gap-2 border-b border-kamen-tlo p-5 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:gap-6 sm:p-6">
      <dt className="font-bold text-kamen-tinta">{term}</dt>
      <dd className="leading-7 text-kamen-tekst">{value}</dd>
    </div>
  );
}

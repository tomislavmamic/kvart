import {
  DATASET_SECTIONS,
  DEAD_ENDS,
  CATALOG_DATE,
  CATALOG_BBOX,
} from "@/lib/datasets";
import type { Dataset, DatasetStatus } from "@/lib/datasets";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Katalog prostornih podataka",
  description:
    "Otvoreni prostorni podaci dostupni za područje Dračevca i Bilica — izvori, formati, licence i stanje pristupa.",
});

const STATUS_STYLES: Record<DatasetStatus, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-rose-100 text-rose-800",
};

export default function DataCatalogPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Katalog prostornih podataka</h1>
      <p className="mt-3 text-zinc-600">
        Popis otvorenih prostornih podataka koji postoje za područje Dračevca i
        Bilica (obuhvat {CATALOG_BBOX}): satelitske i zračne snimke, prostorni
        planovi, infrastruktura, zelenilo, okoliš, stanovništvo. Svaki izvor
        istražen je {CATALOG_DATE} — oznaka{" "}
        <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          provjereno
        </span>{" "}
        znači da je servis tada odgovorio na stvarni upit.
      </p>

      {DATASET_SECTIONS.map((section, i) => (
        <section key={section.title} className="mt-10">
          <h2 className="border-b border-zinc-200 pb-2 text-xl font-bold">
            <span className="mr-2 text-emerald-700">
              {String.fromCharCode(65 + i)}
            </span>
            {section.title}
          </h2>
          {section.intro && (
            <p className="mt-2 text-sm text-zinc-500">{section.intro}</p>
          )}
          <div className="mt-4 space-y-4">
            {section.items.map((item) => (
              <DatasetCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10">
        <h2 className="border-b border-zinc-200 pb-2 text-xl font-bold">
          <span className="mr-2 text-rose-700">✕</span>Slijepe ulice —
          provjereno nedostupno
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-zinc-700">
          {DEAD_ENDS.map((d) => (
            <li key={d.name}>
              <strong>{d.name}</strong> — {d.reason}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs text-zinc-400">
        Katalog je informativan popis javno dostupnih izvora; uvjeti korištenja
        pojedinog izvora navedeni su uz svaki zapis.
      </p>
    </div>
  );
}

function DatasetCard({ item }: { item: Dataset }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5">
      <h3 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900">
        {item.name}
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[item.status]}`}
        >
          {item.statusLabel}
        </span>
      </h3>
      <p className="mt-2 text-sm text-zinc-700">{item.desc}</p>
      {item.endpoints && (
        <div className="mt-3 overflow-x-auto rounded-lg bg-zinc-50 px-3 py-2">
          {item.endpoints.map((e) => (
            <code
              key={e}
              className="block whitespace-nowrap text-xs text-zinc-600"
            >
              {e}
            </code>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        <strong className="text-zinc-600">Format:</strong> {item.format}
        {" · "}
        <strong className="text-zinc-600">Licenca:</strong> {item.license}
        {" · "}
        <strong className="text-zinc-600">Pokrivenost kvarta:</strong>{" "}
        {item.coverage}
      </p>
      {item.note && (
        <p className="mt-1.5 text-xs text-zinc-400">{item.note}</p>
      )}
    </article>
  );
}

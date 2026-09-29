import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { AirPlumeFallback, AirPlumePreview } from "@/components/proposals/air-proposal";
import { getProposals } from "@/lib/queries";
import { ProposalCard } from "@/components/proposal-card";
import { NEIGHBORHOODS, CATEGORIES, STATUSES } from "@/lib/constants";
import type { Neighborhood, Category, Status } from "@/lib/constants";
import { FEATURED_PROPOSALS } from "@/lib/featured-proposals";
import {
  PROBLEMS_SHARE_DESCRIPTION,
  createPageMetadata,
} from "@/lib/metadata";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Prijedlozi",
  description: PROBLEMS_SHARE_DESCRIPTION,
});

interface SearchParams {
  kvart?: string;
  kategorija?: string;
  status?: string;
}

function pick<T extends Record<string, string>>(
  value: string | undefined,
  options: T
): keyof T | undefined {
  return value && value in options ? (value as keyof T) : undefined;
}

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const neighborhood = pick(params.kvart, NEIGHBORHOODS) as Neighborhood | undefined;
  const category = pick(params.kategorija, CATEGORIES) as Category | undefined;
  const status = pick(params.status, STATUSES) as Status | undefined;

  const items = await getProposals({ neighborhood, category, status });
  const featured = [...FEATURED_PROPOSALS.slice(1), FEATURED_PROPOSALS[0]].filter((p) =>
    (!neighborhood || p.neighborhoods.includes(neighborhood)) &&
    (!category || p.category === category) &&
    (!status || status === "objavljeno")
  );
  const otherItems = items.filter((p) => !FEATURED_PROPOSALS.some((f) => f.slug === p.slug));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Prijedlozi</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-kamen-tekst">Bolji pristup kvartu. Više prostora za ljude i hlada. Bolji uvid u zrak koji dišemo. Pogledajte što predlažemo.</p>
        </div>
        <Link
          href="/prijavi"
          className="fokus inline-flex min-h-11 items-center rounded-full bg-maslina px-5 py-2 text-sm font-semibold text-white hover:bg-maslina-tamna"
        >
          Dodaj prijedlog
        </Link>
      </div>

      <details className="mt-7 border-t border-kamen-rub pt-2" open={Boolean(neighborhood || category || status)}>
      <summary className="fokus w-fit cursor-pointer py-3 text-sm font-semibold text-kamen-tekst">Filtriraj prijedloge{(neighborhood || category || status) && " · filtri uključeni"}</summary>
      <form method="get" className="flex flex-wrap gap-3 pb-5 text-sm">
        <FilterSelect name="kvart" label="Svi kvartovi" options={NEIGHBORHOODS} selected={params.kvart} />
        <FilterSelect name="kategorija" label="Sve kategorije" options={CATEGORIES} selected={params.kategorija} />
        <FilterSelect name="status" label="Svi statusi" options={STATUSES} selected={params.status} />
        <button
          type="submit"
          className="fokus min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium hover:bg-zinc-100"
        >
          Filtriraj
        </button>
      </form>
      </details>

      <div className="mt-5 grid gap-x-8 gap-y-12 sm:grid-cols-2">
        {featured.map((p, index) => {
          const air = p.slug === "pracenje-zagadenja-zraka";
          const wide = index === 0 || air;
          return <article key={p.slug} className={wide ? "sm:col-span-2" : ""}>
            <Link href={`/prijedlozi/${p.slug}`} className="fokus group block rounded-xl">
            <div className={`relative overflow-hidden rounded-xl bg-kamen-rub ${air ? "aspect-[2/1]" : p.slug === "uredenje-nogostupa" ? "aspect-[1688/932]" : wide ? "aspect-[5/3]" : "aspect-[4/3]"}`}>
              {air ? <Suspense fallback={<AirPlumeFallback />}><AirPlumePreview /></Suspense> : <Image src={p.image} alt={p.imageAlt} fill preload={index === 0} sizes={wide ? "(max-width: 1024px) 100vw, 992px" : "(max-width: 640px) 100vw, 480px"} className="object-cover" />}
            </div>
            <p className="mt-2 text-xs leading-5 text-kamen-tekst">{p.visualNote}</p>
            <div className={wide ? "mt-3 grid gap-4 sm:grid-cols-[1fr_1fr] sm:gap-8" : "mt-3"}>
              <h2 className={`font-bold leading-tight tracking-tight group-hover:underline ${wide ? "text-2xl sm:text-3xl" : "text-2xl"}`}>{p.title}</h2>
              <div><p className={`${wide ? "" : "mt-3 "}max-w-2xl leading-7 text-kamen-tekst`}>{p.description}</p><p className="mt-3 font-semibold text-kamen-tinta">{p.detail}</p><span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-maslina">Pogledaj prijedlog <span className="ml-2" aria-hidden>→</span></span></div>
            </div>
          </Link>
          {air && <Link href="/karepovac/zrak" className="fokus mt-4 inline-flex min-h-12 items-center rounded-full bg-maslina px-6 py-3 font-semibold text-white hover:bg-maslina-tamna">Pogledaj zrak s Karepovca <span className="ml-2" aria-hidden>→</span></Link>}
          </article>;
        })}
      </div>

      {otherItems.length > 0 && <h2 className="mt-12 text-xl font-bold">Ostali prijedlozi susjeda</h2>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {otherItems.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>
      {featured.length === 0 && otherItems.length === 0 && (
        <p className="mt-8 text-zinc-500">
          Nema prijedloga za odabrane filtere.
        </p>
      )}
    </div>
  );
}

function FilterSelect({
  name,
  label,
  options,
  selected,
}: {
  name: string;
  label: string;
  options: Record<string, string>;
  selected?: string;
}) {
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={selected ?? ""}
      className="fokus min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2"
    >
      <option value="">{label}</option>
      {Object.entries(options).map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
}

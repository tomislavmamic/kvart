import type { Metadata } from "next";
import Link from "next/link";
import { getProposals } from "@/lib/queries";
import { ProposalCard } from "@/components/proposal-card";
import { NEIGHBORHOODS, CATEGORIES, STATUSES } from "@/lib/constants";
import type { Neighborhood, Category, Status } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Problemi i prijedlozi" };

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Problemi i prijedlozi</h1>
        <Link
          href="/prijavi"
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Prijavi problem
        </Link>
      </div>

      <form method="get" className="mt-6 flex flex-wrap gap-3 text-sm">
        <FilterSelect name="kvart" label="Svi kvartovi" options={NEIGHBORHOODS} selected={params.kvart} />
        <FilterSelect name="kategorija" label="Sve kategorije" options={CATEGORIES} selected={params.kategorija} />
        <FilterSelect name="status" label="Svi statusi" options={STATUSES} selected={params.status} />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium hover:bg-zinc-100"
        >
          Filtriraj
        </button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>
      {items.length === 0 && (
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
      defaultValue={selected ?? ""}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
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

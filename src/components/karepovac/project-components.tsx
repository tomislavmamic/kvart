import Link from "next/link";
import type { ReactNode } from "react";

import { KAREPOVAC_DATA_KINDS } from "@/lib/karepovac";

export function PageIntro({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="max-w-3xl">
      <h1 className="text-3xl font-bold leading-tight tracking-[-0.025em] text-kamen-tinta sm:text-4xl">
        {title}
      </h1>
      <div className="mt-4 text-lg leading-8 text-kamen-tekst">{children}</div>
    </header>
  );
}

export function SectionHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold tracking-[-0.02em] text-kamen-tinta">
        {title}
      </h2>
      {children && (
        <div className="mt-3 text-base leading-7 text-kamen-tekst">{children}</div>
      )}
    </div>
  );
}

export function PreparationNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 text-amber-950 ${
        compact ? "px-4 py-3" : "p-5 sm:p-6"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-600"
        />
        <div>
          <p className="font-bold">Projekt je u pripremi</p>
          {!compact && (
            <p className="mt-1 leading-7">
              Još nismo postavili nijednu postaju pa nema ni naših mjerenja.
              Ovdje ćemo objaviti rezultate tek kada provjerimo uređaje i način
              mjerenja.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MonitoringField() {
  return (
    <div className="relative min-h-[360px] overflow-hidden bg-white p-5 sm:min-h-[430px] sm:p-8">
      <svg
        aria-hidden="true"
        viewBox="0 0 620 430"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="620" height="430" fill="#ffffff" />
        <g stroke="#e4e4e7" strokeWidth="1">
          <path d="M0 86H620M0 172H620M0 258H620M0 344H620" />
          <path d="M124 0V430M248 0V430M372 0V430M496 0V430" />
        </g>
        <circle cx="340" cy="226" r="62" fill="#ecfdf5" />
        <circle cx="340" cy="226" r="24" fill="#007956" />
        <path d="M340 282L324 239H356L340 282Z" fill="#007956" />
        <circle cx="340" cy="226" r="8" fill="#ffffff" />
      </svg>

      <div className="relative flex min-h-[320px] flex-col justify-between sm:min-h-[366px]">
        <div className="flex items-start justify-between gap-4">
          <p className="max-w-[14rem] text-base font-semibold leading-6 text-kamen-drugi">
            Prikaz ostaje prazan dok ne dobijemo provjerena mjerenja.
          </p>
          <span className="rounded-full bg-kamen-plitko px-3 py-1.5 text-xs font-bold text-kamen-tekst">
            Mjerenja još nisu počela
          </span>
        </div>

        <div className="self-center rounded-full bg-white px-4 py-2 text-sm font-bold text-kamen-tinta shadow-[0_8px_20px_-8px_rgb(24_24_27/0.25)]">
          Karepovac
        </div>

        <dl className="grid gap-px overflow-hidden rounded-lg border border-kamen-rub bg-kamen-rub text-sm sm:grid-cols-2">
          <div className="bg-white p-3">
            <dt className="font-semibold text-kamen-tinta">Mjerenja mreže</dt>
            <dd className="mt-1 text-kamen-drugi">Mjerenja još nisu počela</dd>
          </div>
          <div className="bg-white p-3">
            <dt className="font-semibold text-kamen-tinta">Procjena prema vjetru</dt>
            <dd className="mt-1 text-kamen-drugi">Smjer širenja još ne procjenjujemo</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function EvidenceRegister() {
  const descriptions = {
    community: "Vrijednost izmjerena na pojedinoj postaji, uz vrijeme mjerenja i oznaku pouzdanosti.",
    official: "Podatak koji je objavilo nadležno tijelo, uz vrijeme objave i poveznicu na izvor.",
    estimated: "Procjena izrađena iz smjera i brzine vjetra, jasno odvojena od mjerenja.",
  } as const;

  return (
    <div className="overflow-hidden rounded-xl border border-kamen-tlo bg-white">
      {KAREPOVAC_DATA_KINDS.map((kind, index) => (
        <div
          key={kind.id}
          className={`grid gap-3 p-5 sm:grid-cols-[12rem_1fr] sm:gap-8 sm:p-6 ${
            index > 0 ? "border-t border-kamen-tlo" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <EvidenceMark kind={kind.id} />
            <h3 className="font-bold leading-6 text-kamen-tinta">{kind.label}</h3>
          </div>
          <p className="leading-7 text-kamen-tekst">{descriptions[kind.id]}</p>
        </div>
      ))}
    </div>
  );
}

function EvidenceMark({ kind }: { kind: "community" | "official" | "estimated" }) {
  if (kind === "community") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-maslina">
        <circle cx="12" cy="10" r="5" fill="currentColor" />
        <path d="M12 22 8.5 14h7L12 22Z" fill="currentColor" />
        <circle cx="12" cy="10" r="1.75" fill="white" />
      </svg>
    );
  }

  if (kind === "official") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-violet-700">
        <path d="M4 9 12 4l8 5v10H4V9Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 19v-6h8v6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-sky-700">
      <path d="M3 8c4-4 8 4 12 0 2-2 4-2 6-1M3 13c4-4 8 4 12 0 2-2 4-2 6-1M3 18c4-4 8 4 12 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="fokus inline-flex min-h-11 items-center justify-center rounded-full bg-maslina px-6 py-3 font-semibold text-white transition-colors hover:bg-maslina-tamna"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="fokus inline-flex min-h-11 items-center justify-center rounded-lg border border-kamen-rub bg-white px-5 py-2.5 font-semibold text-kamen-tekst transition-colors hover:bg-kamen-plitko"
    >
      {children}
    </Link>
  );
}

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
    <div
      data-preview="true"
      className="relative min-h-[440px] overflow-hidden bg-white p-5 sm:min-h-[520px] sm:p-8"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 620 520"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="620" height="520" fill="#ffffff" />
        <g stroke="#e4e4e7" strokeWidth="1">
          <path d="M0 104H620M0 208H620M0 312H620M0 416H620" />
          <path d="M124 0V520M248 0V520M372 0V520M496 0V520" />
        </g>
        <path
          d="M164 125C250 98 398 117 492 230"
          fill="none"
          stroke="#0284c7"
          strokeWidth="28"
          strokeLinecap="round"
          opacity="0.09"
        />
        <path
          d="M466 202 506 246 452 230Z"
          fill="#0284c7"
          opacity="0.24"
        />
        <circle cx="314" cy="255" r="66" fill="#ecfdf5" />
        <circle cx="314" cy="255" r="25" fill="#007956" />
        <path d="M314 314L297 269H331L314 314Z" fill="#007956" />
        <circle cx="314" cy="255" r="8" fill="#ffffff" />
      </svg>

      <div className="relative flex min-h-[400px] flex-col sm:min-h-[456px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-kamen-tinta">
            Ogledni podaci
          </span>
          <span className="rounded-lg bg-amber-100 px-3 py-2 text-right text-xs text-amber-900">
            <span className="block font-bold">Mjerenja još nisu počela</span>
            <span className="mt-0.5 block">Nisu stvarna mjerenja</span>
          </span>
        </div>

        <div className="relative min-h-[270px] flex-1" aria-label="Ogledne mjerne postaje">
          <PreviewStation name="Postaja A" value="1,8 ppb" left="4%" top="42%" />
          <PreviewStation name="Postaja B" value="4,2 ppb" left="68%" top="20%" />
          <PreviewStation name="Postaja C" value="2,6 ppb" left="73%" top="63%" />

          <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 text-center">
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-kamen-tinta shadow-[0_8px_20px_-8px_rgb(24_24_27/0.25)]">
              Karepovac
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-kamen-rub bg-kamen-rub text-sm sm:grid-cols-3">
          <div data-kind="measurement" className="bg-white p-3">
            <dt className="font-semibold text-kamen-tinta">Postaja B</dt>
            <dd className="mt-1 font-mono tabular-nums text-kamen-drugi">
              H₂S 4,2 ppb · 13:10
            </dd>
          </div>
          <div className="bg-white p-3">
            <dt className="font-semibold text-kamen-tinta">Vjetar</dt>
            <dd className="mt-1 font-mono tabular-nums text-kamen-drugi">
              SZ · 3,2 m/s
            </dd>
          </div>
          <div data-kind="estimated" className="col-span-2 bg-white p-3 sm:col-span-1">
            <dt className="font-semibold text-kamen-tinta">
              Procjena prema vjetru
            </dt>
            <dd className="mt-1 text-kamen-drugi">Prema jugoistoku</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function PreviewStation({
  name,
  value,
  left,
  top,
}: {
  name: string;
  value: string;
  left: string;
  top: string;
}) {
  return (
    <div
      data-kind="measurement"
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border border-kamen-rub bg-white px-2 py-1.5 sm:px-3 sm:py-2"
      style={{ left, top }}
    >
      <span className="block whitespace-nowrap text-xs font-bold text-kamen-tinta sm:text-sm">
        {name}
      </span>
      <span className="block whitespace-nowrap font-mono text-xs tabular-nums text-kamen-drugi sm:text-sm">
        H₂S · {value}
      </span>
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

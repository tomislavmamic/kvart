import { PrimaryNavigation } from "@/components/primary-navigation";

export const dynamic = "force-dynamic";

export default function HomePage() {
  // Random start point for the hero pan so it doesn't always begin at the
  // west (Bilice) edge. Negative delay starts the animation mid-cycle; the
  // full there-and-back cycle is 180s (90s each way). Fresh per request.
  //
  // react-hooks/purity flags Math.random() in render, and for a client
  // component it would be right — server and client would disagree at
  // hydration. This is a server component on a force-dynamic page: the value
  // is drawn once per request, baked into the HTML, and never re-rendered on
  // the client, so there is nothing to mismatch. Moving it to an effect would
  // only add a visible jump from the west edge to the random offset.
  // eslint-disable-next-line react-hooks/purity
  const heroPanDelay = `-${(Math.random() * 180).toFixed(1)}s`;

  return (
    <section className="hero-viewport relative left-1/2 -ml-[50vw] -mt-8 w-screen overflow-hidden bg-maslina-noc text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/photos/kvart-strip.jpg"
        alt="Zračna snimka Dračevca i Bilica"
        className="hero-pan absolute inset-y-0 left-0 h-full w-auto max-w-none"
        style={{ animationDelay: heroPanDelay }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-maslina-noc/95 via-maslina-noc/45 to-transparent sm:hidden" />
      <div className="absolute inset-0 hidden sm:block sm:bg-[linear-gradient(75deg,rgba(2,44,34,0.9)_0%,rgba(2,44,34,0.55)_36%,rgba(2,44,34,0.06)_63%,transparent_80%)]" />

      <div className="relative mx-auto flex min-h-[82vh] max-w-5xl flex-col justify-end px-4 pb-14 pt-28 sm:min-h-[86vh] sm:px-6">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Dračevac · Bilice · Split
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] sm:text-5xl">
            Ovo je naš kvart.
            <br />
            Učinimo ga boljim.
          </h1>
          <p className="mt-4 text-lg text-emerald-50/90">
            Razgovaraj sa susjedima, istraži kvart i uključi se.
          </p>
        </div>

        <div className="mt-8">
          <PrimaryNavigation variant="hero" />
        </div>
      </div>

      <a
        href="https://geoportal.dgu.hr"
        target="_blank"
        rel="noopener noreferrer"
        className="fokus absolute bottom-3 right-4 text-xs text-white/70 hover:text-white"
      >
        DOF 2023 · Državna geodetska uprava
      </a>
    </section>
  );
}

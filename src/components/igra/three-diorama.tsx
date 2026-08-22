"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DEFAULT_EXAGGERATION } from "./three-scene-model";

type Runtime = Awaited<ReturnType<typeof import("./three-scene")["createKvartScene"]>>;

const LABELS = ["Dračevac", "Bilice", "Akvadukt"] as const;

export function ThreeDiorama() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const runtimeRef = useRef<Runtime | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [cameraView, setCameraView] = useState({
    zoom: 1,
    isDefault: true,
    exaggeration: DEFAULT_EXAGGERATION,
  });
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (!infoOpen) return;
    const tipka = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInfoOpen(false);
    };
    document.addEventListener("keydown", tipka);
    return () => document.removeEventListener("keydown", tipka);
  }, [infoOpen]);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const followPreference = () => {
      pausedRef.current = motionPreference.matches;
      setPaused(motionPreference.matches);
      runtimeRef.current?.setPaused(motionPreference.matches);
    };
    followPreference();
    motionPreference.addEventListener("change", followPreference);
    return () => motionPreference.removeEventListener("change", followPreference);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    void import("./three-scene")
      .then(({ createKvartScene }) => {
        if (cancelled) return null;
        return createKvartScene(
          canvas,
          labelRefs.current.filter((element): element is HTMLSpanElement => element !== null),
          setCameraView,
        );
      })
      .then((runtime) => {
        if (!runtime) return;
        if (cancelled) {
          runtime.dispose();
          return;
        }
        runtimeRef.current = runtime;
        runtime.setPaused(pausedRef.current);
        observer = new ResizeObserver(([entry]) => {
          runtime.resize(entry.contentRect.width, entry.contentRect.height);
        });
        observer.observe(canvas);
        const bounds = canvas.getBoundingClientRect();
        runtime.resize(bounds.width, bounds.height);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  function togglePaused() {
    const nextPaused = !pausedRef.current;
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    runtimeRef.current?.setPaused(nextPaused);
  }

  return (
    <div className="igra-3d-stage" data-status={status}>
      <canvas
        ref={canvasRef}
        className="igra-3d-canvas"
        aria-label="3D maketa reljefa Dračevca i Bilica"
        role="img"
        aria-describedby="igra-camera-help"
      />

      <div className="igra-3d-labels" aria-hidden="true">
        {LABELS.map((label, index) => (
          <span
            key={label}
            ref={(element) => {
              labelRefs.current[index] = element;
            }}
            className={label === "Akvadukt" ? "igra-3d-label igra-3d-label-landmark" : "igra-3d-label"}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="igra-3d-status" role="status" aria-live="polite">
        <p>
          {status === "unsupported"
            ? "3D prikaz nije dostupan u ovom pregledniku."
            : "Slažem reljef kvarta…"}
        </p>
        <Link href="/svg">Otvori SVG verziju</Link>
      </div>

      <Link href="/" className="fokus igra-exit" aria-label="Zatvori maketu" title="Zatvori">
        <CloseIcon />
      </Link>

      <div className="igra-camera-controls" aria-label="Upravljanje prikazom">
        <button
          type="button"
          onClick={() => runtimeRef.current?.zoomIn()}
          disabled={status !== "ready" || cameraView.zoom >= 5}
          className="fokus"
          aria-label="Povećaj prikaz"
          title="Povećaj prikaz"
        >
          <ZoomInIcon />
        </button>
        <button
          type="button"
          onClick={() => runtimeRef.current?.zoomOut()}
          disabled={status !== "ready" || cameraView.zoom <= 1}
          className="fokus"
          aria-label="Smanji prikaz"
          title="Smanji prikaz"
        >
          <ZoomOutIcon />
        </button>
        <button
          type="button"
          onClick={() => runtimeRef.current?.resetView()}
          disabled={status !== "ready" || cameraView.isDefault}
          className="fokus"
          aria-label="Vrati cijeli kvart"
          title="Vrati cijeli kvart"
        >
          <ResetViewIcon />
        </button>
        <button
          type="button"
          onClick={() => runtimeRef.current?.cycleExaggeration()}
          disabled={status !== "ready"}
          className="fokus igra-exaggeration"
          aria-label={`Preuveličanje visina, sada ${formatExaggeration(cameraView.exaggeration)} puta`}
          title="Preuveličaj visine"
        >
          <span aria-hidden="true">×{formatExaggeration(cameraView.exaggeration)}</span>
        </button>
        <button
          type="button"
          onClick={togglePaused}
          aria-pressed={paused}
          className="fokus"
          aria-label={paused ? "Pokreni animaciju" : "Pauziraj animaciju"}
          title={paused ? "Pokreni animaciju" : "Pauziraj animaciju"}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button
          type="button"
          onClick={() => setInfoOpen((open) => !open)}
          aria-expanded={infoOpen}
          aria-controls="igra-o-maketi"
          className="fokus"
          aria-label="O maketi i izvorima"
          title="O maketi i izvorima"
        >
          <InfoIcon />
        </button>
      </div>

      <output className="sr-only" aria-live="polite">
        Prikaz {cameraView.zoom.toLocaleString("hr-HR", { maximumFractionDigits: 1 })} puta,
        visine preuveličane {formatExaggeration(cameraView.exaggeration)} puta
      </output>

      {/* Ploča je uvijek u dokumentu, samo skrivena: pripis izvora je uvjet
          licencije, a ne pomoćni tekst koji smije postojati tek nakon klika. */}
      <div id="igra-o-maketi" className="igra-o-maketi" hidden={!infoOpen}>
        <div className="igra-o-maketi-tijelo">
          <h1>Kvart u pokretu</h1>
          <p>
            Reljefna maketa Dračevca i Bilica: teren iz LiDAR snimke u koraku
            od 3 metra, sa 105 metara visinske razlike, a na njemu stvarne
            ceste, zgrade i akvadukt.
          </p>
          <p id="igra-camera-help">
            Povuci za zaokretanje · desnom tipkom ili s dva prsta pomakni ·
            kotačićem ili prstima približi.
          </p>
          <p className="igra-o-maketi-izvori">
            Reljef: DGU-ov LiDAR digitalni model reljefa (DMR) · ceste, zelene
            površine, odlagalište i oblik krova: OpenStreetMap (ODbL) ·
            zgrade, visine i Dioklecijanov vodovod: GIS Grada Splita.
          </p>
          <p className="igra-o-maketi-izvori">
            Izmjerenu visinu ima 181 od 415 zgrada; ostale stoje na medijanu
            izmjerenih zgrada istog tlocrta u ovom kvartu, što je procjena o
            kvartu, a ne o toj zgradi. Da krov ima nagib, za 181 zgradu tvrdi
            grad, za još njih 134 samo OSM. Kojeg je oblika zna jedino OSM, a
            ondje je „dvostrešni” zadana vrijednost razmazana preko sloja, ne
            opažanje po kući. Prikaz je pojednostavljena maketa, nije
            geodetski proizvod.
          </p>
          <button type="button" className="fokus" onClick={() => setInfoOpen(false)}>
            Zatvori
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6v.9" />
    </svg>
  );
}

/** Preuveličanje se ispisuje hrvatski: decimalni zarez, bez suvišne nule. */
function formatExaggeration(value: number) {
  return value.toLocaleString("hr-HR", { maximumFractionDigits: 1 });
}

function ZoomInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 21 21M10.5 7.5v6M7.5 10.5h6" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 21 21M7.5 10.5h6" />
    </svg>
  );
}

function ResetViewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 9a8 8 0 1 1-.2 5.5M5 9V4m0 5h5" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
      <rect x="4" y="3" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="12" y="3" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
      <path d="M5 3.8v12.4c0 .8.9 1.3 1.6.8l9.1-6.2a1 1 0 0 0 0-1.6L6.6 3c-.7-.5-1.6 0-1.6.8Z" fill="currentColor" />
    </svg>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";

export function DioramaController({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const followPreference = () => setPaused(motionPreference.matches);
    followPreference();
    motionPreference.addEventListener("change", followPreference);
    return () => motionPreference.removeEventListener("change", followPreference);
  }, []);

  return (
    <DioramaControllerView
      paused={paused}
      onToggle={() => setPaused((value) => !value)}
    >
      {children}
    </DioramaControllerView>
  );
}

export function DioramaControllerView({
  paused,
  onToggle,
  children,
}: {
  paused: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="igra-stage" data-paused={String(paused)}>
      {children}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={paused}
        className="fokus igra-motion-control"
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
        <span>{paused ? "Pokreni animaciju" : "Pauziraj animaciju"}</span>
      </button>
    </div>
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

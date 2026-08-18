import { SEKTORA, SEKTOR_IMENA } from "@/lib/dojave";

const STRANE = [
  { oznaka: "S", sektor: 0 },
  { oznaka: "I", sektor: 4 },
  { oznaka: "J", sektor: 8 },
  { oznaka: "Z", sektor: 12 },
] as const;

/** Točka na krugu za zadani sektor; sjever je gore, kut raste prema istoku. */
function uKrugu(sredina: number, polumjer: number, sektor: number) {
  const kut = ((sektor * 360) / SEKTORA - 90) * (Math.PI / 180);
  return [
    sredina + polumjer * Math.cos(kut),
    sredina + polumjer * Math.sin(kut),
  ] as const;
}

/**
 * Ruža po smjeru vjetra: svaki krak stoji u smjeru iz kojega je puhalo.
 *
 * Krak nikad ne kreće od sredine nego od unutarnjeg kruga. Kad bi kretao od
 * sredine, površina kraka rasla bi s kvadratom vrijednosti i oko bi razliku
 * čitalo puno većom nego što jest — a ove su razlike male i moraju ostati male.
 */
export function Ruza({
  vrijednosti,
  boja,
  opisZaCitac,
  opisi,
  biljeg,
}: {
  vrijednosti: readonly number[];
  boja: string;
  opisZaCitac: string;
  /** Tekst koji se pokaže nad svakim krakom; po jedan za svaki sektor. */
  opisi?: readonly string[];
  biljeg?: { sektor: number; naziv: string };
}) {
  const S = 340;
  const sredina = S / 2;
  const unutra = 32;
  const izvana = 118;
  const vrh = Math.max(...vrijednosti);
  const dno = Math.min(...vrijednosti);
  const raspon = vrh - dno * 0.9 || 1;

  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className="w-full max-w-[320px]"
      role="img"
      aria-label={opisZaCitac}
    >
      <circle cx={sredina} cy={sredina} r={izvana} fill="#fafafa" />
      {[0.5, 1].map((u) => (
        <circle
          key={u}
          cx={sredina}
          cy={sredina}
          r={unutra + (izvana - unutra) * u}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth="1"
        />
      ))}
      {vrijednosti.map((v, i) => {
        const udio = (v - dno * 0.9) / raspon;
        const duljina = unutra + (izvana - unutra) * udio;
        const sirina = 9;
        return (
          <g key={i} transform={`rotate(${(i * 360) / SEKTORA} ${sredina} ${sredina})`}>
            <path
              d={`M${sredina - sirina} ${sredina - unutra} L${sredina + sirina} ${sredina - unutra} L${sredina + sirina} ${sredina - duljina} Q${sredina} ${sredina - duljina - 4} ${sredina - sirina} ${sredina - duljina} Z`}
              fill={boja}
              fillOpacity={0.25 + 0.75 * udio}
              stroke="white"
              strokeWidth="2"
            >
              {opisi && <title>{opisi[i]}</title>}
            </path>
          </g>
        );
      })}
      {STRANE.map(({ oznaka, sektor }) => {
        const [tx, ty] = uKrugu(sredina, izvana + 13, sektor);
        return (
          <text
            key={oznaka}
            x={tx}
            y={ty + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#71717b"
          >
            {oznaka}
          </text>
        );
      })}
      {biljeg && (
        <>
          <line
            x1={uKrugu(sredina, izvana + 2, biljeg.sektor)[0]}
            y1={uKrugu(sredina, izvana + 2, biljeg.sektor)[1]}
            x2={uKrugu(sredina, izvana + 22, biljeg.sektor)[0]}
            y2={uKrugu(sredina, izvana + 22, biljeg.sektor)[1]}
            stroke="#18181b"
            strokeWidth="2"
          />
          <text
            x={uKrugu(sredina, izvana + 34, biljeg.sektor)[0]}
            y={uKrugu(sredina, izvana + 34, biljeg.sektor)[1] + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#18181b"
          >
            {biljeg.naziv}
          </text>
        </>
      )}
    </svg>
  );
}

export { SEKTOR_IMENA };

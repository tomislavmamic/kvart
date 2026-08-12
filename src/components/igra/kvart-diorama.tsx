import { IGRA_SCENE } from "@/generated/igra-scene";

type Point = readonly [number, number];
type Building = {
  readonly id: string;
  readonly kind: "home" | "large";
  readonly height: number;
  readonly tone: number;
  readonly base: readonly Point[];
};

const HOME_ROOFS = ["#ead9bd", "#e8c58f", "#d9ae91", "#cbd3c8", "#d2c1b5"];
const HOME_SIDES = ["#c4ab8b", "#bd9566", "#b0836c", "#9aa99b", "#a99486"];
const LARGE_ROOFS = ["#d9c67f", "#d2b56c", "#cdbd9a", "#b8c3b4", "#d4a46f"];
const LARGE_SIDES = ["#a88745", "#987638", "#988a6e", "#7f9180", "#9c6d49"];

const ROAD_WIDTHS = {
  major: { casing: 13, surface: 9, center: 1.3 },
  local: { casing: 8, surface: 5.5, center: 0.9 },
  minor: { casing: 5, surface: 3, center: 0 },
} as const;

const TREE_POSITIONS = [
  [408, 354], [466, 326], [522, 397], [589, 330], [648, 452], [714, 276],
  [756, 518], [844, 240], [906, 446], [973, 315], [1040, 518], [1110, 382],
  [1173, 472], [1233, 350], [1290, 427], [342, 444], [548, 520], [866, 574],
] as const;

const WALKERS = [
  [620, 448], [798, 520], [1034, 430], [1186, 350], [482, 404],
] as const;

const sortedBuildings = ([...IGRA_SCENE.buildings] as Building[]).sort(
  (left, right) => averageY(left.base) - averageY(right.base),
);
const sortedRoads = [...IGRA_SCENE.roads].sort(
  (left, right) => roadOrder(left.kind) - roadOrder(right.kind),
);

function roadOrder(kind: keyof typeof ROAD_WIDTHS) {
  return kind === "minor" ? 0 : kind === "local" ? 1 : 2;
}

function averageY(points: readonly Point[]) {
  return points.reduce((sum, point) => sum + point[1], 0) / points.length;
}

function pointsAttribute(points: readonly Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function pathAttribute(points: readonly Point[]) {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
    .join(" ");
}

function BuildingBlock({ building }: { building: Building }) {
  const top = building.base.map(([x, y]) => [x, y - building.height] as Point);
  const roofPalette = building.kind === "large" ? LARGE_ROOFS : HOME_ROOFS;
  const sidePalette = building.kind === "large" ? LARGE_SIDES : HOME_SIDES;
  const roof = roofPalette[building.tone % roofPalette.length];
  const side = sidePalette[building.tone % sidePalette.length];

  return (
    <g className={building.kind === "large" ? "igra-building-large" : "igra-building-home"}>
      <polygon
        points={pointsAttribute(building.base)}
        fill="#163f35"
        opacity="0.13"
        transform="translate(5 7)"
      />
      {building.base.map((point, index) => {
        const nextIndex = (index + 1) % building.base.length;
        return (
          <polygon
            key={`${building.id}-side-${index}`}
            points={pointsAttribute([top[index], top[nextIndex], building.base[nextIndex], point])}
            fill={side}
            opacity={index % 2 === 0 ? 0.96 : 0.82}
          />
        );
      })}
      <polygon points={pointsAttribute(top)} fill={roof} stroke="#725e46" strokeWidth="0.8" />
    </g>
  );
}

export function KvartDiorama() {
  const homes = sortedBuildings.filter((building) => building.kind === "home");
  const largeBuildings = sortedBuildings.filter((building) => building.kind === "large");

  return (
    <svg
      viewBox={IGRA_SCENE.viewBox.join(" ")}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-labelledby="igra-title igra-description"
      className="igra-scene"
    >
      <title id="igra-title">Kvart u pokretu</title>
      <desc id="igra-description">
        Stilizirani izometrijski model Dračevca i Bilica s glavnim cestama,
        kućama, velikim zgradama i Dioklecijanovim akvaduktom.
      </desc>
      <defs>
        <clipPath id="igra-land-clip">
          <polygon points={pointsAttribute(IGRA_SCENE.land)} />
        </clipPath>
      </defs>

      <rect width="1600" height="820" fill="#98cbd0" />
      <path d="M0 250 285 125l220 110 255-172 292 146 218-121 330 190V0H0Z" fill="#c6d9c7" />
      <path d="M0 288 285 163l220 110 255-172 292 146 218-121 330 190v-72l-330-190-218 121-292-146-255 172-220-110L0 216Z" fill="#73946f" opacity="0.58" />

      <g data-layer="land">
        <polygon
          points={pointsAttribute(IGRA_SCENE.land)}
          fill="#2e5d49"
          transform="translate(0 25)"
        />
        <polygon
          points={pointsAttribute(IGRA_SCENE.land)}
          fill="#88ae72"
          stroke="#4f7656"
          strokeWidth="2"
        />
      </g>

      <g data-layer="terrain">
        {IGRA_SCENE.terrain.map((area, index) => (
          <polygon
            key={area.name}
            points={pointsAttribute(area.points)}
            fill={index === 0 ? "#82a968" : "#92b779"}
            stroke="#5d815d"
            strokeWidth="1.5"
            opacity="0.78"
          />
        ))}
      </g>

      <g data-layer="roads" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {sortedRoads.map((road) => {
          const widths = ROAD_WIDTHS[road.kind];
          return (
            <g
              key={`${road.sourceId}-${road.sourcePathIndex}`}
              data-road-kind={road.kind}
            >
              <polyline
                points={pointsAttribute(road.points)}
                stroke="#756c60"
                strokeWidth={widths.casing}
              />
              <polyline
                points={pointsAttribute(road.points)}
                stroke={road.kind === "minor" ? "#d7cfbb" : "#eee8d8"}
                strokeWidth={widths.surface}
              />
              {widths.center > 0 ? (
                <polyline
                  points={pointsAttribute(road.points)}
                  stroke="#b5aa95"
                  strokeWidth={widths.center}
                  strokeDasharray={road.kind === "major" ? "8 10" : "5 8"}
                />
              ) : null}
            </g>
          );
        })}
      </g>

      <g data-layer="homes">
        {homes.map((building) => <BuildingBlock key={building.id} building={building} />)}
      </g>
      <g data-layer="large-buildings">
        {largeBuildings.map((building) => <BuildingBlock key={building.id} building={building} />)}
      </g>

      <g className="igra-trees" clipPath="url(#igra-land-clip)" aria-hidden="true">
        {TREE_POSITIONS.map(([x, y], index) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <rect x="-2" y="-3" width="4" height="13" rx="1" fill="#66523c" />
            <g className="igra-motion igra-tree-crown" style={{ animationDelay: `-${index * 0.31}s` }}>
              <path d="M0-27 11-5H-11Z" fill={index % 3 === 0 ? "#245c3d" : "#2f7048"} />
              <path d="M0-19 14 4H-14Z" fill={index % 2 === 0 ? "#367d4d" : "#2b6943"} />
            </g>
          </g>
        ))}
      </g>

      <g data-layer="aqueduct">
        <polyline
          points={pointsAttribute(IGRA_SCENE.aqueduct.arches)}
          fill="none"
          stroke="#806e58"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {IGRA_SCENE.aqueduct.arches.map(([x, y], index) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y - 3})`}>
            <path
              d="M-10 9V-7H10V9M-7 9V4a7 7 0 0 1 14 0v5"
              fill="none"
              stroke={index % 2 === 0 ? "#d9c9a9" : "#c8b594"}
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
          </g>
        ))}
      </g>

      <g aria-hidden="true">
        {IGRA_SCENE.vehiclePaths.map((road, index) => (
          <g
            key={road.id}
            className="igra-motion igra-vehicle"
            style={{
              offsetPath: `path('${pathAttribute(road.points)}')`,
              animationDelay: `-${index * 5.7}s`,
              animationDuration: index === 0 ? "18s" : "24s",
            }}
          >
            <rect
              x="-10"
              y="-5"
              width={index === 0 ? 24 : 18}
              height={index === 0 ? 10 : 9}
              rx="3"
              fill={index === 0 ? "#e8bf42" : index === 1 ? "#c95f4b" : "#f4efe2"}
              stroke="#4b463e"
              strokeWidth="1.2"
            />
            <rect x="-4" y="-3" width="8" height="4" rx="1" fill="#789ca0" />
          </g>
        ))}
      </g>

      <g clipPath="url(#igra-land-clip)" aria-hidden="true">
        {WALKERS.map(([x, y], index) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <g className="igra-motion igra-walker" style={{ animationDelay: `-${index * 1.7}s` }}>
              <circle cy="-6" r="3" fill="#f1c9a5" />
              <path d="M0-3v9m-4 7 4-7 4 7M-4 1l4 3 4-3" fill="none" stroke={index % 2 === 0 ? "#394e74" : "#8d4c45"} strokeWidth="2.4" strokeLinecap="round" />
            </g>
          </g>
        ))}
      </g>

      <g aria-hidden="true" transform="translate(1030 330)">
        {[0, 1, 2].map((index) => (
          <circle
            key={index}
            className="igra-motion igra-smoke"
            style={{ animationDelay: `-${index * 2.2}s` }}
            cx={index * 4}
            cy={index * -8}
            r={8 + index * 2}
            fill="#eef0e8"
            opacity="0.48"
          />
        ))}
      </g>

      <g className="igra-motion igra-birds" aria-hidden="true">
        <path d="M0 12q8-10 16 0 8-10 16 0M45 0q7-8 14 0 7-8 14 0" fill="none" stroke="#39545a" strokeWidth="3" strokeLinecap="round" />
      </g>

      <g className="igra-labels">
        {IGRA_SCENE.labels.map((label) => (
          <g key={label.text} transform={`translate(${label.position[0]} ${label.position[1] - 42})`}>
            <rect x="-58" y="-18" width="116" height="36" rx="18" fill="#fffdf5" stroke="#7f735f" strokeWidth="1.5" />
            <text textAnchor="middle" dominantBaseline="middle" fill="#28362e" fontSize="17" fontWeight="750">
              {label.text}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

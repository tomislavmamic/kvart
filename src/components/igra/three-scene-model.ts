export type ScenePoint = readonly [number, number];
export type WorldPoint = Readonly<{ x: number; z: number }>;
export type GroundPoint = Readonly<{ x: number; y: number; z: number }>;

export type RoadRibbon = Readonly<{
  positions: number[];
  indices: number[];
}>;

const VIEW_CENTER_X = 800;
const VIEW_CENTER_Y = 410;
const WORLD_SCALE = 8;

function clean(value: number) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

export function scenePointToWorld([screenX, screenY]: ScenePoint): WorldPoint {
  const isometricX = screenX - VIEW_CENTER_X;
  const isometricY = screenY - VIEW_CENTER_Y;
  const east = (isometricX + 2 * isometricY) / 2;
  const south = (2 * isometricY - isometricX) / 2;

  return {
    x: clean(east / WORLD_SCALE),
    z: clean(south / WORLD_SCALE),
  };
}

export function buildRoadRibbon(
  points: readonly WorldPoint[],
  width: number,
  elevation: number,
): RoadRibbon {
  if (points.length < 2) return { positions: [], indices: [] };

  const positions: number[] = [];
  const indices: number[] = [];
  const halfWidth = width / 2;

  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const directionX = next.x - previous.x;
    const directionZ = next.z - previous.z;
    const length = Math.hypot(directionX, directionZ) || 1;
    const normalX = (-directionZ / length) * halfWidth;
    const normalZ = (directionX / length) * halfWidth;

    positions.push(point.x + normalX, elevation, point.z + normalZ);
    positions.push(point.x - normalX, elevation, point.z - normalZ);

    if (index < points.length - 1) {
      const left = index * 2;
      const right = left + 1;
      const nextLeft = left + 2;
      const nextRight = left + 3;
      indices.push(left, nextLeft, right, nextLeft, nextRight, right);
    }
  });

  return { positions, indices };
}

export function samplePolyline(
  points: readonly WorldPoint[],
  progress: number,
): WorldPoint & { angle: number } {
  if (points.length < 2) {
    const point = points[0] ?? { x: 0, z: 0 };
    return { ...point, angle: 0 };
  }

  const lengths = points.slice(1).map((point, index) =>
    Math.hypot(point.x - points[index].x, point.z - points[index].z),
  );
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = Math.max(0, Math.min(1, progress)) * totalLength;

  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (remaining <= segmentLength || index === lengths.length - 1) {
      const start = points[index];
      const end = points[index + 1];
      const localProgress = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * localProgress,
        z: start.z + (end.z - start.z) * localProgress,
        angle: Math.atan2(end.z - start.z, end.x - start.x),
      };
    }
    remaining -= segmentLength;
  }

  return { ...points.at(-1)!, angle: 0 };
}

/**
 * Koliko svijeta stane u visinu kadra.
 *
 * Blok je 113 × 69 jedinica, a otkad se kamera vrti, po dijagonali zauzme
 * 132 — pa kadar mora biti širi nego kad je kut bio stalan, inače se maketa
 * pri zakretanju izreže na rubu. U uspravnom kadru se namjerno reže: bolje je
 * vidjeti ulice nego cijeli kvart u veličini nokta.
 */
export function sceneFrustumHeight(width: number, height: number) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const sceneWidth = aspect < 0.8 ? 118 : 152;
  return Math.max(92, sceneWidth / aspect);
}

/**
 * Visina zgrade u jedinicama makete.
 *
 * Metri ulaze iz izvora (gradski GIS, pa OSM, pa procjena), a `unitsPerMetre`
 * je isti omjer kojim se diže i teren — zgrada i brdo moraju stajati na istoj
 * okomitoj skali, inače preuveličanje reljefa utopi kvart u vlastito brdo.
 * Raspon je stegnut u metrima, ne u jedinicama, jer se i izvor mjeri u
 * metrima: ispod 4,5 m ništa se ne čita, iznad 27 m nema ničega u kvartu.
 */
export function buildingWorldHeight(heightMeters: number, unitsPerMetre: number) {
  return Math.max(4.5, Math.min(27, heightMeters)) * unitsPerMetre;
}

/**
 * Mreža visina u koordinatama makete.
 *
 * `heights` su metri nad morem, redak po redak od sjevera prema jugu, kakve
 * ih izrezuje `scripts/generate-igra-scene.ts`. `world` su rubovi mreže —
 * središta krajnjih ćelija, ne njihovi vanjski rubovi — pa se ploha razapinje
 * točno preko njih.
 */
export type ReliefGrid = Readonly<{
  cols: number;
  rows: number;
  world: Readonly<{ west: number; north: number; east: number; south: number }>;
  heights: Float32Array;
  /** Razred pokrova po ćeliji; 0 je nerazvrstano tlo. */
  cover: Uint8Array;
}>;

/**
 * Visina tla u točki makete.
 *
 * Ne interpolira bilinearno nego po istom trokutu po kojem je ploha i
 * sastavljena (dijagonala ide od sjeveroistoka prema jugozapadu). Razlika je
 * mala — do pola metra unutar ćelije od 3 m — ali cesta se polaže s podizajem
 * od svega 40 cm, pa bi bilinearna visina na rubu terase propala kroz teren.
 * Izvan mreže se rub produžuje, jer je alternativa rupa u tlu.
 *
 * Args:
 *   grid: Učitana mreža visina.
 *   x: Istočna koordinata makete.
 *   z: Južna koordinata makete.
 *
 * Returns:
 *   Visina u metrima nad morem.
 */
export function groundHeight(grid: ReliefGrid, x: number, z: number): number {
  const { cols, rows, world, heights } = grid;
  const spanX = world.east - world.west;
  const spanZ = world.south - world.north;
  const rawColumn = spanX === 0 ? 0 : ((x - world.west) / spanX) * (cols - 1);
  const rawRow = spanZ === 0 ? 0 : ((z - world.north) / spanZ) * (rows - 1);
  const column = Math.max(0, Math.min(cols - 1, rawColumn));
  const row = Math.max(0, Math.min(rows - 1, rawRow));
  const left = Math.floor(Math.min(cols - 2, column));
  const top = Math.floor(Math.min(rows - 2, row));
  const right = Math.min(cols - 1, left + 1);
  const bottom = Math.min(rows - 1, top + 1);
  const fx = column - left;
  const fz = row - top;

  const northWest = heights[top * cols + left];
  const northEast = heights[top * cols + right];
  const southWest = heights[bottom * cols + left];
  const southEast = heights[bottom * cols + right];

  if (fx + fz <= 1) {
    return northWest + fx * (northEast - northWest) + fz * (southWest - northWest);
  }
  return southEast + (1 - fx) * (southWest - southEast) + (1 - fz) * (northEast - southEast);
}

/**
 * Dodaje točke duž poteza dok razmak ne padne ispod `step`.
 *
 * Cesta izvučena iz OSM-a ima vrh ondje gdje skreće, a ne ondje gdje se teren
 * lomi. Preko padine bi takav potez presjekao brdo umjesto da ga prati.
 */
export function resamplePolyline(
  points: readonly WorldPoint[],
  step: number,
): WorldPoint[] {
  if (points.length < 2 || step <= 0) return [...points];
  const dense: WorldPoint[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const distance = Math.hypot(end.x - start.x, end.z - start.z);
    const pieces = Math.max(1, Math.ceil(distance / step));
    for (let piece = 1; piece <= pieces; piece += 1) {
      const progress = piece / pieces;
      dense.push({
        x: start.x + (end.x - start.x) * progress,
        z: start.z + (end.z - start.z) * progress,
      });
    }
  }
  return dense;
}

/**
 * Vrpca ceste koja prati tlo umjesto da leži na plohi.
 *
 * Isti oblik kao `buildRoadRibbon`, samo što visinu nosi svaka točka. Rubovi
 * vrpce dijele visinu osi: cesta se time na bočnoj padini ne uvija, nego
 * ostaje ravna poprijeko — kakva i jest, jer se cesta u teren usijeca.
 */
export function buildDrapedRibbon(
  points: readonly GroundPoint[],
  width: number,
): RoadRibbon {
  if (points.length < 2) return { positions: [], indices: [] };

  const positions: number[] = [];
  const indices: number[] = [];
  const halfWidth = width / 2;

  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const directionX = next.x - previous.x;
    const directionZ = next.z - previous.z;
    const length = Math.hypot(directionX, directionZ) || 1;
    const normalX = (-directionZ / length) * halfWidth;
    const normalZ = (directionX / length) * halfWidth;

    positions.push(point.x + normalX, point.y, point.z + normalZ);
    positions.push(point.x - normalX, point.y, point.z - normalZ);

    if (index < points.length - 1) {
      const left = index * 2;
      const right = left + 1;
      const nextLeft = left + 2;
      const nextRight = left + 3;
      indices.push(left, nextLeft, right, nextLeft, nextRight, right);
    }
  });

  return { positions, indices };
}

/**
 * Najmanji opisani pravokutnik tlocrta, kakav ga generator izračuna.
 *
 * `angle` je kut duže osi u ravnini tla, `length` uvijek ide uz nju.
 */
export type RoofFrame = Readonly<{
  x: number;
  z: number;
  angle: number;
  length: number;
  width: number;
}>;

/**
 * Nagib kosog krova. Dalmatinska kuća pod kupom kanalicom drži oko 22°.
 *
 * Gradski GIS zna kotu vrha i kotu dna, ali ne i kotu strehe — a razlika je
 * upravo ono što odlučuje izgleda li kuća kao kuća ili kao kutija s kapom.
 * Uspon sljemena se zato izvodi iz širine zgrade pod stalnim nagibom, i
 * ograniči na 45 % ukupne visine da plitka prizemnica ne postane šator.
 */
const ROOF_PITCH = Math.tan((22 * Math.PI) / 180);
const MAX_RIDGE_SHARE = 0.45;

export function roofRiseMetres(widthMetres: number, heightMetres: number) {
  return Math.min((widthMetres / 2) * ROOF_PITCH, heightMetres * MAX_RIDGE_SHARE);
}

/**
 * Četverostrešni krov nad opisanim pravokutnikom tlocrta.
 *
 * Krov se ne diže nad stvarnim tlocrtom nego nad njegovim pravokutnikom, i to
 * je izbor: pravi kosi krov nad razvedenim tlocrtom traži skelet poligona, a
 * pravokutnik nad njim viri koliko i prava streha. Kad je tlocrt gotovo
 * kvadratan, sljeme se stegne u vrh i krov ispadne piramidalan — kakav na
 * takvoj kući i jest.
 */
export function buildHipRoof(frame: RoofFrame, eaveY: number, ridgeY: number): RoadRibbon {
  const halfLength = frame.length / 2;
  const halfWidth = frame.width / 2;
  const ridgeHalf = Math.max(0, halfLength - halfWidth);
  const cos = Math.cos(frame.angle);
  const sin = Math.sin(frame.angle);

  const positions: number[] = [];
  const place = (u: number, v: number, y: number) => {
    const index = positions.length / 3;
    positions.push(frame.x + u * cos - v * sin, y, frame.z + u * sin + v * cos);
    return index;
  };

  const a = place(-halfLength, -halfWidth, eaveY);
  const b = place(halfLength, -halfWidth, eaveY);
  const c = place(halfLength, halfWidth, eaveY);
  const d = place(-halfLength, halfWidth, eaveY);
  const near = place(-ridgeHalf, 0, ridgeY);
  const far = place(ridgeHalf, 0, ridgeY);

  return {
    positions,
    indices: [
      near, far, b, near, b, a,
      far, near, d, far, d, c,
      a, d, near,
      c, b, far,
    ],
  };
}

/**
 * Koliko je puta okomita os makete rastegnuta u odnosu na vodoravnu.
 *
 * ×1 je istinit odnos i ondje se vidi koliko je kvart zapravo plosnat: 105 m
 * visinske razlike na 2 km širine. ×2 je zadano jer je to skala na kojoj su
 * zgrade već crtane, pa brdo i kuća stoje na istoj mjeri. ×3,5 je čitanje
 * karte, ne prikaz mjesta — korisno da se vide terase i usjeci.
 */
export const EXAGGERATION_STEPS = [1, 2, 3.5] as const;
export const DEFAULT_EXAGGERATION = 2;

export function nextExaggeration(current: number) {
  const index = EXAGGERATION_STEPS.findIndex((step) => step === current);
  return EXAGGERATION_STEPS[(index + 1) % EXAGGERATION_STEPS.length];
}

export type CameraZoomAction = "in" | "out" | "reset";

export function nextCameraZoom(current: number, action: CameraZoomAction) {
  if (action === "reset") return 1;
  const next = action === "in" ? current * 1.4 : current / 1.4;
  return Math.max(1, Math.min(5, Math.round(next * 100) / 100));
}

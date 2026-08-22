import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { IGRA_SCENE } from "@/generated/igra-scene";

import {
  buildDrapedRibbon,
  buildPitchedRoof,
  buildingWorldHeight,
  DEFAULT_EXAGGERATION,
  groundHeight,
  nextCameraZoom,
  nextExaggeration,
  resamplePolyline,
  roofRiseMetres,
  samplePolyline,
  sceneFrustumHeight,
  scenePointToWorld,
  type GroundPoint,
  type ReliefGrid,
  type WorldPoint,
} from "./three-scene-model";

type SceneRuntime = {
  resize: (width: number, height: number) => void;
  setPaused: (paused: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  cycleExaggeration: () => void;
  dispose: () => void;
};

export type CameraViewState = Readonly<{
  zoom: number;
  isDefault: boolean;
  exaggeration: number;
}>;

const RELIEF = IGRA_SCENE.relief;

/** Svjetske jedinice po vodoravnom metru — ista mjera drži teren i zgrade. */
const UNITS_PER_METRE = RELIEF.unitsPerMetre;

/**
 * Dno postolja, u metrima nad morem.
 *
 * Maketa je izrezan blok, a ne otok: donji rez je pod najnižom točkom kvarta
 * (8,4 m) toliko da se na bočnoj strani vidi cijelih 105 m visinske razlike, i
 * ništa ne tvrdi o onome što je ispod.
 */
const BASE_METRES = -40;

/** Koliko cesta lebdi nad tlom, u metrima — tek toliko da ne propadne kroz plohu. */
const ROAD_LIFT_METRES = 0.4;

/** Razmak uzoraka pri polaganju ceste na teren, u metrima. */
const DRAPE_STEP_METRES = 4;

const ROAD_WIDTHS = {
  major: { casing: 2.05, surface: 1.58 },
  local: { casing: 1.28, surface: 0.92 },
  minor: { casing: 0.78, surface: 0.5 },
} as const;

const BUILDING_COLORS = [0xd9c67f, 0xd3b36e, 0xd6c4a1, 0xb7c1b4, 0xd39c68];
const LARGE_BUILDING_COLORS = [0xc89c52, 0xb98a43, 0xaaa07d, 0x8ea08e, 0xb8784f];
/** Kupa kanalica: jedna boja za sve kose krovove, jer ih na terenu i ima jedna. */
const ROOF_TILE = 0xb0673f;

/**
 * Boje terena po visini i nagibu.
 *
 * Kvart se penje od doline uz Karepovac prema goloj kosini pod Kozjakom, i ta
 * se promjena vidi iz zraka: zeleno dolje, suha trava u sredini, ogoljeli
 * vapnenac gore i na svakoj strmini. Boje pripadaju ovoj sceni i nisu
 * sučeljski tokeni.
 */
const TERRAIN_LOW = new THREE.Color(0x76935c);
const TERRAIN_MID = new THREE.Color(0x9d9c69);
const TERRAIN_HIGH = new THREE.Color(0xc0b894);
const TERRAIN_ROCK = new THREE.Color(0xa39c8b);
const PLINTH_TOP = new THREE.Color(0xc0b191);
const PLINTH_BOTTOM = new THREE.Color(0x574f40);

/**
 * Boje pokrova, redom kojim ih generator upisuje u mrežu.
 *
 * Prvi razred je nerazvrstano tlo — ondje gdje ni jedan izvor ne tvrdi što
 * raste. Njegova težina miješanja je nula, pa se tamo vidi čisti raspon po
 * visini i nagibu: nepoznato ostaje nepoznato, a ne postaje kamenjar.
 */
const COVER_TONES = [
  { tone: 0xa79f8d, mix: 0 },
  { tone: 0x93a566, mix: 0.5 },
  { tone: 0x7d8a5d, mix: 0.5 },
  { tone: 0x4a6b41, mix: 0.62 },
  { tone: 0xb5a488, mix: 0.55 },
  { tone: 0x9a9078, mix: 0.66 },
] as const;

/** Ekvidistancija izohipsi urezanih u plohu terena, u metrima. */
const CONTOUR_INTERVAL_METRES = 5;
const CONTOUR_MAJOR_EVERY = 5;

function metresToUnits(metres: number) {
  return metres * UNITS_PER_METRE;
}

function polygonShape(points: readonly (readonly [number, number])[]) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    const world = scenePointToWorld(point);
    if (index === 0) shape.moveTo(world.x, -world.z);
    else shape.lineTo(world.x, -world.z);
  });
  shape.closePath();
  return shape;
}

/**
 * Učitava izrezanu mrežu visina koju uz modul zapisuje generator scene.
 *
 * Pola megabajta `int16` putuje kao datoteka, ne kao JavaScript: kao literali
 * u modulu isto bi to bilo pola milijuna brojeva za raščlanjivanje prije nego
 * što se ijedan trokut nacrta.
 */
async function loadRelief(signal: AbortSignal): Promise<ReliefGrid> {
  const expected = RELIEF.cols * RELIEF.rows;
  const [heightResponse, coverResponse] = await Promise.all([
    fetch(RELIEF.file, { signal }),
    fetch(RELIEF.cover.file, { signal }),
  ]);
  if (!heightResponse.ok) {
    throw new Error(`Mreža visina nije dohvaćena: ${heightResponse.status}`);
  }
  const decimetres = new Int16Array(await heightResponse.arrayBuffer());
  if (decimetres.length !== expected) {
    throw new Error(`Mreža visina ne odgovara sceni: ${decimetres.length} ≠ ${expected}`);
  }
  const heights = new Float32Array(expected);
  for (let index = 0; index < expected; index += 1) heights[index] = decimetres[index] / 10;

  // Pokrov je ukras nad podatkom, ne podatak: ako izostane, teren se oboji
  // samo po visini i nagibu, kao prije, umjesto da scena padne.
  let cover = new Uint8Array(expected);
  if (coverResponse.ok) {
    const raw = new Uint8Array(await coverResponse.arrayBuffer());
    if (raw.length === expected) cover = raw;
  }

  return {
    cols: RELIEF.cols,
    rows: RELIEF.rows,
    world: RELIEF.world,
    heights,
    cover,
  };
}

/**
 * Prorjeđuje mrežu kad uređaj nije za pola milijuna trokuta.
 *
 * Korak od 3 m je ono zbog čega se usjek ceste i terasa uopće vide, pa se
 * ne dira na stolnom računalu. Na telefonu je izbor između 6 m i scene koja
 * se ne vrti, a prorijeđeni reljef je i dalje reljef.
 */
function thinRelief(grid: ReliefGrid, factor: number): ReliefGrid {
  if (factor <= 1) return grid;
  const cols = Math.floor((grid.cols - 1) / factor) + 1;
  const rows = Math.floor((grid.rows - 1) / factor) + 1;
  const heights = new Float32Array(cols * rows);
  const cover = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const source = row * factor * grid.cols + col * factor;
      heights[row * cols + col] = grid.heights[source];
      cover[row * cols + col] = grid.cover[source];
    }
  }
  const spanX = grid.world.east - grid.world.west;
  const spanZ = grid.world.south - grid.world.north;
  return {
    cols,
    rows,
    world: {
      west: grid.world.west,
      north: grid.world.north,
      east: grid.world.west + (spanX * ((cols - 1) * factor)) / (grid.cols - 1),
      south: grid.world.north + (spanZ * ((rows - 1) * factor)) / (grid.rows - 1),
    },
    heights,
    cover,
  };
}

function terrainGeometry(grid: ReliefGrid) {
  const { cols, rows, world, heights, cover } = grid;
  const positions = new Float32Array(cols * rows * 3);
  const covers = new Float32Array(cols * rows);
  const spanX = world.east - world.west;
  const spanZ = world.south - world.north;

  for (let row = 0; row < rows; row += 1) {
    const z = world.north + (spanZ * row) / (rows - 1);
    for (let col = 0; col < cols; col += 1) {
      const offset = (row * cols + col) * 3;
      positions[offset] = world.west + (spanX * col) / (cols - 1);
      positions[offset + 1] = metresToUnits(heights[row * cols + col]);
      positions[offset + 2] = z;
      covers[row * cols + col] = cover[row * cols + col];
    }
  }

  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const northWest = row * cols + col;
      const northEast = northWest + 1;
      const southWest = northWest + cols;
      const southEast = southWest + 1;
      indices[cursor] = northWest;
      indices[cursor + 1] = southWest;
      indices[cursor + 2] = northEast;
      indices[cursor + 3] = northEast;
      indices[cursor + 4] = southWest;
      indices[cursor + 5] = southEast;
      cursor += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aCover", new THREE.BufferAttribute(covers, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Boja i izohipse terena, ušivene u standardni materijal.
 *
 * Boja se računa iz visine i nagiba vrha, a ne iz teksture, pa se ne mijenja
 * kad se reljef preuveliča: nagib ulazi iz normale osnovne geometrije, koja
 * ne zna za rastezanje okomite osi. Izohipse se crtaju derivacijom visine, pa
 * ostaju jednako debele na svakom približenju umjesto da se raspu.
 */
function terrainMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.97,
    metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.reliefLow = { value: TERRAIN_LOW };
    shader.uniforms.reliefMid = { value: TERRAIN_MID };
    shader.uniforms.reliefHigh = { value: TERRAIN_HIGH };
    shader.uniforms.reliefRock = { value: TERRAIN_ROCK };
    shader.uniforms.reliefFloor = { value: RELIEF.lowestMetres };
    shader.uniforms.reliefCeiling = { value: RELIEF.highestMetres };
    shader.uniforms.reliefUnits = { value: UNITS_PER_METRE };
    shader.uniforms.contourInterval = { value: CONTOUR_INTERVAL_METRES };

    const coverTone = COVER_TONES.map(({ tone }) => {
      const colour = new THREE.Color(tone);
      return `vec3(${colour.r.toFixed(4)}, ${colour.g.toFixed(4)}, ${colour.b.toFixed(4)})`;
    }).join(", ");
    const coverMix = COVER_TONES.map(({ mix }) => mix.toFixed(3)).join(", ");

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vReliefMetres;
         varying float vReliefFlatness;
         varying vec3 vCoverTone;
         varying float vCoverMix;
         attribute float aCover;
         uniform float reliefUnits;
         const vec3 COVER_TONE[${COVER_TONES.length}] = vec3[${COVER_TONES.length}](${coverTone});
         const float COVER_MIX[${COVER_TONES.length}] = float[${COVER_TONES.length}](${coverMix});`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vReliefMetres = position.y / reliefUnits;
         vReliefFlatness = normal.y;
         int coverIndex = int(clamp(aCover, 0.0, ${(COVER_TONES.length - 1).toFixed(1)}));
         vCoverTone = COVER_TONE[coverIndex];
         vCoverMix = COVER_MIX[coverIndex];`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vReliefMetres;
         varying float vReliefFlatness;
         varying vec3 vCoverTone;
         varying float vCoverMix;
         uniform vec3 reliefLow;
         uniform vec3 reliefMid;
         uniform vec3 reliefHigh;
         uniform vec3 reliefRock;
         uniform float reliefFloor;
         uniform float reliefCeiling;
         uniform float contourInterval;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         float reliefBand = clamp(
           (vReliefMetres - reliefFloor) / max(1.0, reliefCeiling - reliefFloor),
           0.0,
           1.0
         );
         vec3 reliefTone = mix(reliefLow, reliefMid, smoothstep(0.0, 0.5, reliefBand));
         reliefTone = mix(reliefTone, reliefHigh, smoothstep(0.5, 1.0, reliefBand));
         float reliefSteep = smoothstep(0.95, 0.74, vReliefFlatness);
         reliefTone = mix(reliefTone, reliefRock, reliefSteep * 0.8);

         float contourPhase = vReliefMetres / contourInterval;
         float contourWidth = fwidth(contourPhase);
         float contourEdge = abs(fract(contourPhase) - 0.5);
         float contourLine =
           1.0 - smoothstep(0.0, contourWidth * 1.4, 0.5 - contourEdge);
         float majorPhase = contourPhase / ${CONTOUR_MAJOR_EVERY.toFixed(1)};
         float majorWidth = fwidth(majorPhase);
         float majorEdge = abs(fract(majorPhase) - 0.5);
         float majorLine = 1.0 - smoothstep(0.0, majorWidth * 1.4, 0.5 - majorEdge);
         // Pokrov se miješa preko raspona po visini, ne umjesto njega: i pod
         // šumom se mora vidjeti da teren pada.
         reliefTone = mix(reliefTone, vCoverTone * (0.72 + 0.56 * reliefBand), vCoverMix);
         reliefTone *= 1.0 - contourLine * 0.13 - majorLine * 0.2;

         diffuseColor.rgb *= reliefTone;`,
      );
  };

  return material;
}

/**
 * Bočne strane i dno bloka.
 *
 * Bez postolja teren završava u zraku i maketa izgleda kao pogreška
 * učitavanja. S njim se na rezu čita visinska razlika kvarta, pa je bok
 * postolja i sam podatak — zato mu boja tone prema dnu umjesto da bude
 * ravnomjerna.
 */
function plinthGeometry(grid: ReliefGrid) {
  const { cols, rows, world, heights } = grid;
  const spanX = world.east - world.west;
  const spanZ = world.south - world.north;
  const floor = metresToUnits(BASE_METRES);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const columnX = (col: number) => world.west + (spanX * col) / (cols - 1);
  const rowZ = (row: number) => world.north + (spanZ * row) / (rows - 1);
  const topColor = PLINTH_TOP.toArray();
  const bottomColor = PLINTH_BOTTOM.toArray();

  function wall(edge: Array<{ x: number; z: number; y: number }>, flip: boolean) {
    const first = positions.length / 3;
    edge.forEach((point) => {
      positions.push(point.x, point.y, point.z, point.x, floor, point.z);
      colors.push(...topColor, ...bottomColor);
    });
    for (let index = 0; index < edge.length - 1; index += 1) {
      const top = first + index * 2;
      const bottom = top + 1;
      const nextTop = top + 2;
      const nextBottom = top + 3;
      if (flip) indices.push(top, bottom, nextTop, nextTop, bottom, nextBottom);
      else indices.push(top, nextTop, bottom, nextTop, nextBottom, bottom);
    }
  }

  const north: Array<{ x: number; z: number; y: number }> = [];
  const south: Array<{ x: number; z: number; y: number }> = [];
  for (let col = 0; col < cols; col += 1) {
    north.push({ x: columnX(col), z: rowZ(0), y: metresToUnits(heights[col]) });
    south.push({
      x: columnX(col),
      z: rowZ(rows - 1),
      y: metresToUnits(heights[(rows - 1) * cols + col]),
    });
  }
  const west: Array<{ x: number; z: number; y: number }> = [];
  const east: Array<{ x: number; z: number; y: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    west.push({ x: columnX(0), z: rowZ(row), y: metresToUnits(heights[row * cols]) });
    east.push({
      x: columnX(cols - 1),
      z: rowZ(row),
      y: metresToUnits(heights[row * cols + cols - 1]),
    });
  }

  // Namotaj po zidu: lice mora gledati van iz bloka. Sjeverni i istočni rub
  // teku u smjeru u kojem taj račun već daje vanjsku normalu, južni i zapadni
  // u suprotnom — okrenut zid se ne vidi kao okrenut nego kao rupa.
  wall(north, false);
  wall(south, true);
  wall(west, true);
  wall(east, false);

  const floorStart = positions.length / 3;
  const corners = [
    [world.west, world.north],
    [world.east, world.north],
    [world.east, world.south],
    [world.west, world.south],
  ] as const;
  corners.forEach(([x, z]) => {
    positions.push(x, floor, z);
    colors.push(...bottomColor);
  });
  indices.push(
    floorStart,
    floorStart + 1,
    floorStart + 2,
    floorStart,
    floorStart + 2,
    floorStart + 3,
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Rez kroz blok, s vodoravnim slojevima na svakih 10 metara.
 *
 * Slojevi nisu geološki podatak nego mjerilo: po njima se na boku prebroji
 * koliko je kvart visok, isto kao što se izohipsama na tlu prebroji koliko je
 * padina strma. Bez njih je bok samo smeđa ploha i visinska razlika se gubi.
 */
function plinthMaterial() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.reliefUnits = { value: UNITS_PER_METRE };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vCutMetres;
         uniform float reliefUnits;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vCutMetres = position.y / reliefUnits;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vCutMetres;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         float cutPhase = vCutMetres / 10.0;
         float cutWidth = fwidth(cutPhase);
         float cutEdge = abs(fract(cutPhase) - 0.5);
         float cutLine = 1.0 - smoothstep(0.0, cutWidth * 1.6, 0.5 - cutEdge);
         diffuseColor.rgb *= 1.0 - cutLine * 0.16;`,
      );
  };

  return material;
}

function drape(grid: ReliefGrid, points: readonly WorldPoint[], liftMetres: number) {
  const step = metresToUnits(DRAPE_STEP_METRES);
  return resamplePolyline(points, step).map<GroundPoint>((point) => ({
    x: point.x,
    y: metresToUnits(groundHeight(grid, point.x, point.z) + liftMetres),
    z: point.z,
  }));
}

function drapedRibbonGeometry(
  grid: ReliefGrid,
  points: readonly (readonly [number, number])[],
  width: number,
  liftMetres: number,
) {
  const ribbon = buildDrapedRibbon(
    drape(grid, points.map(scenePointToWorld), liftMetres),
    width,
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(ribbon.positions, 3));
  geometry.setIndex(ribbon.indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRoadNetwork(parent: THREE.Object3D, grid: ReliefGrid) {
  const kinds = ["minor", "local", "major"] as const;
  kinds.forEach((kind) => {
    const roads = IGRA_SCENE.roads.filter((road) => road.kind === kind);
    const widths = ROAD_WIDTHS[kind];
    const casingParts = roads.map((road) =>
      drapedRibbonGeometry(grid, road.points, widths.casing, ROAD_LIFT_METRES * 0.7),
    );
    const surfaceParts = roads.map((road) =>
      drapedRibbonGeometry(grid, road.points, widths.surface, ROAD_LIFT_METRES),
    );
    const casing = mergeGeometries(casingParts);
    const surface = mergeGeometries(surfaceParts);
    casingParts.forEach((geometry) => geometry.dispose());
    surfaceParts.forEach((geometry) => geometry.dispose());

    if (casing) {
      const mesh = new THREE.Mesh(
        casing,
        new THREE.MeshStandardMaterial({
          color: 0x746e65,
          roughness: 1,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    if (surface) {
      const mesh = new THREE.Mesh(
        surface,
        new THREE.MeshStandardMaterial({
          color: kind === "minor" ? 0xd8cfbb : 0xeee7d6,
          roughness: 1,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        }),
      );
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  });
}

/**
 * Granica Dračevca i Bilica, položena po terenu.
 *
 * Prije reljefa su to bile dvije obojene plohe na ravnom tlu. Ploha se preko
 * padine ne može položiti bez ponovnog sjeckanja, a i pojela bi upravo ono
 * što reljef pokazuje — pa od nje ostaje samo crta, ondje gdje granica
 * uistinu jest.
 */
function addNeighbourhoodEdges(parent: THREE.Object3D, grid: ReliefGrid) {
  const parts = IGRA_SCENE.terrain.map((area) =>
    drapedRibbonGeometry(grid, [...area.points, area.points[0]], 0.42, ROAD_LIFT_METRES * 1.2),
  );
  const merged = mergeGeometries(parts);
  parts.forEach((geometry) => geometry.dispose());
  if (!merged) return;
  parent.add(
    new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        color: 0xbe8f52,
        roughness: 1,
        transparent: true,
        opacity: 0.75,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6,
      }),
    ),
  );
}

/**
 * Zgrade sjedaju na vlastiti teren, a 181 od njih na vlastitu izmjerenu kotu.
 *
 * Gradski GIS uz visinu nosi i kotu dna i kotu vrha — apsolutne, u metrima
 * nad morem. Gdje ih ima, zgrada se postavi između njih i ne pita teren za
 * visinu: dva nezavisna izvora, a kota dna se od LiDAR-ove plohe razlikuje za
 * median od 30 cm, pa se smiju gledati u oči. Gdje ih nema, ostaje staro
 * pravilo — pod od najniže točke tlocrta, krov od prosječne.
 *
 * Dno u oba slučaja ide metar ispod najnižeg tla pod tlocrtom: kota dna je
 * jedan broj za cijelu zgradu, a padina nije.
 */
function addBuildings(parent: THREE.Object3D, grid: ReliefGrid) {
  const walls = new Map<string, THREE.BufferGeometry[]>();
  const roofs: THREE.BufferGeometry[] = [];

  IGRA_SCENE.buildings.forEach((building) => {
    const ground = building.base.map((point) => {
      const world = scenePointToWorld(point);
      return groundHeight(grid, world.x, world.z);
    });
    const lowestGround = Math.min(...ground);
    const averageGround = ground.reduce((sum, value) => sum + value, 0) / ground.length;

    const measured = building.baseMetres !== null && building.ridgeMetres !== null;
    const topMetres = measured
      ? building.ridgeMetres!
      : averageGround + buildingWorldHeight(building.heightMeters, UNITS_PER_METRE) / UNITS_PER_METRE;
    const floorMetres = Math.min(measured ? building.baseMetres! : lowestGround, lowestGround) - 1;

    const frame = building.roofFrame;
    const rise =
      building.roof === "pitched" && frame
        ? roofRiseMetres(frame.width / UNITS_PER_METRE, topMetres - floorMetres)
        : 0;
    const eaveMetres = topMetres - rise;

    const bottom = metresToUnits(floorMetres);
    const eave = metresToUnits(eaveMetres);
    const geometry = new THREE.ExtrudeGeometry(polygonShape(building.base), {
      depth: Math.max(0.02, eave - bottom),
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, bottom, 0);
    const key = `${building.kind}-${building.tone}`;
    const current = walls.get(key) ?? [];
    current.push(geometry);
    walls.set(key, current);

    if (rise > 0 && frame) {
      const roof = buildPitchedRoof(
        frame,
        eave,
        metresToUnits(topMetres),
        building.roofShape === "gabled" ? "gabled" : "hipped",
      );
      const roofGeometry = new THREE.BufferGeometry();
      roofGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(roof.positions, 3),
      );
      roofGeometry.setIndex(roof.indices);
      roofGeometry.computeVertexNormals();
      roofs.push(roofGeometry);
    }
  });

  walls.forEach((geometries, key) => {
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) return;
    const [kind, toneValue] = key.split("-");
    const tone = Number(toneValue);
    const palette = kind === "large" ? LARGE_BUILDING_COLORS : BUILDING_COLORS;
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        color: palette[tone % palette.length],
        roughness: 0.86,
        flatShading: true,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  });

  const roof = mergeGeometries(roofs);
  roofs.forEach((geometry) => geometry.dispose());
  if (!roof) return;
  const mesh = new THREE.Mesh(
    roof,
    new THREE.MeshStandardMaterial({ color: ROOF_TILE, roughness: 0.94, flatShading: true }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

/**
 * Akvadukt drži vodoravnu razinu, a stupovi mu se produžuju do tla.
 *
 * Rimski vodovod pada nekoliko promila po kilometru; na duljini koju maketa
 * pokriva to je manje od metra, pa je vodoravna razina bliža istini nego kanal
 * koji se povija po brdu. Ono što se mijenja jest stup — i upravo to je ono
 * što pokazuje koliko je teren pod njim neravnan.
 */
function addAqueduct(parent: THREE.Object3D, grid: ReliefGrid) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xd8c7a4,
    roughness: 0.92,
    flatShading: true,
  });
  const points = IGRA_SCENE.aqueduct.arches.map(scenePointToWorld);
  const ground = points.map((point) => groundHeight(grid, point.x, point.z));
  const deckMetres = Math.max(...ground) + 5.5;
  const deck = metresToUnits(deckMetres);

  points.forEach((point, index) => {
    const height = Math.max(metresToUnits(2), deck - metresToUnits(ground[index]));
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.7, height, 0.85), material);
    pier.position.set(point.x, deck - height / 2, point.z);
    pier.castShadow = true;
    parent.add(pier);
  });

  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const length = Math.hypot(point.x - previous.x, point.z - previous.z);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.7, 0.95), material);
    beam.position.set((point.x + previous.x) / 2, deck + 0.35, (point.z + previous.z) / 2);
    beam.rotation.y = -Math.atan2(point.z - previous.z, point.x - previous.x);
    beam.castShadow = true;
    parent.add(beam);
  });
}

/**
 * Stabla stoje na stvarnim zelenim površinama, u stvarnoj veličini.
 *
 * Prije reljefa je to bio ručno upisan niz od 24 položaja; sada ih generator
 * razasipa po OSM-ovim poligonima šume, makije i travnjaka. Mjere su u
 * metrima jer je to jedina provjera koja drži: alepski bor doraste do 11 m,
 * makija do 3,5, a stara maslina do 6,5 — u jedinicama makete bi se ta
 * razlika izgubila i kvart bi izgledao kao božićna šuma.
 */
const TREE_KINDS = {
  wood: { height: 11, crown: 3.2, trunk: 0.3, color: 0x3f6b41, conifer: true },
  grove: { height: 6.5, crown: 2.7, trunk: 0.26, color: 0x7d8d5c, conifer: false },
  scrub: { height: 3.4, crown: 2, trunk: 0.16, color: 0x6d8149, conifer: false },
} as const;

function addTrees(parent: THREE.Object3D, grid: ReliefGrid) {
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);

  (Object.keys(TREE_KINDS) as Array<keyof typeof TREE_KINDS>).forEach((kind) => {
    const trees = IGRA_SCENE.trees.filter((tree) => tree.kind === kind);
    if (trees.length === 0) return;
    const shape = TREE_KINDS[kind];
    const trunkHeight = metresToUnits(shape.height * 0.36);
    const crownHeight = metresToUnits(shape.height * 0.64);
    const crownRadius = metresToUnits(shape.crown);

    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(
        metresToUnits(shape.trunk * 0.75),
        metresToUnits(shape.trunk),
        trunkHeight,
        5,
      ),
      new THREE.MeshStandardMaterial({ color: 0x6f5540, roughness: 1 }),
      trees.length,
    );
    const crowns = new THREE.InstancedMesh(
      shape.conifer
        ? new THREE.ConeGeometry(crownRadius, crownHeight, 7)
        : new THREE.IcosahedronGeometry(crownRadius, 0),
      new THREE.MeshStandardMaterial({
        color: shape.color,
        roughness: 0.98,
        flatShading: true,
      }),
      trees.length,
    );

    trees.forEach((tree, index) => {
      const world = scenePointToWorld(tree.point);
      const ground = metresToUnits(groundHeight(grid, world.x, world.z));
      const size = 0.82 + tree.size * 0.12;
      scale.set(size, size, size);
      // Krošnja se zakrene oko svoje osi da se dvadeseterostrane kugle ne
      // slože u isti obris; korak dolazi iz indeksa, ne iz slučaja, da se
      // ista maketa uvijek složi jednako.
      rotation.setFromAxisAngle(axis, ((index * 137) % 360) * (Math.PI / 180));
      position.set(world.x, ground + (trunkHeight * size) / 2, world.z);
      matrix.compose(position, new THREE.Quaternion(), scale);
      trunks.setMatrixAt(index, matrix);
      position.set(
        world.x,
        ground + (trunkHeight + (shape.conifer ? crownHeight / 2 : crownRadius * 0.7)) * size,
        world.z,
      );
      matrix.compose(position, rotation, scale);
      crowns.setMatrixAt(index, matrix);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    crowns.receiveShadow = true;
    parent.add(trunks, crowns);
  });
}

function addVehicles(parent: THREE.Object3D, grid: ReliefGrid) {
  return IGRA_SCENE.vehiclePaths.map((path, index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(index === 0 ? 1.7 : 1.35, 0.55, 0.82),
      new THREE.MeshStandardMaterial({
        color: index === 0 ? 0xe2b938 : index === 1 ? 0xc85d4c : 0xf1ead9,
        roughness: 0.72,
      }),
    );
    mesh.castShadow = true;
    parent.add(mesh);
    return {
      mesh,
      path: drape(grid, path.points.map(scenePointToWorld), ROAD_LIFT_METRES + 0.9),
      speed: 0.026 + index * 0.005,
      offset: index * 0.31,
    };
  });
}

function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xd8edf0, 0x6b6a55, 1.55));
  const sun = new THREE.DirectionalLight(0xfff1cf, 3.1);
  sun.position.set(-72, 96, 48);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  scene.add(sun);
  return sun;
}

function disposeScene(scene: THREE.Scene) {
  const materials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => materials.add(material));
  });
  materials.forEach((material) => material.dispose());
}

export async function createKvartScene(
  canvas: HTMLCanvasElement,
  labelElements: readonly HTMLElement[],
  onViewChange?: (state: CameraViewState) => void,
): Promise<SceneRuntime> {
  const abort = new AbortController();
  const fullGrid = await loadRelief(abort.signal);
  const modest =
    (typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4) ||
    (typeof window !== "undefined" && window.innerWidth < 640);
  const grid = thinRelief(fullGrid, modest ? 2 : 1);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x9bc9ce, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bc9ce);
  const camera = new THREE.OrthographicCamera(-70, 70, 55, -55, 0.1, 600);

  /**
   * Sve što ima visinu živi u ovoj skupini, jer preuveličanje reljefa nije
   * ništa drugo nego njezino `scale.y`. Nula skupine je razina mora, pa se
   * jednim brojem rastegnu i brdo i kuća i stup akvadukta — bez ponovne
   * gradnje ijednog trokuta.
   */
  const model = new THREE.Group();
  model.scale.y = DEFAULT_EXAGGERATION;
  scene.add(model);

  const terrain = new THREE.Mesh(terrainGeometry(grid), terrainMaterial());
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  model.add(terrain);

  const plinth = new THREE.Mesh(plinthGeometry(grid), plinthMaterial());
  plinth.receiveShadow = true;
  model.add(plinth);

  addNeighbourhoodEdges(model, grid);
  addRoadNetwork(model, grid);
  addBuildings(model, grid);
  addAqueduct(model, grid);
  addTrees(model, grid);
  const sun = addLights(scene);
  const vehicles = addVehicles(model, grid);

  const labelAnchors = IGRA_SCENE.labels.map((label) => {
    const point = scenePointToWorld(label.position);
    const ground = groundHeight(grid, point.x, point.z);
    return {
      x: point.x,
      z: point.z,
      y: metresToUnits(ground + (label.text === "Akvadukt" ? 14 : 26)),
    };
  });
  const anchorVector = new THREE.Vector3();

  const centre = new THREE.Vector3(
    (RELIEF.world.west + RELIEF.world.east) / 2,
    metresToUnits((RELIEF.lowestMetres + RELIEF.highestMetres) / 2),
    (RELIEF.world.north + RELIEF.world.south) / 2,
  );
  camera.position.set(centre.x + 110, centre.y + 88, centre.z + 118);
  camera.lookAt(centre);

  let width = 1;
  let height = 1;
  let paused = false;
  let elapsed = 0;
  let lastTime = performance.now();
  let frame = 0;
  let disposed = false;
  let exaggeration = DEFAULT_EXAGGERATION;

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(centre);
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.rotateSpeed = 0.55;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;
  controls.minZoom = 1;
  controls.maxZoom = 5;
  /** Kamera ostaje iznad obzora: pod maketom nema ničega osim dna postolja. */
  controls.minPolarAngle = Math.PI * 0.08;
  controls.maxPolarAngle = Math.PI * 0.44;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.update();
  controls.saveState();

  const home = {
    position: camera.position.clone(),
    target: controls.target.clone(),
  };

  /**
   * Širina natpisa se mjeri samo pri promjeni kadra, ne u svakoj slici.
   *
   * Kamera se sada zaustavlja s prigušenjem, pa se natpisi moraju premještati
   * u svakoj slici. Čitanje `offsetWidth` ondje bi šezdeset puta u sekundi
   * tjeralo preglednik na proračun rasporeda — a širina natpisa se mijenja
   * samo kad se promijeni veličina prikaza.
   */
  const labelWidths = labelElements.map(() => 104);

  function measureLabels() {
    labelElements.forEach((element, index) => {
      labelWidths[index] = element.offsetWidth || 104;
    });
  }

  function updateLabels() {
    labelAnchors.forEach((anchor, index) => {
      const element = labelElements[index];
      if (!element) return;
      anchorVector.set(anchor.x, anchor.y * exaggeration, anchor.z);
      const projected = anchorVector.project(camera);
      const visible = projected.z > -1 && projected.z < 1;
      const rawLeft = ((projected.x + 1) / 2) * width;
      const halfLabel = labelWidths[index] / 2;
      const left = Math.max(halfLabel + 12, Math.min(width - halfLabel - 12, rawLeft));
      element.style.left = `${left}px`;
      element.style.top = `${((-projected.y + 1) / 2) * height}px`;
      element.style.visibility = visible ? "visible" : "hidden";
    });
  }

  function render(now: number) {
    if (disposed) return;
    const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (!paused) elapsed += delta;

    controls.update();
    vehicles.forEach((vehicle) => {
      const sample = samplePolyline(vehicle.path, (elapsed * vehicle.speed + vehicle.offset) % 1);
      const ground = groundHeight(grid, sample.x, sample.z);
      vehicle.mesh.position.set(
        sample.x,
        metresToUnits(ground + ROAD_LIFT_METRES + 0.9),
        sample.z,
      );
      vehicle.mesh.rotation.y = -sample.angle;
    });
    sun.target.position.copy(controls.target);
    sun.target.updateMatrixWorld();
    updateLabels();
    renderer.render(scene, camera);
    if (!paused) frame = requestAnimationFrame(render);
  }

  function requestRender() {
    cancelAnimationFrame(frame);
    lastTime = performance.now();
    frame = requestAnimationFrame(render);
  }

  function emitViewState() {
    const offset = controls.target.distanceTo(home.target);
    onViewChange?.({
      zoom: camera.zoom,
      isDefault:
        Math.abs(camera.zoom - 1) < 0.01 &&
        offset < 0.01 &&
        camera.position.distanceTo(home.position) < 0.01 &&
        exaggeration === DEFAULT_EXAGGERATION,
      exaggeration,
    });
  }

  function constrainAndRender() {
    const previousTarget = controls.target.clone();
    controls.target.x = Math.max(RELIEF.world.west, Math.min(RELIEF.world.east, controls.target.x));
    controls.target.z = Math.max(
      RELIEF.world.north,
      Math.min(RELIEF.world.south, controls.target.z),
    );
    controls.target.y = Math.max(
      metresToUnits(BASE_METRES) * exaggeration,
      Math.min(metresToUnits(RELIEF.highestMetres) * exaggeration, controls.target.y),
    );
    camera.position.add(controls.target.clone().sub(previousTarget));
    updateLabels();
    emitViewState();
    requestRender();
  }

  controls.addEventListener("change", constrainAndRender);

  function setZoom(action: "in" | "out" | "reset") {
    if (action === "reset") {
      exaggeration = DEFAULT_EXAGGERATION;
      model.scale.y = exaggeration;
      controls.reset();
    } else {
      camera.zoom = nextCameraZoom(camera.zoom, action);
      camera.updateProjectionMatrix();
      constrainAndRender();
    }
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    const aspect = width / height;
    const frustumHeight = sceneFrustumHeight(width, height);
    camera.left = (-frustumHeight * aspect) / 2;
    camera.right = (frustumHeight * aspect) / 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    const vehicleScale = aspect < 0.8 ? 1.45 : 1;
    vehicles.forEach(({ mesh }) => mesh.scale.setScalar(vehicleScale));
    measureLabels();
    updateLabels();
    emitViewState();
    requestRender();
  }

  requestRender();

  return {
    resize,
    setPaused(nextPaused) {
      if (paused === nextPaused) return;
      paused = nextPaused;
      requestRender();
    },
    zoomIn() {
      setZoom("in");
    },
    zoomOut() {
      setZoom("out");
    },
    resetView() {
      setZoom("reset");
    },
    cycleExaggeration() {
      exaggeration = nextExaggeration(exaggeration);
      model.scale.y = exaggeration;
      constrainAndRender();
    },
    dispose() {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      controls.removeEventListener("change", constrainAndRender);
      controls.dispose();
      disposeScene(scene);
      renderer.dispose();
    },
  };
}

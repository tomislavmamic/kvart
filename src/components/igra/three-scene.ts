import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { IGRA_SCENE } from "@/generated/igra-scene";

import {
  buildingWorldHeight,
  buildRoadRibbon,
  nextCameraZoom,
  samplePolyline,
  sceneFrustumHeight,
  scenePointToWorld,
} from "./three-scene-model";

type SceneRuntime = {
  resize: (width: number, height: number) => void;
  setPaused: (paused: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  dispose: () => void;
};

export type CameraViewState = Readonly<{
  zoom: number;
  isDefault: boolean;
}>;

const ROAD_WIDTHS = {
  major: { casing: 2.05, surface: 1.58 },
  local: { casing: 1.28, surface: 0.92 },
  minor: { casing: 0.78, surface: 0.5 },
} as const;

const BUILDING_COLORS = [0xd9c67f, 0xd3b36e, 0xd6c4a1, 0xb7c1b4, 0xd39c68];
const LARGE_BUILDING_COLORS = [0xc89c52, 0xb98a43, 0xaaa07d, 0x8ea08e, 0xb8784f];
const TREE_POSITIONS = [
  [408, 354], [466, 326], [522, 397], [589, 330], [648, 452], [714, 276],
  [756, 518], [844, 240], [906, 446], [973, 315], [1040, 518], [1110, 382],
  [1173, 472], [1233, 350], [1290, 427], [342, 444], [548, 520], [866, 574],
  [702, 570], [1084, 472], [430, 292], [1190, 410], [635, 246], [930, 548],
] as const;

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

function flatPolygon(
  points: readonly (readonly [number, number])[],
  color: number,
  elevation: number,
  opacity = 1,
) {
  const geometry = new THREE.ShapeGeometry(polygonShape(points));
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.96,
    transparent: opacity < 1,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -elevation * 10,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = elevation;
  mesh.receiveShadow = true;
  return mesh;
}

function roadGeometry(
  points: readonly (readonly [number, number])[],
  width: number,
  elevation: number,
) {
  const worldPoints = points.map(scenePointToWorld);
  const ribbon = buildRoadRibbon(worldPoints, width, elevation);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(ribbon.positions, 3));
  geometry.setIndex(ribbon.indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRoadNetwork(scene: THREE.Scene) {
  const kinds = ["minor", "local", "major"] as const;
  kinds.forEach((kind) => {
    const roads = IGRA_SCENE.roads.filter((road) => road.kind === kind);
    const widths = ROAD_WIDTHS[kind];
    const casingParts = roads.map((road) => roadGeometry(road.points, widths.casing, 0.12));
    const surfaceParts = roads.map((road) => roadGeometry(road.points, widths.surface, 0.16));
    const casing = mergeGeometries(casingParts);
    const surface = mergeGeometries(surfaceParts);
    casingParts.forEach((geometry) => geometry.dispose());
    surfaceParts.forEach((geometry) => geometry.dispose());

    if (casing) {
      const mesh = new THREE.Mesh(
        casing,
        new THREE.MeshStandardMaterial({ color: 0x746e65, roughness: 1 }),
      );
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    if (surface) {
      const mesh = new THREE.Mesh(
        surface,
        new THREE.MeshStandardMaterial({
          color: kind === "minor" ? 0xd8cfbb : 0xeee7d6,
          roughness: 1,
        }),
      );
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  });
}

function addBuildings(scene: THREE.Scene) {
  const groups = new Map<string, THREE.BufferGeometry[]>();

  IGRA_SCENE.buildings.forEach((building) => {
    const geometry = new THREE.ExtrudeGeometry(polygonShape(building.base), {
      depth: buildingWorldHeight(building.heightMeters),
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    const key = `${building.kind}-${building.tone}`;
    const current = groups.get(key) ?? [];
    current.push(geometry);
    groups.set(key, current);
  });

  groups.forEach((geometries, key) => {
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
    scene.add(mesh);
  });
}

function addAqueduct(scene: THREE.Scene) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xd8c7a4,
    roughness: 0.92,
    flatShading: true,
  });
  const points = IGRA_SCENE.aqueduct.arches.map(scenePointToWorld);

  points.forEach((point) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.3, 0.85), material);
    pier.position.set(point.x, 2.15, point.z);
    pier.castShadow = true;
    scene.add(pier);
  });

  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const length = Math.hypot(point.x - previous.x, point.z - previous.z);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.7, 0.95), material);
    beam.position.set((point.x + previous.x) / 2, 4.05, (point.z + previous.z) / 2);
    beam.rotation.y = -Math.atan2(point.z - previous.z, point.x - previous.x);
    beam.castShadow = true;
    scene.add(beam);
  });
}

function addTrees(scene: THREE.Scene) {
  const trunkGeometry = new THREE.CylinderGeometry(0.13, 0.18, 1.25, 5);
  const crownGeometry = new THREE.ConeGeometry(0.88, 2.55, 7);
  const trunks = new THREE.InstancedMesh(
    trunkGeometry,
    new THREE.MeshStandardMaterial({ color: 0x72523c, roughness: 1 }),
    TREE_POSITIONS.length,
  );
  const crowns = new THREE.InstancedMesh(
    crownGeometry,
    new THREE.MeshStandardMaterial({ color: 0x2e7149, roughness: 0.95 }),
    TREE_POSITIONS.length,
  );
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();

  TREE_POSITIONS.forEach((point, index) => {
    const world = scenePointToWorld(point);
    const size = 0.82 + (index % 5) * 0.055;
    scale.set(size, size, size);
    position.set(world.x, 0.62 * size, world.z);
    matrix.compose(position, rotation, scale);
    trunks.setMatrixAt(index, matrix);
    position.set(world.x, 2.1 * size, world.z);
    matrix.compose(position, rotation, scale);
    crowns.setMatrixAt(index, matrix);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks, crowns);
}

function addVehicles(scene: THREE.Scene) {
  return IGRA_SCENE.vehiclePaths.map((path, index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(index === 0 ? 1.7 : 1.35, 0.55, 0.82),
      new THREE.MeshStandardMaterial({
        color: index === 0 ? 0xe2b938 : index === 1 ? 0xc85d4c : 0xf1ead9,
        roughness: 0.72,
      }),
    );
    mesh.castShadow = true;
    scene.add(mesh);
    return {
      mesh,
      path: path.points.map(scenePointToWorld),
      speed: 0.026 + index * 0.005,
      offset: index * 0.31,
    };
  });
}

function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xd8edf0, 0x5d7652, 2.25));
  const sun = new THREE.DirectionalLight(0xfff1cf, 3.2);
  sun.position.set(-55, 90, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
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

export function createKvartScene(
  canvas: HTMLCanvasElement,
  labelElements: readonly HTMLElement[],
  onViewChange?: (state: CameraViewState) => void,
): SceneRuntime {
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
  const camera = new THREE.OrthographicCamera(-70, 70, 55, -55, 0.1, 500);
  camera.position.set(92, 105, 104);
  camera.lookAt(-3, 0, 2);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({ color: 0x98c8cd, roughness: 1 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.55;
  water.receiveShadow = true;
  scene.add(water);

  const landBase = new THREE.Mesh(
    new THREE.ExtrudeGeometry(polygonShape(IGRA_SCENE.land), {
      depth: 1.5,
      bevelEnabled: false,
      steps: 1,
    }),
    new THREE.MeshStandardMaterial({ color: 0x52795f, roughness: 1, flatShading: true }),
  );
  landBase.geometry.rotateX(-Math.PI / 2);
  landBase.position.y = -1.5;
  landBase.receiveShadow = true;
  scene.add(landBase);

  scene.add(flatPolygon(IGRA_SCENE.land, 0x83aa70, 0));
  IGRA_SCENE.terrain.forEach((area, index) => {
    scene.add(flatPolygon(area.points, index === 0 ? 0x7fa46b : 0x8db376, 0.045, 0.72));
  });
  addRoadNetwork(scene);
  addBuildings(scene);
  addAqueduct(scene);
  addTrees(scene);
  addLights(scene);
  const vehicles = addVehicles(scene);
  const labelAnchors = IGRA_SCENE.labels.map((label) => {
    const point = scenePointToWorld(label.position);
    return new THREE.Vector3(point.x, label.text === "Akvadukt" ? 5.4 : 8.6, point.z);
  });

  let width = 1;
  let height = 1;
  let paused = false;
  let elapsed = 0;
  let lastTime = performance.now();
  let frame = 0;
  let disposed = false;
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-3, 0, 2);
  controls.enableRotate = false;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;
  controls.minZoom = 1;
  controls.maxZoom = 5;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.PAN;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.update();
  controls.saveState();

  function updateLabels() {
    labelAnchors.forEach((anchor, index) => {
      const element = labelElements[index];
      if (!element) return;
      const projected = anchor.clone().project(camera);
      const visible = projected.z > -1 && projected.z < 1;
      const rawLeft = ((projected.x + 1) / 2) * width;
      const mobileOffset = width < 640 ? (index === 1 ? 24 : index === 2 ? -18 : 0) : 0;
      const halfLabel = (element.offsetWidth || 104) / 2;
      const left = Math.max(halfLabel + 12, Math.min(width - halfLabel - 12, rawLeft + mobileOffset));
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

    vehicles.forEach((vehicle) => {
      const sample = samplePolyline(vehicle.path, (elapsed * vehicle.speed + vehicle.offset) % 1);
      vehicle.mesh.position.set(sample.x, 0.62, sample.z);
      vehicle.mesh.rotation.y = -sample.angle;
    });
    renderer.render(scene, camera);
    if (!paused) frame = requestAnimationFrame(render);
  }

  function requestRender() {
    cancelAnimationFrame(frame);
    lastTime = performance.now();
    frame = requestAnimationFrame(render);
  }

  function emitViewState() {
    const offset = controls.target.distanceTo(controls.target0);
    onViewChange?.({
      zoom: camera.zoom,
      isDefault: Math.abs(camera.zoom - 1) < 0.01 && offset < 0.01,
    });
  }

  function constrainAndRender() {
    const previousTarget = controls.target.clone();
    controls.target.x = Math.max(-58, Math.min(52, controls.target.x));
    controls.target.y = 0;
    controls.target.z = Math.max(-48, Math.min(52, controls.target.z));
    camera.position.add(controls.target.clone().sub(previousTarget));
    updateLabels();
    emitViewState();
    requestRender();
  }

  controls.addEventListener("change", constrainAndRender);

  function setZoom(action: "in" | "out" | "reset") {
    if (action === "reset") {
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
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      controls.removeEventListener("change", constrainAndRender);
      controls.dispose();
      disposeScene(scene);
      renderer.dispose();
    },
  };
}

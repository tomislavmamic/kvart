import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type XYZ = [number, number, number];
import { createPlanting, type ProposalTree } from "./proposal-trees";
import { addRecreationContent } from "./recreation-content";
type Tree = ProposalTree;
type SceneData = {
  width: number; depth: number;
  terrain: { cols: number; rows: number; heights: number[] };
  surfaces: { role: string; rings: XYZ[][] }[];
  trees: Tree[];
  originalUV: [number, number][]; enhancedUV: [number, number][];
  walls: { points: { position: XYZ; height: number }[] }[];
};

function surfaceGeometry(rings: XYZ[][]) {
  const open = rings.map((ring) => ring.slice(0, -1));
  const points = open.flat();
  const flat = open.map((ring) => ring.map(([x, , z]) => new THREE.Vector2(x, z)));
  const faces = THREE.ShapeUtils.triangulateShape(flat[0], flat.slice(1));
  const indices = faces.flatMap(([a, b, c]) => {
    const p = points[a], q = points[b], r = points[c];
    return (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]) < 0 ? [a, c, b] : [a, b, c];
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export async function createProposalScene(canvas: HTMLCanvasElement, signal: AbortSignal, onSelect: (tree: Tree) => void, kind: "nogostupi" | "rekreacija") {
  const recreation = kind === "rekreacija";
  const [payload, image, enhancedImage] = await Promise.allSettled([
    fetch(`/geo/prijedlozi/${kind}-3d.json`, { signal }).then((response) => {
      if (!response.ok) throw new Error("Scene unavailable");
      return response.json() as Promise<SceneData>;
    }),
    new THREE.TextureLoader().loadAsync(`/prijedlozi/${kind}-ortofoto.jpg`),
    new THREE.TextureLoader().loadAsync("/prijedlozi/nogostupi-render.png"),
  ]);
  if (payload.status === "rejected" || image.status === "rejected" || signal.aborted) {
    if (image.status === "fulfilled") image.value.dispose();
    if (enhancedImage.status === "fulfilled") enhancedImage.value.dispose();
    throw new Error("Scene unavailable");
  }
  const data = payload.value, texture = image.value;
  const enhancedTexture = enhancedImage.status === "fulfilled" ? enhancedImage.value : null;
  if (enhancedTexture) enhancedTexture.colorSpace = THREE.SRGBColorSpace;
  texture.colorSpace = THREE.SRGBColorSpace;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); }
  catch (error) { texture.dispose(); enhancedTexture?.dispose(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e9ebe3");
  scene.add(new THREE.HemisphereLight(0xe7f1ff, 0x79745d, 2));
  const sun = new THREE.DirectionalLight(0xfff2db, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowExtent = recreation ? 85 : 340;
  Object.assign(sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 1, far: 1500 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = recreation ? .07 : .2;
  sun.shadow.bias = -0.00015;
  sun.position.set(-300, 300, 260);
  scene.add(sun, sun.target);

  const { cols, rows, heights } = data.terrain;
  const positions: number[] = [], indices: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    positions.push((c / (cols - 1) - .5) * data.width, heights[r * cols + c], (r / (rows - 1) - .5) * data.depth);
    if (r < rows - 1 && c < cols - 1) {
      const i = r * cols + c;
      indices.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
    }
  }
  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const originalUV = new THREE.Float32BufferAttribute(data.originalUV.flat(), 2);
  const enhancedUV = new THREE.Float32BufferAttribute(data.enhancedUV.flat(), 2);
  terrainGeometry.setAttribute("uv", originalUV);
  terrainGeometry.setIndex(indices);
  terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
  terrain.receiveShadow = true;
  scene.add(terrain);
  // The illustration has a different extent. Keep real imagery beyond its
  // coverage instead of stretching the illustration's edge pixels.
  const enhancedGeometry = terrainGeometry.clone();
  enhancedGeometry.setAttribute("uv", enhancedUV);
  const enhancedFaces: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const face = indices.slice(i, i + 3);
    if (face.every((vertex) => data.enhancedUV[vertex].every((value) => value >= 0 && value <= 1))) enhancedFaces.push(...face);
  }
  enhancedGeometry.setIndex(enhancedFaces);
  const enhancedGround = new THREE.Mesh(enhancedGeometry, new THREE.MeshStandardMaterial({ map: enhancedTexture, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  enhancedGround.visible = !!enhancedTexture;
  enhancedGround.receiveShadow = true;
  scene.add(enhancedGround);
  const parcels = new THREE.Group();
  parcels.visible = false;
  scene.add(parcels);
  const materials: Record<string, THREE.Material> = {
    "existing-sidewalk": new THREE.MeshStandardMaterial({ color: 0xf0e9d6, roughness: 1, transparent: true, opacity: .65 }),
    "planned-sidewalk": new THREE.MeshStandardMaterial({ color: 0xd6ad71, roughness: 1 }),
    "retained-trees": new THREE.MeshStandardMaterial({ color: 0x285c35, roughness: 1, transparent: true, opacity: .4 }),
    "proposal-cageball": new THREE.MeshStandardMaterial({ color: 0x698454, roughness: 1 }),
    "proposal-playground": new THREE.MeshStandardMaterial({ color: 0xd7b78b, roughness: 1 }),
    "proposal-gym": new THREE.MeshStandardMaterial({ color: 0xb67e62, roughness: 1 }),
    "proposal-parking": new THREE.MeshStandardMaterial({ color: 0xb7b5a6, roughness: 1 }),
    "proposal-path": new THREE.MeshStandardMaterial({ color: 0xe8d9bd, roughness: 1 }),
    "proposal-promenade": new THREE.MeshStandardMaterial({ color: 0x849466, roughness: 1 }),
  };
  for (const surface of data.surfaces) {
    if (["road-parcel", "project-parcel", "recreation-zone"].includes(surface.role)) {
      for (const ring of surface.rings) parcels.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map((point) => new THREE.Vector3(...point))), new THREE.LineBasicMaterial({ color: 0xd66526 })));
    } else {
      const mesh = new THREE.Mesh(surfaceGeometry(surface.rings), materials[surface.role]);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  if (recreation) {
    const content = new THREE.Group(); scene.add(content);
    addRecreationContent(content, data.surfaces);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xd3cebb, roughness: 1, side: THREE.DoubleSide });
    for (const wall of data.walls) {
      const vertices: number[] = [], faces: number[] = [];
      wall.points.forEach(({ position: [x,y,z], height }, i) => {
        vertices.push(x,y,z,x,y+height,z);
        if (i) { const n = i*2; faces.push(n-2,n-1,n,n,n-1,n+1); }
      });
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3)); geometry.setIndex(faces); geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry,wallMaterial); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    }
  }
  const planting = createPlanting(data.trees);
  scene.add(planting.group);
  const camera = new THREE.OrthographicCamera(-300, 300, 180, -180, 1, 2000);
  const target = new THREE.Vector3(0, heights.reduce((a, b) => a + b, 0) / heights.length, recreation ? 0 : 10);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = false;
  controls.screenSpacePanning = false;
  controls.minZoom = .7;
  controls.maxZoom = 8;
  controls.minPolarAngle = .02;
  controls.maxPolarAngle = Math.PI * .43;
  controls.zoomToCursor = true;
  let disposed = false, frame = 0;
  function draw() {
    if (!disposed && !frame) frame = requestAnimationFrame(() => { frame = 0; renderer.render(scene, camera); });
  }
  function growth(factor: number) { planting.growth(factor); draw(); }
  function reset(top = false) {
    controls.target.copy(target);
    camera.position.set(target.x + (recreation && !top ? 75 : 0), target.y + (recreation ? 85 : top ? 500 : 260), target.z + (top ? .1 : recreation ? -95 : 270));
    camera.zoom = 1; camera.updateProjectionMatrix(); controls.update(); draw();
  }
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const viewWidth = recreation ? Math.max(data.width * 1.12, data.depth * width / height * .95) : data.width * 1.06;
    const viewHeight = viewWidth * height / width;
    Object.assign(camera, { left: -viewWidth / 2, right: viewWidth / 2, top: viewHeight / 2, bottom: -viewHeight / 2 });
    camera.updateProjectionMatrix(); renderer.setSize(width, height, false); draw();
  }
  const raycaster = new THREE.Raycaster();
  let pointerStart = [0, 0];
  const pointerDown = (e: PointerEvent) => { pointerStart = [e.clientX, e.clientY]; };
  const pointerUp = (e: PointerEvent) => {
    if (!planting.group.visible || Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]) > 5) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), camera);
    const hit = raycaster.intersectObjects(planting.targets)[0];
    if (hit?.instanceId != null) onSelect(planting.treeForHit(hit));
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  controls.addEventListener("change", draw);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  growth(1); reset(); resize();
  return {
    growth, reset,
    zoom: (factor: number) => { camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, .7, 8); camera.updateProjectionMatrix(); draw(); },
    rotate: (angle: number) => { camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(controls.target); controls.update(); draw(); },
    sunlight: (period: string) => { sun.position.set(period === "morning" ? 300 : period === "afternoon" ? -300 : 0, period === "noon" ? 550 : 300, 260); draw(); },
    showTrees: (visible: boolean) => { planting.group.visible = visible; draw(); },
    enhancedAvailable: !!enhancedTexture,
    showEnhanced: (visible: boolean) => { enhancedGround.visible = visible && !!enhancedTexture; draw(); },
    showParcels: (visible: boolean) => { parcels.visible = visible; draw(); },
    dispose: () => {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointerup", pointerUp);
      const geometries = new Set<THREE.BufferGeometry>(), usedMaterials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => usedMaterials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose()); usedMaterials.forEach((material) => material.dispose());
      texture.dispose(); enhancedTexture?.dispose(); sun.shadow.map?.dispose(); renderer.dispose();
    },
  };
}

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { footprintAppearance, inboundRoadArrows, roadColors, roadFrame, wideningFrame, wideningParcelAt, type BiliceRoadSceneData, type BiliceRoadSegment, type BiliceWideningParcel, type RoadXYZ } from "./bilice-road-scene-types";

function openRing(ring: RoadXYZ[]) {
  const first = ring[0], last = ring.at(-1);
  return first && last && first[0] === last[0] && first[2] === last[2] ? ring.slice(0, -1) : ring;
}

function surfaceGeometry(rings: RoadXYZ[][], lift = 0) {
  const open = rings.map(openRing).filter((ring) => ring.length >= 3);
  const points = open.flat();
  const geometry = new THREE.BufferGeometry();
  if (!points.length) return geometry;
  const flat = open.map((ring) => ring.map(([x, , z]) => new THREE.Vector2(x, z)));
  const faces = THREE.ShapeUtils.triangulateShape(flat[0], flat.slice(1));
  const indices = faces.flatMap(([a, b, c]) => {
    const p = points[a], q = points[b], r = points[c];
    return (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]) < 0 ? [a, c, b] : [a, b, c];
  });
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap(([x, y, z]) => [x, y + lift, z]), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createBiliceRoadScene(canvas: HTMLCanvasElement, data: BiliceRoadSceneData, signal: AbortSignal, onSelect: (segment: BiliceRoadSegment) => void, parcelEvents?: { onSelect: (parcel: BiliceWideningParcel) => void; onHover: (parcel: BiliceWideningParcel | null) => void }) {
  if (signal.aborted) throw new DOMException("Scene cancelled", "AbortError");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor("#e9e9e1");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf6f7ee, 0x7b7863, 2.5));
  const sun = new THREE.DirectionalLight(0xfff0da, 2);
  sun.position.set(-400, 650, 200);
  scene.add(sun);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const cleanups: (() => void)[] = [];
  let disposed = false, animationFrame = 0, visible = true;
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(animationFrame);
    cleanups.forEach((cleanup) => cleanup());
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); textures.forEach((texture) => texture.dispose());
    renderer.dispose();
  }
  const rememberGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const rememberMaterial = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => new THREE.Mesh(rememberGeometry(geometry), rememberMaterial(material));
  try {
  const plan = new THREE.Group(), proposal = new THREE.Group(), buildings = new THREE.Group(), widening = new THREE.Group(), annotations = new THREE.Group();
  plan.visible = false;
  scene.add(plan, proposal, buildings, widening, annotations);

  const { cols, rows, heights } = data.terrain;
  const terrainPositions: number[] = [], terrainColors: number[] = [], terrainIndices: number[] = [];
  const minHeight = Math.min(...heights), maxHeight = Math.max(...heights);
  const lowColor = new THREE.Color("#b0b29d"), highColor = new THREE.Color("#d7d2b9"), color = new THREE.Color();
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const height = heights[row * cols + col];
    terrainPositions.push((col / (cols - 1) - .5) * data.width, height, (row / (rows - 1) - .5) * data.depth);
    color.copy(lowColor).lerp(highColor, (height - minHeight) / (maxHeight - minHeight || 1));
    terrainColors.push(color.r, color.g, color.b);
    if (row < rows - 1 && col < cols - 1) {
      const index = row * cols + col;
      terrainIndices.push(index, index + cols, index + 1, index + 1, index + cols, index + cols + 1);
    }
  }
  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute("position", new THREE.Float32BufferAttribute(terrainPositions, 3));
  terrainGeometry.setAttribute("color", new THREE.Float32BufferAttribute(terrainColors, 3));
  terrainGeometry.setIndex(terrainIndices);
  terrainGeometry.computeVertexNormals();
  const terrainMesh = mesh(terrainGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  scene.add(terrainMesh);

  const roadMaterial = rememberMaterial(new THREE.MeshStandardMaterial({ color: roadColors.road, roughness: 1, side: THREE.DoubleSide }));
  const planMaterial = rememberMaterial(new THREE.MeshBasicMaterial({ color: roadColors.plan, transparent: true, opacity: .29, depthWrite: false, side: THREE.DoubleSide }));
  const planLineMaterial = rememberMaterial(new THREE.LineDashedMaterial({ color: roadColors.plan, dashSize: 6, gapSize: 4, transparent: true, opacity: .8 }));
  for (const surface of data.surfaces) {
    const planned = surface.role.startsWith("dpu") || surface.role.startsWith("planned");
    if (surface.role.startsWith("proposal")) continue;
    const group = planned ? plan : scene;
    group.add(mesh(surfaceGeometry(surface.rings, planned ? .48 : .22), planned ? planMaterial : roadMaterial));
    if (planned) for (const ring of surface.rings) {
      const line = new THREE.Line(rememberGeometry(new THREE.BufferGeometry().setFromPoints(ring.map(([x, y, z]) => new THREE.Vector3(x, y + .55, z)))), planLineMaterial);
      line.computeLineDistances();
      group.add(line);
    }
  }

  const wallPositions: number[] = [], roofPositions: number[] = [], edgePositions: number[] = [];
  for (const building of data.buildings) {
    const validRings = building.rings.map(openRing).filter((ring) => ring.length >= 3);
    if (!validRings.length) continue;
    const top = Math.max(...validRings.flat().map(([, y]) => y)) + building.height;
    const roof = surfaceGeometry(validRings.map((ring) => ring.map(([x, , z]): RoadXYZ => [x, top, z])));
    const roofPoints = roof.toNonIndexed();
    roofPositions.push(...Array.from(roofPoints.getAttribute("position").array));
    roofPoints.dispose(); roof.dispose();
    for (const ring of validRings) ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length];
      wallPositions.push(...p, q[0], top, q[2], ...q, ...p, p[0], top, p[2], q[0], top, q[2]);
      edgePositions.push(p[0], top + .04, p[2], q[0], top + .04, q[2]);
    });
  }
  for (const [positions, fill] of [[wallPositions, "#c9c5b8"], [roofPositions, roadColors.building]] as const) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    buildings.add(mesh(geometry, new THREE.MeshStandardMaterial({ color: fill, roughness: 1, side: THREE.DoubleSide })));
  }
  buildings.add(new THREE.LineSegments(rememberGeometry(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3))), rememberMaterial(new THREE.LineBasicMaterial({ color: "#99978e", transparent: true, opacity: .65 }))));

  const pickables: THREE.Mesh[] = [];
  for (const footprint of data.proposalFootprints ?? []) {
    const segment = data.segments.find((item) => item.id === footprint.segmentId);
    if (!segment) continue;
    const { color } = footprintAppearance(footprint);
    const road = mesh(surfaceGeometry(footprint.rings, .65), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    road.userData.segment = segment;
    pickables.push(road);
    proposal.add(road);
  }
  const arrowMaterial = rememberMaterial(new THREE.MeshBasicMaterial({ color: "#fff8e7", side: THREE.DoubleSide }));
  for (const { ring } of inboundRoadArrows(data)) proposal.add(mesh(surfaceGeometry([ring]), arrowMaterial));

  const parcelMaterials = new Map<string, { fill: THREE.MeshBasicMaterial; line: THREE.LineBasicMaterial }>();
  let selectedParcelId: string | null = null, hoveredParcelId: string | null = null;
  if (data.widening) {
    widening.add(mesh(surfaceGeometry(data.widening.rings, 1.35), new THREE.MeshBasicMaterial({ color: roadColors.widening, side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false })));
    for (const ring of data.widening.rings) widening.add(new THREE.Line(rememberGeometry(new THREE.BufferGeometry().setFromPoints(ring.map(([x, y, z]) => new THREE.Vector3(x, y + 1.4, z)))), rememberMaterial(new THREE.LineBasicMaterial({ color: "#fff8e7" }))));
    for (const parcel of data.widening.parcels) {
      const fill = rememberMaterial(new THREE.MeshBasicMaterial({ color: roadColors.parcel, transparent: true, opacity: .05, side: THREE.DoubleSide, depthWrite: false }));
      const line = rememberMaterial(new THREE.LineBasicMaterial({ color: roadColors.parcel, transparent: true, opacity: .85 }));
      parcelMaterials.set(parcel.id, { fill, line });
      const footprint = mesh(surfaceGeometry(parcel.rings, .6), fill);
      widening.add(footprint);
      for (const ring of parcel.rings) widening.add(new THREE.Line(rememberGeometry(new THREE.BufferGeometry().setFromPoints(ring.map(([x, y, z]) => new THREE.Vector3(x, y + 1.5, z)))), line));
    }
  }
  function paintParcels() {
    for (const [id, material] of parcelMaterials) {
      const active = id === selectedParcelId || id === hoveredParcelId;
      material.fill.opacity = active ? .22 : .05;
      material.fill.color.set(active ? roadColors.widening : roadColors.parcel);
      material.line.color.set(active ? "#8c2455" : roadColors.parcel);
    }
    draw();
  }

  // A road label is a screen-facing annotation, not an additional geographic feature.
  for (const label of data.labels) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 768; labelCanvas.height = 96;
    const context = labelCanvas.getContext("2d");
    if (!context) continue;
    context.font = "600 32px system-ui, sans-serif";
    const textWidth = Math.min(724, context.measureText(label.label).width + 42);
    context.fillStyle = "rgba(255,255,249,0.94)";
    context.beginPath(); context.roundRect((768 - textWidth) / 2, 16, textWidth, 62, 12); context.fill();
    context.fillStyle = "#343c36"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(label.label, 384, 47, 682);
    const texture = new THREE.CanvasTexture(labelCanvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const sprite = new THREE.Sprite(rememberMaterial(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })));
    sprite.position.set(label.position[0], label.position[1] + 19, label.position[2]);
    sprite.scale.set(160, 20, 1); sprite.renderOrder = 10;
    annotations.add(sprite);
  }

  let frame = roadFrame(data);
  const wholeTarget = new THREE.Vector3((frame.minX + frame.maxX) / 2, (minHeight + maxHeight) / 2, (frame.minZ + frame.maxZ) / 2);
  const target = wholeTarget.clone();
  const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, .1, 12000);
  const controls = new OrbitControls(camera, canvas);
  cleanups.push(() => controls.dispose());
  controls.target.copy(target); controls.enableDamping = false;
  controls.screenSpacePanning = true; controls.zoomToCursor = true;
  controls.minZoom = .65; controls.maxZoom = 12;
  controls.minPolarAngle = .001; controls.maxPolarAngle = Math.PI * .46;
  function draw() {
    if (disposed || !visible || animationFrame) return;
    animationFrame = requestAnimationFrame(() => { animationFrame = 0; if (!disposed) renderer.render(scene, camera); });
  }
  function fit() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.updateMatrixWorld();
    const projected = new THREE.Box3();
    for (const x of [frame.minX, frame.maxX]) for (const y of [minHeight, maxHeight + 20]) for (const z of [frame.minZ, frame.maxZ]) projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    const size = projected.getSize(new THREE.Vector3());
    const aspect = rect.width / rect.height;
    const viewHeight = Math.max(size.y, size.x / aspect) * 1.12;
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height, false); draw();
  }
  function reset(top = false) {
    frame = roadFrame(data); target.copy(wholeTarget); annotations.visible = true;
    controls.target.copy(target);
    camera.position.copy(target).add(top ? new THREE.Vector3(0, 2200, .1) : new THREE.Vector3(160, 1200, 900));
    camera.zoom = 1; controls.update(); fit(); draw();
  }
  const raycaster = new THREE.Raycaster();
  let pointerStart: [number, number] = [0, 0];
  const pointerDown = (event: PointerEvent) => { pointerStart = [event.clientX, event.clientY]; };
  function pointRay(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
  }
  function parcelUnderRay() {
    if (!data.widening || !widening.visible) return null;
    const hit = raycaster.intersectObject(terrainMesh)[0];
    return hit ? wideningParcelAt(data.widening, hit.point.x, hit.point.z) : null;
  }
  function setHover(parcel: BiliceWideningParcel | null) {
    if (hoveredParcelId === (parcel?.id ?? null)) return;
    hoveredParcelId = parcel?.id ?? null;
    canvas.style.cursor = parcel ? "pointer" : "";
    parcelEvents?.onHover(parcel); paintParcels();
  }
  const pointerMove = (event: PointerEvent) => {
    if (!widening.visible || event.buttons) { setHover(null); return; }
    pointRay(event);
    setHover(parcelUnderRay());
  };
  const pointerLeave = () => setHover(null);
  const pointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) return;
    pointRay(event);
    const parcelHit = parcelUnderRay();
    if (parcelHit) { parcelEvents?.onSelect(parcelHit); return; }
    if (!proposal.visible) return;
    const hit = raycaster.intersectObjects(pickables)[0];
    if (hit) onSelect(hit.object.userData.segment as BiliceRoadSegment);
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointermove", pointerMove); canvas.addEventListener("pointerleave", pointerLeave);
  cleanups.push(() => { canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerleave", pointerLeave); canvas.style.cursor = ""; });
  controls.addEventListener("change", draw);
  const observer = new ResizeObserver(fit); observer.observe(canvas);
  cleanups.push(() => observer.disconnect());
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) draw(); }); visibility.observe(canvas);
  cleanups.push(() => visibility.disconnect());
  signal.addEventListener("abort", dispose, { once: true });
  cleanups.push(() => signal.removeEventListener("abort", dispose));
  reset();
  return {
    reset, dispose,
    zoom: (factor: number) => { camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); draw(); },
    rotate: (angle: number) => { camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(controls.target); controls.update(); draw(); },
    showPlan: (value: boolean) => { plan.visible = value; draw(); },
    showProposal: (value: boolean) => { proposal.visible = value; draw(); },
    showBuildings: (value: boolean) => { buildings.visible = value; draw(); },
    showWidening: (value: boolean) => { widening.visible = value; if (!value) setHover(null); draw(); },
    selectParcel: (id: string | null) => { selectedParcelId = id; paintParcels(); },
    focusWidening: () => {
      if (!data.widening) return;
      frame = wideningFrame(data.widening); annotations.visible = false;
      const heights = data.widening.points.map(([, y]) => y);
      target.set((frame.minX + frame.maxX) / 2, (Math.min(...heights) + Math.max(...heights)) / 2, (frame.minZ + frame.maxZ) / 2);
      controls.target.copy(target); camera.position.copy(target).add(new THREE.Vector3(0, 2200, .1));
      camera.zoom = 1; controls.update(); fit(); draw();
    },
  };
  } catch (error) {
    dispose();
    throw error;
  }
}

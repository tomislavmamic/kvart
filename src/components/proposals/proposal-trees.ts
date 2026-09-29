import * as THREE from "three";

export type ProposalTree = { id: string; position: [number, number, number]; radius: number; soilRadius: number; conditional: boolean };

// One reusable crown with irregular leaf sprays, gaps and fine silhouettes.
// Geometry is deterministic; changing the view never changes the planting plan.
function foliageGeometry() {
  let seed = 7183;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const normal = new THREE.Vector3(), tangent = new THREE.Vector3(), bitangent = new THREE.Vector3();
  const shades = ["#486d36", "#6f8b43", "#849b55", "#5a7939"];
  for (let cluster = 0; cluster < 9; cluster++) {
    const angle = cluster * Math.PI * 2 / 8;
    const centre = cluster === 8 ? new THREE.Vector3(0, .25, 0) : new THREE.Vector3(Math.cos(angle) * .48, (random() - .5) * .35, Math.sin(angle) * .48);
    for (let leaf = 0; leaf < 210; leaf++) {
      const azimuth = random() * Math.PI * 2, vertical = random() * 2 - 1;
      const distance = Math.cbrt(random()) * (cluster === 8 ? .65 : .5);
      const spread = Math.sqrt(1 - vertical * vertical);
      const point = centre.clone().add(new THREE.Vector3(Math.cos(azimuth) * spread * distance, vertical * distance * .8, Math.sin(azimuth) * spread * distance));
      normal.set(random() - .5, .15 + random(), random() - .5).normalize();
      tangent.crossVectors(normal, new THREE.Vector3(0, 0, 1)).normalize();
      bitangent.crossVectors(normal, tangent);
      const size = .045 + random() * .05, start = positions.length / 3;
      const color = new THREE.Color(shades[Math.floor(random() * shades.length)]);
      for (let v = 0; v < 6; v++) {
        const theta = v / 6 * Math.PI * 2;
        const p = point.clone().addScaledVector(tangent, Math.cos(theta) * size).addScaledVector(bitangent, Math.sin(theta) * size * .6);
        positions.push(p.x, p.y, p.z); colors.push(color.r, color.g, color.b);
      }
      for (let v = 1; v < 5; v++) indices.push(start, start + v, start + v + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createPlanting(trees: ProposalTree[]) {
  const group = new THREE.Group(), dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(.65, 1, 1, 9), new THREE.MeshStandardMaterial({ color: 0x99866d, roughness: 1 }), trees.length * 16);
  const crowns = new THREE.InstancedMesh(foliageGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .9 }), trees.length);
  const soil = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ color: 0x766b51, roughness: 1 }), trees.length);
  branches.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = soil.receiveShadow = true;
  group.add(branches, crowns, soil);
  const branch = (index: number, a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
    dummy.position.copy(a).add(b).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    dummy.scale.set(radius, a.distanceTo(b), radius); dummy.updateMatrix(); branches.setMatrixAt(index, dummy.matrix);
  };
  function growth(factor: number) {
    trees.forEach((tree, i) => {
      const origin = new THREE.Vector3(...tree.position), r = tree.radius * factor;
      const trunkHeight = 2.3 + r * .23, rotation = i * 2.39996;
      const fork = origin.clone().add(new THREE.Vector3(0, trunkHeight, 0));
      branch(i * 16, origin, fork, .28 * Math.sqrt(factor));
      for (let j = 0; j < 5; j++) {
        const angle = rotation + j * Math.PI * 2 / 5;
        const end = fork.clone().add(new THREE.Vector3(Math.cos(angle) * r * .52, r * (.42 + .04 * j), Math.sin(angle) * r * .52));
        branch(i * 16 + 1 + j * 3, fork, end, .12 * factor);
        for (let k = 0; k < 2; k++) {
          const tipAngle = angle + (k ? .65 : -.65);
          const tip = end.clone().add(new THREE.Vector3(Math.cos(tipAngle) * r * .25, r * .23, Math.sin(tipAngle) * r * .25));
          branch(i * 16 + 2 + j * 3 + k, end, tip, .055 * factor);
        }
      }
      dummy.position.copy(fork).add(new THREE.Vector3(0, r * .67, 0)); dummy.rotation.set(0, rotation, 0);
      dummy.scale.set(r, r * (1 + .05 * Math.sin(i)), r); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
      dummy.position.copy(origin).add(new THREE.Vector3(0, .25, 0)); dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(tree.soilRadius, tree.soilRadius, 1); dummy.updateMatrix(); soil.setMatrixAt(i, dummy.matrix);
    });
    for (const mesh of [branches, crowns, soil]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  }
  growth(1);
  return { group, growth, targets: [crowns, branches], treeForHit: (hit: THREE.Intersection) => trees[hit.object === crowns ? hit.instanceId! : Math.floor(hit.instanceId! / 16)] };
}

import * as THREE from "three";

type Surface = { role: string; rings: [number, number, number][][] };

// Furniture illustrates the programme inside its mapped footprints; it is not
// a construction layout or a certified equipment-clearance drawing.
export function addRecreationContent(group: THREE.Group, surfaces: Surface[]) {
  const wood = new THREE.MeshStandardMaterial({ color: 0xb88d59, roughness: .85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x344b43, metalness: .45, roughness: .5 });
  const white = new THREE.LineBasicMaterial({ color: 0xf2eddd });
  const turf = [0x688652, 0x607e49].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, material = wood) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const rod = (a: number[], b: number[], radius = .07, material = steel) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 8), material);
    mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    mesh.castShadow = true; group.add(mesh);
  };
  const lines = (points: number[][], material = white) => group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p))), material));
  for (const surface of surfaces) {
    if (!["proposal-cageball", "proposal-playground", "proposal-gym", "proposal-parking"].includes(surface.role)) continue;
    const points = surface.rings[0];
    const x0 = Math.min(...points.map((p) => p[0])), x1 = Math.max(...points.map((p) => p[0]));
    const z0 = Math.min(...points.map((p) => p[2])), z1 = Math.max(...points.map((p) => p[2]));
    const y = points[0][1] + .04, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = x1 - x0, d = z1 - z0;
    if (surface.role === "proposal-cageball") {
      for (let i = 0; i < 8; i++) box(x0 + w * (i + .5) / 8, y, cz, w / 8, .025, d, turf[i % 2]);
      lines([[x0+.35,y+.04,z0+.35],[x1-.35,y+.04,z0+.35],[x1-.35,y+.04,z1-.35],[x0+.35,y+.04,z1-.35],[x0+.35,y+.04,z0+.35]]);
      lines([[cx,y+.04,z0+.35],[cx,y+.04,z1-.35]]);
      lines(Array.from({ length: 49 }, (_, i) => [cx+Math.cos(i/48*Math.PI*2)*1.5,y+.04,cz+Math.sin(i/48*Math.PI*2)*1.5]));
      const fence: number[] = [];
      for (const [a,b] of [[[x0,z0],[x1,z0]],[[x1,z0],[x1,z1]],[[x1,z1],[x0,z1]],[[x0,z1],[x0,z0]]]) {
        const length = Math.hypot(b[0]-a[0],b[1]-a[1]);
        for (let i = 0; i <= Math.ceil(length/.35); i++) {
          const t = i/Math.ceil(length/.35), x = a[0]+(b[0]-a[0])*t, z = a[1]+(b[1]-a[1])*t;
          fence.push(x,y,z,x,y+3.8,z);
        }
        for (let h = .35; h < 3.9; h += .35) fence.push(a[0],y+h,a[1],b[0],y+h,b[1]);
        for (let i = 0; i <= Math.ceil(length/3); i++) {
          const t = i/Math.ceil(length/3), x = a[0]+(b[0]-a[0])*t, z = a[1]+(b[1]-a[1])*t;
          rod([x,y,z],[x,y+3.9,z],.055);
        }
      }
      const netGeometry = new THREE.BufferGeometry(); netGeometry.setAttribute("position",new THREE.Float32BufferAttribute(fence,3));
      group.add(new THREE.LineSegments(netGeometry,new THREE.LineBasicMaterial({color:0x3f574c,transparent:true,opacity:.45})));
      for (const x of [x0+.6,x1-.6]) {
        rod([x,y,cz-1.5],[x,y+2,cz-1.5],.06); rod([x,y,cz+1.5],[x,y+2,cz+1.5],.06); rod([x,y+2,cz-1.5],[x,y+2,cz+1.5],.06);
      }
    } else if (surface.role === "proposal-gym") {
      for (let i = 0; i < 3; i++) {
        const x = x0+1+i*1.7, h = 2.3-i*.35;
        rod([x,y,z0+1],[x,y+h,z0+1]); rod([x+1.3,y,z0+1],[x+1.3,y+h,z0+1]); rod([x,y+h,z0+1],[x+1.3,y+h,z0+1]);
      }
      for (const z of [z1-1,z1-2]) { rod([cx-2,y,z],[cx-2,y+1.1,z]); rod([cx+1,y,z],[cx+1,y+1.1,z]); rod([cx-2,y+1.1,z],[cx+1,y+1.1,z]); }
      box(x1-1,y+.25,z1-1.5,1,.5,1);
    } else if (surface.role === "proposal-playground") {
      const tx = x0+w*.68, tz = z0+d*.53;
      for (const dx of [-.8,.8]) for (const dz of [-.8,.8]) rod([tx+dx,y,tz+dz],[tx+dx,y+2.9,tz+dz],.095,wood);
      box(tx,y+1.3,tz,1.9,.18,1.9);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.65,1,4),steel); roof.position.set(tx,y+3.2,tz);roof.rotation.y=Math.PI/4;roof.castShadow=true;group.add(roof);
      const slide = box(tx+2,y+.72,tz,2.8,.12,.7,steel);slide.rotation.z=-.47;
      for (let i=0;i<5;i++) rod([tx-.8,y+.25+i*.25,tz-1],[tx+.8,y+.25+i*.25,tz-1],.055,wood);
      const sx = x0+w*.15, sz = z0+d*.23;
      for (const x of [sx-2,sx+2]) {rod([x,y,sz-1],[x,y+2.8,sz],.085,wood);rod([x,y,sz+1],[x,y+2.8,sz],.085,wood);}
      rod([sx-2,y+2.8,sz],[sx+2,y+2.8,sz],.1,wood);
      for (const x of [sx-.8,sx+.8]) {for(const dx of [-.25,.25])rod([x+dx,y+.55,sz],[x+dx,y+2.8,sz],.016);box(x,y+.55,sz,.65,.07,.35,steel);}
      box(x0+w*.37,y+.12,z0+d*.2,3,.24,2.6,wood);
      for (const x of [x0+w*.35,x0+w*.8]) {box(x,y+.46,z1-.5,1.8,.12,.48);box(x,y+.77,z1-.3,1.8,.5,.08);}
    } else {
      for (let i=0;i<4;i++) lines([[x0,y,z0+i*d/3],[x0+5,y,z0+i*d/3]]);
    }
  }
}

/**
 * Sloj koji na kartu crta perjanicu, strelice i čestice vjetra.
 *
 * Ide kao MapLibreov „custom layer”: karta ostaje gospodar zemljopisa —
 * projekcije, pomicanja, uvećanja, poretka slojeva — a ovdje se samo crta u
 * njezin WebGL sklop, matricom koju ona zada. Nema druge kamere ni drugih
 * kontrola; da ih ima, dvije bi se slike razišle čim netko povuče kartu.
 *
 * Oblik životnog vijeka preuzet je iz `/igra`: jedan predmet s `dispose`,
 * ništa se ne stvara izvan njega, i sve što se stvori ovdje se i pušta.
 *
 * ## Zašto je perjanica podijeljen pravokutnik
 *
 * Polje je pravilna mreža po zemljopisnoj širini i dužini, a Mercatorova
 * projekcija širinu razvlači prema polovima. Na jednom pravokutniku s četiri
 * vrha tekstura bi se razvukla pravocrtno i sjeverni bi rub perjanice bio
 * pomaknut. Na 6,4 km to je manje od metra, ali podjela stoji ništa: svaki
 * vrh dobiva svoj pravi položaj, pa greške nema nikakve.
 */

import type { Map as MapaLibre, CustomLayerInterface } from "maplibre-gl";
import { MercatorCoordinate } from "maplibre-gl";
import * as THREE from "three";

import { MIRISNI_RASPON, TVARI, type Tvar, ljestvicaBoja } from "@/lib/dim";
import { bojaZa, SIDRO_SIMULATORA } from "@/lib/sim/ljestvica";
import { PROZOR } from "@/lib/sim/zapis-gustoce";
import type { Osnove } from "@/lib/sim/polje";

/** Koliko puta se pravokutnik perjanice dijeli po svakoj osi. */
const PODJELA = 24;

/** Rešetka strelica vjetra; gušće od ovoga postane šara, a ne mjerenje. */
const STRELICA = { po_osi: 16, duljinaM: 260 } as const;

/** Koliko čestica nosi animirani vjetar. */
const CESTICA = 1400;

/** Sekundi koliko čestica živi prije nego se vrati na slučajno mjesto. */
const VIJEK_CESTICE = 2.4;

/** Ubrzanje prikaza čestica: koliko stvarnih metara u sekundi prikaza. */
const UBRZANJE_CESTICA = 26;

export type PrikazTvari = {
  readonly vidljiv: boolean;
  readonly boja: string;
  /** Jačina izvora u odnosu na bazdarenu. */
  readonly jacina: number;
};

export type PostavkePrikaza = {
  readonly tvari: Readonly<Record<Tvar, PrikazTvari>>;
  readonly strelice: boolean;
  readonly cestice: boolean;
  readonly mirovanje: boolean;
};

export type Scena = {
  /** Postavlja sliku gustoće za odabrani sat. */
  postaviGustocu(bajtovi: Uint8Array, sirina: number, visina: number): void;
  /** Postavlja polje vjetra za odabrani sat, u m/s po ćeliji. */
  postaviVjetar(vx: Float32Array, vy: Float32Array, gw: number, gh: number): void;
  postaviPrikaz(postavke: PostavkePrikaza): void;
  dispose(): void;
};

const _RASPON_OD = Math.log10(MIRISNI_RASPON.od);
const _RASPON_SIRINA = Math.log10(MIRISNI_RASPON.do) - _RASPON_OD;

/**
 * Pomak ljestvice za jednu tvar pri zadanoj jačini izvora.
 *
 * Zapis gustoće ne zna ni za tvar ni za jačinu (vidi `zapis-gustoce.ts`);
 * oboje su pomaci iste logaritamske ljestvice, pa se ovdje samo zbroje.
 *
 * Args:
 *   tvar: Koja se tvar prikazuje.
 *   jacina: Jačina izvora u odnosu na bazdarenu.
 *
 * Returns:
 *   Pomak koji sjenčar dodaje pročitanoj vrijednosti.
 */
export function pomakLjestvice(tvar: Tvar, jacina: number): number {
  const mirisne = TVARI[tvar].razina / TVARI[tvar].prag;
  // Jačina nula znači da tvari nema; ljestvica se gura ispod dna, ne u −∞.
  const log = jacina > 0 ? Math.log10(jacina) : -99;
  return (Math.log10(mirisne) + log - _RASPON_OD) / _RASPON_SIRINA;
}

const VRHOVI = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PIKSELI = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uGustoca;
  uniform sampler2D uLutA;
  uniform sampler2D uLutB;
  uniform float uSkala;
  uniform float uBaza;
  uniform float uPomakA;
  uniform float uPomakB;
  uniform float uVidljivA;
  uniform float uVidljivB;

  vec4 uzmi(sampler2D lut, float razina, float vidljiv) {
    if (vidljiv < 0.5) return vec4(0.0);
    return texture2D(lut, vec2(clamp(razina, 0.0, 1.0), 0.5));
  }

  void main() {
    float u = texture2D(uGustoca, vUv).r;
    // Bajt nula znači „ispod prozora zapisa”, dakle nema ničega. Bez ove
    // provjere bi prazan zrak dobio dno ljestvice, a ono pri jakom izvoru
    // više nije prozirno — cijela bi karta poprimila boju.
    if (u <= 0.0) discard;

    // Rub okvira nije rub perjanice nego rub onoga što je izračunato. Oštar
    // rez ondje čita se kao „dalje je čisto”, što nije istina — zrak ide
    // dalje, samo ga polje više ne prati. Zato se pri rubu gasi postupno.
    vec2 doRuba = min(vUv, 1.0 - vUv);
    float rub = smoothstep(0.0, 0.045, min(doRuba.x, doRuba.y));

    float razina = u * uSkala + uBaza;
    vec4 a = uzmi(uLutA, razina + uPomakA, uVidljivA);
    vec4 b = uzmi(uLutB, razina + uPomakB, uVidljivB);

    // Druga tvar ide preko prve; obje su prozirne, pa se preklop vidi kao
    // miješana boja, a ne kao da je jedna pojela drugu.
    vec3 boja = a.rgb * a.a;
    float alfa = a.a;
    boja = b.rgb * b.a + boja * (1.0 - b.a);
    alfa = b.a + alfa * (1.0 - b.a);
    alfa *= rub;
    if (alfa <= 0.002) discard;

    // MapLibre očekuje boju već pomnoženu neprozirnošću.
    gl_FragColor = vec4(boja * rub, alfa);
  }
`;

/** Gradi teksturu 256 × 1 iz ljestvice boja. */
function lutTekstura(kljuc: string, tvar: Tvar): THREE.DataTexture {
  const bajtovi = ljestvicaBoja(bojaZa(kljuc, tvar).ljestvica);
  const t = new THREE.DataTexture(
    new Uint8Array(bajtovi.buffer.slice(0)),
    256,
    1,
    THREE.RGBAFormat,
  );
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/**
 * Gradi mrežu pravokutnika perjanice u Mercatorovim koordinatama karte.
 *
 * Args:
 *   granice: Zemljopisni obuhvat polja.
 *
 * Returns:
 *   Geometrija s pravim položajem svakog vrha i teksturnim koordinatama.
 */
function geometrijaPerjanice(granice: Osnove["granice"]): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, PODJELA, PODJELA);
  const polozaji = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < polozaji.count; i += 1) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const lon = granice.zapad + u * (granice.istok - granice.zapad);
    // `v` raste prema vrhu pravokutnika, a redak 0 teksture je sjeverni rub.
    const lat = granice.jug + v * (granice.sjever - granice.jug);
    const m = MercatorCoordinate.fromLngLat({ lng: lon, lat }, 0);
    polozaji.setXYZ(i, m.x, m.y, 0);
    uv.setXY(i, u, 1 - v);
  }
  polozaji.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

/** Jedna strelica: tanak trup i vrh, u ravnini, duljine 1 i sredine u ishodištu. */
function geometrijaStrelice(): THREE.BufferGeometry {
  const oblik = new THREE.Shape();
  oblik.moveTo(-0.5, -0.06);
  oblik.lineTo(0.16, -0.06);
  oblik.lineTo(0.16, -0.2);
  oblik.lineTo(0.5, 0);
  oblik.lineTo(0.16, 0.2);
  oblik.lineTo(0.16, 0.06);
  oblik.lineTo(-0.5, 0.06);
  oblik.closePath();
  return new THREE.ShapeGeometry(oblik);
}

/**
 * Stvara sloj i vraća upravljač njime.
 *
 * Args:
 *   karta: Karta na koju se sloj dodaje.
 *   osnove: Osnove polja; iz njih dolaze granice i veličina okvira.
 *   naSpremno: Poziva se kad je sloj spreman primati podatke.
 *
 * Returns:
 *   Sloj u obliku koji `map.addLayer` prima, uz upravljač.
 */
export function stvoriSlojPerjanice(
  osnove: Osnove,
  naSpremno: (scena: Scena) => void,
): CustomLayerInterface {
  let renderer: THREE.WebGLRenderer | null = null;
  let karta: MapaLibre | null = null;
  const scena = new THREE.Scene();
  const kamera = new THREE.Camera();

  const gustoca = new THREE.DataTexture(new Uint8Array(1), 1, 1, THREE.RedFormat);
  gustoca.minFilter = THREE.LinearFilter;
  gustoca.magFilter = THREE.LinearFilter;
  gustoca.wrapS = THREE.ClampToEdgeWrapping;
  gustoca.wrapT = THREE.ClampToEdgeWrapping;
  gustoca.needsUpdate = true;

  const lutovi: Record<"A" | "B", THREE.DataTexture> = {
    A: lutTekstura("jantar", "sumporovodik"),
    B: lutTekstura("modra", "merkaptani"),
  };

  const uniforme = {
    uGustoca: { value: gustoca },
    uLutA: { value: lutovi.A },
    uLutB: { value: lutovi.B },
    // Zapis pokriva šest redova veličine; ljestvica prikaza svoj vlastiti
    // raspon. Ovo je pretvorba iz jednoga u drugi, i ne ovisi o satu.
    uSkala: { value: (PROZOR.do - PROZOR.od) / _RASPON_SIRINA },
    uBaza: { value: PROZOR.od / _RASPON_SIRINA },
    uPomakA: { value: pomakLjestvice("sumporovodik", 1) },
    uPomakB: { value: pomakLjestvice("merkaptani", 1) },
    uVidljivA: { value: 1 },
    uVidljivB: { value: 0 },
  };

  const perjanica = new THREE.Mesh(
    geometrijaPerjanice(osnove.granice),
    new THREE.ShaderMaterial({
      uniforms: uniforme,
      vertexShader: VRHOVI,
      fragmentShader: PIKSELI,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Vidi napomenu uz strelice: orijentacija ovdje nije pouzdana.
      side: THREE.DoubleSide,
    }),
  );
  perjanica.frustumCulled = false;
  scena.add(perjanica);

  // Strelice i čestice dijele polje vjetra; drži se ovdje da ga oboje čita.
  let polje: { vx: Float32Array; vy: Float32Array; gw: number; gh: number } | null = null;

  const strelice = new THREE.InstancedMesh(
    geometrijaStrelice(),
    new THREE.MeshBasicMaterial({
      color: 0x1c2733,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      depthWrite: false,
      // Obavezno obostrano. U Mercatorovim koordinatama karte y raste prema
      // jugu, pa matrica koju MapLibre zada preokreće orijentaciju: ploha
      // okrenuta „prema gledatelju” u Three.js ovdje ispadne okrenuta od
      // njega i odbaci se prije crtanja. Strelice su bile ondje, s ispravnim
      // položajem i kutom, i nijedna se nije vidjela.
      side: THREE.DoubleSide,
    }),
    STRELICA.po_osi * STRELICA.po_osi,
  );
  strelice.frustumCulled = false;
  strelice.visible = false;
  scena.add(strelice);

  const cesticeGeo = new THREE.BufferGeometry();
  const cesticePol = new Float32Array(CESTICA * 3);
  const cesticeDob = new Float32Array(CESTICA);
  cesticeGeo.setAttribute("position", new THREE.BufferAttribute(cesticePol, 3));
  const cestice = new THREE.Points(
    cesticeGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 3,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.75,
      depthTest: false,
      depthWrite: false,
    }),
  );
  cestice.frustumCulled = false;
  cestice.visible = false;
  scena.add(cestice);

  let mirovanje = false;
  let zadnjiTrenutak = 0;

  /** Očitava polje u točki zadanoj udjelom okvira. */
  function uzmiVjetar(u: number, v: number): [number, number] {
    if (!polje) return [0, 0];
    const i = Math.min(polje.gw - 1, Math.max(0, Math.round(u * (polje.gw - 1))));
    const j = Math.min(polje.gh - 1, Math.max(0, Math.round(v * (polje.gh - 1))));
    const k = j * polje.gw + i;
    return [polje.vx[k], polje.vy[k]];
  }

  /** Vraća čestici slučajno mjesto i dob, da se rođenja ne slože u takt. */
  function rodiCesticu(n: number, prvi: boolean): void {
    const u = Math.random();
    const v = Math.random();
    const m = MercatorCoordinate.fromLngLat(
      {
        lng: osnove.granice.zapad + u * (osnove.granice.istok - osnove.granice.zapad),
        lat: osnove.granice.sjever - v * (osnove.granice.sjever - osnove.granice.jug),
      },
      0,
    );
    cesticePol[n * 3] = m.x;
    cesticePol[n * 3 + 1] = m.y;
    cesticePol[n * 3 + 2] = 0;
    cesticeDob[n] = prvi ? Math.random() * VIJEK_CESTICE : 0;
  }

  for (let n = 0; n < CESTICA; n += 1) rodiCesticu(n, true);

  /** Koliko Mercatorovih jedinica ide na metar na ovoj širini. */
  const metarU = (() => {
    const sredina = (osnove.granice.jug + osnove.granice.sjever) / 2;
    const a = MercatorCoordinate.fromLngLat({ lng: osnove.granice.zapad, lat: sredina }, 0);
    const b = MercatorCoordinate.fromLngLat({ lng: osnove.granice.istok, lat: sredina }, 0);
    return (b.x - a.x) / osnove.sirinaM;
  })();

  function pomakniCestice(dt: number): void {
    if (!polje) return;
    const zapad = osnove.granice.zapad;
    const sirinaLon = osnove.granice.istok - zapad;
    const sjever = osnove.granice.sjever;
    const visinaLat = sjever - osnove.granice.jug;
    for (let n = 0; n < CESTICA; n += 1) {
      cesticeDob[n] += dt;
      if (cesticeDob[n] > VIJEK_CESTICE) {
        rodiCesticu(n, false);
        continue;
      }
      // Natrag u udjele okvira, da se polje očita na pravom mjestu.
      const x = cesticePol[n * 3];
      const y = cesticePol[n * 3 + 1];
      const lonLat = new MercatorCoordinate(x, y, 0).toLngLat();
      const u = (lonLat.lng - zapad) / sirinaLon;
      const v = (sjever - lonLat.lat) / visinaLat;
      if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) {
        rodiCesticu(n, false);
        continue;
      }
      const [vx, vy] = uzmiVjetar(u, v);
      cesticePol[n * 3] = x + vx * UBRZANJE_CESTICA * dt * metarU;
      cesticePol[n * 3 + 1] = y + vy * UBRZANJE_CESTICA * dt * metarU;
    }
    (cesticeGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  function osvjeziStrelice(): void {
    if (!polje) return;
    const privremena = new THREE.Object3D();
    const duljina = STRELICA.duljinaM * metarU;
    let n = 0;
    for (let j = 0; j < STRELICA.po_osi; j += 1) {
      for (let i = 0; i < STRELICA.po_osi; i += 1) {
        const u = (i + 0.5) / STRELICA.po_osi;
        const v = (j + 0.5) / STRELICA.po_osi;
        const m = MercatorCoordinate.fromLngLat(
          {
            lng: osnove.granice.zapad + u * (osnove.granice.istok - osnove.granice.zapad),
            lat: osnove.granice.sjever - v * (osnove.granice.sjever - osnove.granice.jug),
          },
          0,
        );
        const [vx, vy] = uzmiVjetar(u, v);
        const brzina = Math.hypot(vx, vy);
        privremena.position.set(m.x, m.y, 0);
        // U Mercatorovim koordinatama y raste prema jugu, kao i u polju, pa
        // kut ide izravno; bez okretanja bi strelice pokazivale zrcalno.
        privremena.rotation.set(0, 0, Math.atan2(vy, vx));
        // Kratka strelica pri slabom vjetru, ali nikad nevidljiva: i tišina
        // ima smjer, a upravo se pri njoj nad kvartom najviše nakupi.
        const mjera = duljina * (0.45 + 0.55 * Math.min(1, brzina / 6));
        privremena.scale.set(mjera, mjera, 1);
        privremena.updateMatrix();
        strelice.setMatrixAt(n, privremena.matrix);
        n += 1;
      }
    }
    strelice.instanceMatrix.needsUpdate = true;
  }

  const upravljac: Scena = {
    postaviGustocu(bajtovi, sirina, visina) {
      gustoca.dispose();
      const nova = new THREE.DataTexture(bajtovi, sirina, visina, THREE.RedFormat);
      nova.minFilter = THREE.LinearFilter;
      nova.magFilter = THREE.LinearFilter;
      nova.wrapS = THREE.ClampToEdgeWrapping;
      nova.wrapT = THREE.ClampToEdgeWrapping;
      nova.needsUpdate = true;
      uniforme.uGustoca.value = nova;
      karta?.triggerRepaint();
    },
    postaviVjetar(vx, vy, gw, gh) {
      polje = { vx, vy, gw, gh };
      osvjeziStrelice();
      karta?.triggerRepaint();
    },
    postaviPrikaz(postavke) {
      const par: [Tvar, "A" | "B"][] = [
        ["sumporovodik", "A"],
        ["merkaptani", "B"],
      ];
      for (const [tvar, kljuc] of par) {
        const t = postavke.tvari[tvar];
        const stara = lutovi[kljuc];
        lutovi[kljuc] = lutTekstura(t.boja, tvar);
        stara.dispose();
        if (kljuc === "A") {
          uniforme.uLutA.value = lutovi.A;
          uniforme.uVidljivA.value = t.vidljiv ? 1 : 0;
          uniforme.uPomakA.value = pomakLjestvice(tvar, t.jacina);
        } else {
          uniforme.uLutB.value = lutovi.B;
          uniforme.uVidljivB.value = t.vidljiv ? 1 : 0;
          uniforme.uPomakB.value = pomakLjestvice(tvar, t.jacina);
        }
      }
      strelice.visible = postavke.strelice;
      cestice.visible = postavke.cestice;
      mirovanje = postavke.mirovanje;
      karta?.triggerRepaint();
    },
    dispose() {
      perjanica.geometry.dispose();
      (perjanica.material as THREE.Material).dispose();
      strelice.geometry.dispose();
      (strelice.material as THREE.Material).dispose();
      strelice.dispose();
      cesticeGeo.dispose();
      (cestice.material as THREE.Material).dispose();
      lutovi.A.dispose();
      lutovi.B.dispose();
      (uniforme.uGustoca.value as THREE.DataTexture).dispose();
      renderer?.dispose();
      renderer = null;
      karta = null;
    },
  };

  return {
    id: "karepovac-perjanica",
    type: "custom",
    renderingMode: "2d",

    onAdd(mapa, gl) {
      karta = mapa;
      renderer = new THREE.WebGLRenderer({
        canvas: mapa.getCanvas(),
        context: gl,
        antialias: true,
      });
      // Karta sama briše i slaže sklop; da ovaj to ponovi, obrisao bi podlogu.
      renderer.autoClear = false;
      naSpremno(upravljac);
    },

    render(_gl, args) {
      if (!renderer) return;
      const sada = performance.now() / 1000;
      const dt = zadnjiTrenutak ? Math.min(0.1, sada - zadnjiTrenutak) : 0;
      zadnjiTrenutak = sada;

      if (cestice.visible && !mirovanje && dt > 0) {
        pomakniCestice(dt);
        karta?.triggerRepaint();
      }

      kamera.projectionMatrix = new THREE.Matrix4().fromArray(
        args.defaultProjectionData.mainMatrix,
      );
      renderer.resetState();
      renderer.render(scena, kamera);
    },

    onRemove() {
      upravljac.dispose();
    },
  };
}

/** Sidro ljestvice; ovdje samo da ga uvoznik ne mora tražiti na dva mjesta. */
export { SIDRO_SIMULATORA };

/**
 * Sloj koji na kartu crta perjanicu i tragove vjetra.
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
import type { Podloga } from "@/components/karepovac/sim/sim-karta";
import { stvoriTragove, type Tragovi } from "@/components/karepovac/sim/tragovi";

/** Koliko puta se pravokutnik perjanice dijeli po svakoj osi. */
const PODJELA = 24;

export type PrikazTvari = {
  readonly vidljiv: boolean;
  readonly boja: string;
  /** Jačina izvora u odnosu na bazdarenu. */
  readonly jacina: number;
};

export type PostavkePrikaza = {
  readonly tvari: Readonly<Record<Tvar, PrikazTvari>>;
  /** Tragovi vjetra — čestice koje za sobom vuku rep koji blijedi. */
  readonly vjetar: boolean;
  readonly mirovanje: boolean;
};

export type Scena = {
  /** Postavlja sliku gustoće za odabrani sat. */
  postaviGustocu(
    bajtovi: Uint8Array,
    bajtoviMerkaptana: Uint8Array,
    sirina: number,
    visina: number,
  ): void;
  /** Postavlja polje vjetra za odabrani sat, u m/s po ćeliji. */
  postaviVjetar(vx: Float32Array, vy: Float32Array, gw: number, gh: number): void;
  postaviPrikaz(postavke: PostavkePrikaza): void;
  /** Podloga ne mijenja ništa u računu, ali mijenja boju kojom se tragovi vide. */
  postaviPodlogu(podloga: Podloga): void;
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
  uniform sampler2D uGustocaB;
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
    // Tvari više ne dijele polje: merkaptanski izvor prati radne sate, pa
    // njegova gustoća stoji u vlastitoj teksturi.
    float u = texture2D(uGustoca, vUv).r;
    float uB = texture2D(uGustocaB, vUv).r;
    // Bajt nula znači „ispod prozora zapisa”, dakle nema ničega. Bez ove
    // provjere bi prazan zrak dobio dno ljestvice, a ono pri jakom izvoru
    // više nije prozirno — cijela bi karta poprimila boju.
    if (u <= 0.0 && uB <= 0.0) discard;

    // Rub okvira nije rub perjanice nego rub onoga što je izračunato. Oštar
    // rez ondje čita se kao „dalje je čisto”, što nije istina — zrak ide
    // dalje, samo ga polje više ne prati. Zato se pri rubu gasi postupno.
    vec2 doRuba = min(vUv, 1.0 - vUv);
    float rub = smoothstep(0.0, 0.045, min(doRuba.x, doRuba.y));

    float razina = u * uSkala + uBaza;
    float razinaB = uB * uSkala + uBaza;
    vec4 a = u <= 0.0 ? vec4(0.0) : uzmi(uLutA, razina + uPomakA, uVidljivA);
    vec4 b = uB <= 0.0 ? vec4(0.0) : uzmi(uLutB, razinaB + uPomakB, uVidljivB);

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
  const gustocaB = new THREE.DataTexture(new Uint8Array(1), 1, 1, THREE.RedFormat);
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
    uGustocaB: { value: gustocaB },
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
      // Karta zna okrenuti obilazak vrhova (zrcaljena projekcija, nagib), pa
      // se na jednu stranu ne računa.
      side: THREE.DoubleSide,
    }),
  );
  perjanica.frustumCulled = false;
  scena.add(perjanica);

  // Vjetar ide u svoj sloj: račun roja je u `@/lib/sim/tragovi-vjetra`, a
  // pretvorba u koordinate karte i crtanje u `tragovi.ts`.
  const tragovi: Tragovi = stvoriTragove(osnove);
  scena.add(tragovi.objekt);

  let mirovanje = false;
  let zadnjiTrenutak = 0;

  const upravljac: Scena = {
    postaviGustocu(bajtovi, bajtoviMerkaptana, sirina, visina) {
      const tekstura = (b: Uint8Array) => {
        const nova = new THREE.DataTexture(b, sirina, visina, THREE.RedFormat);
        nova.minFilter = THREE.LinearFilter;
        nova.magFilter = THREE.LinearFilter;
        nova.wrapS = THREE.ClampToEdgeWrapping;
        nova.wrapT = THREE.ClampToEdgeWrapping;
        nova.needsUpdate = true;
        return nova;
      };
      (uniforme.uGustoca.value as THREE.DataTexture).dispose();
      (uniforme.uGustocaB.value as THREE.DataTexture).dispose();
      uniforme.uGustoca.value = tekstura(bajtovi);
      uniforme.uGustocaB.value = tekstura(bajtoviMerkaptana);
      karta?.triggerRepaint();
    },
    postaviVjetar(vx, vy, gw, gh) {
      // Pri mirovanju se roj ne miče sam od sebe, pa mu se novi sat mora
      // uvesti sjetvom — inače bi tragovi ostali oni iz prošloga.
      tragovi.postaviPolje(vx, vy, gw, gh, mirovanje);
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
      tragovi.postaviVidljivost(postavke.vjetar);
      mirovanje = postavke.mirovanje;
      karta?.triggerRepaint();
    },
    postaviPodlogu(podloga) {
      tragovi.postaviPodlogu(podloga);
      karta?.triggerRepaint();
    },
    dispose() {
      perjanica.geometry.dispose();
      (perjanica.material as THREE.Material).dispose();
      tragovi.dispose();
      lutovi.A.dispose();
      lutovi.B.dispose();
      (uniforme.uGustoca.value as THREE.DataTexture).dispose();
      (uniforme.uGustocaB.value as THREE.DataTexture).dispose();
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

      if (tragovi.objekt.visible) {
        // Debljina poteza mora ostati ista u pikselima, pa sloj svaku sliku
        // dobiva veličinu platna; iz nje se izvodi i koliko se čestica nosi.
        const platno = renderer.getContext().canvas;
        // Broj čestica ide po tome koliko okvir polja zauzima zaslona, a ne
        // koliko ga zauzima prozor: pri zadanom pogledu okvir je manji od
        // trećine karte.
        const sz = karta?.project([osnove.granice.zapad, osnove.granice.sjever]);
        const ji = karta?.project([osnove.granice.istok, osnove.granice.jug]);
        tragovi.postaviPogled(
          platno.width,
          platno.height,
          typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
          sz && ji ? Math.abs(ji.x - sz.x) * Math.abs(ji.y - sz.y) : 0,
        );
        if (!mirovanje && dt > 0) {
          tragovi.korak(dt);
          karta?.triggerRepaint();
        }
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

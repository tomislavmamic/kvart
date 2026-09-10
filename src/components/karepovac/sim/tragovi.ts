/**
 * Crtanje tragova vjetra na karti.
 *
 * Račun roja je u `@/lib/sim/tragovi-vjetra` i ne zna ni za kartu ni za Three;
 * ovdje se njegove točke pretvaraju u koordinate karte i slažu u geometriju.
 *
 * ## Zašto svaki potez ide kao primjerak, a ne kao trokuti
 *
 * Rep se mora crtati stalnom debljinom u pikselima — potez koji se pri
 * uvećanju zadeblja pretvori se u mrlju, a pri smanjenju nestane. WebGL to ne
 * zna sam (`lineWidth` veći od 1 ne radi), pa se svaki potez širi u vršnom
 * sjenčaru, iz zaslonskih položaja svoja dva kraja. Time potez preživi i
 * nagib karte, koji je ovdje moguć rukom.
 *
 * Slaže se kao primjerci jednog pravokutnika (`InstancedBufferGeometry`): po
 * potezu se šalje šest brojeva umjesto šest vrhova po osam, pa se po slici
 * prepiše osmina onoga što bi inače išlo na grafičku.
 *
 * ## Što se ne preuzima od uzora
 *
 * Karte kojima je ovo uzor pri olujnom vjetru brzinu logaritamski stišću, da
 * repovi ne polete preko cijelog zaslona. Ovdje se to ne radi: cijela je
 * poanta ovog simulatora koliko brzo i kamo zrak s plohe stigne, pa se brzina
 * ne glumi. Nad okvirom od 6,4 km ionako je riječ o gradskom vjetru.
 */

import { MercatorCoordinate } from "maplibre-gl";
import * as THREE from "three";

import type { Osnove } from "@/lib/sim/polje";
import { alfaRuba } from "@/lib/sim/rub-prikaza";
import { brojTragova, NAJMANJE_TRAGOVA as NAJMANJE_CESTICA, NAJVISE_TRAGOVA as NAJVISE_CESTICA } from "@/lib/sim/gustoca-tragova";
import type { Granice } from "@/lib/sim/obuhvat";
import type { Podloga } from "@/components/karepovac/sim/sim-karta";
import {
  PODJELA_TRAGA,
  POTEZA_PO_TRAGU,
  TRAG_TOCAKA,
  stvoriRoj,
  type Roj,
} from "@/lib/sim/tragovi-vjetra";

/** Debljina poteza u CSS pikselima. */
const SIRINA_PX = 1.8;

/**
 * Boja tragova po podlozi.
 *
 * Tamna modra je ono što se na svijetloj karti čita kao vjetar i ne otima se
 * jantarnoj perjanici. Nad ortofotom bi nestala, pa ondje ide svijetla.
 */
const BOJA: Record<Podloga, number> = { karta: 0x0a4f75, ortofoto: 0xeaf4fb };

const VRHOVI = /* glsl */ `
  attribute vec2 pocetak;
  attribute vec2 kraj;
  attribute vec2 alfe;

  uniform vec2 uRazlucivost;
  uniform float uSirina;

  varying float vPoprijeko;
  varying float vAlfa;

  void main() {
    mat4 M = projectionMatrix * modelViewMatrix;
    vec4 a = M * vec4(pocetak, 0.0, 1.0);
    vec4 b = M * vec4(kraj, 0.0, 1.0);

    // U piksele, pa je debljina debljina bez obzira na uvećanje i nagib.
    vec2 pa = a.xy / a.w * uRazlucivost * 0.5;
    vec2 pb = b.xy / b.w * uRazlucivost * 0.5;
    vec2 d = pb - pa;
    float duljina = length(d);
    vec2 uzduz = duljina > 1e-4 ? d / duljina : vec2(1.0, 0.0);
    vec2 poprijeko = vec2(-uzduz.y, uzduz.x);

    // position.x je 0 ili 1 po potezu, position.y je −1 ili 1 poprijeko.
    vec4 p = mix(a, b, position.x);
    // Krajevi se produljuju za pola debljine da se susjedni potezi spoje bez
    // klina na vanjskoj strani zavoja.
    vec2 pomak = poprijeko * (uSirina * 0.5) * position.y
               + uzduz * (uSirina * 0.5) * (position.x * 2.0 - 1.0);
    p.xy += pomak / (uRazlucivost * 0.5) * p.w;

    gl_Position = p;
    vPoprijeko = position.y;
    vAlfa = mix(alfe.x, alfe.y, position.x);
  }
`;

const PIKSELI = /* glsl */ `
  precision mediump float;
  uniform vec3 uBoja;
  varying float vPoprijeko;
  varying float vAlfa;

  void main() {
    // Meki rub: puna boja u sredini poteza, gašenje prema rubovima. Bez toga
    // potez od dva piksela stepeničasto trepće dok putuje.
    float rub = 1.0 - smoothstep(0.5, 1.0, abs(vPoprijeko));
    float a = vAlfa * rub;
    gl_FragColor = vec4(uBoja * a, a);
  }
`;

export type Tragovi = {
  readonly objekt: THREE.Object3D;
  postaviPolje(
    vx: Float32Array,
    vy: Float32Array,
    gw: number,
    gh: number,
    preslozi: boolean,
    pozadina?: readonly [number, number],
  ): void;
  postaviObuhvat(obuhvat: Granice, pogled: Granice): void;
  postaviPodlogu(podloga: Podloga): void;
  postaviVidljivost(vidljiv: boolean): void;
  /**
   * Javlja veličinu platna u pikselima crtanja (za debljinu poteza) i površinu
   * koju okvir polja zauzima na zaslonu u CSS pikselima (za broj čestica).
   */
  postaviPogled(sirina: number, visina: number, omjer: number, okvirPx: number, zoom: number): void;
  /** Pomiče roj i osvježava geometriju. */
  korak(dt: number): void;
  dispose(): void;
};

/**
 * Stvara sloj tragova vjetra.
 *
 * Args:
 *   osnove: Osnove polja; iz njih dolaze granice okvira i njegova veličina.
 *
 * Returns:
 *   Upravljač slojem; `objekt` se dodaje u scenu.
 */
export function stvoriTragove(osnove: Osnove): Tragovi {
  let granice = osnove.granice;
  let domena = granice;
  let zadnjePolje: { vx: Float32Array; vy: Float32Array; gw: number; gh: number; pozadina?: readonly [number, number] } | null = null;
  let roj: Roj = stvoriRoj(
    osnove.sirinaM,
    osnove.visinaM,
    NAJVISE_CESTICA,
  );

  function tocka(udioX: number, udioY: number, pomak: number): void {
    const lon = granice.zapad + udioX * (granice.istok - granice.zapad);
    const lat = granice.sjever - udioY * (granice.sjever - granice.jug);
    const mercator = MercatorCoordinate.fromLngLat({ lng: lon, lat: Math.max(-85, Math.min(85, lat)) });
    podatci[pomak] = mercator.x;
    podatci[pomak + 1] = mercator.y;
  }

  function rub(udioX: number, udioY: number): number {
    const lon = granice.zapad + udioX * (granice.istok - granice.zapad);
    const lat = granice.sjever - udioY * (granice.sjever - granice.jug);
    return alfaRuba((lon - domena.zapad) / (domena.istok - domena.zapad), (domena.sjever - lat) / (domena.sjever - domena.jug));
  }

  // Šest brojeva po potezu: dva kraja i prozirnost na svakom od njih.
  const podatci = new Float32Array(NAJVISE_CESTICA * POTEZA_PO_TRAGU * 6);
  const medju = new THREE.InstancedInterleavedBuffer(podatci, 6, 1);
  medju.setUsage(THREE.DynamicDrawUsage);

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(
      // Dva trokuta jednog pravokutnika: uzduž 0→1, poprijeko −1→1.
      new Float32Array([
        0, -1, 0, 0, 1, 0, 1, -1, 0,
        1, -1, 0, 0, 1, 0, 1, 1, 0,
      ]),
      3,
    ),
  );
  geo.setAttribute("pocetak", new THREE.InterleavedBufferAttribute(medju, 2, 0));
  geo.setAttribute("kraj", new THREE.InterleavedBufferAttribute(medju, 2, 2));
  geo.setAttribute("alfe", new THREE.InterleavedBufferAttribute(medju, 2, 4));
  geo.instanceCount = 0;
  // Okvir se ne računa: čestice se svaku sliku pomiču, a sloj se ionako ne
  // odsijeca.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

  const uniforme = {
    uRazlucivost: { value: new THREE.Vector2(1, 1) },
    uSirina: { value: SIRINA_PX },
    uBoja: { value: new THREE.Color(BOJA.karta) },
  };

  const materijal = new THREE.ShaderMaterial({
    uniforms: uniforme,
    vertexShader: VRHOVI,
    fragmentShader: PIKSELI,
    transparent: true,
    // Sjenčar već vraća boju pomnoženu prozirnošću; bez ovoga bi je Three
    // pomnožio drugi put i tragovi bi ispali bljeđi nego što piše.
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    // Potez se u sjenčaru širi na obje strane, pa mu obilazak vrhova ovisi o
    // tome kamo vjetar puše; s jednom stranom pola bi repova otpalo.
    side: THREE.DoubleSide,
  });

  const mreza = new THREE.Mesh(geo, materijal);
  mreza.frustumCulled = false;
  mreza.visible = false;
  // Iznad perjanice: obje su prozirne i na istoj visini, pa bi ih inače
  // razvrstavanje slagalo kako mu dođe.
  mreza.renderOrder = 1;

  let zadnjiBroj = 0;

  /**
   * Prepisuje repove roja u geometriju.
   *
   * Točke idu od najstarije prema najnovijoj; prozirnost raste s njima, pa je
   * glava poteza puna a rep se gubi. To je jedino što tragu daje smjer — bez
   * toga se ne zna putuje li lijevo ili desno.
   */
  function osvjezi(): void {
    let i = 0;
    for (let n = 0; n < roj.broj; n += 1) {
      const zivot = roj.zivot(n);
      if (zivot <= 0) continue;
      const baza = n * TRAG_TOCAKA * 2;
      const g = roj.glava[n];
      // Svakoj se čestici crta njezin udio repa, a prozirnost se razapinje po
      // tome što se crta — inače bi kraći repovi počinjali na pola svjetline.
      const prva = TRAG_TOCAKA - 1 - Math.round((TRAG_TOCAKA - 1) * roj.udioRepa(n));
      const raspon = TRAG_TOCAKA - 1 - prva;
      for (let k = TRAG_TOCAKA - 1; k - PODJELA_TRAGA >= prva; k -= PODJELA_TRAGA) {
        const stariji = k - PODJELA_TRAGA;
        const a = ((g + 1 + stariji) % TRAG_TOCAKA) * 2 + baza;
        const b = ((g + 1 + k) % TRAG_TOCAKA) * 2 + baza;
        const o = i * 6;
        tocka(roj.trag[a], roj.trag[a + 1], o);
        tocka(roj.trag[b], roj.trag[b + 1], o + 2);
        podatci[o + 4] = ((stariji - prva) / raspon) * zivot * rub(roj.trag[a], roj.trag[a + 1]);
        podatci[o + 5] = ((k - prva) / raspon) * zivot * rub(roj.trag[b], roj.trag[b + 1]);
        i += 1;
      }
    }
    geo.instanceCount = i;
    if (i > 0) {
      medju.clearUpdateRanges();
      medju.addUpdateRange(0, i * 6);
      medju.needsUpdate = true;
    }
  }

  return {
    objekt: mreza,

    postaviPolje(vx, vy, gw, gh, preslozi, pozadina) {
      zadnjePolje = { vx, vy, gw, gh, pozadina };
      roj.postaviPolje(vx, vy, gw, gh, preslozi, pozadina);
      osvjezi();
    },

    postaviObuhvat(obuhvat, pogled) {
      const promjenaDomene = domena.zapad !== obuhvat.zapad || domena.istok !== obuhvat.istok || domena.jug !== obuhvat.jug || domena.sjever !== obuhvat.sjever;
      domena = obuhvat;
      const sirina = pogled.istok - pogled.zapad;
      const visina = pogled.sjever - pogled.jug;
      if (!(sirina > 0 && visina > 0)) return;
      if (pogled.zapad >= granice.zapad && pogled.istok <= granice.istok &&
          pogled.jug >= granice.jug && pogled.sjever <= granice.sjever &&
          granice.istok - granice.zapad < sirina * 1.8) {
        if (promjenaDomene) osvjezi();
        return;
      }
      granice = {
        zapad: pogled.zapad - sirina * 0.2, istok: pogled.istok + sirina * 0.2,
        jug: pogled.jug - visina * 0.2, sjever: pogled.sjever + visina * 0.2,
      };
      const sirinaLon = granice.istok - granice.zapad;
      const visinaLat = granice.sjever - granice.jug;
      roj = stvoriRoj(
        osnove.sirinaM * sirinaLon / (osnove.granice.istok - osnove.granice.zapad),
        osnove.visinaM * visinaLat / (osnove.granice.sjever - osnove.granice.jug),
        NAJVISE_CESTICA,
        {
          od: [(osnove.granice.zapad - granice.zapad) / sirinaLon, (granice.sjever - osnove.granice.sjever) / visinaLat],
          do: [(osnove.granice.istok - granice.zapad) / sirinaLon, (granice.sjever - osnove.granice.jug) / visinaLat],
        },
      );
      roj.postaviBroj(Math.max(NAJMANJE_CESTICA, zadnjiBroj));
      if (zadnjePolje) {
        const { vx, vy, gw, gh, pozadina } = zadnjePolje;
        roj.postaviPolje(vx, vy, gw, gh, true, pozadina);
      }
      osvjezi();
    },

    postaviPodlogu(podloga) {
      (uniforme.uBoja.value as THREE.Color).setHex(BOJA[podloga]);
    },

    postaviVidljivost(vidljiv) {
      mreza.visible = vidljiv;
    },

    postaviPogled(sirina, visina, omjer, okvirPx, zoom) {
      (uniforme.uRazlucivost.value as THREE.Vector2).set(sirina, visina);
      uniforme.uSirina.value = SIRINA_PX * omjer;
      // Broj se ne prepravlja na svaki piksel uvećanja: inače bi se pri svakom
      // pomaku karte sijale nove čestice i roj bi treperio.
      const broj = brojTragova(okvirPx, zoom);
      if (broj === zadnjiBroj) return;
      zadnjiBroj = broj;
      const prije = roj.broj;
      roj.postaviBroj(broj);
      if (roj.broj !== prije) osvjezi();
    },

    korak(dt) {
      roj.korak(dt);
      osvjezi();
    },

    dispose() {
      geo.dispose();
      materijal.dispose();
    },
  };
}

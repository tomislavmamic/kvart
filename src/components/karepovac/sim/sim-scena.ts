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
 *
 * ## Prijelaz među satima i nesigurnost prognoze
 *
 * Sat se ne zamjenjuje odsjekom nego se dvije slike **pretapaju** (~400 ms):
 * sjenčar drži prošlu i novu teksturu i miješa gotove boje. Ništa se ne
 * pomiče ni ne okreće — prošla perjanica samo blijedi dok nova izranja. Bilo
 * bi lako „animirati” zrak razvlačenjem prošle slike prema novoj, ali to bi
 * bila slika koju model nikad nije izračunao; kadrovi su istina modela i
 * između njih se ne izmišlja.
 *
 * Prognozirani sat crta se **kao prognoza**: bljeđe, sivlje i s prošaranim
 * rubom ispod praga mirisa, i to jače što je sat dalje (+1 h jedva, +3 h
 * jasno). Nema vjerojatnosnih izolinija — model daje jedno polje, ne
 * ansambl — ali sat koji je nagađanje ne smije izgledati kao sat koji se
 * dogodio.
 */

import type { Map as MapaLibre, CustomLayerInterface } from "maplibre-gl";
import { MercatorCoordinate } from "maplibre-gl";
import * as THREE from "three";

import { MIRISNI_RASPON, PRAG_NA_LJESTVICI, TVARI, type Tvar, ljestvicaBoja } from "@/lib/dim";
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
  /**
   * Postavlja sliku gustoće za odabrani sat.
   *
   * `prijelazMs` veći od nule pretapa prošlu sliku u novu; nula je oštar
   * rez (mirovanje, snimka zaslona). Prazni bajtovi (duljina 0) brišu
   * perjanicu — sat koji još nije izračunat ne smije nositi tuđu sliku.
   */
  postaviGustocu(
    bajtovi: Uint8Array,
    bajtoviMerkaptana: Uint8Array,
    sirina: number,
    visina: number,
    prijelazMs?: number,
  ): void;
  /**
   * Koliko je sat nagađanje: 0 za izmjeren ili sadašnji, do 1 za najdalju
   * prognozu. Mijenja samo prikaz — bljeđe, sivlje, prošaran rub.
   */
  postaviNesigurnost(nesigurnost: number): void;
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
  uniform sampler2D uPrije;
  uniform sampler2D uPrijeB;
  uniform sampler2D uLutA;
  uniform sampler2D uLutB;
  uniform float uSkala;
  uniform float uBaza;
  uniform float uPomakA;
  uniform float uPomakB;
  uniform float uVidljivA;
  uniform float uVidljivB;
  /** 0 = prošla slika, 1 = nova; između se pretapa. */
  uniform float uMjesavina;
  /** 0 = izmjereno, 1 = najdalja prognoza. */
  uniform float uNesigurnost;
  /** Gdje na ljestvici stoji prag mirisa; ispod njega je rub „moguće”. */
  uniform float uPrag;

  vec4 uzmi(sampler2D lut, float razina, float vidljiv) {
    if (vidljiv < 0.5) return vec4(0.0);
    return texture2D(lut, vec2(clamp(razina, 0.0, 1.0), 0.5));
  }

  // Boja jedne slike (obje tvari), već pomnožena neprozirnošću; uz nju i
  // najviši položaj na ljestvici, da se rub ispod praga dade prepoznati.
  vec4 slozi(sampler2D gA, sampler2D gB, out float polozaj) {
    float u = texture2D(gA, vUv).r;
    float uB = texture2D(gB, vUv).r;
    polozaj = 0.0;
    // Bajt nula znači „ispod prozora zapisa”, dakle nema ničega. Bez ove
    // provjere bi prazan zrak dobio dno ljestvice, a ono pri jakom izvoru
    // više nije prozirno — cijela bi karta poprimila boju.
    if (u <= 0.0 && uB <= 0.0) return vec4(0.0);
    float razinaA = u * uSkala + uBaza + uPomakA;
    float razinaB = uB * uSkala + uBaza + uPomakB;
    vec4 a = u <= 0.0 ? vec4(0.0) : uzmi(uLutA, razinaA, uVidljivA);
    vec4 b = uB <= 0.0 ? vec4(0.0) : uzmi(uLutB, razinaB, uVidljivB);
    polozaj = max(u <= 0.0 || uVidljivA < 0.5 ? 0.0 : razinaA,
                  uB <= 0.0 || uVidljivB < 0.5 ? 0.0 : razinaB);
    // Druga tvar ide preko prve; obje su prozirne, pa se preklop vidi kao
    // miješana boja, a ne kao da je jedna pojela drugu.
    vec3 boja = a.rgb * a.a;
    float alfa = a.a;
    boja = b.rgb * b.a + boja * (1.0 - b.a);
    alfa = b.a + alfa * (1.0 - b.a);
    return vec4(boja, alfa);
  }

  void main() {
    float polozajSada;
    float polozajPrije;
    vec4 sada = slozi(uGustoca, uGustocaB, polozajSada);
    vec4 prije = uMjesavina >= 1.0 ? vec4(0.0) : slozi(uPrije, uPrijeB, polozajPrije);
    vec4 c = uMjesavina >= 1.0 ? sada : mix(prije, sada, uMjesavina);
    float polozaj = uMjesavina >= 1.0 ? polozajSada : mix(polozajPrije, polozajSada, uMjesavina);
    if (c.a <= 0.0) discard;

    // Rub okvira nije rub perjanice nego rub onoga što je izračunato. Oštar
    // rez ondje čita se kao „dalje je čisto”, što nije istina — zrak ide
    // dalje, samo ga polje više ne prati. Zato se pri rubu gasi postupno.
    vec2 doRuba = min(vUv, 1.0 - vUv);
    float rub = smoothstep(0.0, 0.045, min(doRuba.x, doRuba.y));

    if (uNesigurnost > 0.0) {
      // Prognoza: sivlja i bljeđa, a pojas ispod praga prošaran kosim
      // crtama u pikselima zaslona — čita se kao „možda”, ne kao ploha.
      float siva = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb, vec3(siva), 0.4 * uNesigurnost);
      float ispodPraga = 1.0 - smoothstep(uPrag - 0.04, uPrag + 0.04, polozaj);
      float srafura = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 12.0));
      float prosarano = mix(1.0, mix(0.35, 1.0, srafura), ispodPraga * uNesigurnost);
      c *= prosarano * mix(1.0, 0.7, uNesigurnost);
    }

    c *= rub;
    if (c.a <= 0.002) discard;

    // MapLibre očekuje boju već pomnoženu neprozirnošću.
    gl_FragColor = c;
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

  /** Tekstura gustoće; prazna je 1 × 1 nula, što sjenčar čita kao „ništa”. */
  const tekstura = (b: Uint8Array, sirina: number, visina: number) => {
    const prazna = b.length === 0;
    const t = new THREE.DataTexture(
      prazna ? new Uint8Array(1) : b,
      prazna ? 1 : sirina,
      prazna ? 1 : visina,
      THREE.RedFormat,
    );
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  };
  const prazno = new Uint8Array(0);

  const lutovi: Record<"A" | "B", THREE.DataTexture> = {
    A: lutTekstura("jantar", "sumporovodik"),
    B: lutTekstura("modra", "merkaptani"),
  };

  const uniforme = {
    uGustoca: { value: tekstura(prazno, 1, 1) },
    uGustocaB: { value: tekstura(prazno, 1, 1) },
    uPrije: { value: tekstura(prazno, 1, 1) },
    uPrijeB: { value: tekstura(prazno, 1, 1) },
    uMjesavina: { value: 1 },
    uNesigurnost: { value: 0 },
    uPrag: { value: PRAG_NA_LJESTVICI },
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
  /** Prijelaz u tijeku: kad je počeo i koliko traje; `null` kad ga nema. */
  let prijelaz: { pocetak: number; trajanje: number; odNesigurnosti: number } | null = null;
  let nesigurnost = 0;
  /** Je li ikad postavljena prava slika; prvi sat nema iz čega pretapati. */
  let imaSliku = false;

  const upravljac: Scena = {
    postaviGustocu(bajtovi, bajtoviMerkaptana, sirina, visina, prijelazMs = 0) {
      const staraA = uniforme.uGustoca.value as THREE.DataTexture;
      const staraB = uniforme.uGustocaB.value as THREE.DataTexture;
      (uniforme.uPrije.value as THREE.DataTexture).dispose();
      (uniforme.uPrijeB.value as THREE.DataTexture).dispose();
      if (prijelazMs > 0 && imaSliku) {
        // Prošla slika ostaje u sjenčaru dok nova izranja preko nje.
        uniforme.uPrije.value = staraA;
        uniforme.uPrijeB.value = staraB;
        uniforme.uMjesavina.value = 0;
        prijelaz = {
          pocetak: performance.now(),
          trajanje: prijelazMs,
          odNesigurnosti: uniforme.uNesigurnost.value,
        };
      } else {
        staraA.dispose();
        staraB.dispose();
        uniforme.uPrije.value = tekstura(prazno, 1, 1);
        uniforme.uPrijeB.value = tekstura(prazno, 1, 1);
        uniforme.uMjesavina.value = 1;
        uniforme.uNesigurnost.value = nesigurnost;
        prijelaz = null;
      }
      uniforme.uGustoca.value = tekstura(bajtovi, sirina, visina);
      uniforme.uGustocaB.value = tekstura(bajtoviMerkaptana, sirina, visina);
      imaSliku = true;
      karta?.triggerRepaint();
    },
    postaviNesigurnost(n) {
      nesigurnost = Math.max(0, Math.min(1, n));
      // Bez prijelaza u tijeku vrijedi odmah; s prijelazom se pretapa s njim.
      if (!prijelaz) uniforme.uNesigurnost.value = nesigurnost;
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
      (uniforme.uPrije.value as THREE.DataTexture).dispose();
      (uniforme.uPrijeB.value as THREE.DataTexture).dispose();
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

      if (prijelaz) {
        const t = Math.min(1, (performance.now() - prijelaz.pocetak) / prijelaz.trajanje);
        // Glatko na oba kraja, da pretapanje ne „sjekne” ni na početku ni na kraju.
        const glatko = t * t * (3 - 2 * t);
        uniforme.uMjesavina.value = glatko;
        uniforme.uNesigurnost.value =
          prijelaz.odNesigurnosti + (nesigurnost - prijelaz.odNesigurnosti) * glatko;
        if (t >= 1) {
          prijelaz = null;
          (uniforme.uPrije.value as THREE.DataTexture).dispose();
          (uniforme.uPrijeB.value as THREE.DataTexture).dispose();
          uniforme.uPrije.value = tekstura(prazno, 1, 1);
          uniforme.uPrijeB.value = tekstura(prazno, 1, 1);
        } else {
          karta?.triggerRepaint();
        }
      }

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

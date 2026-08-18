/**
 * Širenje mirisa s plohe, računato u pregledniku.
 *
 * Prije je ovo bila statična toplinska karta i zato je izgledalo kao mrlja.
 * Tri stvari daju izgled dima:
 *
 * 1. Izvor nije jednolik. Plin izlazi na pukotinama pokrova i oko zdenaca, pa
 *    model bira žarišta. Kad ploha emitira jednoliko, perjanica izlazi kao
 *    mrlja široka koliko i odlagalište — jer to onda i jest.
 * 2. Vrtložni šum nema divergencije (uzima se okomiti gradijent potencijala),
 *    pa se čestice ne skupljaju u grudu nego razvlače u niti.
 * 3. Izvor pulsira, pa naleti izlaze sami umjesto da su nacrtani.
 *
 * Modul ne dira DOM, da se može provjeriti i izvan preglednika.
 */

/** Polje vjetra iz `npm run izvedi-polje-dima`. */
export type PoljeDima = {
  readonly gw: number;
  readonly gh: number;
  readonly skala: number;
  readonly vx: string;
  readonly vy: string;
  readonly maska: string;
};

export type Postavke = {
  /** Širina rešetke gustoće u ćelijama. */
  sirina?: number;
  cestica?: number;
  /** Sekundi između dva naleta. */
  ritam?: number;
  /** Koliko puls jača emisiju; 1 znači da između naleta izvor stane. */
  zamah?: number;
  /** Koliko je nalet uzak — veće znači oštriji nalet i veći razmak. */
  ostrina?: number;
  /** Jačina vrtložnog šuma. */
  vrtlog?: number;
  /** Koliko vrtlog nadjača nošenje vjetrom. */
  snaga?: number;
  /** Krupnoća vitica; veće znači sitnije. */
  mjerilo?: number;
  /** Rast vrtloga sa starošću čestice. */
  sirenje?: number;
  /** Sekundi života čestice. */
  vijek?: number;
  /** Koliko brzo polje nosi česticu, u dijelovima okvira po sekundi. */
  brzina?: number;
  /** Broj prolaza zamućenja; bez toga se vide zrnca, a ne dim. */
  zamucenje?: number;
  /** Broj žarišta na plohi. */
  zarista?: number;
};

export type Simulacija = {
  readonly sirina: number;
  readonly visina: number;
  readonly cestica: number;
  korak(dt: number): void;
  crtaj(): Float32Array;
  zivih(): number;
  postavi(ime: keyof Postavke, vrijednost: number): void;
};

const ZADANO = {
  sirina: 200,
  cestica: 90_000,
  ritam: 5,
  zamah: 1,
  ostrina: 4,
  vrtlog: 1.9,
  snaga: 0.12,
  mjerilo: 3.2,
  sirenje: 0.55,
  vijek: 14,
  brzina: 0.085,
  zamucenje: 2,
  zarista: 12,
} as const;

type Parametri = { -readonly [K in keyof typeof ZADANO]: number };

function raspakiraj(s: string): Uint8Array {
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) a[i] = bin.charCodeAt(i);
  return a;
}

/** Determinističan niz, da se provjera ponovi jednako. */
function generator(sjeme: number): () => number {
  let s = sjeme;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Bira žarišta na plohi i ponavlja ćelije razmjerno njihovoj jakosti. */
function zarista(
  celije: readonly number[],
  koliko: number,
  gw: number,
  gh: number,
  slucaj: () => number,
): Float64Array {
  const n = celije.length / 2;
  const tocke: { i: number; j: number; r: number; w: number }[] = [];
  for (let k = 0; k < koliko; k += 1) {
    const s = Math.floor(slucaj() * n) * 2;
    tocke.push({
      i: celije[s],
      j: celije[s + 1],
      r: 2 + slucaj() * 4,
      w: 0.35 + slucaj() * 0.65,
    });
  }

  const izvor: number[] = [];
  for (let k = 0; k < n; k += 1) {
    const ci = celije[k * 2];
    const cj = celije[k * 2 + 1];
    let jakost = 0;
    for (const t of tocke) {
      const dd = (ci - t.i) ** 2 + (cj - t.j) ** 2;
      jakost += t.w * Math.exp(-dd / (2 * t.r * t.r));
    }
    const puta = Math.min(6, Math.round(jakost * 5));
    for (let m = 0; m < puta; m += 1) izvor.push(ci / gw, cj / gh);
  }
  if (izvor.length === 0) {
    for (let k = 0; k < n; k += 1) {
      izvor.push(celije[k * 2] / gw, celije[k * 2 + 1] / gh);
    }
  }
  return Float64Array.from(izvor);
}

/** Mekan otisak čestice; uska jezgra izgleda kao pijesak, ne kao dim. */
function jezgra(): Float32Array {
  const j = new Float32Array(25);
  let zbroj = 0;
  for (let a = -2; a <= 2; a += 1) {
    for (let b = -2; b <= 2; b += 1) {
      const w = Math.exp(-(a * a + b * b) / 2.6);
      j[(a + 2) * 5 + (b + 2)] = w;
      zbroj += w;
    }
  }
  for (let k = 0; k < 25; k += 1) j[k] /= zbroj;
  return j;
}

export function stvoriDim(polje: PoljeDima, postavke: Postavke = {}): Simulacija {
  const par: Parametri = { ...ZADANO, ...postavke };
  const { gw, gh, skala } = polje;
  const VX = raspakiraj(polje.vx);
  const VY = raspakiraj(polje.vy);
  const MK = raspakiraj(polje.maska);

  const W = par.sirina;
  const H = Math.max(2, Math.round((W * gh) / gw));
  const N = par.cestica;

  const slucaj = generator(1);
  const celije: number[] = [];
  for (let j = 0; j < gh; j += 1) {
    for (let i = 0; i < gw; i += 1) {
      if (MK[j * gw + i] > 128) celije.push(i, j);
    }
  }
  const izvor = zarista(celije, par.zarista, gw, gh, slucaj);
  const nIzvor = izvor.length / 2;

  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const dob = new Float32Array(N);
  const pomak = new Float32Array(N);
  const ziv = new Uint8Array(N);
  const gust = new Float32Array(W * H);
  const pomocno = new Float32Array(W * H);
  const JEZ = jezgra();

  const slobodne = new Int32Array(N);
  let nSlobodnih = N;
  for (let i = 0; i < N; i += 1) slobodne[i] = i;

  let t = 0;
  let ostatak = 0;

  function uzmi(A: Uint8Array, fx: number, fy: number): number {
    const x = fx * (gw - 1);
    const y = fy * (gh - 1);
    const i0 = x | 0;
    const j0 = y | 0;
    const i1 = i0 + 1 < gw ? i0 + 1 : i0;
    const j1 = j0 + 1 < gh ? j0 + 1 : j0;
    const tx = x - i0;
    const ty = y - j0;
    const a = A[j0 * gw + i0];
    const b = A[j0 * gw + i1];
    const c = A[j1 * gw + i0];
    const d = A[j1 * gw + i1];
    const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    return (v / 255) * 2 * skala - skala;
  }

  /** Potencijal vrtložnog šuma; brzina mu je okomiti gradijent. */
  function psi(x: number, y: number, vrijeme: number): number {
    const m = par.mjerilo;
    return (
      Math.sin(x * m + vrijeme * 0.55) * Math.cos(y * m * 1.31 - vrijeme * 0.42) +
      0.52 *
        Math.sin(x * m * 2.17 - vrijeme * 0.91) *
        Math.cos(y * m * 1.87 + vrijeme * 0.73) +
      0.27 *
        Math.sin(x * m * 4.1 + vrijeme * 1.4) *
        Math.cos(y * m * 3.7 - vrijeme * 1.1)
    );
  }

  function puls(vrijeme: number): number {
    const f = (vrijeme % par.ritam) / par.ritam;
    return Math.max(0, Math.sin(Math.PI * f)) ** par.ostrina;
  }

  function rodi(n: number): void {
    const s = Math.floor(slucaj() * nIzvor) * 2;
    px[n] = izvor[s] + (slucaj() - 0.5) * 0.006;
    py[n] = izvor[s + 1] + (slucaj() - 0.5) * 0.006;
    dob[n] = 0;
    pomak[n] = slucaj();
    ziv[n] = 1;
  }

  function ugasi(n: number): void {
    ziv[n] = 0;
    slobodne[nSlobodnih] = n;
    nSlobodnih += 1;
  }

  function korak(dt: number): void {
    t += dt;
    ostatak += (N / par.vijek) * dt * (1 - par.zamah + par.zamah * puls(t) * 1.9);
    while (ostatak >= 1 && nSlobodnih > 0) {
      ostatak -= 1;
      nSlobodnih -= 1;
      rodi(slobodne[nSlobodnih]);
    }

    const e = 0.004;
    for (let n = 0; n < N; n += 1) {
      if (!ziv[n]) continue;
      dob[n] += dt;
      if (dob[n] > par.vijek) {
        ugasi(n);
        continue;
      }
      const x = px[n];
      const y = py[n];
      let vx = uzmi(VX, x, y);
      let vy = uzmi(VY, x, y);

      // Blizu plohe je mlaz, dalje se raspliće.
      const a =
        par.vrtlog * (0.22 + par.sirenje * Math.min(1, (dob[n] / par.vijek) * 2.2));
      const tt = t * 0.6 + pomak[n] * 2;
      const dx = (psi(x, y + e, tt) - psi(x, y - e, tt)) / (2 * e);
      const dy = (psi(x + e, y, tt) - psi(x - e, y, tt)) / (2 * e);
      vx += dy * a * par.snaga;
      vy += -dx * a * par.snaga;

      px[n] = x + vx * par.brzina * dt;
      py[n] = y + vy * par.brzina * dt;
      if (px[n] < -0.02 || px[n] > 1.02 || py[n] < -0.02 || py[n] > 1.02) {
        ugasi(n);
      }
    }
  }

  function zamuti(prolaza: number): void {
    for (let p = 0; p < prolaza; p += 1) {
      for (let j = 0; j < H; j += 1) {
        for (let i = 0; i < W; i += 1) {
          const k = j * W + i;
          const l = i > 0 ? gust[k - 1] : gust[k];
          const d = i < W - 1 ? gust[k + 1] : gust[k];
          pomocno[k] = (l + gust[k] * 2 + d) * 0.25;
        }
      }
      for (let j = 0; j < H; j += 1) {
        for (let i = 0; i < W; i += 1) {
          const k = j * W + i;
          const g = j > 0 ? pomocno[k - W] : pomocno[k];
          const d = j < H - 1 ? pomocno[k + W] : pomocno[k];
          gust[k] = (g + pomocno[k] * 2 + d) * 0.25;
        }
      }
    }
  }

  function crtaj(): Float32Array {
    gust.fill(0);
    for (let n = 0; n < N; n += 1) {
      if (!ziv[n]) continue;
      const f = dob[n] / par.vijek;
      // Pojavi se brzo, blijedi dugo — inače je rub naleta tvrd.
      const w = Math.min(1, f * 9) * (1 - f) * (1 - f);
      if (w <= 0.002) continue;
      const i0 = (px[n] * W) | 0;
      const j0 = (py[n] * H) | 0;
      for (let dj = -2; dj <= 2; dj += 1) {
        const jj = j0 + dj;
        if (jj < 0 || jj >= H) continue;
        for (let di = -2; di <= 2; di += 1) {
          const ii = i0 + di;
          if (ii < 0 || ii >= W) continue;
          gust[jj * W + ii] += w * JEZ[(dj + 2) * 5 + (di + 2)];
        }
      }
    }
    zamuti(par.zamucenje);
    return gust;
  }

  return {
    sirina: W,
    visina: H,
    cestica: N,
    korak,
    crtaj,
    zivih: () => ziv.reduce((a: number, b) => a + b, 0),
    postavi: (ime, vrijednost) => {
      par[ime as keyof Parametri] = vrijednost;
    },
  };
}

/** Ljestvica perjanice: pijesak, jantar, žeravica, rđa. Ista kao na karticama. */
export const LJESTVICA: readonly (readonly [number, readonly [number, number, number, number]])[] = [
  [0, [255, 247, 214, 0]],
  [0.12, [250, 224, 140, 110]],
  [0.32, [245, 176, 66, 170]],
  [0.58, [232, 116, 40, 210]],
  [0.8, [198, 58, 42, 232]],
  [1, [124, 24, 44, 248]],
];

/** Gradi tablicu boja za 256 razina, da se ne računa po pikselu. */
export function ljestvicaBoja(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const v = i / 255;
    for (let k = 0; k < LJESTVICA.length - 1; k += 1) {
      const [a, ca] = LJESTVICA[k];
      const [b, cb] = LJESTVICA[k + 1];
      if (v < b || k === LJESTVICA.length - 2) {
        const f = Math.max(0, Math.min(1, (v - a) / (b - a)));
        for (let c = 0; c < 4; c += 1) lut[i * 4 + c] = ca[c] * (1 - f) + cb[c] * f;
        break;
      }
    }
  }
  return lut;
}

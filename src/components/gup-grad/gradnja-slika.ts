"use client";

/**
 * Slika trenutnog pogleda karte /gup/gradnja za dijeljenje: naslov, karta
 * (podloga, obojene pločice, obrisi, odabrana čestica), tumač samo onoga što
 * je na karti i izvori. Sve se crta iz slojeva karte u jedan <canvas>, bez
 * tražilice i kartice preko nje.
 *
 *  - Podloga: pločice su <img> s našeg posrednika (/api/podloga, isto
 *    podrijetlo) ili s Esrija, koje se za crtanje učitaju ponovno uz
 *    crossOrigin; koja se ne učita, ostane siva.
 *  - Siva podloga (globals.css, .podloga-siva) ponovi se u platnu: ctx.filter
 *    gdje ga preglednik ima (Safari ga nema), inače piksel po piksel.
 *  - Obojene pločice i vektori (granica, obrisi, čestica, točka) već su
 *    <canvas> (gradnja-karta.tsx, preferCanvas), pa se samo precrtaju.
 */
import type * as LeafletNS from "leaflet";

export interface StavkaLegende {
  naziv: string;
  ha?: number;
  ploha?: { boja: string; alfa: number; pruge?: string; mreza?: boolean };
  crta?: { boja: string; crtice?: number[]; debljina?: number };
}

export interface OpisSlike {
  naslov: string;
  podnaslov?: string;
  legenda: StavkaLegende[];
  podnozje: string[];
}

/** Dio karte koji se vidi, u pikselima spremnika karte. */
export interface Podrucje {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SIRINA = 1080;
const RUB = 48;
const SIVA_SNIMKE = "#a6a6a6";

function podrzavaFilter(): boolean {
  const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!c || !("filter" in c)) return false;
  c.filter = "grayscale(1)";
  c.fillStyle = "#ff0000";
  c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data;
  return d[0] === d[1] && d[1] === d[2];
}

/** isto što `grayscale(1) contrast(0.6) brightness(1.3)` u globals.css */
function posivi(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const slika = ctx.getImageData(0, 0, w, h);
  const d = slika.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const v = Math.max(0, Math.min(255, ((y - 127.5) * 0.6 + 127.5) * 1.3));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(slika, 0, 0);
}

function ucitajSliku(src: string): Promise<HTMLImageElement | null> {
  return new Promise((r) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const istek = setTimeout(() => r(null), 6000);
    img.onload = () => {
      clearTimeout(istek);
      r(img);
    };
    img.onerror = () => {
      clearTimeout(istek);
      r(null);
    };
    img.src = src;
  });
}

function prelomi(ctx: CanvasRenderingContext2D, tekst: string, sirina: number): string[] {
  const rijeci = tekst.split(/\s+/);
  const redovi: string[] = [];
  let red = "";
  for (const r of rijeci) {
    const probni = red ? `${red} ${r}` : r;
    if (ctx.measureText(probni).width > sirina && red) {
      redovi.push(red);
      red = r;
    } else red = probni;
  }
  if (red) redovi.push(red);
  return redovi;
}

function uzorak(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: NonNullable<StavkaLegende["ploha"]>) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.clip();
  ctx.fillStyle = SIVA_SNIMKE;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = p.alfa;
  ctx.fillStyle = p.boja;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  if (p.pruge) {
    ctx.strokeStyle = p.pruge;
    ctx.lineWidth = 3;
    for (const smjer of p.mreza ? [1, -1] : [1]) {
      ctx.beginPath();
      for (let k = -h; k < w + h; k += 9) {
        if (smjer === 1) {
          ctx.moveTo(x + k, y + h);
          ctx.lineTo(x + k + h, y);
        } else {
          ctx.moveTo(x + k, y);
          ctx.lineTo(x + k + h, y + h);
        }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 4);
  ctx.stroke();
}

/** PNG pogleda karte s naslovom, tumačem i izvorima, 1080 px širok. */
export async function slikaKarte(map: LeafletNS.Map, podrucje: Podrucje, opis: OpisSlike): Promise<Blob> {
  await document.fonts?.ready;
  const spremnik = map.getContainer();
  const r0 = spremnik.getBoundingClientRect();
  // ne previsoko (4:5) ni preširoko (1,91:1, kao pregled poveznice)
  let { x, y, w, h } = podrucje;
  if (h > w * 1.25) {
    y += (h - w * 1.25) / 2;
    h = w * 1.25;
  }
  if (w > h * 1.91) {
    x += (w - h * 1.91) / 2;
    w = h * 1.91;
  }
  const s = SIRINA / w;
  const visinaKarte = Math.round(h * s);
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  // karta: podloga, pa obojeni slojevi redom okana
  const karta = document.createElement("canvas");
  karta.width = SIRINA;
  karta.height = visinaKarte;
  const kc = karta.getContext("2d", { willReadFrequently: true })!;
  kc.fillStyle = "#d4d4d8";
  kc.fillRect(0, 0, SIRINA, visinaKarte);
  const naPlatnu = (el: Element) => {
    const r = el.getBoundingClientRect();
    return [(r.left - r0.left - x) * s, (r.top - r0.top - y) * s, r.width * s, r.height * s] as const;
  };
  const filtar = podrzavaFilter();
  if (filtar) kc.filter = "grayscale(1) contrast(0.6) brightness(1.3)";
  const plocice = [...spremnik.querySelectorAll<HTMLImageElement>(".leaflet-tile-pane img.leaflet-tile-loaded")];
  const slike = await Promise.all(
    plocice.map((img) => (new URL(img.src, location.href).origin === location.origin ? Promise.resolve(img) : ucitajSliku(img.src))),
  );
  plocice.forEach((img, i) => {
    const sl = slike[i];
    if (!sl) return;
    const [dx, dy, dw, dh] = naPlatnu(img);
    // pločice se preklapaju za pola piksela, inače bi se vidjeli šavovi
    kc.drawImage(sl, dx - 0.5, dy - 0.5, dw + 1, dh + 1);
  });
  kc.filter = "none";
  if (!filtar) posivi(kc, SIRINA, visinaKarte);

  const okna = [...spremnik.querySelectorAll<HTMLElement>(".leaflet-map-pane > .leaflet-pane")]
    .filter((p) => !p.classList.contains("leaflet-tile-pane"))
    .sort((a, b) => Number(getComputedStyle(a).zIndex || 0) - Number(getComputedStyle(b).zIndex || 0));
  const ostro = map.getZoom() >= 15;
  for (const okno of okna)
    for (const c of okno.querySelectorAll("canvas")) {
      if (!c.width || !c.height) continue;
      kc.imageSmoothingEnabled = c.classList.contains("gup-regije") ? !ostro : true;
      const [dx, dy, dw, dh] = naPlatnu(c);
      kc.drawImage(c, dx, dy, dw, dh);
    }
  kc.imageSmoothingEnabled = true;

  // tekst: najprije izmjeri, pa složi platno
  const mjera = document.createElement("canvas").getContext("2d")!;
  const sirinaTeksta = SIRINA - 2 * RUB;
  mjera.font = `700 46px ${font}`;
  const naslov = prelomi(mjera, opis.naslov, sirinaTeksta).slice(0, 3);
  mjera.font = `400 28px ${font}`;
  const podnaslov = opis.podnaslov ? prelomi(mjera, opis.podnaslov, sirinaTeksta).slice(0, 2) : [];
  const visinaZaglavlja = RUB + naslov.length * 56 + (podnaslov.length ? 8 + podnaslov.length * 36 : 0) + 28;
  const stupci = opis.legenda.length > 3 ? 2 : 1;
  const sirinaStupca = (sirinaTeksta - (stupci - 1) * 32) / stupci;
  mjera.font = `400 26px ${font}`;
  const legenda = opis.legenda.map((st) => {
    const tekst = st.ha !== undefined ? `${st.naziv} · ${Math.round(st.ha).toLocaleString("hr-HR")} ha` : st.naziv;
    return { st, redovi: prelomi(mjera, tekst, sirinaStupca - 56).slice(0, 3) };
  });
  const visineRedova: number[] = [];
  for (let i = 0; i < legenda.length; i += stupci)
    visineRedova.push(Math.max(...legenda.slice(i, i + stupci).map((l) => l.redovi.length * 32)) + 16);
  const visinaLegende = 28 + visineRedova.reduce((a, b) => a + b, 0) + 12;
  mjera.font = `400 21px ${font}`;
  const podnozje = opis.podnozje.flatMap((p) => prelomi(mjera, p, sirinaTeksta));
  const visinaPodnozja = 20 + podnozje.length * 28 + RUB - 12;

  const platno = document.createElement("canvas");
  platno.width = SIRINA;
  platno.height = visinaZaglavlja + visinaKarte + visinaLegende + visinaPodnozja;
  const c = platno.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, platno.width, platno.height);
  c.textBaseline = "top";

  let yy = RUB;
  c.fillStyle = "#18181b";
  c.font = `700 46px ${font}`;
  for (const r of naslov) {
    c.fillText(r, RUB, yy);
    yy += 56;
  }
  if (podnaslov.length) {
    yy += 8;
    c.fillStyle = "#52525b";
    c.font = `400 28px ${font}`;
    for (const r of podnaslov) {
      c.fillText(r, RUB, yy);
      yy += 36;
    }
  }
  yy = visinaZaglavlja;
  c.drawImage(karta, 0, yy);
  karta.width = 0;
  yy += visinaKarte + 28;

  c.font = `400 26px ${font}`;
  legenda.forEach(({ st, redovi }, i) => {
    const stupac = i % stupci;
    const xx = RUB + stupac * (sirinaStupca + 32);
    if (st.ploha) uzorak(c, xx, yy + 4, 40, 26, st.ploha);
    else if (st.crta) {
      c.strokeStyle = "#ffffff";
      c.lineWidth = (st.crta.debljina ?? 2) + 3;
      c.setLineDash([]);
      c.beginPath();
      c.moveTo(xx, yy + 17);
      c.lineTo(xx + 40, yy + 17);
      c.stroke();
      c.strokeStyle = st.crta.boja;
      c.lineWidth = st.crta.debljina ?? 2;
      c.setLineDash(st.crta.crtice ?? []);
      c.beginPath();
      c.moveTo(xx, yy + 17);
      c.lineTo(xx + 40, yy + 17);
      c.stroke();
      c.setLineDash([]);
    }
    c.fillStyle = "#27272a";
    redovi.forEach((r, n) => c.fillText(r, xx + 56, yy + n * 32));
    if (stupac === stupci - 1 || i === legenda.length - 1) yy += visineRedova[Math.floor(i / stupci)];
  });

  yy += 12;
  c.strokeStyle = "#e4e4e7";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(RUB, yy);
  c.lineTo(SIRINA - RUB, yy);
  c.stroke();
  yy += 20;
  c.fillStyle = "#71717a";
  c.font = `400 21px ${font}`;
  for (const r of podnozje) {
    c.fillText(r, RUB, yy);
    yy += 28;
  }

  const blob = await new Promise<Blob | null>((r) => platno.toBlob(r, "image/png"));
  platno.width = 0;
  if (!blob) throw new Error("slika karte nije napravljena");
  return blob;
}

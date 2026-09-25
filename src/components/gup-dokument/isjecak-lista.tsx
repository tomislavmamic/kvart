/**
 * Isječak kartografskog prikaza složen od pločica lista — bez karte i bez
 * JavaScripta, pa radi i u skočnom prozoru i na statičnoj stranici.
 *
 * Razina pločica bira se tako da isječak ima ~`sirinaPx` piksela širine
 * (dovoljno za oštar prikaz na telefonu s gustim zaslonom); pločice se
 * postavljaju u postocima, pa se isječak rasteže sa širinom spremnika.
 */
import { PLOCICA_LISTA, type List, type Okvir, type Tocka } from "@/lib/gup-dokument/model";

export function IsjecakLista({
  list,
  okvir,
  tocka,
  sirinaPx = 1000,
  alt,
}: {
  list: List;
  okvir: Okvir;
  /** Mjesto na listu (udio lista) koje se obilježi krugom — čestica s karte. */
  tocka?: Tocka;
  sirinaPx?: number;
  alt: string;
}) {
  const [x0, y0, x1, y1] = okvir;
  const punaSirina = (x1 - x0) * list.sirina;
  const z = Math.max(0, Math.min(list.maksZum, Math.ceil(list.maksZum + Math.log2(sirinaPx / punaSirina))));
  const mj = 2 ** (z - list.maksZum);
  const sirinaRazine = Math.floor(list.sirina * mj);
  const visinaRazine = Math.floor(list.visina * mj);
  const cx0 = x0 * sirinaRazine;
  const cy0 = y0 * visinaRazine;
  const cw = (x1 - x0) * sirinaRazine;
  const ch = (y1 - y0) * visinaRazine;
  const plocice: { x: number; y: number; w: number; h: number }[] = [];
  for (let ty = Math.floor(cy0 / PLOCICA_LISTA); ty * PLOCICA_LISTA < cy0 + ch; ty++) {
    for (let tx = Math.floor(cx0 / PLOCICA_LISTA); tx * PLOCICA_LISTA < cx0 + cw; tx++) {
      const w = Math.min(PLOCICA_LISTA, sirinaRazine - tx * PLOCICA_LISTA);
      const h = Math.min(PLOCICA_LISTA, visinaRazine - ty * PLOCICA_LISTA);
      if (w > 0 && h > 0) plocice.push({ x: tx, y: ty, w, h });
    }
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className="relative w-full overflow-hidden rounded-lg bg-white"
      style={{ aspectRatio: `${cw} / ${ch}` }}
    >
      {plocice.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element -- pločice lista, složene u postocima
        <img
          key={`${p.x}_${p.y}`}
          src={`/gup/listovi/${list.id}/${z}/${p.x}_${p.y}.avif`}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            left: `${((p.x * PLOCICA_LISTA - cx0) / cw) * 100}%`,
            top: `${((p.y * PLOCICA_LISTA - cy0) / ch) * 100}%`,
            width: `${(p.w / cw) * 100}%`,
            height: `${(p.h / ch) * 100}%`,
          }}
        />
      ))}
      {tocka && (
        // Krug je naš znak, ne znak plana: maslina živa, samo obrub, da boja zone ostane vidljiva.
        <span
          aria-hidden="true"
          className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-maslina-zivo shadow-[0_0_0_2px_white]"
          style={{ left: `${((tocka[0] - x0) / (x1 - x0)) * 100}%`, top: `${((tocka[1] - y0) / (y1 - y0)) * 100}%` }}
        />
      )}
    </div>
  );
}

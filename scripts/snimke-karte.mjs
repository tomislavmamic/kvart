#!/usr/bin/env node
/**
 * Snimke zaslona karte /gup/gradnja za pregled sučelja (kritika UI/UX):
 * pokrene Chrome bez prozora, za svaki korak postavi veličinu zaslona,
 * otvori adresu, po potrebi klikne (gumb po aria-labelu ili tekstu) i
 * spremi PNG. Koristi samo Chromeov protokol za alate (CDP), bez paketa.
 *
 *   node scripts/snimke-karte.mjs <osnovni-url> <izlazna-mapa>
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [osnova = "https://dracevac.vercel.app", izlaz = "snimke"] = process.argv.slice(2);
mkdirSync(izlaz, { recursive: true });

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const profil = path.join(izlaz, ".profil");
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`, "--hide-scrollbars", "about:blank"], {
  stdio: "ignore",
});
const cekaj = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await cekaj(250);
  try {
    const popis = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const stranica = popis.find((t) => t.type === "page");
    if (stranica) ws = new WebSocket(stranica.webSocketDebuggerUrl);
  } catch {}
}
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const cekaju = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && cekaju.has(m.id)) {
    cekaju.get(m.id)(m);
    cekaju.delete(m.id);
  }
});
const cdp = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    cekaju.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await cdp("Page.enable");
await cdp("Runtime.enable");

/** Klik na gumb čiji aria-label ili tekst sadrži `oznaka`. */
const klikni = (oznaka) =>
  cdp("Runtime.evaluate", {
    expression: `(() => { const b = [...document.querySelectorAll('button,summary,a')].find(x => (x.getAttribute('aria-label')||'').includes(${JSON.stringify(oznaka)}) || x.textContent.trim().startsWith(${JSON.stringify(oznaka)})); if (b) b.click(); return !!b; })()`,
    returnByValue: true,
  });

const KORACI = [
  { ime: "1-racunalo-pocetak", w: 1366, h: 850, url: "/gup/gradnja?v=karta" },
  { ime: "2-racunalo-cestica", w: 1366, h: 850, url: "/gup/gradnja?v=karta&c=17/43.50889/16.48686&t=16.486858,43.508894" },
  { ime: "3-racunalo-slojevi", w: 1366, h: 850, url: "/gup/gradnja?v=karta&c=16/43.5100/16.4900", klik: ["Svi slojevi"] },
  { ime: "4-racunalo-prijeci", w: 1366, h: 850, url: "/gup/gradnja?v=karta&c=16/43.5100/16.4900", klik: ["Što priječi"] },
  { ime: "5-racunalo-svi-slojevi", w: 1366, h: 850, url: "/gup/gradnja?v=karta&c=16/43.5100/16.4900&s=1.2.3.4.5.14.6.7.8.9.23.21.20.16.10.17.11.15.12.13.25.26.27.28.19.22.18.24" },
  { ime: "6-mobitel-pocetak", w: 390, h: 844, mob: true, url: "/gup/gradnja?v=karta" },
  { ime: "7-mobitel-cestica", w: 390, h: 844, mob: true, url: "/gup/gradnja?v=karta&c=17/43.50889/16.48686&t=16.486858,43.508894" },
  { ime: "8-mobitel-cestica-rasireno", w: 390, h: 844, mob: true, url: "/gup/gradnja?v=karta&c=17/43.50889/16.48686&t=16.486858,43.508894", klik: ["Sve provjere"] },
  { ime: "9-mobitel-slojevi", w: 390, h: 844, mob: true, url: "/gup/gradnja?v=karta&c=16/43.5100/16.4900", klik: ["Svi slojevi"] },
  { ime: "10-mobitel-pregled", w: 390, h: 844, mob: true, url: "/gup/gradnja" },
];

for (const k of KORACI) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: k.w, height: k.h, deviceScaleFactor: k.mob ? 2 : 1, mobile: !!k.mob });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: !!k.mob });
  await cdp("Page.navigate", { url: osnova + k.url });
  await cekaj(9000);
  for (const o of k.klik ?? []) {
    await klikni(o);
    await cekaj(1500);
  }
  const { result } = await cdp("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(izlaz, `${k.ime}.png`), Buffer.from(result.data, "base64"));
  console.log(k.ime);
}
ws.close();
chrome.kill();

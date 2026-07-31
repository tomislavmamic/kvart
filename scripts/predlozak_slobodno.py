"""Predložak stranice o slobodnim stambenim česticama.

Odvojen od scripts/stranica-slobodno.py da se računanje i oblikovanje ne
miješaju: ondje je geometrija, ovdje je crtež.

`fragment()` vraća stranicu bez <html>/<head>/<body> jer je mjesto na koje
se objavljuje samo omota; `standalone()` isti sadržaj zapakira u punu
datoteku koja se otvara dvoklikom. Jedan izvor, dva pakiranja.

Oblikovanje slijedi ono što stranica prikazuje — geodetski list. Boje su
hladno sive s blagim zelenim odmakom (crtaći film, ne požutjeli papir),
brojke i oznake idu u monospaceu jer se broj čestice, površina i koordinata
poravnavaju u stupce, a jedina jaka boja osim semantičkih jest #d99a00 —
boja kojom sam GUP crta K5, jedinu zonu u ovom obuhvatu koja dopušta
stanovanje. Mreža od 500 m s oznakama u HTRS96 stoji jer je to mjerilo u
kojem su podaci i nastali.
"""
from __future__ import annotations

import json
from typing import Any

STIL = """
:root{
  --paper:#eef1f0; --card:#f8faf9; --ink:#101619; --muted:#59696b;
  --rule:#ccd6d4; --rule-jaka:#a9b8b5;
  --free:#1f7a4d; --locked:#a83226; --k5:#d99a00;
  --sjena:0 1px 2px rgba(16,22,25,.06),0 8px 24px rgba(16,22,25,.05);
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme:dark){
  :root{
    --paper:#0b0f11; --card:#131a1c; --ink:#e3ebe9; --muted:#8ea09f;
    --rule:#222e31; --rule-jaka:#35464a;
    --free:#3faa76; --locked:#d9695c; --k5:#e8b52e;
    --sjena:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.3);
  }
}
:root[data-theme="dark"]{
  --paper:#0b0f11; --card:#131a1c; --ink:#e3ebe9; --muted:#8ea09f;
  --rule:#222e31; --rule-jaka:#35464a;
  --free:#3faa76; --locked:#d9695c; --k5:#e8b52e;
  --sjena:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.3);
}
:root[data-theme="light"]{
  --paper:#eef1f0; --card:#f8faf9; --ink:#101619; --muted:#59696b;
  --rule:#ccd6d4; --rule-jaka:#a9b8b5;
  --free:#1f7a4d; --locked:#a83226; --k5:#d99a00;
  --sjena:0 1px 2px rgba(16,22,25,.06),0 8px 24px rgba(16,22,25,.05);
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.omot{max-width:1180px;margin:0 auto;padding:0 20px}
.uzak{max-width:70ch}
h1,h2,h3{text-wrap:balance;margin:0}
a{color:inherit}

/* --- zaglavlje --- */
.glava{padding:56px 0 28px;border-bottom:1px solid var(--rule)}
.oznaka{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--muted)}
h1{font-size:clamp(30px,4.4vw,50px);line-height:1.06;letter-spacing:-.022em;
  font-weight:660;margin:14px 0 0}
.podnaslov{margin:16px 0 0;font-size:17px;color:var(--muted);max-width:62ch}
.meta{margin-top:22px;display:flex;flex-wrap:wrap;gap:8px 26px;
  font-family:var(--mono);font-size:12px;color:var(--muted)}
.meta b{color:var(--ink);font-weight:600}

/* --- brojke --- */
.brojke{display:grid;gap:1px;background:var(--rule);border:1px solid var(--rule);
  grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:34px 0 0}
.plocica{background:var(--card);padding:16px 18px 15px}
.plocica .k{font-family:var(--mono);font-size:11px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--muted)}
.plocica .v{font-family:var(--mono);font-size:31px;font-weight:620;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin-top:7px;
  line-height:1}
.plocica .v small{font-size:15px;font-weight:500;color:var(--muted);
  letter-spacing:0;margin-left:3px}
.plocica.istaknuta .v{color:var(--free)}
.plocica.upozorenje .v{color:var(--locked)}

/* --- karta --- */
.karta-blok{margin:40px 0 0}
.alatna{display:flex;flex-wrap:wrap;align-items:center;gap:10px;
  padding-bottom:12px}
.gumb{font-family:var(--mono);font-size:12px;letter-spacing:.04em;
  padding:6px 11px;border:1px solid var(--rule-jaka);background:var(--card);
  color:var(--ink);cursor:pointer;border-radius:2px}
.gumb:hover{border-color:var(--ink)}
.gumb[aria-pressed="true"]{background:var(--ink);color:var(--paper);
  border-color:var(--ink)}
.gumb:focus-visible{outline:2px solid var(--k5);outline-offset:2px}
.legenda{display:flex;gap:16px;margin-left:auto;font-family:var(--mono);
  font-size:11.5px;color:var(--muted);align-items:center;flex-wrap:wrap}
.legenda i{display:inline-block;width:11px;height:11px;margin-right:6px;
  vertical-align:-1px;border:1px solid rgba(0,0,0,.25)}
/* Okvir drži razmjere obuhvata (--ar), a visina ga vodi: tako nema ni
   praznih pojaseva sa strane ni razvlačenja crteža. */
.okvir{position:relative;border:1px solid var(--rule-jaka);background:var(--card);
  box-shadow:var(--sjena);overflow:hidden;touch-action:none;
  height:min(74vh,680px);aspect-ratio:var(--ar);width:auto;max-width:100%;
  margin-inline:auto}
svg.karta{display:block;width:100%;height:100%;cursor:grab}
svg.karta.vuce{cursor:grabbing}
.mreza{stroke:var(--rule);stroke-width:.5;fill:none;vector-effect:non-scaling-stroke}
.cesta{stroke:var(--rule-jaka);fill:none;stroke-width:1.1;
  vector-effect:non-scaling-stroke;opacity:.7}
.ploha{stroke:var(--ink);stroke-width:.6;vector-effect:non-scaling-stroke;
  fill:var(--free);fill-opacity:.62}
.ploha.zakljucana{fill:var(--locked)}
.ploha:hover{fill-opacity:.92}
.ploha.odabrana{stroke-width:2.4}
.tocka{fill:var(--free);stroke:var(--paper);stroke-width:1.2;
  vector-effect:non-scaling-stroke}
.tocka.zakljucana{fill:var(--locked)}
.natpis{font-family:var(--mono);font-size:9px;fill:var(--muted);
  paint-order:stroke;stroke:var(--card);stroke-width:2.5px}
.mjerilo{position:absolute;left:14px;bottom:12px;font-family:var(--mono);
  font-size:11px;color:var(--muted);background:color-mix(in srgb,var(--card) 86%,transparent);
  padding:5px 8px;border:1px solid var(--rule)}
.mjerilo .stap{display:block;height:5px;border:1px solid var(--ink);
  border-top:none;margin-bottom:3px}
.sjever{position:absolute;right:14px;top:12px;font-family:var(--mono);
  font-size:11px;color:var(--muted);text-align:center;line-height:1.1}
.natuknica{position:absolute;pointer-events:none;opacity:0;transition:opacity .1s;
  background:var(--ink);color:var(--paper);font-family:var(--mono);font-size:11.5px;
  padding:9px 11px;border-radius:2px;max-width:250px;line-height:1.5;z-index:5}
.natuknica.vidi{opacity:1}
.natuknica b{font-weight:650}
.natuknica .r{color:color-mix(in srgb,var(--paper) 62%,var(--ink))}

/* --- lijevak --- */
.lijevak{margin:14px 0 0;border:1px solid var(--rule);background:var(--card)}
.korak{display:grid;grid-template-columns:minmax(190px,1fr) 2fr auto;
  gap:14px;align-items:center;padding:11px 16px;border-top:1px solid var(--rule)}
.korak:first-child{border-top:none}
.korak .naz{font-size:13.5px}
.korak .traka{height:9px;background:color-mix(in srgb,var(--rule) 60%,transparent)}
.korak .traka span{display:block;height:100%;background:var(--rule-jaka)}
.korak:last-child .traka span{background:var(--free)}
.korak .br{font-family:var(--mono);font-size:13px;font-variant-numeric:tabular-nums;
  color:var(--muted);white-space:nowrap}
.korak .br b{color:var(--ink);font-weight:620}

/* --- tablica --- */
.tablica-omot{overflow-x:auto;border:1px solid var(--rule);background:var(--card)}
table{border-collapse:collapse;width:100%;font-family:var(--mono);font-size:12.5px}
th,td{padding:9px 14px;text-align:right;white-space:nowrap;
  border-top:1px solid var(--rule);font-variant-numeric:tabular-nums}
th{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);font-weight:600;border-top:none;position:sticky;top:0;
  background:var(--card)}
td:first-child,th:first-child,td:nth-child(2),th:nth-child(2){text-align:left}
tr.zakljucan td:first-child{color:var(--locked)}
.znak{display:inline-block;width:7px;height:7px;margin-right:7px;
  background:var(--free)}
tr.zakljucan .znak{background:var(--locked)}

/* --- odjeljci i bilješke --- */
section{padding:44px 0 0}
h2{font-size:22px;letter-spacing:-.014em;font-weight:640}
h2 + p{margin-top:10px;color:var(--muted)}
.biljeske{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
  gap:26px;margin-top:22px}
.biljeska h3{font-family:var(--mono);font-size:11.5px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--k5);margin-bottom:7px}
.biljeska p{margin:0;font-size:14.5px;color:var(--muted)}
.biljeska p + p{margin-top:9px}
.ograda{margin-top:26px;border-left:3px solid var(--k5);padding:2px 0 2px 16px}
.ograda p{margin:0;font-size:14.5px}
.podnozje{margin-top:52px;padding:22px 0 46px;border-top:1px solid var(--rule);
  font-family:var(--mono);font-size:11.5px;color:var(--muted)}
.podnozje p{margin:0 0 6px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
"""


def _br(n: float) -> str:
    """Cijeli broj po hrvatskom pravopisu — točka dijeli tisućice."""
    return f"{int(round(n)):,}".replace(",", ".")


def _dec(x: float, mjesta: int = 2) -> str:
    """Decimalni broj — zarez dijeli cijeli dio od decimala."""
    return f"{x:.{mjesta}f}".replace(".", ",")


def _plocice(izv: dict[str, Any]) -> str:
    r = izv["rezultat"]
    stavke = [
        ("čestica", _br(r["cestica"]), "", "istaknuta"),
        ("nakupina", _br(r["skupina"]), "", ""),
        ("slobodno", _dec(r["slobodna_ha"]), "ha", "istaknuta"),
        ("nakupina ≥500 m²", _br(r["skupina_od_500_m2"]), "", ""),
        ("bez pristupa", _br(r["cestica_bez_pristupa"]), "čest.", "upozorenje"),
    ]
    return "".join(
        f'<div class="plocica {k}"><div class="k">{n}</div>'
        f'<div class="v">{v}{f"<small>{j}</small>" if j else ""}</div></div>'
        for n, v, j, k in stavke)


def _lijevak(izv: dict[str, Any]) -> str:
    koraci = izv["lijevak"]
    naj = max(k["cestica"] for k in koraci) or 1
    return "".join(
        f'<div class="korak"><div class="naz">{k["korak"]}</div>'
        f'<div class="traka"><span style="width:{100 * k["cestica"] / naj:.2f}%">'
        f'</span></div>'
        f'<div class="br"><b>{_br(k["cestica"])}</b> čest. · '
        f'{_dec(k["ha"])} ha</div></div>'
        for k in koraci)


def _tablica(skupine: list[dict[str, Any]]) -> str:
    redci = []
    for s in skupine[:24]:
        kc = ", ".join(s["kc"])
        if s["n"] > len(s["kc"]):
            kc += f" +{s['n'] - len(s['kc'])}"
        # Bez općeg replace() nad cijelim retkom: popis čestica se nabraja
        # zarezima i takva bi zamjena "419/1, 293/2" pretvorila u "419/1. 293/2".
        pristup = "nema" if s["z"] else f'{_dec(s["p"], 1)} m'
        redci.append(
            f'<tr class="{"zakljucan" if s["z"] else ""}">'
            f'<td><span class="znak"></span>#{s["g"]}</td>'
            f'<td>{kc}</td><td>{_br(s["n"])}</td>'
            f'<td>{_br(s["s"])}</td><td>{pristup}</td></tr>')
    return "".join(redci)


def _sadrzaj(p: dict[str, Any]) -> str:
    izv = p["izvjestaj"]
    r = izv["rezultat"]
    pr = izv["pragovi"]
    prozor = p["prozor"]
    zap = _dec(sum(c["p"] for c in p["cestice"]) / 1e4)
    return f"""
<header class="glava"><div class="omot">
  <div class="oznaka">Analiza zemljišta · GUP Splita {izv['godina']}. (na snazi)</div>
  <h1>Gdje u istočnom Splitu još stoji prazno zemljište na kojem se smije graditi stan</h1>
  <p class="podnaslov">Presjek katastra, namjene iz GUP-a i evidencije zgrada
  nad prozorom od 4,0 × 3,3 km. Od {_br(izv['lijevak'][0]['cestica'])} čestica
  ostaje ih {_br(r['cestica'])} — {zap} ha katastarski, a
  {_dec(r['slobodna_ha'])} ha stvarno slobodno.</p>
  <div class="meta">
    <span>Obuhvat <b>{_br(prozor['w'])} × {_br(prozor['h'])} m</b></span>
    <span>HTRS96/TM <b>{prozor['x']} E · {prozor['y']} N</b></span>
    <span>Zone koje dopuštaju stanovanje <b>{', '.join(izv['stambene_namjene'])}</b></span>
  </div>
  <div class="meta"><span>Kotarevi u obuhvatu <b>Mejaši, Kamen, Neslanovac,
    Visoka, Pujanke, Brda, Sirobuja</b> te rubovi Split-3, Ravnih njiva,
    Mertojaka, Žnjana i Kocunara</span></div>
  <div class="brojke">{_plocice(izv)}</div>
</div></header>

<div class="omot">
  <section class="karta-blok">
    <h2>Karta</h2>
    <p class="uzak">Pri punom obuhvatu svaka nakupina stoji kao točka
    razmjerna slobodnoj površini; uvećanjem se točke povlače i pojavljuju se
    prave čestice. Povucite za pomicanje, kotačićem za uvećanje.</p>
    <div class="alatna">
      <button class="gumb" id="reset" type="button">Cijeli obuhvat</button>
      <button class="gumb" id="zakljucane" type="button" aria-pressed="true">Bez pristupa</button>
      <button class="gumb" id="ceste" type="button" aria-pressed="true">Ceste</button>
      <div class="legenda">
        <span><i style="background:var(--free)"></i>slobodno i dostupno</span>
        <span><i style="background:var(--locked)"></i>bez pristupa na cestu</span>
      </div>
    </div>
    <div class="okvir" id="okvir" style="--ar:{prozor['w']}/{prozor['h']}">
      <svg class="karta" id="karta" viewBox="0 0 {prozor['w']} {prozor['h']}"
           role="img" aria-label="Karta slobodnih čestica">
        <defs><clipPath id="obuhvat"><rect x="0" y="0"
          width="{prozor['w']}" height="{prozor['h']}"/></clipPath></defs>
        <!-- Rezanje na obuhvat, ne na okvir: ceste su izvađene sa širom
             rezervom, pa bi inače prelile rub i prikazale mrežu ondje gdje
             analize nema. -->
        <g clip-path="url(#obuhvat)">
          <g id="gmreza"></g>
          <g id="gceste"></g>
          <g id="gplohe"></g>
          <g id="gtocke"></g>
        </g>
      </svg>
      <div class="mjerilo"><span class="stap" id="stap"></span><span id="mjera">500 m</span></div>
      <div class="sjever">N<br>▲</div>
      <div class="natuknica" id="natuknica"></div>
    </div>
  </section>

  <section>
    <h2>Kako se {_br(izv['lijevak'][0]['cestica'])} čestica svelo na {_br(r['cestica'])}</h2>
    <p class="uzak">Svaki korak je jedan uvjet. Redoslijed nije proizvoljan:
    prvo otpada ono što plan ne dopušta, pa ono čime upravlja cesta, pa ono
    što je već izgrađeno, i tek na kraju ono što je premalo da bi se na
    njemu smjelo graditi.</p>
    <div class="lijevak">{_lijevak(izv)}</div>
  </section>

  <section>
    <h2>Nakupine</h2>
    <p class="uzak">Prag najmanje građevne čestice primjenjuje se na nakupinu
    susjednih čestica, ne na svaku zasebno — dvije male jedna uz drugu spajaju
    se u jednu građevnu. „Slobodno” je najveći povezan komad nakon što se
    odbiju cesta, tlocrti i dio izvan stambene zone.</p>
    <div class="tablica-omot"><table>
      <thead><tr><th>Nakupina</th><th>Čestice</th><th>Broj</th>
        <th>Slobodno (m²)</th><th>Do ceste</th></tr></thead>
      <tbody>{_tablica(p['skupine'])}</tbody>
    </table></div>
  </section>

  <section>
    <h2>Pravila i njihovo podrijetlo</h2>
    <div class="biljeske">
      <div class="biljeska"><h3>Namjena</h3>
        <p>Čestica je stambena ako joj je barem
        {int(pr['udio_namjene'] * 100)} % površine u zoni koja dopušta
        stanovanje. Većina, ne dodir: podloga namjene je trag rastera s
        ruba nesigurnog nekoliko metara.</p>
        <p>U slobodnu površinu ulazi samo dio unutar te zone — čestica koja
        je pola K5 a pola zaštitno zelenilo donosi samo tu polovicu.</p></div>
      <div class="biljeska"><h3>Cesta</h3>
        <p>Čestica pokrivena cestom preko
        {int(pr['udio_je_cesta'] * 100)} % svoje površine jest cesta i
        ispada. Ispada i ona kroz koju os nerazvrstane ceste prolazi dulje
        od {int(pr['kroz_cesticu'] * 100)} % njezine dulje strane.</p>
        <p>Postojeće ulice, koridori s obaju listova GUP-a i zaštitni pojas
        nadzemnog dalekovoda od {int(pr['koridor_dalekovoda_m'])} m oduzimaju
        se od slobodne površine.</p></div>
      <div class="biljeska"><h3>Veličina i oblik</h3>
        <p>Odredbe za M1, koje se po odredbi za K5 primjenjuju i na nju,
        traže Ppmin {int(pr['ppmin_slobodnostojeca_m2'])} m² za
        slobodnostojeću građevinu i {int(pr['ppmin_pod_m2'])} m² kad se
        čestica formira između dvije izgrađene. {int(pr['ppmin_pod_m2'])} m²
        je zato apsolutni pod.</p>
        <p>Traka uža od {int(pr['najuza_m'])} m — koliko pojedu dva propisana
        odmaka od 3 m — ulazi samo ako je uz susjeda prislonjena dugom
        stranom i time ga proširuje.</p></div>
      <div class="biljeska"><h3>Pristup</h3>
        <p>„Građevna čestica mora imati pristup na javnoprometnu površinu”, a
        pristupni put najmanje 3,0 m. Nakupina dalja od
        {int(pr['pristup_m'])} m od postojeće ceste crvena je, ne izbačena:
        zemljište postoji i namjena ga dopušta, ali je zaključano dok se
        pristup ne riješi.</p></div>
    </div>
    <div class="ograda"><p>Ovo je uputa gdje gledati, a ne potvrda da se
    smije graditi. Mjerodavni su akt i uvjeti gradnje; za pojedinačnu
    česticu vrijedi ono što piše u njima.</p></div>
  </section>

  <section>
    <h2>Dokle podatak seže</h2>
    <p class="uzak">Obuhvat nije izbor nego granica podatka. GUP se ne
    objavljuje kao vektorski sloj, pa je namjena ovdje dobivena praćenjem
    lista na 1 m/px i ručnim smještanjem; praćen je prozor od 4,0 × 3,3 km i
    izvan njega namjene naprosto nema. Katastar Grada seže 27,4 km i pokriva
    71 461 česticu, ali izvan GUP-a (Žrnovnica, Stobreč, Kamen, Srinjine,
    Slatine) vrijedi PPUG, koji nije praćen.</p>
    <p class="uzak">Rub plohe namjene zna odstupati nekoliko metara, pa su
    svi pragovi postavljeni tako da ih ta nesigurnost ne obara — mjere se
    udjeli površine, a ne dodiri. Nacrt izmjena GUP-a iz 2024. ne mijenja
    rezultat: registracijski robustan raster-diff pokazuje da unutar ovog
    obuhvata ne mijenja nijednu plohu.</p>
  </section>

  <footer class="podnozje">
    <p>Izvori: GUP Splita {izv['godina']}. (praćeno s lista), Katastarske
    čestice 2024., Objekti 2025., Ulice i Nerazvrstane ceste — GIS izvoz
    Grada Splita; Odredbe za provođenje GUP-a.</p>
    <p>Izračun: scripts/slobodne-parcele.py --obuhvat sire</p>
  </footer>
</div>
"""


SKRIPTA = """
(function(){
const P=window.__PODACI__, sv=document.getElementById('karta'),
  okvir=document.getElementById('okvir'), nat=document.getElementById('natuknica'),
  gm=document.getElementById('gmreza'), gc=document.getElementById('gceste'),
  gp=document.getElementById('gplohe'), gt=document.getElementById('gtocke'),
  W=P.prozor.w, H=P.prozor.h, NS='http://www.w3.org/2000/svg';
let vb={x:0,y:0,w:W,h:H}, pokaziZakljucane=true;

function el(t,a){const e=document.createElementNS(NS,t);
  for(const k in a) e.setAttribute(k,a[k]); return e;}

// Mreža od 500 m s oznakama u HTRS96 — mjerilo u kojem su podaci nastali.
(function mreza(){
  const K=500, f=document.createDocumentFragment();
  for(let x=Math.ceil(P.prozor.x/K)*K; x<P.prozor.x+W; x+=K){
    const u=x-P.prozor.x;
    f.appendChild(el('path',{class:'mreza',d:`M${u} 0V${H}`}));
    const t=el('text',{class:'natpis',x:u+4,y:13}); t.textContent=x; f.appendChild(t);
  }
  for(let y=Math.floor(P.prozor.y/K)*K; y>P.prozor.y-H; y-=K){
    const v=P.prozor.y-y;
    f.appendChild(el('path',{class:'mreza',d:`M0 ${v}H${W}`}));
    const t=el('text',{class:'natpis',x:4,y:v-4}); t.textContent=y; f.appendChild(t);
  }
  gm.appendChild(f);
})();

(function ceste(){
  const f=document.createDocumentFragment();
  for(const d of P.ceste) f.appendChild(el('path',{class:'cesta',d:d}));
  gc.appendChild(f);
})();

const plohe=[];
(function cestice(){
  const f=document.createDocumentFragment();
  P.cestice.forEach((c,i)=>{
    const e=el('path',{class:'ploha'+(c.z?' zakljucana':''),d:c.d});
    e.dataset.i=i; f.appendChild(e); plohe.push(e);
  });
  gp.appendChild(f);
})();

const tocke=[];
(function oznake(){
  const f=document.createDocumentFragment();
  for(const s of P.skupine){
    // Polumjer razmjeran KORIJENU površine: oko je osjetljivo na plohu
    // kruga, pa linearni polumjer pretjera velikima.
    const r=Math.max(9,Math.sqrt(s.s)*0.62);
    const e=el('circle',{class:'tocka'+(s.z?' zakljucana':''),cx:s.c[0],cy:s.c[1],r:r});
    e.dataset.g=s.g; f.appendChild(e); tocke.push(e);
  }
  gt.appendChild(f);
})();

// Pogled se drži uz obuhvat: dopušta se pola širine preko ruba, taman da
// se rubna čestica može odmaknuti od okvira, ali ne toliko da se odluta u
// prazno i izgubi karta iz vida.
function stegni(){
  const rx=vb.w*0.5, ry=vb.h*0.5;
  vb.x=Math.min(Math.max(vb.x,-rx),W-vb.w+rx);
  vb.y=Math.min(Math.max(vb.y,-ry),H-vb.h+ry);
}

function crtaj(){
  stegni();
  sv.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  // Prijelaz s pregleda na čestice: točke i plohe se križaju oko 1/6
  // punog obuhvata, gdje čestica postaje veća od nekoliko piksela.
  const u=W/vb.w, t=Math.min(1,Math.max(0,(u-3.2)/2.6));
  gp.style.opacity=t; gp.style.pointerEvents=t>0.5?'auto':'none';
  gt.style.opacity=1-t; gt.style.pointerEvents=t>0.5?'none':'auto';
  gm.style.opacity=Math.min(.85,.3+u*0.08);
  const px=vb.w/sv.clientWidth, cilj=120*px,
    stupanj=Math.pow(10,Math.floor(Math.log10(cilj))),
    duz=[1,2,5,10].map(k=>k*stupanj).find(v=>v>=cilj)||stupanj*10;
  document.getElementById('stap').style.width=(duz/px)+'px';
  document.getElementById('mjera').textContent=
    duz>=1000?(duz/1000)+' km':duz+' m';
}

function zumiraj(f,cx,cy){
  const nw=Math.min(W*1.4,Math.max(W/220,vb.w*f)), nh=nw*(vb.h/vb.w);
  vb.x=cx-(cx-vb.x)*(nw/vb.w); vb.y=cy-(cy-vb.y)*(nh/vb.h);
  vb.w=nw; vb.h=nh; crtaj();
}
function usvg(e){const r=sv.getBoundingClientRect();
  return {x:vb.x+(e.clientX-r.left)/r.width*vb.w, y:vb.y+(e.clientY-r.top)/r.height*vb.h};}

sv.addEventListener('wheel',e=>{e.preventDefault();const p=usvg(e);
  zumiraj(e.deltaY>0?1.16:0.862,p.x,p.y);},{passive:false});

let vuce=null;
sv.addEventListener('pointerdown',e=>{vuce={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y};
  sv.setPointerCapture(e.pointerId); sv.classList.add('vuce');});
sv.addEventListener('pointermove',e=>{
  if(vuce){const r=sv.getBoundingClientRect();
    vb.x=vuce.vx-(e.clientX-vuce.x)/r.width*vb.w;
    vb.y=vuce.vy-(e.clientY-vuce.y)/r.height*vb.h; crtaj(); return;}
  const c=e.target.closest('.ploha,.tocka'); if(!c){nat.classList.remove('vidi');return;}
  const r=okvir.getBoundingClientRect();
  if(c.dataset.i!==undefined){
    const d=P.cestice[c.dataset.i];
    nat.innerHTML=`<b>k.č. ${d.kc}</b> <span class="r">k.o. ${d.ko}</span><br>`+
      `${d.p.toLocaleString('hr')} m² · slobodno ${d.s.toLocaleString('hr')} m²<br>`+
      `<span class="r">namjena ${d.n} · nakupina #${d.g} (${d.gs.toLocaleString('hr')} m²)</span>`+
      (d.z?'<br><b>bez pristupa na cestu</b>':'');
  } else {
    const s=P.skupine.find(s=>s.g==c.dataset.g);
    nat.innerHTML=`<b>Nakupina #${s.g}</b><br>${s.n} čestica · `+
      `${s.s.toLocaleString('hr')} m² slobodno<br>`+
      `<span class="r">k.č. ${s.kc.join(', ')}</span>`+
      (s.z?'<br><b>bez pristupa na cestu</b>':'');
  }
  nat.classList.add('vidi');
  const x=e.clientX-r.left+14, y=e.clientY-r.top+14;
  nat.style.left=Math.min(x,r.width-nat.offsetWidth-8)+'px';
  nat.style.top=Math.min(y,r.height-nat.offsetHeight-8)+'px';
});
addEventListener('pointerup',()=>{vuce=null;sv.classList.remove('vuce');});
sv.addEventListener('pointerleave',()=>nat.classList.remove('vidi'));

document.getElementById('reset').onclick=()=>{vb={x:0,y:0,w:W,h:H};crtaj();};
document.getElementById('zakljucane').onclick=function(){
  pokaziZakljucane=!pokaziZakljucane;
  this.setAttribute('aria-pressed',pokaziZakljucane);
  const v=pokaziZakljucane?'':'none';
  plohe.forEach((e,i)=>{if(P.cestice[i].z)e.style.display=v;});
  tocke.forEach(e=>{const s=P.skupine.find(s=>s.g==e.dataset.g);
    if(s.z)e.style.display=v;});
};
document.getElementById('ceste').onclick=function(){
  const v=this.getAttribute('aria-pressed')==='true';
  this.setAttribute('aria-pressed',!v); gc.style.display=v?'none':'';
};
addEventListener('resize',crtaj);
crtaj();
})();
"""


def fragment(p: dict[str, Any]) -> str:
    """Stranica bez <html>/<head>/<body> — za mjesta koja same omataju."""
    podaci = json.dumps(p, ensure_ascii=False, separators=(",", ":"))
    return (f"<title>Slobodne stambene čestice — istočni Split</title>\n"
            f"<style>{STIL}</style>\n{_sadrzaj(p)}\n"
            f"<script>window.__PODACI__={podaci};</script>\n"
            f"<script>{SKRIPTA}</script>\n")


def standalone(p: dict[str, Any]) -> str:
    """Puna datoteka koja se otvara dvoklikom."""
    return ('<!doctype html>\n<html lang="hr">\n<head>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            '<meta name="description" content="Katastarske čestice u istočnom '
            'Splitu na kojima GUP dopušta stanovanje, a prazne su.">\n'
            f'{fragment(p)}</head>\n<body>\n</body>\n</html>\n')


def stranica(p: dict[str, Any]) -> str:
    """Zadano pakiranje je samostalna datoteka."""
    return standalone(p)

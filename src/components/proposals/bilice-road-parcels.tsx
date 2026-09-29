import report from "../../../public/geo/prijedlozi/bilice-cesta.json";

type WideningSummary = {
  label: string;
  lengthM: number;
  widthM: number;
  areaM2: number;
  startDescription: string;
  endDescription: string;
  assumption: string;
  parcels: {
    id: string;
    label: string;
    overlapM2: number;
    ownershipLabel: string;
    ownershipStatus?: string;
    sourceUrl?: string | null;
    checkedAt?: string | null;
    historicalOwnership?: {
      entityLabel: string;
      ownershipForm: string;
      sourceUpdatedAt: string;
      sourceUrl: string;
      sourceLabel: string;
    };
  }[];
};

const number = (value: number, decimals = 0) => value.toLocaleString("hr-HR", { maximumFractionDigits: decimals });

export function BiliceRoadParcels() {
  const widening = (report as unknown as { widening?: WideningSummary }).widening;
  if (!widening) return null;

  return <section id="prosirenje-bilice" className="scroll-mt-6 space-y-5 rounded-xl border border-[#cba5b6] bg-[#fcf7f9] p-5 sm:p-8">
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#87395d]">Postojeća ulica unutar Bilica</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight">Prvih 75 m treba proširiti.</h2>
      <p className="mt-3 max-w-3xl leading-7 text-kamen-tekst">Obuhvat počinje kod predloženog spoja s DPU-om i prati postojeću ulicu Bilice II prema unutrašnjosti naselja, preko raskrižja prikazanog na fotografiji. To je radno tumačenje početka dionice. Ružičasta površina i katastarske granice prikazane su na karti i u 3D-u; gumb „Prvih 75 m” približava taj dio.</p>
    </div>
    <dl className="grid grid-cols-3 gap-4 border-y border-[#e5d0d9] py-4">
      <div><dt className="text-sm text-kamen-tekst">Radna širina</dt><dd className="mt-1 text-xl font-bold">{number(widening.widthM, 1)} m</dd></div>
      <div><dt className="text-sm text-kamen-tekst">Cijeli ispitani profil</dt><dd className="mt-1 text-xl font-bold">≈ {number(widening.areaM2)} m²</dd></div>
      <div><dt className="text-sm text-kamen-tekst">Zahvaćene čestice</dt><dd className="mt-1 text-xl font-bold">{widening.parcels.length}</dd></div>
    </dl>
    <p className="max-w-3xl border-l-2 border-[#ad4777] pl-4 leading-7 text-kamen-tekst"><strong className="text-kamen-tinta">Ovo je prostorni probir, a ne odobren profil ceste.</strong> Radna os je pomaknuta prema slobodnim dijelovima zemljišta radi očuvanja zgrada. Ima približno {number(widening.lengthM, 1)} m unutar obuhvata mjerenog po prvih 75 m postojeće osi. Profil od 5 m nema zaseban nogostup; širi ispitani profili nailaze na zgrade ili evidentirane objekte. Mali odmak na karti nije dovoljan da potvrdi izvedbu bez rušenja. Prije odabira širine treba provjeriti snimljene rubove, pješački i interventni pristup te uvjete plana.</p>
    <p className="max-w-3xl leading-7 text-kamen-tekst"><strong className="text-kamen-tinta">Postojeći GIS podaci bilježe vlasništvo Republike Hrvatske na česticama 13571/1 i 251/2.</strong> Izvedeni sloj sačuvao je izričiti status „RH” i oblik „Vlasništvo”, uz navedeni datum izvora 3. listopada 2025. Za ostalih šest čestica dostupni skup nema podatak o vlasniku; to ne znači da su privatne.</p>
    <p className="max-w-3xl text-sm leading-6 text-kamen-tekst">Odvojena provjera 22. rujna 2026. potvrdila je svih osam čestica u živom katastru, ali nijedna nema izravno povezan ZK uložak. Stari GIS zapis zato prikazujemo kao dostupnu evidenciju, bez potvrde današnjeg vlasništva ili udjela. Za aktualni list B potrebna je službena identifikacija katastarske i zemljišnoknjižne čestice.</p>
    <div className="overflow-x-auto rounded-lg border border-[#e5d0d9] bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">Katastarske čestice prvih 75 metara Bilica II i stanje provjere vlasništva</caption>
        <thead className="bg-[#f5ecf0]"><tr><th scope="col" className="p-4">Čestica · k.o. Split</th><th scope="col" className="p-4">Presjek profila</th><th scope="col" className="p-4">Dostupni podaci o vlasništvu</th></tr></thead>
        <tbody>{widening.parcels.map((parcel) => <tr key={parcel.id} className="border-t border-[#eadde3] align-top">
          <th scope="row" className="p-4 font-semibold">{parcel.label}</th>
          <td className="whitespace-nowrap p-4 tabular-nums">{number(parcel.overlapM2, 1)} m²</td>
          <td className="max-w-lg p-4 leading-6">
            <p>{parcel.ownershipLabel}</p>
            {parcel.historicalOwnership && <a href={parcel.historicalOwnership.sourceUrl} className="fokus mt-1 inline-flex min-h-11 items-center font-semibold text-maslina underline underline-offset-4">GIS evidencija · {parcel.historicalOwnership.sourceUpdatedAt}</a>}
            {parcel.checkedAt && <p className="mt-1 text-xs text-kamen-drugi">Pokušaj povezivanja sa ZK: {parcel.checkedAt.slice(0, 10)}</p>}
            {parcel.sourceUrl && <a href={parcel.sourceUrl} className="fokus mt-1 inline-flex min-h-11 items-center font-semibold text-maslina underline underline-offset-4">Otvori katastarski zapis</a>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="max-w-3xl text-sm leading-6 text-kamen-tekst">Površine su presjeci cijelog radnog profila s katastarskim poligonima, uključujući postojeću cestu. <strong>To nisu površine za otkup.</strong> Bez snimljenog ruba asfalta, međa i potvrđenog projekta nije moguće izračunati potreban otkup. Katastarski posjednik nije automatski zemljišnoknjižni vlasnik; nepovezani zapisi ostaju označeni kao neutvrđeni.</p>
  </section>;
}

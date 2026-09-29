# Rekreacijska zona i zajednički 3D prikaz

22. 9. 2026. `ProposalSceneVisual` i `proposal-scene.ts` koriste isti
Three.js prikaz za park i nogostupe. Nema novih npm ovisnosti ni trajne
animacijske petlje. Geometrija se renderira nakon promjene kontrola.

## Park

`generate-proposal-geodata.py` generira `rekreacija-3d.json` iz istih
geometrija kao karta. Područje prikaza u EPSG:3765:
500075,4820765,500170,4820848. Izvorni rekreacijski ortofoto ima okvir
500020,4820710,500220,4820880; UV koordinate izrezuju taj isti izvor.

- Cijela radna dječja terasa: 637 m², ilustrativne ljuljačke, kućica s
  toboganom, pješčanik i klupe. Sprave nisu izvedbeni raspored niti potvrda
  njihovih sigurnosnih razmaka.
- Srednja terasa: cageball 22 × 9 m, mreža, stupovi, golovi i oznake.
- Gornja terasa: teretana 8 × 6 m, šipke i klupe za vježbanje.
- Zapadna šetnica prati postojeći teren; tri parkirna mjesta ostaju
  zapadno od donje terase, na kartom utvrđenom povezanom zahvatu izvan R2.
- Četiri nova mjesta za platane i tri očitane skupine postojeće sadnje
  ostaju na istim koordinatama kao prije ove izmjene.

Okolni teren potječe iz DGU DMR-a izvorne mreže oko 3 m. Za prikaz malih
ploha interpolira se na mrežu 1 m, bez tvrdnje o većoj točnosti. Radne
ravnine su 46,5 m (dječja terasa), 48 m (cageball), 48,8 m (teretana) i
44,3 m (zapadno parkiranje). Prve vrijednosti uzete su iz DMR-a u središtu
ploha. Gornja terasa pretpostavlja najmanje 0,8 m razlike prema srednjoj
radi prikaza odnosa na korisnikovim fotografijama. To je eksplicitna
pretpostavka modela, ne snimljena kota ni odluka o zemljanim radovima.

Zid prati već označeni približni rub više južne ceste. Visina je procjena
iz DMR-a 2 m sa svake strane ruba, uz minimalni ilustrativni prikaz 0,7 m.
Zid nema potvrđene kote, konstrukciju ili presjek. Prijelazi terasa,
stabilnost zida i pristupačnost zahtijevaju geodetsku snimku i projekt.

## Detaljnija podloga u oba prikaza

Ponovno se koristi postojeći `public/prijedlozi/nogostupi-render.png`.
Nije stvarna nova satelitska snimka: AI ilustracija s izmijenjenim detaljima,
stablima i sjenama. Približna registracija kroz 20 ručno očitanih zajedničkih
orijentira dokumentirana je u `scripts/data/proposal-ground-registration.json`.
Thin-plate spline mijenja isključivo UV koordinate teksture. Trasa, čestice,
visine izvornog terena i sve položajne geometrije ne dolaze iz AI slike.

Podloga se može prebaciti na izvorni ortofoto. Izvan pokrivanja ilustracije
ostaje izvorna fotografija, umjesto rastezanja rubnih piksela. Oba rastera
sadrže vlastite sjene. Isključivanje novih 3D stabala ne uklanja stabla već
nacrtana u ilustraciji; za usporedbu izvornog stanja treba odabrati ortofoto.

## Stabla

`proposal-trees.ts` zamjenjuje četiri pune kuglaste krošnje jednim skupom
instancirane geometrije: suženo deblo, pet osnovnih grana i deset ogranaka,
te 1.890 sitnih listovnih ploha u devet nepravilnih skupina po krošnji.
Prikaz je determinističan, s varijacijom zakreta, visine i boje. Veličina
krošnje i sadni položaji ostaju definirani podacima prijedloga. To je
prirodniji idejni oblik, ne botanička ili vremenska simulacija rasta.
Postojeće skupine ostaju približni pojasevi, bez izmišljanja inventara
debala i izmjerenih visina. Sjene nisu stručni proračun osunčanja.

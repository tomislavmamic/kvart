# Idejni prikaz rekreativne zone Dračevac

Generirano 22. 9. 2026. ugrađenim alatom `image_gen` (jedna generacija).
Datoteka: `public/prijedlozi/rekreacija-koncept.png`.

Prikaz je ilustracija mogućeg uređenja, a ne snimka izvedenog stanja, geodetski
nacrt ni odobren projekt. Mjerodavni su zasebna karta, izvorni podaci i terenska
provjera. Prikaz ne potvrđuje izvedivost sadnje ili položaj instalacija.

Ulazi:

- DGU ortofoto: `public/prijedlozi/rekreacija-ortofoto.jpg`, okvir EPSG:3765
  500020, 4820710, 500220, 4820880; izvornu snimku s oznakom izvora stranica
  prikazuje zasebno.
- Izrez GUP-a: `public/prijedlozi/rekreacija-gup.png`, R2 iz prijedloga izmjena
  GUP-a 2024., točka 1.15.
- Granica obuhvata (oko 2.238 m²), postojeće sprave i osam radnih kandidata za
  stabla: `public/geo/prijedlozi/rekreacija.geojson`.

## Konačni prompt

```text
Use case: sketch-to-render.
Asset type: one aerial landscape concept illustration for a Croatian neighbourhood proposal webpage.
Primary request: create a polished, realistic bird's-eye architectural landscape render of a modest proposed upgrade to the existing recreation pocket in Dračevac, Split, using the two input references. This is a concept, not a photograph of completed construction.
Inputs: Image 1 is the north-up DGU orthophoto, 1200 × 1020 pixels, giving actual existing roads, buildings, parking, playground and site context. Image 2 is a land-use plan; use ONLY its small pale-green R2 pocket as location/shape guidance, never reproduce its graphics or labels.
Camera/composition: near-vertical bird's-eye, north up, a slight architectural oblique angle is acceptable. Keep enough surrounding context to identify the east–west road above the site, the large white-roofed hall across that road, the curved north–south road immediately east of the site, houses west and south, and the rounded large building southeast. Keep the real footprint and scale of the surrounding road network and buildings.
Exact intervention footprint: only the small irregular 2,238 m² R2 pocket, roughly 58m across by 58m tall, south of the east–west road and west of the curving road. In Image 1 pixel coordinates its boundary is [(472,298),(484,334),(484,496),(496,568),(550,616),(586,610),(610,526),(682,466),(784,448),(820,406),(820,292),(760,268),(538,268)]. This forms a wider upper part and narrow southwestern tail. Keep all proposed new landscaping INSIDE that pocket. Do not transform adjacent homes, streets, or surrounding land into park. Replace selected internal hardstanding/parking with modest planted areas and a simple accessible walking route, retaining the small existing play and exercise facilities near the southeast and lower-center parts of the pocket.
Programme: a small everyday neighbourhood park with exactly eight new broad-canopy Mediterranean shade trees, a simple light-toned permeable walking path connecting accessible entrances, a few timber benches in shade, one modest drinking-water fountain, small planted drought-tolerant beds and some open ground, modest safe play surfacing around the existing playground equipment at Image 1 pixels (728–783,418–447), existing outdoor exercise bars near (612,488). Tree candidates in Image 1 are (624,378),(708,414),(792,330),(576,354),(588,462),(660,450),(564,546),(756,402); follow these approximate positions and existing features without overstating survey precision. Show plausible mature shade while keeping paths and small play equipment visible.
Style/materials: professional but restrained photorealistic landscape design visualization, Mediterranean Split limestone context, realistic small scale, low stone edges, pale gravel/permeable paving, dry-climate planting, naturally varied foliage, existing neutral roofs. Soft clear daylight with gentle shadows.
Constraints: ONE final image only. No text, letters, labels, measurement numbers, drawn polygon boundary, map overlays, logos or watermark. No giant courts, stadium, full-size football pitch, swimming pool, new buildings, dense forest, grand plazas, decorative roof structures or new large parking lots. Preserve surrounding street and building layout, keep it recognizably the same place.
```

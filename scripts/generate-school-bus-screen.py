#!/usr/bin/env python3
"""Build the bus-stop screening from authored candidates and existing GIS.

Requires Shapely and pyproj. Locations and approach directions are concepts,
not approved bus bays, swept paths, or a complete operating route.
"""
import json
import statistics
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/geo/prijedlozi'
project = Transformer.from_crs(4326, 3765, always_xy=True).transform


def read(path):
    return json.loads((ROOT / path).read_text())['features']


def feature(geometry, **properties):
    return {'type': 'Feature', 'geometry': geometry, 'properties': properties}


report = json.loads((ROOT / 'scripts/data/school-bus-stops.json').read_text())
public = read('public/geo/analiza/javne-cestice.geojson')
addresses = read('public/geo/grad/adrese.geojson')
clip = box(16.4890, 43.5239, 16.5064, 43.5292)
features = []

for candidate in report['candidates']:
    bilice = candidate['neighborhood'] == 'bilice'
    selected = [
        item for item in addresses
        if ('BILICE' in item['properties']['ulica'].upper() if bilice
            else item['properties']['ulica'].upper() == 'DRAČEVAC')
    ]
    point = transform(project, Point(candidate['coordinate']))
    distances = [point.distance(transform(project, shape(item['geometry']))) for item in selected]
    candidate['catchment'] = {
        'source': '/geo/grad/adrese.geojson',
        'method': 'Ravna zračna udaljenost do GIS adrese u EPSG:3765; nije hodna ruta.',
        'addressSelection': 'Ulica sadrži BILICE (Bilice I i II)' if bilice else 'Ulica točno DRAČEVAC',
        'totalAddresses': len(distances),
        'within300m': sum(distance <= 300 for distance in distances),
        'within500m': sum(distance <= 500 for distance in distances),
        'medianDistanceM': round(statistics.median(distances)),
        'maximumDistanceM': round(max(distances)),
        'limitation': 'Adrese nisu popis kućanstava ni učenika. Udaljenosti ne potvrđuju siguran pješački put.',
    }
    parcel = next(item for item in public if item['properties']['parcel_id'] == candidate['parcel'])
    assert shape(parcel['geometry']).covers(Point(candidate['coordinate'])), candidate['id']
    assert parcel['properties']['public_level'] == candidate['publicLevel'], candidate['id']
    features.append(feature(
        mapping(Point(candidate['coordinate'])), role='stop-candidate',
        candidate_id=candidate['id'], label=candidate['label'],
        evidence=candidate['evidence'], reason=candidate['reason'],
        direction=candidate['direction'], parcel=candidate['parcel'], status=candidate['status'],
    ))

for alternative in report['alternatives']:
    role = 'stop-rejected' if alternative['status'] == 'relocate-for-recreation' else 'stop-earlier'
    features.append(feature(
        mapping(Point(alternative['coordinate'])), role=role,
        candidate_id=alternative['id'], label=alternative['label'],
        reason=alternative['reason'], parcel=alternative['parcel'], status=alternative['status'],
    ))

for item in public:
    if item['properties']['parcel_id'] not in report['publicParcels']:
        continue
    geometry = shape(item['geometry']).intersection(clip)
    if not geometry.is_empty:
        features.append(feature(mapping(geometry), **{
            **item['properties'], 'role': 'public-parcel',
            'label': item['properties']['parcel_id'], 'evidence': report['ownershipEvidence'],
        }))

for index, item in enumerate(read('public/geo/ceste-sve.geojson')):
    properties = item['properties']
    if properties.get('postojece') is not True or properties.get('highway') in ['footway', 'steps', 'path', 'track']:
        continue
    geometry = shape(item['geometry']).intersection(clip)
    if not geometry.is_empty:
        features.append(feature(mapping(geometry), **{
            **properties, 'role': 'existing-road', 'source_index': index,
            'label': properties.get('name', 'Postojeća cesta'),
        }))

for item in read('public/geo/planovi/dpu-kolnici.geojson'):
    features.append(feature(item['geometry'], **{
        **item['properties'], 'role': 'planned-road', 'label': 'Planirani DPU kolnik',
    }))
for item in read('public/geo/prijedlozi/rekreacija.geojson'):
    if item['properties'].get('role') == 'recreation-zone':
        features.append(item)

for path, role, label in [
    ('nogostupi', 'existing-sidewalk', 'Evidentirani nogostup'),
    ('pjesacki-prijelazi', 'existing-crossing', 'Evidentirani pješački prijelaz'),
]:
    for item in read(f'public/geo/grad/{path}.geojson'):
        geometry = shape(item['geometry']).intersection(clip)
        if not geometry.is_empty:
            features.append(feature(mapping(geometry), **{**item['properties'], 'role': role, 'label': label}))

for overlay in report.get('overlays', []):
    features.append(feature(overlay['geometry'], **overlay['properties']))

assert all(not shape(item['geometry']).is_empty and shape(item['geometry']).is_valid for item in features)
(OUT / 'skolski-autobus.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
(OUT / 'skolski-autobus.geojson').write_text(json.dumps({
    'type': 'FeatureCollection', 'features': features,
}, ensure_ascii=False, separators=(',', ':')) + '\n')
print({'candidates': [item['id'] for item in report['candidates']], 'features': len(features)})

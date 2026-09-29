#!/usr/bin/env python3
"""Extract proposal geometry and a preliminary planting screen from local GIS.

Run: python3 scripts/generate-proposal-geodata.py
Requires pyproj and Shapely. The 3 m utility screen is a working assumption,
not a legal setback or a determination that excavation/planting is safe.
"""
import json
import gzip
import array
import sys
import math
import re
from pathlib import Path

import shapely
from pyproj import Transformer
from shapely.geometry import Point, LineString, box, mapping, shape
from shapely.ops import substring, transform, unary_union

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "public/geo"
TO_METRES = Transformer.from_crs(4326, 3765, always_xy=True).transform
TO_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform
UTILITY_LAYERS = {
    "vodovod": "Vodovod",
    "odvodnja": "Odvodnja",
    "odvodnja-tlacni": "Tlačna odvodnja",
    "struja-nn": "Podzemna niskonaponska mreža",
    "struja-sn": "Podzemna srednjonaponska mreža",
    "telekom-ht-podzemno": "HT podzemna mreža",
    "telekom-trase": "Telekom kanalizacija (DTK)",
}


def read(name):
    return json.loads((GEO / f"{name}.geojson").read_text())["features"]


def metres(feature):
    return transform(TO_METRES, shape(feature["geometry"]))


def feature(original, role, source, **properties):
    return {"type": "Feature", "geometry": original["geometry"],
            "properties": {**original["properties"], "role": role,
                           "source": source, **properties}}


def write(path, value, indent=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=indent,
                               separators=None if indent else (",", ":")) + "\n")


def mapped_feature(geometry, **properties):
    return {"type": "Feature", "geometry": mapping(transform(TO_WGS, geometry)),
            "properties": properties}


def infrastructure(geometries, metadata, boundary):
    features = []
    for geometry, info in zip(geometries, metadata):
        if not geometry.intersects(boundary):
            continue
        clipped = geometry.intersection(boundary)
        if clipped.length > 0.1:
            features.append(mapped_feature(clipped, **info, role="infrastructure"))
    return features


def dpu_evidence():
    record = next(f for f in read("grad/planovi-obuhvat-pp")
                  if f["properties"].get("naziv") == "Izmjena i dopuna DPU-a radne zone Dračevac")
    boundary = metres(record)
    source = "/geo/grad/planovi-obuhvat-pp.geojson"
    output = [feature(record, "dpu-boundary", source, source_path=source,
                      source_url=record["properties"]["poveznica"], plan_status="in-force",
                      label="Obuhvat važećeg DPU-a radne zone Dračevac")]
    surfaces = {}
    for name, role in (("dpu-nogostupi", "dpu-sidewalk"), ("dpu-kolnici", "dpu-road")):
        records = read(f"planovi/{name}")
        valid = [f for f in records if f["geometry"]["type"] in ("Polygon", "MultiPolygon")]
        if len(valid) != len(records):
            raise ValueError(f"Audited DPU surfaces must be polygons: {name}")
        surfaces[role] = unary_union([metres(f) for f in valid
                                     if f["properties"].get("level") == "surface"])
        path = f"/geo/planovi/{name}.geojson"
        output += [feature(f, role, path, source_path=path) for f in valid]
    return output, surfaces, boundary


def dpu_summary(target, boundary, surfaces):
    covered = target.intersection(boundary)
    is_line = target.geom_type.endswith("LineString")
    measure = covered.length if is_line else covered.area
    total = target.length if is_line else target.area
    return {"source_path": "/geo/grad/planovi-obuhvat-pp.geojson",
            "source_url": "https://www.split.hr/ukljuci-se/prostorno-planska-dokumentacija/planovi-na-snazi/dpu-i-na-snazi",
            "plan_status": "in-force", "bounds": list(transform(TO_WGS, boundary).bounds),
            "target_covered_length_m" if is_line else "target_covered_area_m2": round(measure, 1),
            "coverage_percent": round(100 * measure / total, 1),
            "sidewalk_area_m2_within_target": round(surfaces["dpu-sidewalk"].intersection(
                target.buffer(15) if is_line else target).area, 1),
            "road_area_m2_within_target": round(surfaces["dpu-road"].intersection(
                target.buffer(15) if is_line else target).area, 1),
            "note": "Prikazan je cijeli dostupni DPU, uključujući zapadni dio izvan početnog pogleda. Izvan njegova obuhvata ovaj plan ne daje uvjete."}


def ownership_lookup(parcels, parcel_geometries):
    parcel_tree = shapely.STRtree(parcel_geometries)
    public = {f["properties"]["parcel_id"]: f["properties"] for f in read("analiza/javne-cestice")}
    verified = {f["properties"]["parcel_id"]: f["properties"]
                for f in read("analiza/ciljana-provjera-vlasnistva")}

    def ownership(point):
        records = []
        for index in parcel_tree.query(point, predicate="intersects"):
            props = parcels[int(index)]["properties"]
            key = f"{props.get('ko')}:{props.get('cestica')}"
            record = {"parcel_id": key, "parcel_number": props.get("cestica"),
                      "ownership_status": "unknown", "source": None}
            if key in verified:
                evidence = verified[key]
                record.update(ownership_status=evidence["verification_status"],
                              evidence_source=evidence["evidence_source"],
                              public_entities=evidence["public_entities"],
                              verified_at=evidence["verified_at"],
                              source="/geo/analiza/ciljana-provjera-vlasnistva.geojson")
            elif key in public:
                evidence = public[key]
                record.update(ownership_status="city-gis-public-record",
                              public_level=evidence["public_level"],
                              source_updated_at=evidence["source_updated_at"],
                              source="/geo/analiza/javne-cestice.geojson")
            records.append(record)
        return records
    return ownership


def municipal_route():
    # Stable junction coordinates identify the municipal records even if reordered.
    nodes = [(16.500932, 43.527420), (16.501142, 43.527451),
             (16.502021, 43.527441), (16.502054, 43.527441),
             (16.502600, 43.527488), (16.504915, 43.527755),
             (16.506380, 43.527270)]
    roads = read("grad/ceste-nerazvrstane")
    coordinates, indices = [], []
    for start, end in zip(nodes, nodes[1:]):
        matches = []
        for index, road in enumerate(roads):
            if road["properties"].get("ulica") != "Dračevac":
                continue
            points = road["geometry"]["coordinates"]
            for sequence in (points, list(reversed(points))):
                if math.dist(sequence[0], start) < 1e-8 and math.dist(sequence[-1], end) < 1e-8:
                    matches.append((index, sequence))
        if len(matches) != 1:
            raise ValueError(f"Ambiguous or missing municipal road segment: {start} → {end}")
        index, points = matches[0]
        indices.append(index)
        coordinates.extend(points if not coordinates else points[1:])
    return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": coordinates},
            "properties": {"name": "Dračevac", "source_indices": indices}}


def parcel_key(record):
    p = record["properties"]
    return f"{p['ko']}:{p['cestica']}"


def road_parcel_evidence(road, axis, parcels):
    roads = read("grad/ceste-nerazvrstane")
    references = {roads[i]["properties"]["cestice"] for i in road["properties"]["source_indices"]}
    if any(not text.lower().startswith("k.o. split;") for text in references):
        raise ValueError("Road parcel references need cadastral municipality review")
    listed = {f"SPLIT:{number}" for text in references for number in re.findall(r"\d+(?:/\d+)?", text)}
    # The register lists parcels for a wider road. Only retain referenced
    # polygons that actually contain this selected route, never nearby yards.
    selected = [f for f in parcels if parcel_key(f) in listed and metres(f).intersection(axis).length > 1]
    corridor = unary_union([metres(f) for f in selected])
    available = unary_union([metres(f) for f in parcels if metres(f).intersects(axis)])
    return selected, corridor, {
        "source": "/geo/grad/katastar.geojson", "road_register_source": "/geo/grad/ceste-nerazvrstane.geojson",
        "parcel_ids": [parcel_key(f) for f in selected],
        "register_references": sorted(references),
        "covered_length_m": round(axis.intersection(corridor).length, 1),
        "unconfirmed_length_m": round(axis.intersection(available).difference(corridor).length, 1),
        "missing_cadastre_length_m": round(axis.difference(available).length, 1),
        "records": [{"parcel_id": parcel_key(f), "parcel_number": f["properties"]["cestica"],
                     "cadastral_municipality": f["properties"]["ko"],
                     "route_length_m": round(axis.intersection(metres(f)).length, 1)} for f in selected],
    }


def parcel_context(parcels, context, road_ids, project_ids=()):
    result = []
    for record in parcels:
        geometry = metres(record)
        visible = geometry.intersection(context)
        if visible.area < 1:
            continue
        key = parcel_key(record)
        role = "road-parcel" if key in road_ids else "project-parcel" if key in project_ids else "parcel"
        label = transform(TO_WGS, visible.representative_point())
        result.append(feature(record, role, "/geo/grad/katastar.geojson", parcel_id=key,
                              label_coordinates=list(label.coords[0]), area_m2=round(geometry.area, 1)))
    return result


def recreation_program(zone):
    """Working footprints from the orthophoto and the user's northeast views."""
    x0, y0, _, _ = zone.bounds
    def rectangle(west, south, east, north):
        return box(x0+west, y0+south, x0+east, y0+north)
    areas = [
        ("proposal-cageball", "Veći cageball · srednja terasa", rectangle(14, 25.5, 36, 34.5), "Radna ploha 22 × 9 m povučena od postojeće sadnje; konačne dimenzije nakon snimke debala i zaštitnih zona."),
        ("proposal-gym", "Teretana · gornja terasa", rectangle(18, 18, 26, 24), "Kompaktna ploha 8 × 6 m uz postojeće vježbalište, izvan vidljivih zelenih otoka."),
        ("proposal-playground", "Dječje igralište · cijela donja terasa", rectangle(5, 41, 54, 54), "Cijela niža parkirna terasa namjenjuje se dječjoj igri, s prolazima i prostorom za pratnju."),
        ("proposal-parking", "3 mjesta zapadno od donje terase", rectangle(-12, 44, -3, 55), "Povezani zahvat izvan R2, na dijelovima 419/1 i 419/9. Tri radna mjesta, jedno pristupačno; pristup i manevar provjeriti prometnim projektom."),
    ]
    features, occupied = [], []
    for role, label, geometry, note in areas:
        if role != "proposal-parking" and not zone.covers(geometry):
            raise ValueError(f"Recreation concept falls outside R2: {role}")
        occupied.append(geometry)
        features.append(mapped_feature(geometry, role=role, label=label,
                        area_m2=round(geometry.area), schematic=True, source=note))
    path = LineString([(x0+x, y0+y) for x,y in [(3,48),(3,42),(4,32),(5,23),(7,12),(10,8),(14,7)]])
    path_area = path.buffer(1.2).intersection(zone)
    if any(path_area.intersection(area).area > 0.01 for area in occupied):
        raise ValueError("The proposed connection crosses an activity area")
    promenade = path.buffer(4).intersection(zone).difference(unary_union(occupied))
    occupied.append(path_area)
    features.append(mapped_feature(promenade, role="proposal-promenade", label="Bočna cesta postaje zelena šetnica",
                    schematic=True, source="Prenamjena bočne ceste uz zapadnu zgradu: stabla, grmlje i klupe uz prohodnu stazu. Očuvati nužan pristup zgradama i službama."))
    features.append(mapped_feature(path_area, role="proposal-path", label="Pješačka staza · 2,4 m",
                    schematic=True, source="Radna trasa širine 2,4 m; visinske prijelaze, pristupačnost i službeni pristup razraditi projektom."))
    wall = LineString([(x0+x, y0+y) for x,y in [(12.9,0),(19,1),(23,15),(34.9,25),(52,28),(58,35)]])
    features.append(mapped_feature(wall, role="terrain-edge", label="Viša južna cesta i potporni zid",
                    schematic=True, source="Rub približan prema obuhvatu R2, ortofotu i fotografijama; zid i kote treba snimiti."))
    # Check both orientations parallel to the existing court. This is a footprint
    # check, not proof of buildability on a surveyed, level platform.
    middle = rectangle(12, 24, 55, 40).intersection(zone)
    free_middle = middle.difference(areas[0][2].buffer(1))
    padel_fits = any(free_middle.covers(rectangle(x,y,x+w,y+h).buffer(1))
                     for w,h in [(20,10),(10,20)]
                     for x in range(12,56) for y in range(24,41))
    return features, unary_union(occupied), {
        "cageball_courts": 1, "outdoor_gyms": 1, "retained_parking_spaces": 3,
        "cageball_area_m2": 198, "cageball_dimensions_m": [22,9], "gym_area_m2": 48, "playground_area_m2": 637,
        "parking_outside_r2": True, "pedestrian_path_width_m": 2.4,
        "padel": {"included": False, "fits_working_middle_terrace": padel_fits,
                  "court_dimensions_m": [20,10], "source": "https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel-1.pdf",
                  "note": "Uz veći cageball i prolaze nije pronađeno mjesto za 20 × 10 m u obje orijentacije usporedne s postojećim terenom. Provjeriti nakon snimke; padel nije prikazan."},
        "status": "concept", "terrain": "Dječja igra dolje, cageball na srednjoj terasi, teretana na gornjoj. Južna cesta ostaje iznad parka i iza potpornog zida.",
        "note": "Dimenzije su radni prostorni raspored. Kote, stabilnost zida, pristupačnost, promet, sigurnosne razmake i instalacije treba razraditi projektom.",
    }


def intervals_union(intervals, tolerance=0.01):
    merged = []
    for start, end in sorted(intervals):
        if end <= start:
            continue
        if merged and start <= merged[-1][1] + tolerance:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def direction(line, chainage):
    before = line.interpolate(max(0, chainage - 0.5))
    after = line.interpolate(min(line.length, chainage + 0.5))
    dx, dy = after.x - before.x, after.y - before.y
    length = math.hypot(dx, dy)
    return (dx / length, dy / length) if length else (0, 0)


def sidewalk_evidence(axis, display_boundary=None):
    boundary = display_boundary if display_boundary is not None else axis.buffer(15)
    visible, footprints, runs = [], [], []
    coverage = {"left": [], "right": []}
    for index, record in enumerate(read("grad/nogostupi")):
        line = metres(record)
        width = float(record["properties"]["sirina"])
        footprints.append(line.buffer(width / 2, cap_style=2))
        clipped = line.intersection(boundary)
        if clipped.length <= 0.1:
            continue
        visible.append(mapped_feature(clipped, **record["properties"], role="existing-sidewalk",
                                       source="/geo/grad/nogostupi.geojson", source_index=index,
                                       length_m=round(clipped.length, 1)))
        active = None
        for sample in range(math.ceil(line.length)):
            end = min(sample + 1, line.length)
            point = line.interpolate((sample + end) / 2)
            chainage = axis.project(point)
            centre = axis.interpolate(chainage)
            dx, dy = direction(axis, chainage)
            sx, sy = direction(line, (sample + end) / 2)
            angle = math.degrees(math.acos(min(1, abs(dx * sx + dy * sy))))
            signed = (point.x - centre.x) * -dy + (point.y - centre.y) * dx
            accepted = (0.5 < chainage < axis.length - 0.5 and point.distance(centre) <= 10
                        and angle <= 35 and abs(signed) > 0.2)
            side = "left" if signed > 0 else "right"
            if not accepted:
                active = None
                continue
            q0, q1 = axis.project(line.interpolate(sample)), axis.project(line.interpolate(end))
            coverage[side].append([min(q0, q1), max(q0, q1)])
            if active is None or active["side"] != side:
                active = {"source_index": index, "width_m": width, "side": side,
                          "start": sample, "end": end, "from_m": min(q0, q1), "to_m": max(q0, q1),
                          "line": line}
                runs.append(active)
            else:
                active["end"] = end
                active["from_m"] = min(active["from_m"], q0, q1)
                active["to_m"] = max(active["to_m"], q0, q1)
    coverage = {side: intervals_union(intervals) for side, intervals in coverage.items()}
    gaps = {}
    for side, intervals in coverage.items():
        cursor, missing = 0, []
        for start, end in intervals:
            if start > cursor:
                missing.append([cursor, start])
            cursor = max(cursor, end)
        if cursor < axis.length:
            missing.append([cursor, axis.length])
        gaps[side] = missing
    records = []
    for run in runs:
        run["geometry"] = substring(run["line"], run["start"], run["end"])
        records.append({key: run[key] for key in ("source_index", "width_m", "side")} |
                       {"length_m": round(run["geometry"].length, 1),
                        "from_m": round(run["from_m"], 1), "to_m": round(run["to_m"], 1)})
    existing_m = sum(end - start for intervals in coverage.values() for start, end in intervals)
    gap_m = sum(end - start for intervals in gaps.values() for start, end in intervals)
    summary = {"existing_length_m": round(sum(run["geometry"].length for run in runs), 1),
               "existing_coverage_m": round(existing_m, 1), "gap_length_m": round(gap_m, 1),
               "records": records,
               "sides": [{"side": side, "existing_m": round(sum(b-a for a,b in coverage[side]), 1),
                          "gap_m": round(sum(b-a for a,b in gaps[side]), 1),
                          "existing_intervals": [[round(a,1),round(b,1)] for a,b in coverage[side]],
                          "gap_intervals": [[round(a,1),round(b,1)] for a,b in gaps[side]]}
                         for side in ("left", "right")],
               "method": "Gradske linije nogostupa i atribut sirina; uzorkovanje po 1 m, usporedba smjera do 35° i udaljenosti do 10 m od gradske osi. Okvir prolaza pretpostavlja liniju u sredini širine (sirina/2 sa svake strane). Razmaci bez evidencije nisu potvrda da nogostup na terenu nedostaje."}
    return visible, unary_union(footprints), runs, coverage, gaps, summary


def roadside(road, axis, utility_geometries, utility_metadata, utility_tree,
             ownership, building_geometries, dpu_features, dpu_surfaces, road_clearance,
             equipment_geometry, dpu_boundary, parcels, road_parcels, road_corridor):
    boundary = axis.buffer(15)
    output = [feature(road, "road", "/geo/grad/ceste-nerazvrstane.geojson", length_m=round(axis.length, 1))]
    output += infrastructure(utility_geometries, utility_metadata,
                             unary_union([boundary, dpu_boundary])) + dpu_features
    visible, actual_passage, runs, coverage, gaps, sidewalk_summary = sidewalk_evidence(
        axis, unary_union([boundary, dpu_boundary]))
    output += visible
    output += parcel_context(parcels, boundary, {parcel_key(f) for f in road_parcels})
    unresolved = axis.difference(road_corridor)
    if not unresolved.is_empty:
        output.append(mapped_feature(unresolved, role="unresolved-road-parcels",
                      source="Za ovaj dio trase cestovna čestica nije potvrđena dostupnim podacima; stabla nisu predložena."))
    observations = json.loads((ROOT / "scripts/data/sidewalk-tree-retention.json").read_text())
    west,south,east,north = observations["bbox_3765"]
    width,height = observations["image_size"]
    def observed_area(record):
        return LineString([(west+x/width*(east-west), north-y/height*(north-south))
                           for x,y in record["pixels"]]).buffer(record["buffer_m"])
    retained = unary_union([observed_area(record) for record in observations["groups"]])
    access = unary_union([observed_area(record) for record in observations["access_gaps"]])
    planting_exclusions = retained.union(access)
    for record in observations["groups"]:
        output.append(mapped_feature(observed_area(record), role="retained-trees",
                      retention_id=record["id"], label=record["label"], approximate=True,
                      source=observations["source"], action="Postojeću sadnju zadržati; debla i korijenje snimiti prije radova."))
    planned = []
    for side, sign in (("left", 1), ("right", -1)):
        for start, end in gaps[side]:
            if end - start < 0.01:
                continue
            portion = substring(axis, start, end)
            strip = portion.buffer(sign * 4.8, single_sided=True).difference(
                portion.buffer(sign * 3, single_sided=True)).difference(actual_passage).difference(
                    unary_union(list(dpu_surfaces.values()))).intersection(road_corridor)
            # Remove sub-millimetre overlay slivers before the WGS84 round trip.
            strip = shapely.set_precision(strip, 0.001)
            if strip.is_empty:
                continue
            planned.append(strip)
            output.append(mapped_feature(
                strip, role="planned-sidewalk", side=side, width_m=1.8,
                from_m=round(start, 1), to_m=round(end, 1),
                inner_offset_m=3, outer_offset_m=4.8, schematic=True,
                evidence_status="not-recorded", source="Shema dopune samo gdje nema podudarne gradske evidencije; nedostatak nogostupa treba provjeriti na terenu."))
    passage = unary_union([actual_passage, *planned, *dpu_surfaces.values(), road_clearance])
    building_tree = shapely.STRtree(building_geometries)
    sections = [{"id": index + 1, "from_m": index * 200,
                 "to_m": round(min(axis.length, (index + 1) * 200), 1),
                 "suggested": 0, "conflict": 0, "excluded_buildings": 0,
                 "excluded_sidewalks": 0, "excluded_parcels": 0, "unknown_ownership": 0}
                for index in range(math.ceil(axis.length / 200))]
    for section in sections:
        def covered(intervals):
            return sum(max(0, min(b, section["to_m"]) - max(a, section["from_m"]))
                       for side in intervals.values() for a, b in side)
        section["existing_sidewalk_m"] = round(covered(coverage), 1)
        section["gap_m"] = round(covered(gaps), 1)
    selected, candidates = [], []
    last_conflict = {"left": -100, "right": -100}
    for chainage in range(8, int(axis.length), 10):
        centre = axis.interpolate(chainage)
        dx, dy = direction(axis, chainage)
        section = sections[min(chainage // 200, len(sections) - 1)]
        for side, sign in (("left", 1), ("right", -1)):
            matching = [run for run in runs if run["side"] == side
                        and run["from_m"] <= chainage <= run["to_m"]]
            source_index, alternatives = None, []
            if matching:
                run = min(matching, key=lambda item: item["geometry"].distance(centre))
                walk = run["geometry"]
                origin = walk.interpolate(walk.project(centre))
                road_point = axis.interpolate(axis.project(origin))
                nx, ny = origin.x - road_point.x, origin.y - road_point.y
                normal = math.hypot(nx, ny)
                for extra in (1.1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5):
                    offset = run["width_m"] / 2 + extra
                    alternatives.append((Point(origin.x + nx / normal * offset,
                                               origin.y + ny / normal * offset), extra))
                basis = "existing-sidewalk"
                source_index = run["source_index"]
            else:
                for offset in (6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12):
                    alternatives.append((Point(centre.x - sign * dy * offset,
                                               centre.y + sign * dx * offset), offset))
                basis = "gap-concept"
            alternatives = [(point, offset) for point, offset in alternatives
                            if road_corridor.covers(point.buffer(1))]
            if not alternatives:
                section["excluded_parcels"] += 1
                continue
            feasible = []
            for point, offset in alternatives:
                if not boundary.covers(point.buffer(1)) or point.buffer(1).intersects(passage) or point.buffer(1).intersects(planting_exclusions):
                    continue
                building_distance = point.distance(building_geometries[int(building_tree.nearest(point))])
                if (building_distance < 3 or point.distance(equipment_geometry) < 5
                        or any(point.distance(other) < 8 for other in selected)):
                    continue
                index = int(utility_tree.nearest(point))
                distance = point.distance(utility_geometries[index])
                records = ownership(point)
                has_public = bool(records) and all(r["ownership_status"] in
                    ("city-gis-public-record", "confirmed_public", "cadastre_public")
                    or bool(r.get("public_entities")) for r in records)
                feasible.append((point, offset, distance, index, records, has_public, building_distance))
            if not feasible:
                if all(point.buffer(1).intersects(passage) for point, _ in alternatives):
                    section["excluded_sidewalks"] += 1
                else:
                    section["excluded_buildings"] += 1
                continue
            clear = [candidate for candidate in feasible if candidate[2] >= 3]
            if clear:
                # Public provenance first, then the least outward movement; do not
                # maximize distance by pushing every tree deep into private land.
                chosen = min(clear, key=lambda item: (not item[5], item[1], -item[2]))
                result = "suggested"
            else:
                if chainage - last_conflict[side] < 10:
                    continue
                chosen = min(feasible, key=lambda item: (not item[5], -item[2], item[1]))
                result = "conflict"
                last_conflict[side] = chainage
            point, offset, distance, index, records, _, building_distance = chosen
            selected.append(point)
            unknown = not records or any(r["ownership_status"] in ("unknown", "unresolved") for r in records)
            section[result] += 1
            section["unknown_ownership"] += int(unknown)
            props = dict(role="proposed-tree", candidate_id=f"D{len(candidates)+1}",
                screen_result=result, status="needs-soil-and-utility-design", side=side,
                chainage_m=chainage, section_id=section["id"],
                passage_basis=basis, nearest_sidewalk_source_index=source_index,
                tree_pit_radius_m=1,
                canopy_radius_m=5 if road_corridor.covers(point.buffer(1.75)) and building_distance >= 5.5 else 4 if building_distance >= 4.5 else 3,
                canopy_note="Krošnja promjera 6–10 m ilustrira budući razvoj, ne trenutačnu veličinu sadnice ni proračun sjene.",
                soil_note="Krug otvorenog tla nije ukupni prostor korijena. Projektirati povezano tlo ispod zelenih traka i propusnih površina bez sužavanja nogostupa.",
                passage_distance_m=round(point.distance(passage), 2),
                nearest_utility=utility_metadata[index], nearest_utility_distance_m=round(distance, 2),
                building_distance_m=round(building_distance, 2), parcels=records,
                planting_parcel_ids=[parcel_key(f) for f in road_parcels
                                    if metres(f).intersection(point.buffer(1)).area > .001],
                parcel_fit="road-parcels", parcel_boundary_distance_m=round(point.distance(road_corridor.boundary), 2),
                ownership_status="unknown" if unknown else "evidence-available",
                search_offset_m=offset,
                action=f"{utility_metadata[index]['label']}: provjeriti točnu trasu i dubinu; bez boljeg položaja uvjetovati sadnju suglasnošću upravitelja ili projektom prelaganja."
                       if result == "conflict" else
                       "Prvo provjeriti vlasništvo i mogućnost sadnje, zatim trase i sadni prostor na terenu."
                       if unknown else "Kandidat za terensku provjeru trase i sadnog prostora.",
                source="Radni položaj uz vanjski rub evidentiranog nogostupa." if matching
                       else "Radni položaj uz shemu dopune na intervalu bez evidencije; provjeriti stvarno stanje.")
            item = mapped_feature(point, **props)
            output.append(item)
            output.append(mapped_feature(point.buffer(props["canopy_radius_m"]), role="proposal-canopy",
                          candidate_id=props["candidate_id"], label=f"{props['candidate_id']} · buduća krošnja",
                          source=props["canopy_note"], conditional=True))
            candidates.append({**props, "coordinates": list(item["geometry"]["coordinates"])})
    screen = {"axis_source": "/geo/grad/ceste-nerazvrstane.geojson", "tree_offset_m": 6,
              "tree_interval_m": 10, "conditional_minimum_interval_m": 10,
              "axis_search_offsets_m": [6, 12], "sidewalk_search_offsets_m": [1.1, 7.5],
              "existing_sidewalk_outer_offset_m": 1.1, "tree_spacing_m": 8,
              "tree_pit_radius_m": 1, "utility_distance_m": 3, "building_distance_m": 3,
              "equipment_distance_m": 5,
              "shade": {"previous_candidate_count": 19, "retained_groups": len(observations["groups"]),
                        "source": observations["source"], "source_complete": False,
                        "access_gaps_checked": len(observations["access_gaps"]),
                        "canopy_diameters_m": [6,8,10],
                        "canopy_counts": {str(d): sum(c["canopy_radius_m"]*2 == d for c in candidates) for d in [6,8,10]},
                        "note": "Gušća sadnja s radnim razmakom od oko 10 m, uz postojeće skupine i prekide za prilaze. Veće krošnje samo gdje odmak od zgrada i sadni prostor to dopuštaju; sav korijenski prostor i instalacije razraditi projektom."},
              "sidewalk_width_m": 1.8, "sidewalk_inner_offset_m": 3,
              "sidewalk_outer_offset_m": 4.8, "sections": sections, "candidates": candidates,
              **{key: sum(s[key] for s in sections) for key in
                 ("suggested", "conflict", "excluded_buildings", "excluded_sidewalks", "excluded_parcels", "unknown_ownership")},
              "assumed_carriageway_half_width_m": 3,
              "note": "Cijeli krug sadnje polumjera 1 m mora stati u dostupnu cestovnu česticu koja je navedena u gradskom registru i preklapa odabranu trasu. Na koracima od 10 m tražena su alternativna mjesta izvan nogostupa, radnih dopuna, prometnih ploha DPU-a, vidljive postojeće sadnje i očitanih prilaza. Uz gradske osi korišten je radni odmak 3 m, bez tvrdnje o snimljenoj širini kolnika. Razmak 3 m od vodova radni je probir. Izvan potvrđenih cestovnih čestica stabla nisu predložena; trase, dubine i izvedivost trebaju provjeru."}
    return output, screen, sidewalk_summary


def proposal_scene(features, kind="nogostupi"):
    """Shared georeferenced terrain; enhanced imagery changes UVs, never positions."""
    import numpy as np
    registration = json.loads((ROOT / "scripts/data/proposal-ground-registration.json").read_text())
    source_bbox = registration["source_bbox_3765"]
    recreation = kind == "rekreacija"
    west,south,east,north = [500075,4820765,500170,4820848] if recreation else source_bbox
    image_bbox = [500020,4820710,500220,4820880] if recreation else source_bbox
    cx,cy = (west+east)/2,(south+north)/2
    header = json.loads((GEO / "reljef/visine.json").read_text())
    heights = array.array("h", gzip.decompress((GEO / "reljef/visine.bin.gz").read_bytes()))
    if sys.byteorder != "little":
        heights.byteswap()
    def altitude(x,y):
        lon,lat = TO_WGS(x,y)
        c = min(header["stupaca"]-1,max(0,(lon-header["zapad"])/(header["istok"]-header["zapad"])*(header["stupaca"]-1)))
        r = min(header["redaka"]-1,max(0,(header["sjever"]-lat)/(header["sjever"]-header["jug"])*(header["redaka"]-1)))
        ci,ri = int(c),int(r)
        c1,r1 = min(ci+1,header["stupaca"]-1),min(ri+1,header["redaka"]-1)
        vals = [heights[row*header["stupaca"]+col] for row,col in [(ri,ci),(ri,c1),(r1,ci),(r1,c1)]]
        if header["prazno"] in vals:
            raise ValueError("Missing DMR cell in proposal scene")
        u,v = c-ci,r-ri
        return ((vals[0]*(1-u)+vals[1]*u)*(1-v)+(vals[2]*(1-u)+vals[3]*u)*v)/10
    # Local level pads represent the proposed terraces, not a resurvey of the DMR.
    pads = []
    if recreation:
        for record in features:
            if record["properties"]["role"] in ("proposal-playground","proposal-cageball","proposal-gym","proposal-parking"):
                g = metres(record)
                p = g.representative_point()
                pads.append((g, round(altitude(p.x,p.y),1),record["properties"]["role"]))
    if recreation:
        middle = next(h for _,h,role in pads if role == "proposal-cageball")
        pads = [(g, max(h,round(middle+.8,1)) if role == "proposal-gym" else h,role) for g,h,role in pads]
    pad_areas = [(g.buffer(.01),h) for g,h,_ in pads]
    def ground(x,y):
        for g,h in pad_areas:
            if g.covers(Point(x,y)):
                return h
        return altitude(x,y)
    spacing = 1 if recreation else 3
    cols,rows = math.ceil((east-west)/spacing)+1,math.ceil((north-south)/spacing)+1
    xy = [(west+i/(cols-1)*(east-west),north-j/(rows-1)*(north-south)) for j in range(rows) for i in range(cols)]
    grid = [ground(x,y) for x,y in xy]
    base = math.floor(min(grid))
    def xyz(x,y,lift=0):
        return [round(x-cx,2),round(ground(x,y)-base+lift,2),round(cy-y,2)]
    # Fit only the visual texture. Feature geometry remains in EPSG:3765.
    src = np.array([p['source'] for p in registration['landmarks']],float) / registration['source_size']
    dst = np.array([p['enhanced'] for p in registration['landmarks']],float) / registration['enhanced_size']
    def kernel(a,b):
        d = ((a[:,None,:]-b[None,:,:])**2).sum(axis=2)
        return d*np.log(np.maximum(d,1e-12))
    affine = np.column_stack([np.ones(len(src)),src])
    system = np.block([[kernel(src,src)+np.eye(len(src))*1e-7,affine],[affine.T,np.zeros((3,3))]])
    coeff = np.linalg.solve(system,np.vstack([dst,np.zeros((3,2))]))
    sw,ss,se,sn = source_bbox
    sample = np.array([[(x-sw)/(se-sw),(sn-y)/(sn-ss)] for x,y in xy])
    enhanced = np.column_stack([kernel(sample,src),np.ones(len(sample)),sample]) @ coeff
    iw,iss,ie,inn = image_bbox
    original_uv = [[round((x-iw)/(ie-iw),6),round((y-iss)/(inn-iss),6)] for x,y in xy]
    enhanced_uv = [[round(float(u),6),round(1-float(v),6)] for u,v in enhanced]
    surfaces,trees,walls = [],[],[]
    context = box(west,south,east,north)
    allowed = {"existing-sidewalk","planned-sidewalk","retained-trees","road-parcel","project-parcel","recreation-zone","proposal-cageball","proposal-gym","proposal-playground","proposal-parking","proposal-path","proposal-promenade"}
    for record in features:
        props = record["properties"]; role = props["role"]; g = metres(record)
        if role == "proposed-tree":
            trees.append({"id":props["candidate_id"],"position":xyz(g.x,g.y),"radius":props["canopy_radius_m"],"soilRadius":props["tree_pit_radius_m"],"conditional":props["screen_result"] == "conflict"})
        if role == "terrain-edge" and recreation:
            line = shapely.segmentize(g,1.5)
            points = []
            for i,(x,y) in enumerate(line.coords):
                a = line.coords[max(0,i-1)]; b = line.coords[min(len(line.coords)-1,i+1)]
                length = math.hypot(b[0]-a[0],b[1]-a[1]); nx,ny = (b[1]-a[1])/length,-(b[0]-a[0])/length
                low = altitude(x-nx*2,y-ny*2); high = altitude(x+nx*2,y+ny*2)
                points.append({"position":[round(x-cx,2),round(low-base,2),round(cy-y,2)],"height":round(max(.7,high-low+.3),2)})
            walls.append({"points":points,"approximate":True})
        if role not in allowed:
            continue
        if role == "existing-sidewalk":
            g = g.buffer(float(props["sirina"])/2,cap_style=2)
        g = g.intersection(context)
        polygons = [g] if g.geom_type == "Polygon" else list(g.geoms) if g.geom_type == "MultiPolygon" else []
        for poly in polygons:
            if poly.area < .1:
                continue
            poly = shapely.segmentize(poly,1 if recreation else 3)
            surfaces.append({"role":role,"label":props.get("label",""),"rings":[[xyz(x,y,.24 if role == "proposal-path" else .18) for x,y in ring.coords] for ring in [poly.exterior,*poly.interiors]]})
    return {"version":2,"kind":kind,"projection":"EPSG:3765","origin":[cx,cy,base],"width":round(east-west,3),"depth":round(north-south,3),
            "terrain":{"cols":cols,"rows":rows,"heights":[round(h-base,2) for h in grid],"source":"DGU DMR LiDAR, izvorna mreža približno 3 m; radne ravnine sadržaja u rekreacijskoj zoni nisu snimljene kote"},
            "image":f"/prijedlozi/{kind}-ortofoto.jpg","enhancedImage":registration["enhanced_image"],"originalUV":original_uv,"enhancedUV":enhanced_uv,
            "surfaces":surfaces,"trees":trees,"walls":walls,
            "platforms":[{"role":role,"elevation_m":h} for _,h,role in pads],
            "note":"AI podloga je približno usklađena ilustracija, ne geodetski izvor. Položaji sadržaja i stabala ostaju iz izvornih podataka. Sjene su shematske; okolne zgrade i postojeća stabla nemaju izmjerene 3D visine. Terase i zid zahtijevaju geodetsku snimku."}


def main():
    parcels = read("grad/katastar")
    parcel_geometries = [metres(f) for f in parcels]
    building_geometries = [metres(f) for f in read("grad/zgrade-2025")]
    ownership_at = ownership_lookup(parcels, parcel_geometries)
    street = municipal_route()
    axis = metres(street)
    road_parcels, road_corridor, road_cadastre = road_parcel_evidence(street, axis, parcels)
    dpu_features, dpu_surfaces, dpu_boundary = dpu_evidence()
    # Municipal data contains centre lines, not surveyed carriageway polygons.
    # This conservative working footprint is kept distinct from exact DPU fills.
    road_clearance = unary_union([metres(f).buffer(3) for f in read("grad/ceste-nerazvrstane")])
    parcel = next(f for f in parcels if f["properties"].get("cestica") == "419/1")
    parcel_geometry = metres(parcel)
    zones = [(f, metres(f)) for f in read("planovi/gup-2024-namjena")
             if f["properties"].get("kod") == "R2"]
    zone, geometry = max(zones, key=lambda pair: pair[1].intersection(parcel_geometry).area)
    if geometry.intersection(parcel_geometry).area < 100:
        raise ValueError("R2 recreation zone cannot be identified on parcel 419/1")
    bounds = list(shape(zone["geometry"]).bounds)
    focused = [
        feature(zone, "recreation-zone", "/geo/planovi/gup-2024-namjena.geojson",
                area_m2=round(geometry.area, 1), plan_status="draft", plan_item="1.15"),
    ]
    recreation_parcels = [f for f in parcels if metres(f).intersection(geometry).area > 1]
    recreation_land = unary_union([metres(f) for f in recreation_parcels])
    focused += parcel_context(parcels, geometry.buffer(20), {parcel_key(f) for f in road_parcels},
                              {parcel_key(f) for f in recreation_parcels})
    program_features, program_footprint, program_summary = recreation_program(geometry)
    focused += program_features
    equipment = []
    for name, role in (("igralista", "playground"), ("zelenilo-vjezbaliste", "workout")):
        for index, f in enumerate(read(f"grad/{name}")):
            g = metres(f)
            equipment.append(g)
            if g.distance(geometry) <= 20:
                focused.append(feature(f, role, f"/geo/grad/{name}.geojson", source_index=index))

    utility_geometries, utility_metadata, utility_summary = [], [], []
    for name, label in UTILITY_LAYERS.items():
        nearby = []
        for index, f in enumerate(read(f"grad/{name}")):
            props = f["properties"]
            if name.startswith("struja-") and not props.get("vrsta", "").startswith("podzemna"):
                continue
            g = metres(f)
            utility_geometries.append(g)
            utility_metadata.append({"layer": name, "network": name, "label": label,
                                     "network_status": "existing", "source_path": f"/geo/grad/{name}.geojson",
                                     "source": f"/geo/grad/{name}.geojson",
                                     "source_index": index,
                                     "name": props.get("oznaka") or props.get("vod") or
                                             props.get("izvod") or props.get("tip") or label})
            if g.distance(geometry) <= 10:
                nearby.append(g)
        utility_summary.append({"layer": name, "label": label,
                                "network_status": "existing", "source_path": f"/geo/grad/{name}.geojson",
                                "records_within_10m": len(nearby),
                                "mapped_length_inside_zone_m": round(
                                    unary_union(nearby).intersection(geometry).length, 1)})

    planned_utility_path = GEO / "planovi/dpu-infrastruktura.geojson"
    if planned_utility_path.exists():
        for index, record in enumerate(read("planovi/dpu-infrastruktura")):
            if record["geometry"]["type"] not in ("LineString", "MultiLineString"):
                raise ValueError("Audited DPU infrastructure must contain route lines, not CAD glyph polygons")
            props = record["properties"]
            network = props.get("network") or props.get("tema")
            if not network:
                raise ValueError("Audited DPU utility route lacks a network identifier")
            network = network if network.startswith("dpu-") else f"dpu-{network}"
            utility_geometries.append(metres(record))
            utility_metadata.append({"layer": network, "network": network,
                                     "label": props.get("label") or props.get("opis") or network,
                                     "network_status": "dpu-plan", "source_index": index,
                                     **{key: props[key] for key in
                                        ("source_status", "completeness", "extraction", "note", "cad_sloj", "plan")
                                        if key in props},
                                     "source_path": "/geo/planovi/dpu-infrastruktura.geojson",
                                     "source": "/geo/planovi/dpu-infrastruktura.geojson",
                                     "source_url": props.get("source_url"),
                                     "sheet": props.get("sheet") or props.get("list"),
                                     "name": props.get("name") or props.get("cad_sloj") or network})

    planned_networks = {info["network"]: info["label"] for info in utility_metadata
                        if info["network_status"] == "dpu-plan"}
    for name, label in planned_networks.items():
        nearby = [g for g, info in zip(utility_geometries, utility_metadata)
                  if info["network"] == name and g.distance(geometry) <= 10]
        utility_summary.append({"layer": name, "label": label, "network_status": "dpu-plan",
                                "source_path": "/geo/planovi/dpu-infrastruktura.geojson",
                                "records_within_10m": len(nearby),
                                "mapped_length_inside_zone_m": round(
                                    unary_union(nearby).intersection(geometry).length, 1)})

    tree = shapely.STRtree(utility_geometries)
    focused += infrastructure(utility_geometries, utility_metadata,
                              unary_union([geometry.buffer(15), dpu_boundary])) + dpu_features
    sidewalk_footprints = []
    recreation_context = unary_union([geometry.buffer(15), dpu_boundary])
    for index, record in enumerate(read("grad/nogostupi")):
        line = metres(record)
        footprint = line.buffer(float(record["properties"]["sirina"]) / 2, cap_style=2)
        if footprint.intersects(recreation_context):
            sidewalk_footprints.append(footprint)
            focused.append(feature(record, "existing-sidewalk", "/geo/grad/nogostupi.geojson",
                                   source_index=index))
    converted_lane = unary_union([metres(f) for f in program_features if f["properties"]["role"] == "proposal-promenade"])
    passage = unary_union([*sidewalk_footprints, *dpu_surfaces.values(), road_clearance.difference(converted_lane)])
    existing_equipment = unary_union(equipment)
    buildings = unary_union([g for g in building_geometries if g.distance(geometry) <= 10])
    x0, y0, _, _ = geometry.bounds
    tree_evidence = json.loads((ROOT / "scripts/data/recreation-tree-retention.json").read_text())
    x0, y0 = tree_evidence["origin_3765"]
    retained = []
    for record in tree_evidence["groups"]:
        coordinates = record["coordinates"]
        location = Point(x0+coordinates[0], y0+coordinates[1]) if record["kind"] == "Point" else LineString([(x0+x,y0+y) for x,y in coordinates])
        area = location.buffer(record["buffer_m"])
        retained.append(area)
        focused.append(mapped_feature(area, role="retained-trees", retention_id=record["id"],
                       label=record["label"], approximate=True, source=tree_evidence["source"],
                       action="Zadržati postojeća stabla; položaje debala, vrste i korijenje snimiti prije projekta.",
                       evidence=record["evidence"]))
    retained_land = unary_union(retained)
    hard_program = unary_union([metres(f) for f in program_features if f["properties"]["role"] in
                               ("proposal-cageball", "proposal-gym", "proposal-parking")])
    if hard_program.intersection(retained_land).area > .01:
        raise ValueError("Hard programme overlaps an observed tree-retention belt")
    path_area = unary_union([metres(f) for f in program_features if f["properties"]["role"] == "proposal-path"])
    planting, selected = [], []
    for record in tree_evidence["new_planting"]:
        x,y = record["coordinates"]
        p = Point(x0+x,y0+y)
        soil = p.buffer(2)
        if not geometry.covers(soil) or not recreation_land.covers(soil):
            raise ValueError(f"Shade-tree soil outside project parcels: {record['id']}")
        if soil.intersects(hard_program) or soil.intersects(path_area) or soil.intersects(retained_land):
            raise ValueError(f"Shade-tree soil overlaps a court, path or retained planting: {record['id']}")
        if p.distance(buildings) < 5:
            raise ValueError(f"Large shade tree too close to a building: {record['id']}")
        index = int(tree.nearest(p))
        distance = p.distance(utility_geometries[index])
        # A larger open soil reserve needs checking from its edge. Every location
        # remains conditional until soil volume, roots, walls and utilities are surveyed.
        conflict = distance < 5
        props = {"role": "proposed-tree", "candidate_id": record["id"],
                 "source": "Radni položaj za hlad, uz očuvanje vidljivih postojećih skupina stabala.",
                 "purpose": record["purpose"], "species_proposal": "Platana (Platanus); vrstu potvrditi projektom",
                 "status": "needs-soil-and-utility-design", "screen_result": "conflict" if conflict else "suggested",
                 "nearest_utility": utility_metadata[index], "nearest_utility_distance_m": round(distance,2),
                 "boundary_distance_m": round(geometry.boundary.distance(p),2),
                 "tree_pit_radius_m": 2, "canopy_radius_m": 5,
                 "canopy_note": "Krošnja promjera 10 m ilustrira budući razvoj, ne veličinu sadnice ni najveću veličinu vrste; nije izračun sjene.",
                 "passage_distance_m": round(p.distance(path_area),2), "parcels": ownership_at(p),
                 "planting_parcel_ids": [parcel_key(f) for f in recreation_parcels if metres(f).intersection(soil).area > .001],
                 "parcel_fit": "recreation-parcels",
                 "action": "Provjeriti ili prilagoditi instalacije, zaštitu zidova i povezani prostor za korijen. Krug otvorenog tla nije puna zona korijena."}
        item = mapped_feature(p, **props)
        focused.append(item)
        focused.append(mapped_feature(p.buffer(5), role="proposal-canopy", candidate_id=record["id"],
                       label=f"{record['id']} · moguća buduća krošnja platane", source=props["canopy_note"],
                       conditional=True))
        planting.append({**props, "coordinates": list(item["geometry"]["coordinates"])})
        selected.append(p)
    shade = {"retained_groups": len(retained), "existing_source": tree_evidence["source"],
             "existing_note": tree_evidence["note"], "new_trees": len(planting),
             "conditional_trees": sum(p["screen_result"] == "conflict" for p in planting),
             "canopy_diameter_m": 10, "open_soil_radius_m": 2,
             "species": "Platana (Platanus), kandidat za velike krošnje; konačan odabir nakon provjere tla i instalacija.",
             "species_source": "https://www.rhs.org.uk/plants/96764/platanus-%C3%97-hispanica/details",
             "note": "Očuvati postojeće skupine, novu sadnju uklopiti u dječju terasu i uz šetnicu. Promjer krošnje je ilustracija budućeg razvoja, ne obećanje hlada odmah nakon sadnje. Potreban je povezan prostor za korijen, veći od kruga otvorenog tla."}

    ownership = {f["properties"]["parcel_number"]: f["properties"]
                 for f in read("analiza/javne-cestice")}
    parcel_overlaps = []
    for f in parcels:
        overlap = metres(f).intersection(geometry).area
        if overlap < 1:
            continue
        number = f["properties"]["cestica"]
        record = ownership.get(number, {})
        parcel_overlaps.append({"parcel_number": number, "overlap_m2": round(overlap, 1),
                                "public_level": record.get("public_level"),
                                "ownership_evidence": "city-gis" if record else None,
                                "source_updated_at": record.get("source_updated_at")})
    inventory = read("grad/zelenilo-stabla")
    road_features, road_screen, sidewalk_summary = roadside(street, axis, utility_geometries, utility_metadata,
                                          tree, ownership_at, building_geometries,
                                          dpu_features, dpu_surfaces, road_clearance, existing_equipment, dpu_boundary,
                                          parcels, road_parcels, road_corridor)
    road_buffer = axis.buffer(15)
    road_utilities = []
    for name, label in {**UTILITY_LAYERS, **planned_networks}.items():
        sections = [g for g, info in zip(utility_geometries, utility_metadata)
                    if info["layer"] == name and g.intersects(road_buffer)]
        road_utilities.append({"layer": name, "label": label,
                               "network_status": "dpu-plan" if name.startswith("dpu-") else "existing",
                               "source_path": "/geo/planovi/dpu-infrastruktura.geojson" if name.startswith("dpu-")
                                              else f"/geo/grad/{name}.geojson",
                               "records_within_15m": len(sections),
                               "mapped_length_within_15m": round(
                                   unary_union(sections).intersection(road_buffer).length, 1)})
    city_roads = [metres(f) for f in read("grad/ceste-nerazvrstane")
                  if f["properties"].get("ulica") == "Dračevac"]
    utility_scope = {"planned_networks_included": list(planned_networks),
                     "planned_routes_source": "/geo/planovi/dpu-infrastruktura.geojson" if planned_networks else None,
                     "completeness": "partial-conservative" if planned_networks else "city-records-only",
                     "note": "Probir uključuje gradske vodove i pouzdano izdvojene poteze mreža iz DPU-a. Njihov izvorni status (postojeće, planirano ili nerazlučeno) ostaje uz trasu. Razmaci među CAD crticama nisu popunjavani, a nejasni potezi i simboli su izostavljeni: udaljenost je do dostupne geometrije, ne potvrda slobodnog prostora. Prije sadnje treba pregledati izvorne listove, utvrditi dubine i pribaviti uvjete upravitelja." if planned_networks else
                             "Probir zasad uključuje gradske vodove; planirane trase DPU-a nisu pouzdano izdvojene iz starijih CAD fragmenata i nisu uključene u razmake."}
    road_screen["utility_scope"] = utility_scope
    summary = {
        "method": "Površine i udaljenosti izračunate u HTRS96/TM (EPSG:3765).",
        "recreation": {
            "source_pdf": "https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?Command=Core_Download&EntryId=13948&PortalId=0&language=hr-HR",
            "plan_status": "draft", "plan_item": "1.15", "area_m2": round(geometry.area, 1),
            "perimeter_m": round(geometry.length, 1), "bounds": bounds,
            "centroid": list(shape(zone["geometry"]).centroid.coords[0]),
            "parcel_419_1_area_m2": round(parcel_geometry.area, 1), "parcels": parcel_overlaps,
            "equipment_records": {"playground": sum(f["properties"]["role"] == "playground" for f in focused),
                                  "workout": sum(f["properties"]["role"] == "workout" for f in focused)},
            "tree_inventory": {"records_inside_zone": sum(metres(f).intersects(geometry) for f in inventory),
                               "records_in_available_dataset": len(inventory), "complete": False, "observed_groups": len(retained)},
            "shade": shade,
            "utilities": utility_summary,
            "program": program_summary,
            "dpu": dpu_summary(geometry, dpu_boundary, dpu_surfaces),
            "planting_screen": {"utility_distance_m": 5, "boundary_distance_m": 2,
                                "equipment_distance_m": None, "tree_spacing_m": 8,
                                "building_distance_m": 5, "tree_pit_radius_m": 2,
                                "utility_scope": utility_scope,
                                "assumed_carriageway_half_width_m": 3,
                                "note": "Radni prijedlog većih krošnji. Krug otvorenog tla polumjera 2 m ostaje unutar čestica i izvan sportskih ploha, pješačke staze i vidljivih postojećih skupina. Dječje sprave rasporediti oko sadnje. Stabla zamjenjuju dijelove parkirališta u prijedlogu prenamjene, a blizina vodova ostaje označena. Razmak 5 m od osi voda radni je probir (2 m otvorenog tla + 3 m), ne propisani razmak ni projekt korijenskog prostora.",
                                "candidates": planting},
        },
        "road_candidate": {"confirmed_by_user": False, "source": "/geo/grad/ceste-nerazvrstane.geojson",
                           "source_indices": street["properties"]["source_indices"], "name": "Dračevac",
                           "direction": "west-to-east", "sidewalks": sidewalk_summary,
                           "length_m": round(axis.length, 1),
                           "endpoints": [street["geometry"]["coordinates"][0], street["geometry"]["coordinates"][-1]],
                           "bounds": list(shape(street["geometry"]).bounds),
                           "utilities": road_utilities,
                           "dpu": dpu_summary(axis, dpu_boundary, dpu_surfaces),
                           "cadastre": road_cadastre,
                           "screening": road_screen,
                           "all_city_named_segments": len(city_roads),
                           "all_city_named_length_m": round(unary_union(city_roads).length, 1),
                           "note": "Gradska os ceste koja prati evidentirane nogostupe sjeverno od rekreacijske zone, od zapadnog spoja do istočnog kraja. Sjeverni i južni odvojci nisu uključeni."},
    }
    write(GEO / "prijedlozi/rekreacija.geojson", {"type": "FeatureCollection", "features": focused})
    write(GEO / "prijedlozi/nogostupi.geojson", {"type": "FeatureCollection", "features": road_features})
    write(GEO / "prijedlozi/nogostupi-3d.json", proposal_scene(road_features))
    write(GEO / "prijedlozi/rekreacija-3d.json", proposal_scene(focused, "rekreacija"))
    write(ROOT / "src/generated/proposal-spatial.json", summary, indent=2)
    print(f"R2: {geometry.area:.1f} m²; {len(selected)} preliminary tree candidates; street candidate {axis.length:.1f} m")
    print(f"Road: {road_screen['suggested']} suggested trees, {road_screen['conflict']} conflicts, "
          f"{road_screen['excluded_buildings']} positions excluded near buildings")


if __name__ == "__main__":
    main()

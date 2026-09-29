#!/usr/bin/env python3
"""Reproducible preliminary Bilice access screen; no permit/cost certification.

python3 scripts/generate-bilice-road.py
Requires Shapely, pyproj. Existing source files are never modified.
"""
import array
import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import substring, transform, unary_union

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "public/geo"
OUT = GEO / "prijedlozi"
TO_M = Transformer.from_crs(4326, 3765, always_xy=True).transform
TO_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform


def read(name):
    return json.loads((GEO / f"{name}.geojson").read_text())["features"]


def metres(record):
    return transform(TO_M, shape(record["geometry"]))


def write(path, value, indent=None):
    content = json.dumps(value, ensure_ascii=False, indent=indent,
                         separators=None if indent else (",", ":")) + "\n"
    if "--check" in sys.argv:
        assert path.read_text() == content, f"Generated asset is stale: {path}"
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


def feature(geometry, **props):
    return {"type": "Feature", "geometry": mapping(transform(TO_WGS, geometry)), "properties": props}


def parts(g):
    if g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    return [p for p in getattr(g, "geoms", []) if p.geom_type == "Polygon"]


def asym_envelope(line, left, right):
    return unary_union([line.buffer(left, single_sided=True, cap_style=2),
                        line.buffer(-right, single_sided=True, cap_style=2)])


def widening_study(control, municipal):
    """Bounded lateral corridor search; not a road design or legal minimum.

    Retain all footprints, including small structures and conflicting cadastral
    objects. No geometric result is called demolition-free in the real world.
    """
    settings = control["widening"]
    requested = settings["requestedLengthM"]
    start = Point(control["newSegments"][0]["points"][0])
    inward = metres(municipal[18])
    to_junction = inward.project(start)
    first = substring(inward, 0, to_junction)
    continuation = metres(municipal[17])
    last = substring(continuation, continuation.length-(requested-to_junction), continuation.length)
    reference = LineString(list(first.coords)[::-1] + list(last.coords)[::-1][1:])
    assert abs(reference.length-requested) < .001
    obstacles = []
    source_counts = {}
    for layer in ["grad/zgrade-2025", "zgrade", "grad/katastar-objekti"]:
        records = read(layer)
        source_counts[layer] = len(records)
        for i,record in enumerate(records):
            g = metres(record)
            if g.distance(reference) < settings["maximumOffsetM"]+10:
                obstacles.append((layer,i,g,record["properties"]))
    obstacle_union = unary_union([g for _,_,g,_ in obstacles])
    parcels = [(f,metres(f)) for f in read("grad/katastar")]
    road_parcels = unary_union([g for f,g in parcels if f["properties"]["ko"] == "SPLIT"
                               and f["properties"]["cestica"] in ["13571/1","13572/1","13573"]])
    step = settings["offsetStepM"]
    n = int(settings["maximumOffsetM"]/step)
    offsets = [i*step for i in range(-n,n+1)]
    stations = [i*settings["stationStepM"] for i in range(int(requested/settings["stationStepM"])+1)]
    points = []
    for station in stations:
        p=reference.interpolate(station)
        a=reference.interpolate(max(0,station-.5)); b=reference.interpolate(min(requested,station+.5))
        dx,dy=b.x-a.x,b.y-a.y; distance=math.hypot(dx,dy)
        points.append([(p.x-dy/distance*offset,p.y+dx/distance*offset) for offset in offsets])
    max_step=int(settings["maximumOffsetStepM"]/step)
    scenarios=[]
    chosen=None
    for width in settings["comparisonWidthsM"]:
        blocked=obstacle_union.buffer(width/2+settings["workingClearanceM"])
        costs=[math.inf]*len(offsets);costs[offsets.index(0)]=0
        parents=[]
        for station in range(1,len(stations)):
            following=[math.inf]*len(offsets);previous=[-1]*len(offsets)
            for j,offset in enumerate(offsets):
                point=Point(points[station][j])
                if blocked.covers(point) or (station==len(stations)-1 and abs(offset)>2):
                    continue
                for k in range(max(0,j-max_step),min(len(offsets),j+max_step+1)):
                    if not math.isfinite(costs[k]):
                        continue
                    connection=LineString([points[station-1][k],points[station][j]])
                    if connection.intersects(blocked):
                        continue
                    # Ranking prefers short, gentle, near-existing alignments.
                    # No monetary cost or ownership right is inferred.
                    score=(costs[k]+connection.length+abs(offset)*.04+
                           abs(offset-offsets[k])*.5+min(point.distance(road_parcels),5)*.1)
                    if score<following[j]:
                        following[j]=score;previous[j]=k
            costs=following;parents.append(previous)
        end=min(range(len(offsets)),key=lambda i:costs[i])
        found=math.isfinite(costs[end])
        unshifted=reference.buffer(width/2,cap_style=2)
        scenario={"widthM":width,"found":found,
                  "unshiftedPrimaryBuildingConflicts":sum(g.intersection(unshifted).area>.01
                      for layer,_,g,_ in obstacles if layer=="grad/zgrade-2025"),
                  "description":"Pronađen radni omotač bez preklapanja izvora; nije projektirana cesta." if found else
                      "U ograničenoj pretrazi nije pronađen kontinuirani omotač bez dodira evidentiranih zgrada i objekata."}
        if found:
            indices=[end]
            for previous in reversed(parents):
                end=previous[end];indices.append(end)
            indices.reverse()
            candidate=LineString([points[i][j] for i,j in enumerate(indices)])
            envelope=candidate.buffer(width/2,cap_style=2,join_style=1)
            hits=[{"source":layer,"sourceIndex":i,"overlapM2":round(g.intersection(envelope).area,2)}
                  for layer,i,g,_ in obstacles if g.intersection(envelope).area>.01]
            assert not hits,hits
            scenario.update(adjustedAxisLengthM=round(candidate.length,2),
                            minimumMappedClearanceM=round(envelope.distance(obstacle_union),2),
                            maximumNorthOffsetM=abs(min(offsets[i] for i in indices)),
                            maximumSouthOffsetM=max(offsets[i] for i in indices))
            if width==settings["studyWidthM"]:
                chosen=(candidate,envelope,scenario)
        scenarios.append(scenario)
    assert chosen is not None, "The selected widening study width no longer clears the source footprints"
    candidate,envelope,selected=chosen
    ownership_path=ROOT / "scripts/data/bilice-road-ownership.json"
    ownership=json.loads(ownership_path.read_text()).get("parcels",{}) if ownership_path.exists() else {}
    public_evidence={f["properties"]["parcel_id"]:f["properties"] for f in read("analiza/javne-cestice")}
    public_labels={"state":"Republika Hrvatska","city":"Grad / JLS","county":"Županija"}
    affected=[];parcel_geometries=[]
    for record,g in parcels:
        overlap=g.intersection(envelope).area
        if overlap<=.1:
            continue
        p=record["properties"];identifier=f"{p['ko']}:{p['cestica']}"
        evidence=ownership.get(identifier,{})
        info={"id":identifier,"label":f"k.č. {p['cestica']} · k.o. {p['ko']}",
              "overlapM2":round(overlap,1),"parcelAreaM2":round(g.area,1),
              "ownershipLabel":evidence.get("ownershipLabel","ZK vlasništvo nije provjereno"),
              "ownershipStatus":evidence.get("ownershipStatus","unverified"),
              "sourceUrl":evidence.get("sourceUrl"),"checkedAt":evidence.get("checkedAt"),
              "representativePoint":list(transform(TO_WGS,g.representative_point()).coords[0])}
        # A failed current ZK lookup must not erase independently retained GIS
        # evidence. Preserve its original date and classification, not a title
        # verification date or an invented owner share.
        historic=public_evidence.get(identifier)
        if historic and historic["public_level"] in public_labels:
            info["historicalOwnership"]={
                "entityLabel":public_labels[historic["public_level"]],
                "publicLevel":historic["public_level"],
                "ownershipForm":historic["ownership_form"],
                "sourceUpdatedAt":historic["source_updated_at"],
                "generatedAt":historic["generated_at"],
                "sourceUrl":"/geo/analiza/javne-cestice.geojson",
                "sourceLabel":"GIS Grada Splita · izričiti status i oblik upisa"}
            if info["ownershipStatus"] in ("missing_land_register_link","unverified"):
                form={"ownership":"vlasništvo","coownership":"suvlasništvo"}.get(historic["ownership_form"],"javni status")
                info["ownershipLabel"]=f"{public_labels[historic['public_level']]} · {form} prema GIS-u ({historic['source_updated_at']}); aktualni ZK nije potvrđen"
        affected.append(info);parcel_geometries.append((g,info))
    affected.sort(key=lambda p:-p["overlapM2"])
    closest=[]
    for layer,index,g,props in obstacles:
        clearance=g.distance(envelope)
        if clearance<.75:
            closest.append({"source":f"/geo/{layer}.geojson","sourceIndex":index,
                            "clearanceM":round(clearance,2),"properties":props})
    report={"id":settings["id"],"label":"Obuhvat prvih 75 m · radna os 75,8 m",
            "requestedLengthM":requested,"lengthM":round(candidate.length,2),
            "adjustedAxisLengthM":round(candidate.length,2),"widthM":settings["studyWidthM"],
            "areaM2":round(envelope.area,1),"startDescription":"Predloženi spoj s DPU-om na istočnom rubu Ulice Bilice II",
            "endDescription":f"{requested-to_junction:.2f} m zapadno od središnjeg križanja Ulice Bilice II",
            "start":list(transform(TO_WGS,start).coords[0]),
            "referenceEnd":list(transform(TO_WGS,Point(reference.coords[-1])).coords[0]),
            "assumption":settings["assumption"],"status":"constrained-width-study-not-road-design",
            "buildingScreen":{"primaryConflicts":0,"allSourceObjectConflicts":0,
                              "minimumMappedClearanceM":selected["minimumMappedClearanceM"],
                              "sources":source_counts,"closestObjects":closest,
                              "note":"Oko 0,15 m radnog odmaka manje je od nepoznate položajne nesigurnosti podloga. Nula računalnih preklapanja ne potvrđuje izvedivost bez rušenja."},
            "widthComparison":scenarios,
            "search":{"maximumOffsetM":settings["maximumOffsetM"],"offsetStepM":step,
                      "stationStepM":settings["stationStepM"],"maximumOffsetStepM":settings["maximumOffsetStepM"],
                      "score":"Duljina + blizina postojećoj osi i cestovnim česticama + manja promjena bočnog pomaka; nije financijski trošak."},
            "parcels":affected,
            "notes":["Profil 5 m je ograničena prostorna studija bez zasebnog nogostupa, ne preporučena ili dopuštena širina ceste.",
                     "Stvarni rubovi postojeće ceste nisu snimljeni. Prikazana površina cijelog radnog koridora nije površina otkupa niti dokaz koliko ceste treba proširiti.",
                     "Krivine, mimoilaženje, pješački pristup, interventna vozila, zidovi, stupovi i instalacije trebaju terenski pregled i prometni projekt.",
                     "U ograničenoj pretrazi 5,5–11 m nije pronađeno bez dodira objekata. To nije dokaz da svako moguće projektno rješenje šire ceste zahtijeva rušenje."]}
    return report,{"reference":reference,"axis":candidate,"envelope":envelope,"parcels":parcel_geometries}


def main():
    control = json.loads((ROOT / "scripts/data/bilice-road-route.json").read_text())
    municipal = read("grad/ceste-nerazvrstane")
    osm = read("ceste-sve")
    buildings = read("grad/zgrade-2025")
    building_geometries = [metres(f) for f in buildings]
    dpu_roads = read("planovi/dpu-kolnici")
    dpu_walks = read("planovi/dpu-nogostupi")
    road_surface = unary_union([metres(f) for f in dpu_roads if f["properties"]["level"] == "surface"])
    walk_surface = unary_union([metres(f) for f in dpu_walks if f["properties"]["level"] == "surface"])
    dpu_boundary_record = next(f for f in read("grad/planovi-obuhvat-pp")
                               if f["properties"].get("naziv") == "Izmjena i dopuna DPU-a radne zone Dračevac")
    dpu_boundary = metres(dpu_boundary_record)
    routes = [{**r, "line": LineString(r["points"]), "kind": "new"} for r in control["newSegments"]]
    routes += [{"id": "existing-59", "label": "Postojeći Dračevac · istočni nastavak", "kind": "existing",
                "widthM": 6, "line": LineString([control["newSegments"][-1]["points"][-1], *list(metres(municipal[59]).coords)]), "sourceIndex": 59},
               {"id": "existing-70", "label": "Postojeći Dračevac · spoj na odvojak", "kind": "existing",
                "widthM": 6, "line": LineString(list(metres(municipal[70]).coords)[::-1]), "sourceIndex": 70}]
    slip = metres(osm[control["osmSlipIndex"]])
    # The OSM and city axes differ by 3.7 m at this same observed junction.
    # Preserve both, and explicitly include the small registration join.
    slip_points = list(slip.coords)[::-1]
    routes += [{"id": "existing-slip", "label": "Postojeći jednosmjerni odvojak D1 prema Dračevcu", "kind": "existing",
                "widthM": 6, "line": LineString([list(routes[-1]["line"].coords)[-1], *slip_points]),
                "sourceIndex": control["osmSlipIndex"], "oneway": True,
                "travelDirection": "toward-bilice-opposite-digitized-route"}]
    for a,b in zip(routes,routes[1:]):
        assert Point(a["line"].coords[-1]).distance(Point(b["line"].coords[0])) < .001
    new_axis = unary_union([r["line"] for r in routes if r["kind"] == "new"])
    existing_axis = unary_union([r["line"] for r in routes if r["kind"] == "existing"])
    axis = unary_union([r["line"] for r in routes])
    new_envelope = unary_union([asym_envelope(r["line"], r["leftM"], r["rightM"])
                               for r in routes if r["kind"] == "new"])
    existing_envelope = existing_axis.buffer(control["reuseScreenWidthM"]/2, cap_style=2)

    def conflicts(envelope):
        return [{"sourceIndex": i, "overlapM2": round(g.intersection(envelope).area, 2),
                 "bounds": list(transform(TO_WGS, g).bounds)}
                for i,g in enumerate(building_geometries) if g.intersection(envelope).area > .01]

    new_conflicts, existing_conflicts = conflicts(new_envelope), conflicts(existing_envelope)
    # Failing these assertions must stop publication of the zero-demolition candidate.
    assert not new_conflicts, new_conflicts
    assert not existing_conflicts, existing_conflicts
    secondary_screens = []
    for layer in ["zgrade", "grad/katastar-objekti"]:
        records = read(layer)
        checks = []
        for kind, envelope in [("new", new_envelope), ("existing", existing_envelope)]:
            for i,f in enumerate(records):
                g = metres(f)
                overlap = g.intersection(envelope).area
                if overlap > .01:
                    checks.append({"sourceIndex":i,"kind":kind,"overlapM2":round(overlap,2),
                                   "properties":f["properties"],"bounds":list(transform(TO_WGS,g).bounds)})
        secondary_screens.append({"source":f"/geo/{layer}.geojson","count":len(records),"conflicts":checks})
    alternatives = []
    for identifier, label, bounds, reason in [
        ("north-4b", "Puni sjeverni spoj 4B → 4A", [499633,4820725,499660,4820860],
         "Službeni planirani kolnik i nogostup preklapaju postojeću zgradu; odbačeno zbog zahtjeva bez rušenja."),
        ("full-4d", "Puni istočni profil 4D", [499819,4820670,500080,4820855],
         "Širenje na puni planirani profil zahvaća postojeće zgrade. Prva faza zadržava postojeću cestu; takvu etapu treba odobriti."),
        ("north-4c", "Puni središnji spoj 4C → 4A", [499780,4820690,499817,4820860],
         "Središnji sjeverni koridor zahvaća dvije postojeće zgrade; odbačeno zbog zahtjeva bez rušenja."),
        ("south-4g", "Puni južni koridor 4G", [499640,4820430,499920,4820560],
         "Puni planirani kolnik i nogostup zahvaćaju postojeće zgrade; odbačeno zbog zahtjeva bez rušenja.")]:
        envelope = road_surface.union(walk_surface).intersection(box(*bounds))
        hits = conflicts(envelope)
        alternatives.append({"id": identifier, "label": label, "status": "rejected-no-demolition",
                             "buildingConflicts": len(hits), "buildingOverlapM2": round(sum(h["overlapM2"] for h in hits),1),
                             "screenedAreaM2": round(envelope.area,1), "reason": reason,
                             "screenMethod": "Točni kolnik + nogostupi DPU-a unutar navedenog usporednog dijela; zelenilo može povećati sukobe.",
                             "screenBounds3765": bounds, "conflicts": hits})
    north_bypass = LineString([(499627.7684073699,4820827.561195457),(499626,4820842),
                              (499645,4820842),(499645,4820853),(499646,4820857),
                              (499650,4820860),(499660,4820863)])
    north_bypass_envelope = north_bypass.buffer(5.5,cap_style=2)
    assert not conflicts(north_bypass_envelope)
    north_walk_conflicts = conflicts(road_surface.union(walk_surface).intersection(
        box(499650,4820837,500095,4820905)))
    alternatives.append({"id":"north-reuse-track","label":"Postojeći sjeverni put → 4B iznad zgrade → 4A",
                         "status":"further-study","newLengthM":round(north_bypass.length,1),
                         "buildingConflicts":len(north_walk_conflicts),
                         "buildingOverlapM2":round(sum(h["overlapM2"] for h in north_walk_conflicts),1),
                         "reason":"Kratki spoj širine 11 m iznad duge zgrade prolazi bez dodira zgrada 2025., ali istočni nogostup 4A zahvaća drugu zgradu za 34,4 m². Potrebno je dokazati premještanje nogostupa unutar cestovne čestice, puni profil i zakonitost nadogradnje postojećeg sjevernog puta izvan DPU-a. Nije odobreni cjeloviti spoj.",
                         "screenMethod":"Spoj iznad zgrade: 11 m radni profil; nastavak4A: izvorni kolnik i nogostupi. Različito od gradnje cijelog sjevernog4B kroz zgradu.",
                         "conflicts":north_walk_conflicts})

    parcel_records = []
    public_ids = {f["properties"]["parcel_id"] for f in read("analiza/javne-cestice")}
    verified = {f["properties"]["parcel_id"]: f["properties"] for f in read("analiza/ciljana-provjera-vlasnistva")}
    available_parcels = []
    for p in read("grad/katastar"):
        g = metres(p)
        if g.intersection(new_envelope).area <= 1:
            continue
        available_parcels.append(g)
        props = p["properties"]
        key = f"{props['ko']}:{props['cestica']}"
        record = {"parcelId": key, "areaM2": round(g.intersection(new_envelope).area,1),
                  "status": "city-gis-public-record" if key in public_ids else "unknown"}
        if key in verified:
            record["status"] = verified[key]["verification_status"]
            record["publicEntities"] = verified[key]["public_entities"]
        parcel_records.append(record)

    features = [feature(dpu_boundary, role="dpu-boundary", label="Obuhvat DPU-a")]
    for r in routes:
        features.append(feature(r["line"], role="route", id=r["id"], label=r["label"], kind=r["kind"],
                                length_m=round(r["line"].length,1), width_m=r["widthM"],
                                one_way_inbound=r.get("oneway",False)))
    features += [feature(new_envelope, role="new-stage-full-profile", label="Probir cijelog radnog profila nove etape"),
                 feature(existing_envelope, role="existing-width-screen", label="Postojeće ceste · probir radne širine 6 m")]
    total = sum(r["line"].length for r in routes)
    report = {
        "version": 1, "title": "Spoj Bilica preko DPU-a Dračevac",
        "recommendation": "Razrađen je kratki spoj Bilice II → 4B → zapadni 4E, uz zadržavanje postojećeg istočnog Dračevca. Potpuna zakonita veza u oba smjera bez rušenja nije potvrđena. Prvo treba riješiti izlaz, prometnu etapu, nivelete i neslaganje katastarskih tlocrta. Kraći sjeverni spoj preko postojećeg puta ostaje zasebna varijanta za provjeru prilagodbe nogostupa 4A.",
        "status": "study-candidate-outbound-unverified",
        "metrics": {"totalLengthM": round(total,1), "existingLengthM": round(existing_axis.length,1),
                    "newLengthM": round(new_axis.length,1), "reusePercent": round(100*existing_axis.length/total,1),
                    "carriagewayWidthM": 10.5, "screenedWidthM": 23,
                    "buildingConflicts": len(new_conflicts)+len(existing_conflicts)+sum(
                        c["properties"].get("vrsta") == 101 for s in secondary_screens for c in s["conflicts"]),
                    "primaryBuildingConflicts":len(new_conflicts)+len(existing_conflicts),
                    "secondaryObjectConflicts":sum(len(s["conflicts"]) for s in secondary_screens),
                    "newStageBuildingConflicts": len(new_conflicts), "existingWorkingWidthConflicts": len(existing_conflicts),
                    "plannedRoadCoveragePercent": round(100*new_axis.intersection(road_surface).length/new_axis.length,1),
                    "newAxisOutsideDpuM": round(new_axis.difference(dpu_boundary).length,1),
                    "newFullProfileAreaM2": round(new_envelope.area,1),
                    "newFullProfileOutsideDpuM2": round(new_envelope.difference(dpu_boundary).area,1),
                    "newAxisOnExistingRegisterWithin4mM": round(new_axis.intersection(unary_union([metres(f).buffer(4) for f in municipal])).length,1),
                    "costEur": None},
        "alternatives": alternatives,
        "segments": [{"id":r["id"],"label":r["label"],"kind":r["kind"],"lengthM":round(r["line"].length,1),
                      "widthM":r["widthM"],"onewayInbound":r.get("oneway",False)} for r in routes],
        "parcelScreen": {"count":len(parcel_records), "unknownCount":sum(r["status"]=="unknown" for r in parcel_records),
                         "publicCount":sum(r["status"] in ("city-gis-public-record","verified-public") for r in parcel_records),
                         "missingCadastreAreaM2":round(new_envelope.difference(unary_union(available_parcels)).area,1),
                         "records":parcel_records},
        "buildingScreen": {"source":"/geo/grad/zgrade-2025.geojson","sourceBuildingCount":len(buildings),
                           "newFullProfile":new_conflicts,"existingWorkingWidth":existing_conflicts,
                           "secondaryScreens":secondary_screens,
                           "note":"Nula preklapanja s gradskim zgradama 2025. i OSM zgradama. Stariji katastarski objekti imaju neslaganja; to nije potvrda svih nadstrešnica, zidova ili terenskih rubova. Novi profil uključuje nogostupe i zelenilo 4B; radni omotač 4E je 23 m. Postojeći dio ispitan je samo radnom širinom 6 m."},
        "assumptions": control["notes"] + [
            "Duljina nove etape je opseg rekonstrukcije/novog zahvata, ne tvrdnja da je cijela podloga danas neasfaltirana.",
            "Usporedba građevinskog opsega nije troškovnik. Najjeftinije potpuno izvedivo rješenje nije utvrđeno zbog neriješenog izlaza, profila, vlasništva i konstrukcija.",
            "Nijedna postojeća zgrada nije izostavljena iz provjere zbog odabira trase. Nema dodira s gradskim tlocrtima 2025. ni OSM zgradama; stariji katastarski objekti imaju tri neslaganja koja treba riješiti prije potvrde uvjeta bez rušenja."],
        "constraints": [
            "Grad mora potvrditi da spoj i zadržavanje postojećeg istočnog Dračevca čine samostalnu prometnu i tehničku etapu prema točki 3.1 DPU-a.",
            "Zapadni 4E prolazi ispod planiranog pješačkog nathodnika. Kote, rampe, zidovi, odvodnja i uvjeti rezervacije nathodnika nisu riješeni; ravna jeftina zamjena nije potvrđena planom.",
            "Postojeći odvojak D1 prema Dračevcu označen je jednosmjernim u dostupnim podacima. Prikaz potvrđuje mrežni spoj i ulazni smjer; siguran i zakonit izlaz treba potvrditi cjelovitom prometnom shemom i uvjetima Hrvatskih cesta.",
            "Geometrija novih križanja, radijusi, preglednost, stvarne širine postojeće ceste i pristup interventnih vozila zahtijevaju snimku i projekt.",
            "Čestice i pravo građenja treba riješiti prije gradnje. Gradski registar osi nije dokaz vlasništva, dozvole ili dovoljne širine.",
            "Nije odobrena niti pretpostavljena prenamjena zemljišta izvan cestovnih čestica. Rubni spoj Bilica i omotač na zapadnoj granici traže geodetsku provjeru i dopušteno uklapanje."
            ,"Stariji katastarski objekt 15793 (vrsta 101) zahvaća radni omotač postojeće ceste 14,86 m², a objekti 12728 i 18525 (vrsta 406) rub nove etape 0,10 i 0,07 m². Ti objekti nisu jednako prikazani u novijim podacima: terenski provjeriti, ne pretpostaviti rušenje ili nestanak."
        ],
        "sources": [
            {"label":"DPU · pročišćeni tekst 10/25","url":"https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?Command=Core_Download&EntryId=14341&PortalId=0&language=hr-HR"},
            {"label":"DPU · promet 2a-1, 87/24","url":"https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?Command=Core_Download&EntryId=14243&PortalId=0&language=hr-HR","path":"/geo/planovi/dpu-kolnici.geojson"},
            {"label":"Grad Split · registar nerazvrstanih cesta","path":"/geo/grad/ceste-nerazvrstane.geojson"},
            {"label":"Grad Split · zgrade 2025","path":"/geo/grad/zgrade-2025.geojson"},
            {"label":"Grad Split · katastar","path":"/geo/grad/katastar.geojson"},
            {"label":"DGU · LiDAR DMR","path":"/geo/reljef/visine.json"},
            {"label":"Postojeće ulice i smjerovi · OSM","path":"/geo/ceste-sve.geojson"}
        ]
    }
    widening,widening_geometries=widening_study(control,municipal)
    report["widening"]=widening
    features += [feature(widening_geometries["reference"],role="widening-reference",label="Prvih 75 m postojeće osi"),
                 feature(widening_geometries["axis"],role="widening-axis",label=widening["label"],width_m=widening["widthM"]),
                 feature(widening_geometries["envelope"],role="widening-study",label="Radni omotač širine 5 m")]
    features += [feature(g,role="widening-parcel",**info) for g,info in widening_geometries["parcels"]]
    scene = make_scene(routes, features, report, building_geometries, dpu_roads, dpu_walks,widening_geometries,control,dpu_boundary)
    report["validation"] = {
        "projection":"EPSG:3765","routeContinuityToleranceM":.001,
        "primaryBuildingScreen":"passed-zero-overlap-new-and-existing-working-width",
        "secondaryBuildingScreen":"requires-source-reconciliation",
        "north4bBypass": {
            "buildingSourceIndex":1320,"carriagewayOverlapM2":94.73,"sidewalkOverlapM2":96.79,
            "crossSectionNorthingM":4820825,"westernDpuBoundaryEastingM":499629.18,
            "buildingWesternExtentEastingM":499636.98,"availableWesternStripM":7.8,
            "minimumTwoLanesAndTwoSidewalksM":11,
            "conclusion":"Zapadni pojas je uži od 7 m kolnika i dva nogostupa po 2 m. Istočni obilazak izlazi iz cestovne čestice 4B; dopušten pomak unutar čestice nije utvrđen."},
        "inputSha256": {name:hashlib.sha256((GEO / f"{name}.geojson").read_bytes()).hexdigest()
                        for name in ["grad/ceste-nerazvrstane","ceste-sve","grad/zgrade-2025","grad/katastar-objekti","zgrade","planovi/dpu-kolnici","planovi/dpu-nogostupi"]}}
    assert len(scene["terrain"]["heights"]) == scene["terrain"]["cols"]*scene["terrain"]["rows"]
    assert all(math.isfinite(h) for h in scene["terrain"]["heights"])
    assert abs(total - new_axis.length - existing_axis.length) < .01
    write(OUT / "bilice-cesta.json", report, 2)
    write(OUT / "bilice-cesta.geojson", {"type":"FeatureCollection","features":features})
    write(OUT / "bilice-cesta-3d.json", scene)
    print(json.dumps(report["metrics"], ensure_ascii=False, indent=2))
    print("Alternatives:", [(a["id"],a["buildingConflicts"]) for a in alternatives])


def make_scene(routes, features, report, buildings, dpu_roads, dpu_walks,widening_geometries,control,dpu_boundary):
    west,south,east,north = 499500,4820600,500150,4820930
    cx,cy = (west+east)/2,(south+north)/2
    area = box(west,south,east,north)
    header = json.loads((GEO / "reljef/visine.json").read_text())
    heights = array.array("h",gzip.decompress((GEO / "reljef/visine.bin.gz").read_bytes()))
    if sys.byteorder != "little":
        heights.byteswap()
    def altitude(x,y):
        lon,lat=TO_WGS(x,y)
        c=(lon-header["zapad"])/(header["istok"]-header["zapad"])*(header["stupaca"]-1)
        r=(header["sjever"]-lat)/(header["sjever"]-header["jug"])*(header["redaka"]-1)
        assert 0 <= c < header["stupaca"]-1 and 0 <= r < header["redaka"]-1
        ci,ri=int(c),int(r); u,v=c-ci,r-ri
        vals=[heights[rr*header["stupaca"]+cc] for rr,cc in [(ri,ci),(ri,ci+1),(ri+1,ci),(ri+1,ci+1)]]
        assert header["prazno"] not in vals
        return ((vals[0]*(1-u)+vals[1]*u)*(1-v)+(vals[2]*(1-u)+vals[3]*u)*v)/10
    cols,rows=math.ceil((east-west)/5)+1,math.ceil((north-south)/5)+1
    grid=[altitude(west+i/(cols-1)*(east-west),north-j/(rows-1)*(north-south)) for j in range(rows) for i in range(cols)]
    base=math.floor(min(grid))
    def xyz(x,y,lift=0):
        return [round(x-cx,2),round(altitude(x,y)-base+lift,2),round(cy-y,2)]
    def rings(g,lift=.18,densify=True):
        if densify:
            g=shapely.segmentize(g,4)
        return [[xyz(x,y,lift) for x,y in ring.coords] for ring in [g.exterior,*g.interiors]]
    surfaces=[]
    for records,role in [(dpu_roads,"dpu-road"),(dpu_walks,"dpu-sidewalk")]:
        for f in records:
            if f["properties"]["list"] != control["dpuHighlight"]["sheet"]:
                continue
            for g in parts(metres(f).intersection(area)):
                surfaces.append({"role":role,"label":f["properties"]["opis"],"rings":rings(g,.12)})
    municipal_context=read("grad/ceste-nerazvrstane")
    mapped_existing_axes=[metres(f) for f in municipal_context]
    mapped_existing_mask=unary_union([g.buffer(control["reuseScreenWidthM"]/2,cap_style=2)
                                      for g in mapped_existing_axes])
    for f in municipal_context:
        g=metres(f)
        if not g.intersects(area):
            continue
        for p in parts(g.buffer(2.5,cap_style=2).intersection(area)):
            surfaces.append({"role":"existing-road","label":f["properties"].get("ulica",""),"rings":rings(p,.16)})
    # Show the main road beside the inlet; these schematic widths provide
    # context only and never enter the route or building-clearance screen.
    for f in read("ceste-sve"):
        props = f["properties"]
        if props.get("highway") not in ("trunk", "trunk_link", "primary", "primary_link"):
            continue
        g = metres(f)
        if not g.intersects(area):
            continue
        lane_text = str(props.get("lanes", "2"))
        lanes = int(lane_text) if lane_text.isdigit() else 2
        for p in parts(g.buffer(max(1, min(lanes, 4))*1.75, cap_style=2).intersection(area)):
            surfaces.append({"role":"existing-road","label":"Glavna cesta · OSM os, shematska širina","rings":rings(p,.16)})
    footprints=[]
    selection=Polygon(control["dpuHighlight"]["selectionRing"]).intersection(dpu_boundary).intersection(area)
    new_routes=[r for r in routes if r["kind"]=="new"]
    existing_routes=[r for r in routes if r["kind"]=="existing"]
    new_axis=unary_union([r["line"] for r in new_routes])
    # The planned fill is needed only in the missing western link. These
    # longitudinal gates retain source kerbs and the junction flare, but cut
    # the selected stage at the existing 59 junction. They never extend the
    # planned eastern widening or roundabout over the existing selected route.
    end_easting=new_routes[-1]["line"].coords[-1][0]
    new_profile=unary_union([asym_envelope(r["line"],r["leftM"],r["rightM"]) for r in new_routes])
    south_branch_cut=math.floor(new_profile.bounds[1])-1
    north_branch_cut=round(new_profile.bounds[3],1)
    new_selection=selection.intersection(box(west,south_branch_cut,end_easting,north_branch_cut))
    gates=[box(west,4820705,499640,north),box(west,south,499675,north),area]
    exact_dpu_parts=[]
    exact_existing_parts=[]
    candidate_parts=[]

    def append_footprint(geometry,info,role):
        for p in parts(geometry.intersection(area)):
            if p.area<.01:
                continue
            features.append(feature(p,role=role,**info))
            # Preserve exact source geometry in GeoJSON. Repair only CAD seams
            # at the 3D scene's existing centimetre coordinate precision.
            for display in parts(shapely.set_precision(shapely.segmentize(p,4),.01)):
                if display.area>=.01:
                    footprints.append({**info,"rings":rings(display,.4,False)})

    # Existing roads retain their selected municipal/OSM axes on both sides of
    # the DPU boundary. Width remains a clearly identified working assumption.
    for route in existing_routes:
        existing=route["line"].buffer(route["widthM"]/2,cap_style=2).intersection(area)
        info={"source":"existing","segmentId":route["id"],"widthM":route["widthM"],
              "widthBasis":"schematic-axis","sourcePath":"/geo/ceste-sve.geojson" if route["id"]=="existing-slip"
                  else "/geo/grad/ceste-nerazvrstane.geojson","sourceIndex":route["sourceIndex"]}
        append_footprint(existing,info,"display-existing-road")
        exact_existing_parts.append(existing)
    selected_existing=unary_union(exact_existing_parts)
    existing_mask=mapped_existing_mask.union(selected_existing)
    for f in dpu_roads:
        props=f["properties"]
        if props["list"] != control["dpuHighlight"]["sheet"] or props["level"] != "surface":
            continue
        remaining=metres(f).intersection(new_selection).difference(existing_mask)
        for route,gate in zip(new_routes,gates):
            planned=remaining.intersection(gate)
            info={"source":"dpu","segmentId":route["id"],"level":props["level"],
                  "sheet":props["list"],"sourceLayer":props["cad_sloj"],"widthBasis":"original-dpu-fill",
                  "sourcePath":"/geo/planovi/dpu-kolnici.geojson"}
            append_footprint(planned,info,"display-dpu-road")
            exact_dpu_parts.extend(parts(planned))
            remaining=remaining.difference(gate)
    selected_dpu=unary_union(exact_dpu_parts)
    for route in new_routes:
        working=route["line"].buffer(route["widthM"]/2,cap_style=2).intersection(area)
        # Small ties at the new-stage ends already fall within a mapped road.
        # Show those bits as existing, without reclassifying the construction
        # scope or pretending that the width is a surveyed pavement boundary.
        retained=working.intersection(existing_mask).difference(selected_existing)
        append_footprint(retained,{"source":"existing","segmentId":route["id"],
                         "widthM":control["reuseScreenWidthM"],"widthBasis":"schematic-axis",
                         "sourcePath":"/geo/grad/ceste-nerazvrstane.geojson"},"display-existing-road")
        exact_existing_parts.extend(parts(retained))
        # Only the short tie outside the DPU requires a working proposal fill.
        # No substitute road strip is drawn through the planned polygon edges.
        outside=working.difference(dpu_boundary).difference(existing_mask)
        append_footprint(outside,{"source":"candidate","segmentId":route["id"],
                         "widthM":route["widthM"],"widthBasis":"working-connection"},"display-working-road")
        candidate_parts.extend(parts(outside))
    all_existing=unary_union(exact_existing_parts)
    selected_all=unary_union([all_existing,selected_dpu,*candidate_parts])
    existing_axis=unary_union([r["line"] for r in existing_routes])
    original_dpu=unary_union([metres(f) for f in dpu_roads if f["properties"]["level"]=="surface"])
    assert selected_dpu.difference(original_dpu).area<.000001
    assert selected_dpu.intersection(existing_mask).area<.000001
    assert all(p["segmentId"] in {r["id"] for r in new_routes}
               for p in footprints if p["source"]=="dpu")
    assert existing_axis.difference(all_existing.buffer(.001)).length<.001
    assert new_axis.difference(selected_all.buffer(.01)).length<.05
    new_working_carriageway=unary_union([r["line"].buffer(r["widthM"]/2,cap_style=2) for r in new_routes])
    clipped_needed_source=new_working_carriageway.intersection(original_dpu).difference(new_selection).difference(all_existing)
    assert clipped_needed_source.area<.000001
    report["displayGeometry"]={
        "mode":"existing-road-first","existingSelectedLengthM":round(existing_axis.length,1),
        "newStageLengthM":round(new_axis.length,1),
        "existingFootprintAreaM2":round(all_existing.area,1),
        "plannedGapFootprintAreaM2":round(selected_dpu.area,1),
        "outsideDpuCandidateAreaM2":round(unary_union(candidate_parts).area,1),
        "plannedSegmentIds":[r["id"] for r in new_routes],
        "newAxisInsideMappedExistingWorkingWidthM":round(new_axis.intersection(existing_mask).length,1),
        "existingWidthM":control["reuseScreenWidthM"],
        "selectionBranchCuts3765":{"southNorthingM":south_branch_cut,"northNorthingM":north_branch_cut,
                                    "eastEastingM":end_easting},
        "sourceCarriagewayAreaClippedWithoutExistingReplacementM2":round(clipped_needed_source.area,3),
        "note":"Prikaz zadržava odabrane postojeće osi Dračevca i odvojka D1 unutar i izvan DPU-a. Izvorni planirani kolnik ističe samo nedostajući zapadni spoj; istočno proširenje i budući rotor nisu dio istaknute trase. Postojeća širina 6 m je radni prikaz, ne snimljeni rub asfalta niti ocjena stanja ceste."}
    heights_source=[(metres(f),f["properties"].get("visina")) for f in read("grad/zgrade-visine")]
    scene_buildings=[]
    for i,g in enumerate(buildings):
        if not g.intersects(area) or g.area < 1:
            continue
        candidates=[(g.intersection(h).area,z) for h,z in heights_source if z and h.intersects(g)]
        best=max(candidates,default=(0,None))
        known=best[0]>g.area*.4 and best[1] and 1 <= best[1] <= 70
        height=round(best[1],1) if known else 6
        for p in parts(g.intersection(area)):
            anchor=p.representative_point();ground=altitude(anchor.x,anchor.y)-base
            scene_buildings.append({"id":str(i),"rings":[[[round(x-cx,2),round(ground,2),round(cy-y,2)] for x,y in ring.coords] for ring in [p.exterior,*p.interiors]],
                                    "height":height,"source":"city-height-overlap" if known else "schematic-6m"})
    segments=[{"id":r["id"],"label":r["label"],"kind":r["kind"],"widthM":r["widthM"],
               "onewayInbound":r.get("oneway",False),
               "points":[xyz(x,y,.5) for x,y in shapely.segmentize(r["line"],3).coords]} for r in routes]
    # Actual terrain is retained, with no invented ramps or road design elevations.
    report["metrics"]["terrainMinimumM"]=round(min(grid),1)
    report["metrics"]["terrainMaximumM"]=round(max(grid),1)
    widening_report=report["widening"]
    widening_parcels=[]
    for g,info in widening_geometries["parcels"]:
        for part in parts(g.intersection(area)):
            widening_parcels.append({"id":info["id"],"label":info["label"],"rings":rings(part,.2),
                                    "overlapM2":info["overlapM2"],"ownershipLabel":info["ownershipLabel"]})
    widening={"id":widening_report["id"],"label":widening_report["label"],
              "lengthM":widening_report["requestedLengthM"],"requestedLengthM":widening_report["requestedLengthM"],
              "adjustedLengthM":widening_report["adjustedAxisLengthM"],
              "widthM":widening_report["widthM"],
              "points":[xyz(x,y,.5) for x,y in widening_geometries["axis"].coords],
              "rings":rings(widening_geometries["envelope"],.4),"parcels":widening_parcels,
              "note":"Radni profil 5 m bez zasebnog nogostupa; nije projekt ceste. Površine čestica označuju bruto preklapanje, ne otkup. Granice čestica u sceni odrezane su na rubu prikazanog terena."}
    return {"version":1,"projection":"EPSG:3765","origin":[cx,cy,base],"width":east-west,"depth":north-south,
            "bounds":list(transform(TO_WGS,area).bounds),"terrain":{"cols":cols,"rows":rows,"heights":[round(h-base,2) for h in grid],"source":"DGU LiDAR DMR · uzorak 5 m; prikazuje današnji teren, ne projektirane nivelete"},
            "surfaces":surfaces,"proposalFootprints":footprints,"segments":segments,"buildings":scene_buildings,"widening":widening,
            "labels":[{"label":"BILICE II","position":xyz(499561,4820730,14)},
                      {"label":"NOVA ETAPA · 4B + 4E","position":xyz(499720,4820650,14)},
                      {"label":"POSTOJEĆI DRAČEVAC","position":xyz(499960,4820740,14)},
                      {"label":"D1 · ULAZNI ODVOJAK","position":xyz(499906,4820906,14)}],
            "note":"Postojeći Dračevac i ulazni odvojak D1 prikazani su po postojećim gradskim/OSM osima i radnoj širini 6 m; rub asfalta nije snimljen. Planirani kolnik DPU-a istaknut je samo na nedostajućem zapadnom spoju. Teren prikazuje današnji DMR, ne projektirane nivelete. Odvojak D1 ostaje jednosmjeran prema naselju; zakoniti izlaz nije potvrđen."}


if __name__ == "__main__":
    main()

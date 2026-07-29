"""Extract vector geometry from AutoCAD-exported PDF plan sheets, grouped by
the original CAD layer names (PDF optional content groups).

Output: {layer_name: [ {"closed": bool, "pts": [(x, y), ...]}, ... ]}
Coordinates are in PDF user space (points, origin bottom-left).
"""
from __future__ import annotations

import re
import subprocess
import tempfile
import os

NUM = r"[-+]?[0-9]*\.?[0-9]+"


def qdf(path: str) -> bytes:
    """Normalise a PDF so all streams are uncompressed and objects unpacked."""
    fd, tmp = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    subprocess.run(
        ["qpdf", "--qdf", "--object-streams=disable", path, tmp],
        capture_output=True, check=False,
    )
    data = open(tmp, "rb").read()
    os.unlink(tmp)
    return data


def parse_objects(raw: bytes) -> dict[int, bytes]:
    """Map object number -> raw body (dictionary plus any stream payload)."""
    objs: dict[int, bytes] = {}
    for m in re.finditer(rb"(?m)^(\d+)\s+0\s+obj\b", raw):
        num = int(m.group(1))
        end = raw.find(b"endobj", m.end())
        objs[num] = raw[m.end():end if end > 0 else len(raw)]
    return objs


def stream_of(body: bytes) -> bytes:
    i = body.find(b"stream")
    if i < 0:
        return b""
    j = i + len(b"stream")
    if raw_nl := body[j:j + 2] == b"\r\n":
        j += 2
    elif body[j:j + 1] in (b"\n", b"\r"):
        j += 1
    k = body.find(b"endstream", j)
    return body[j:k if k > 0 else len(body)]


def _box(name: bytes) -> re.Pattern:
    n = NUM.encode()
    return re.compile(rb"/" + name + rb"\s*\[\s*(" + n + rb")\s+(" + n +
                      rb")\s+(" + n + rb")\s+(" + n + rb")", re.S)


MEDIABOX = _box(b"MediaBox")
CROPBOX = _box(b"CropBox")


def page_info(raw: bytes, objs: dict[int, bytes]) -> dict:
    """Find the page object and pull MediaBox, /Rotate, Contents and OCG names.

    Scans parsed objects rather than the raw byte stream: searching the raw
    file for the first "/Type /Page" can land inside the /Pages node or a
    kid array and yield a MediaBox belonging to another object entirely.
    MediaBox and Rotate are inheritable, so both fall back to /Parent."""
    page_num = None
    for num, body in objs.items():
        if re.search(rb"/Type\s*/Page\s*(?:/|>|\s)", body) and not re.search(
            rb"/Type\s*/Pages", body
        ):
            page_num = num
            break
    if page_num is None:  # pragma: no cover
        raise ValueError("PDF nema stranicu s /Type /Page")
    page = objs[page_num]

    def naslijedi(body: bytes, rx, dubina: int = 0):
        m = rx.search(body)
        if m:
            return m
        par = re.search(rb"/Parent\s+(\d+)\s+0\s+R", body)
        if par and dubina < 8:
            return naslijedi(objs.get(int(par.group(1)), b""), rx, dubina + 1)
        return None

    # CropBox je stvarno vidljivo područje stranice i može biti manje od
    # MediaBoxa te pomaknuto (npr. UPU Bilice sjever: MediaBox 5669×5669,
    # CropBox 3316,44×1694,4). Rotacija se mora vrtjeti oko njega.
    mb = naslijedi(page, CROPBOX) or naslijedi(page, MEDIABOX)
    media = [float(x) for x in mb.groups()] if mb else [0.0, 0.0, 612.0, 792.0]
    if media[2] < media[0]:
        media[0], media[2] = media[2], media[0]
    if media[3] < media[1]:
        media[1], media[3] = media[3], media[1]

    rt = naslijedi(page, re.compile(rb"/Rotate\s+(-?\d+)"))
    rotate = int(rt.group(1)) % 360 if rt else 0

    cm = re.search(rb"/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)", page, re.S)
    contents = [int(x) for x in re.findall(rb"(\d+)\s+0\s+R", cm.group(1))] if cm else []

    props: dict[str, str] = {}
    pm = re.search(rb"/Properties\s*<<(.*?)>>", page, re.S)
    if pm:
        for name, ref in re.findall(rb"/(\w+)\s+(\d+)\s+0\s+R", pm.group(1)):
            body = objs.get(int(ref), b"")
            nm = re.search(rb"/Name\s*\((.*?)\)\s*(?:/|>>)", body, re.S)
            if nm:
                try:
                    layer = nm.group(1).decode("utf-8")
                except UnicodeDecodeError:
                    layer = nm.group(1).decode("latin-1")
                props[name.decode()] = layer
    return {"media": media, "contents": contents, "props": props,
            "rotate": rotate}


def rotator(media: list[float], rotate: int):
    """Map user space to display orientation for a page with /Rotate.

    /Rotate is how many degrees the page turns clockwise when shown, so a
    sheet drawn north-up in CAD comes out sideways or upside down unless the
    same turn is applied to the coordinates."""
    x0, y0, x1, y1 = media
    W, H = x1 - x0, y1 - y0
    if rotate == 90:
        return (lambda x, y: (y - y0, W - (x - x0))), (H, W)
    if rotate == 180:
        return (lambda x, y: (W - (x - x0), H - (y - y0))), (W, H)
    if rotate == 270:
        return (lambda x, y: (H - (y - y0), x - x0)), (H, W)
    return (lambda x, y: (x - x0, y - y0)), (W, H)


def mat_mul(a, b):
    return (
        a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
    )


def apply(m, x, y):
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


TOKEN = re.compile(rb"(/[^\s/\[\]<>(){}]+|<<|>>|\[|\]|\(|" + NUM.encode() + rb"|[A-Za-z*'\"]+)")


def extract(path: str) -> tuple[dict[str, list], list]:
    raw = qdf(path)
    objs = parse_objects(raw)
    info = page_info(raw, objs)
    content = b"\n".join(stream_of(objs.get(n, b"")) for n in info["contents"])

    ctm = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    fill = (0.0, 0.0, 0.0)
    stroke = (0.0, 0.0, 0.0)
    stack: list = []
    oc_stack: list[str | None] = []
    layers: dict[str, list] = {}

    path_subpaths: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    start_pt = (0.0, 0.0)
    cx = cy = 0.0
    operands: list = []
    pending_name: str | None = None
    grupa = 0

    def flush(closed: bool):
        """Zapiše podputanje trenutne putanje.

        Jedan operator bojanja može obojiti desetke odvojenih podputanja —
        to je jedna ploha plana s rupama i otocima, ne desetci zasebnih.
        Zato svaka podputanja nosi `grupa`, redni broj operatora bojanja,
        pa ih potrošač može spojiti natrag u jednu plohu.
        """
        nonlocal path_subpaths, cur, grupa
        if cur:
            path_subpaths.append(cur)
        layer = next((o for o in reversed(oc_stack) if o), "(bez sloja)")
        col = fill if closed else stroke
        rgb = "#%02x%02x%02x" % tuple(max(0, min(255, int(round(c * 255)))) for c in col)
        for sp in path_subpaths:
            if len(sp) >= 2:
                layers.setdefault(layer, []).append(
                    {"closed": closed, "pts": sp, "color": rgb, "grupa": grupa}
                )
        grupa += 1
        path_subpaths = []
        cur = []

    def to_rgb(vals):
        if len(vals) >= 4:  # CMYK
            c, m, y, k = vals[-4:]
            return (1 - min(1, c + k), 1 - min(1, m + k), 1 - min(1, y + k))
        if len(vals) >= 3:
            return tuple(vals[-3:])
        if len(vals) >= 1:
            return (vals[-1],) * 3
        return (0.0, 0.0, 0.0)

    for tm in TOKEN.finditer(content):
        t = tm.group(1)
        if t[:1] == b"/":
            pending_name = t[1:].decode("latin-1")
            operands.append(("name", pending_name))
            continue
        try:
            operands.append(float(t))
            continue
        except ValueError:
            pass
        op = t.decode("latin-1")
        nums = [o for o in operands if isinstance(o, float)]

        if op == "q":
            stack.append((ctm, fill, stroke))
        elif op == "Q":
            if stack:
                ctm, fill, stroke = stack.pop()
        elif op in ("rg", "g", "k", "sc", "scn"):
            if nums:
                fill = to_rgb(nums)
        elif op in ("RG", "G", "K", "SC", "SCN"):
            if nums:
                stroke = to_rgb(nums)
        elif op == "cm" and len(nums) >= 6:
            ctm = mat_mul(tuple(nums[-6:]), ctm)
        elif op == "m" and len(nums) >= 2:
            if cur:
                path_subpaths.append(cur)
            cx, cy = nums[-2], nums[-1]
            start_pt = (cx, cy)
            cur = [apply(ctm, cx, cy)]
        elif op == "l" and len(nums) >= 2:
            cx, cy = nums[-2], nums[-1]
            cur.append(apply(ctm, cx, cy))
        elif op in ("c", "v", "y") and len(nums) >= 4:
            # Flatten the Bezier into a few straight segments.
            if op == "c" and len(nums) >= 6:
                x1, y1, x2, y2, x3, y3 = nums[-6:]
            elif op == "v":
                x1, y1 = cx, cy
                x2, y2, x3, y3 = nums[-4:]
            else:
                x1, y1, x2, y2 = nums[-4:-2] + nums[-4:-2]
                x3, y3 = nums[-2:]
            for i in range(1, 9):
                s = i / 8.0
                u = 1 - s
                bx = u**3 * cx + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s**3 * x3
                by = u**3 * cy + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s**3 * y3
                cur.append(apply(ctm, bx, by))
            cx, cy = x3, y3
        elif op == "re" and len(nums) >= 4:
            x, y, w, h = nums[-4:]
            if cur:
                path_subpaths.append(cur)
            cur = [apply(ctm, x, y), apply(ctm, x + w, y),
                   apply(ctm, x + w, y + h), apply(ctm, x, y + h),
                   apply(ctm, x, y)]
            path_subpaths.append(cur)
            cur = []
            cx, cy = x, y
            start_pt = (x, y)
        elif op == "h":
            if cur:
                cur.append(apply(ctm, *start_pt))
        elif op in ("f", "F", "f*", "B", "B*", "b", "b*"):
            flush(True)
        elif op in ("S", "s"):
            flush(op == "s")
        elif op == "n":
            flush(False)
        elif op == "BDC":
            name = None
            names = [o[1] for o in operands if isinstance(o, tuple)]
            if len(names) >= 2 and names[0] == "OC":
                name = info["props"].get(names[1])
            oc_stack.append(name)
        elif op == "BMC":
            oc_stack.append(None)
        elif op == "EMC":
            if oc_stack:
                oc_stack.pop()
        operands = []

    rot, (W, H) = rotator(info["media"], info["rotate"])
    if info["rotate"]:
        for items in layers.values():
            for it in items:
                it["pts"] = [rot(x, y) for x, y in it["pts"]]
    return layers, [0.0, 0.0, W, H]


if __name__ == "__main__":
    import sys, json
    layers, media = extract(sys.argv[1])
    print("MediaBox:", media)
    tot = 0
    for name, items in sorted(layers.items(), key=lambda kv: -len(kv[1])):
        pts = sum(len(i["pts"]) for i in items)
        tot += pts
        print(f"  {len(items):7d} paths  {pts:9d} pts   {name}")
    print("TOTAL points:", tot)

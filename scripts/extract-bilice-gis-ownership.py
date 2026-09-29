#!/usr/bin/env python3
"""Read eight selected ownership rows from the local Split GIS ZIP, privately.

No GIS dependency is required. The DBF is streamed directly from the ZIP.
Inspect field metadata first: python3 scripts/extract-bilice-gis-ownership.py --inspect
Extract: python3 scripts/extract-bilice-gis-ownership.py
If the archive has no .cpg, supply the source's known --encoding explicitly.
This script preserves raw targeted owner text; it does not interpret owners,
shares, or cadastral-to-land-register correspondence, and publishes nothing.
"""

import argparse
import codecs
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import tempfile
import unicodedata
import zipfile


ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "bilice-ownership"
MEMBER = "SHP/SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/KatastarskeCestice.dbf"
OUTPUT = CACHE / "gis-targeted-records.json"
TARGETS = frozenset(("13571/1", "248/1", "247/2", "250/11", "452/1", "251/2", "532", "13572/1"))
SELECTED_FIELDS = ("kat_cest_1", "kat_opcina", "zku_status", "zku_suvlas", "zku_vlasni")
MAX_DBF_BYTES = 2_000_000_000


class ExtractionError(Exception):
    """A deliberately non-sensitive diagnostic safe to display."""


def read_exact(stream, size):
    data = stream.read(size)
    if len(data) != size:
        raise ExtractionError("Truncated DBF; no output written.")
    return data


def read_schema(stream, member_size):
    header = read_exact(stream, 32)
    # These DBF variants use the fixed-width records read below. Memo values
    # are not supported or requested by this bounded extractor.
    if header[0] not in (0x03, 0x04, 0x30, 0x31, 0x32, 0x43, 0x63, 0x83, 0x8B, 0xCB, 0xF5):
        raise ExtractionError("Unsupported DBF version; manual schema review required.")
    record_count, header_length, record_length = struct.unpack_from("<IHH", header, 4)
    if header_length < 33 or record_length < 2 or record_length > 65535:
        raise ExtractionError("Invalid DBF header lengths.")
    if header_length + record_count * record_length > member_size:
        raise ExtractionError("DBF record count exceeds member size.")
    descriptors = read_exact(stream, header_length - 32)
    fields = {}
    offset = 1  # byte zero is the deletion marker
    found_terminator = False
    for index in range(0, len(descriptors), 32):
        if descriptors[index] == 0x0D:
            found_terminator = True
            break
        descriptor = descriptors[index:index + 32]
        if len(descriptor) != 32:
            raise ExtractionError("Incomplete DBF field descriptor.")
        try:
            name = descriptor[:11].split(b"\0", 1)[0].decode("ascii").lower()
            kind = bytes((descriptor[11],)).decode("ascii")
        except UnicodeDecodeError:
            raise ExtractionError("Invalid DBF field metadata.") from None
        length = descriptor[16]
        if not re.fullmatch(r"[a-z_][a-z0-9_]{0,10}", name) or not length or name in fields:
            raise ExtractionError("Invalid or duplicate DBF field name/length.")
        fields[name] = {"offset": offset, "length": length, "type": kind}
        offset += length
    if not found_terminator or offset != record_length:
        raise ExtractionError("DBF fields do not match its fixed record length.")
    return fields, record_count, record_length


def text_encoding(archive, explicit):
    if explicit:
        candidate = explicit
    else:
        cpg_name = MEMBER[:-4] + ".cpg"
        matches = [info for info in archive.infolist() if info.filename == cpg_name]
        if len(matches) != 1 or matches[0].file_size > 128:
            raise ExtractionError("Missing or ambiguous .cpg: supply the known source --encoding; no encoding is guessed.")
        try:
            candidate = archive.read(matches[0]).decode("ascii").strip().strip('"').upper()
        except UnicodeDecodeError:
            raise ExtractionError("Invalid .cpg encoding declaration.") from None
        candidate = {"65001": "utf-8", "1250": "cp1250", "ANSI 1250": "cp1250",
                     "ANSI1250": "cp1250", "28592": "iso-8859-2"}.get(candidate, candidate)
    try:
        encoding = codecs.lookup(candidate).name
    except (LookupError, TypeError):
        raise ExtractionError("Unknown text encoding; no output written.") from None
    if encoding not in ("utf-8", "cp1250", "cp852", "iso8859-2", "ascii"):
        raise ExtractionError("Unsupported source text encoding; manual review required.")
    return encoding


def field_text(record, field, encoding):
    start = field["offset"]
    value = record[start:start + field["length"]].rstrip(b" \0")
    try:
        return value.decode(encoding, errors="strict").strip()
    except UnicodeDecodeError:
        raise ExtractionError("Selected DBF text cannot be decoded with the declared encoding.") from None


def require_private_destination():
    result = subprocess.run(
        ["git", "check-ignore", "--quiet", ".cache/bilice-ownership/gis-targeted-records.json"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
    )
    if result.returncode:
        raise ExtractionError("Refusing output because the private cache is not git-ignored.")
    if CACHE.is_symlink() or CACHE.parent.is_symlink() or OUTPUT.is_symlink():
        raise ExtractionError("Refusing a symlinked cache destination.")
    CACHE.mkdir(mode=0o700, parents=True, exist_ok=True)
    CACHE.chmod(0o700)


def write_private(value):
    # Atomic replacement leaves any previous successful extraction untouched
    # on a schema, decoding, missing-target, or duplicate-target failure.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=CACHE, delete=False) as handle:
            temporary = Path(handle.name)
            os.chmod(temporary, 0o600)
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, OUTPUT)
        OUTPUT.chmod(0o600)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=ROOT / "SHP.zip")
    parser.add_argument("--inspect", action="store_true", help="Print field names and record counts only; write nothing.")
    parser.add_argument("--encoding", help="Known source encoding, only needed when .cpg is absent or explicitly overridden.")
    args = parser.parse_args()
    if not args.archive.is_file():
        raise ExtractionError("Source ZIP has not arrived; no output written.")
    if not args.inspect:
        require_private_destination()
    with zipfile.ZipFile(args.archive) as archive:
        matches = [info for info in archive.infolist() if info.filename == MEMBER]
        if len(matches) != 1:
            raise ExtractionError("Expected exactly one documented cadastral DBF member; no output written.")
        info = matches[0]
        if info.flag_bits & 0x1 or info.file_size > MAX_DBF_BYTES:
            raise ExtractionError("Encrypted or oversized DBF requires manual review.")
        with archive.open(info) as stream:
            fields, record_count, record_length = read_schema(stream, info.file_size)
            if args.inspect:
                print(json.dumps({"record_count": record_count, "field_count": len(fields), "field_names": list(fields)}))
                return
            if any(name not in fields or fields[name]["type"] != "C" for name in SELECTED_FIELDS):
                raise ExtractionError("Required cadastral/ownership fields are absent or not character fields; inspect schema first.")
            encoding = text_encoding(archive, args.encoding)
            selected = {}
            for _ in range(record_count):
                record = read_exact(stream, record_length)
                if record[:1] == b"*":
                    continue
                if record[:1] != b" ":
                    raise ExtractionError("Invalid DBF record marker.")
                number = re.sub(r"\s+", "", field_text(record, fields["kat_cest_1"], encoding))
                if number not in TARGETS:
                    continue
                municipality = unicodedata.normalize("NFKC", field_text(record, fields["kat_opcina"], encoding)).upper()
                if municipality != "SPLIT":
                    continue
                if number in selected:
                    raise ExtractionError("Duplicate target record; no output written and no ownership rows merged.")
                # Owner text is decoded only after both target identifiers match.
                # No burden, OIB, address, or unrelated fields are selected.
                # The raw owner text may itself embed identifiers: it stays private.
                selected[number] = {name: field_text(record, fields[name], encoding) for name in SELECTED_FIELDS}
            if set(selected) != TARGETS:
                raise ExtractionError(f"Matched {len(selected)} of {len(TARGETS)} targets; incomplete extraction not written.")
        write_private({
            "extractedAt": datetime.now(timezone.utc).isoformat(),
            "sourceArchive": str(args.archive.resolve()),
            "sourceMember": MEMBER,
            "sourceMemberTimestamp": list(info.date_time),
            "encoding": encoding,
            "evidenceType": "historical_city_gis_raw_fields_not_current_land_register_verification",
            "targetCount": len(selected),
            "fieldNames": list(SELECTED_FIELDS),
            "records": [selected[number] for number in sorted(selected)],
        })
        print(json.dumps({"target_count": len(selected), "field_names": list(SELECTED_FIELDS)}))


if __name__ == "__main__":
    try:
        main()
    except ExtractionError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (OSError, zipfile.BadZipFile, RuntimeError, ValueError):
        # Library exceptions can embed paths or record contents; never echo them.
        print("Archive extraction failed; no targeted data is printed.", file=sys.stderr)
        sys.exit(1)

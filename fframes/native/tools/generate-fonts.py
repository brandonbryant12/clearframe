#!/usr/bin/env python3
"""Derive ClearFrame's static font instances from pinned OFL variable sources.

Requires fontTools (tested with 4.60.1 and 4.66.1; `uv run --with fonttools python
generate-fonts.py` works without installing anything). Inter's source is bundled and
hash-checked against provenance.json; the display voices (Archivo, Playfair Display,
Space Grotesk, Big Shoulders Display) come from the same pinned google/fonts revision
and are fetched into assets/fonts/source/ on demand, hash-checked, and not committed.
Existing instances are left untouched unless --force is given, so their recorded hashes
stay stable.
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

from fontTools import version as fonttools_version
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONTS = Path(__file__).resolve().parents[2] / "assets/fonts"
PROVENANCE = FONTS / "provenance.json"
# (file, family, style, weight, optical size). Text sizes use opsz 14; display sizes use
# Inter's own opsz 32 master, which tightens spacing and details for large type.
INSTANCES = [
    ("Inter-Regular.ttf", "Inter", "Regular", 400, 14),
    ("Inter-SemiBold.ttf", "Inter", "SemiBold", 600, 14),
    ("InterDisplay-Light.ttf", "Inter Display", "Light", 300, 32),
    ("InterDisplay-SemiBold.ttf", "Inter Display", "SemiBold", 600, 32),
    ("InterDisplay-Bold.ttf", "Inter Display", "Bold", 700, 32),
    # Counters: Inter's own tabular figures (the `tnum` feature) baked into the default cmap,
    # because the SVG renderer cannot switch OpenType features on.
    ("InterDisplay-Figures.ttf", "Inter Display Figures", "Bold", 700, 32),
]
TABULAR = {"InterDisplay-Figures.ttf"}

# Display voices: (provenance family, source file, output file, family, style, axes, baked feature).
# One or two static weights each, so the whole set stays small. Playfair's default figures are
# old-style; display type wants lining figures with its capitals, so `lnum` is baked in.
VOICES = [
    ("Archivo", "Archivo[wdth,wght].ttf", "ArchivoExpanded-ExtraBold.ttf", "Archivo Expanded", "ExtraBold",
     {"wght": 800, "wdth": 125}, None),
    ("Playfair Display", "PlayfairDisplay[wght].ttf", "PlayfairDisplay-Bold.ttf", "Playfair Display", "Bold",
     {"wght": 700}, "lnum"),
    ("Playfair Display", "PlayfairDisplay-Italic[wght].ttf", "PlayfairDisplay-BoldItalic.ttf", "Playfair Display",
     "Bold Italic", {"wght": 700}, "lnum"),
    ("Space Grotesk", "SpaceGrotesk[wght].ttf", "SpaceGrotesk-Bold.ttf", "Space Grotesk", "Bold", {"wght": 700}, None),
    ("Space Grotesk", "SpaceGrotesk[wght].ttf", "SpaceGrotesk-Light.ttf", "Space Grotesk", "Light", {"wght": 300}, None),
    ("Big Shoulders Display", "BigShouldersDisplay[wght].ttf", "BigShouldersDisplay-ExtraBold.ttf",
     "Big Shoulders Display", "ExtraBold", {"wght": 800}, None),
]
# Accent and voice faces checked per face by production.mjs (coverage-families.json).
FAMILY_FACES = [
    "InstrumentSerif-Regular.ttf",
    "InstrumentSerif-Italic.ttf",
    "IBMPlexMono-Medium.ttf",
    "ArchitectsDaughter-Regular.ttf",
    "BebasNeue-Regular.ttf",
    "DMSerifDisplay-Regular.ttf",
    "DMSerifDisplay-Italic.ttf",
] + [voice[2] for voice in VOICES]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def name_font(font: TTFont, family: str, style: str) -> None:
    table = font["name"]
    postscript = f"{family.replace(' ', '')}-{style}"
    # Keep legacy RIBBI names valid: non-RIBBI styles move into the legacy family name.
    ribbi = ("Regular", "Bold", "Italic", "Bold Italic")
    legacy_family = family if style in ribbi else f"{family} {style}"
    legacy_style = style if style in ribbi else "Regular"
    for name_id, value in {1: legacy_family, 2: legacy_style, 3: f"{postscript};clearframe",
                           4: f"{family} {style}", 6: postscript, 16: family, 17: style}.items():
        table.setName(value, name_id, 3, 1, 0x409)
        table.removeNames(nameID=name_id, platformID=1)


def bake_feature(font: TTFont, tag: str) -> None:
    """Point the cmap at a feature's single-substitution glyphs so they become the default."""
    gsub = font["GSUB"].table
    indices = {i for record in gsub.FeatureList.FeatureRecord if record.FeatureTag == tag
               for i in record.Feature.LookupListIndex}
    mapping = {}
    for index in sorted(indices):
        lookup = gsub.LookupList.Lookup[index]
        for sub in lookup.SubTable:
            sub = getattr(sub, "ExtSubTable", sub)
            mapping.update(getattr(sub, "mapping", {}) or {})
    if not mapping:
        raise SystemExit(f"{tag} has no single substitutions to bake")
    for table in font["cmap"].tables:
        for code, glyph in list(table.cmap.items()):
            if glyph in mapping:
                table.cmap[code] = mapping[glyph]


def main() -> None:
    force = "--force" in sys.argv
    provenance = json.loads(PROVENANCE.read_text())
    source = next(f for f in provenance["files"] if f["file"] == "source/Inter.ttf")
    source_path = FONTS / source["file"]
    if sha256(source_path) != source["sha256"]:
        raise SystemExit("Inter source does not match provenance.json")
    records = {entry["file"]: entry for entry in provenance.get("staticInstances", [])}
    for file, family, style, weight, opsz in INSTANCES:
        target = FONTS / file
        if target.exists() and file in records and not force:
            if sha256(target) != records[file]["sha256"]:
                raise SystemExit(f"{file} differs from provenance.json; rerun with --force to regenerate")
            records[file].setdefault("family", family)
            continue
        font = instancer.instantiateVariableFont(TTFont(source_path), {"wght": weight, "opsz": opsz})
        name_font(font, family, style)
        font["OS/2"].usWeightClass = weight
        if file in TABULAR:
            bake_feature(font, "tnum")
        font.save(target)
        records[file] = {"file": file, "family": family, "weight": weight, "opticalSize": opsz,
                         "tool": f"FontTools {fonttools_version} varLib.instancer", "sha256": sha256(target)}
        print(f"wrote {file}")
    provenance["staticInstances"] = [records[file] for file, *_ in INSTANCES]
    derive_voices(provenance, force)
    PROVENANCE.write_text(json.dumps(provenance, indent=2) + "\n")
    write_coverage()
    write_family_coverage()


def fetch_source(entry: dict) -> Path:
    """The pinned variable source for a voice, downloaded once into source/ and hash-checked."""
    target = FONTS / "source" / entry["file"]
    if not target.exists():
        print(f"fetching {entry['url']}")
        target.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(entry["url"]) as response:
            target.write_bytes(response.read())
    if sha256(target) != entry["sha256"]:
        raise SystemExit(f"{target.name} does not match provenance.json")
    return target


def derive_voices(provenance: dict, force: bool) -> None:
    """Static display-voice instances from the variable sources recorded under `families`."""
    families = {f["family"]: f for f in provenance.get("families", [])}
    for family_name, source_file, file, family, style, axes, bake in VOICES:
        record = families.get(family_name)
        source = next((s for s in (record or {}).get("source", []) if s["file"] == source_file), None)
        if record is None or source is None:
            raise SystemExit(f"provenance.json lacks a source entry for {family_name} / {source_file}")
        instances = record.setdefault("instances", [])
        existing = next((i for i in instances if i["file"] == file), None)
        target = FONTS / file
        if target.exists() and existing and not force:
            if sha256(target) != existing["sha256"]:
                raise SystemExit(f"{file} differs from provenance.json; rerun with --force to regenerate")
            continue
        path = fetch_source(source)
        font = instancer.instantiateVariableFont(TTFont(path), axes)
        name_font(font, family, style)
        font["OS/2"].usWeightClass = axes["wght"]
        if bake:
            bake_feature(font, bake)
        font.save(target)
        entry = {"file": file, "source": source_file, "axes": axes, "weight": axes["wght"],
                 "italic": "Italic" in style, **({"baked": bake} if bake else {}),
                 "tool": f"FontTools {fonttools_version} varLib.instancer", "sha256": sha256(target)}
        if existing:
            instances[instances.index(existing)] = entry
        else:
            instances.append(entry)
        print(f"wrote {file}")


def write_family_coverage() -> None:
    """Per-face code point ranges for the accent and voice faces."""
    ranges = {}
    for file in FAMILY_FACES:
        cmap = sorted(TTFont(FONTS / file).getBestCmap())
        out = []
        for code in cmap:
            if out and code == out[-1][1] + 1:
                out[-1][1] = code
            else:
                out.append([code, code])
        ranges[file] = out
    (FONTS / "coverage-families.json").write_text(json.dumps({"fonts": FAMILY_FACES, "ranges": ranges}) + "\n")


def write_coverage() -> None:
    """Code points every bundled instance can draw, as inclusive ranges, for early checks."""
    common = None
    for file, *_ in INSTANCES:
        cmap = set(TTFont(FONTS / file).getBestCmap())
        common = cmap if common is None else common & cmap
    ranges = []
    for code in sorted(common):
        if ranges and code == ranges[-1][1] + 1:
            ranges[-1][1] = code
        else:
            ranges.append([code, code])
    (FONTS / "coverage.json").write_text(json.dumps({"fonts": [f for f, *_ in INSTANCES], "ranges": ranges}) + "\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Derive ClearFrame's static Inter instances from the pinned OFL variable source.

Requires fontTools (tested with 4.60.1). No network. The source hash is checked
against provenance.json before anything is written; existing text instances are
left untouched unless --force is given, so their recorded hashes stay stable.
"""
import hashlib
import json
import sys
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


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def name_font(font: TTFont, family: str, style: str) -> None:
    table = font["name"]
    postscript = f"{family.replace(' ', '')}-{style}"
    # Keep legacy RIBBI names valid: non-RIBBI styles move into the legacy family name.
    legacy_family = family if style in ("Regular", "Bold") else f"{family} {style}"
    legacy_style = style if style in ("Regular", "Bold") else "Regular"
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
    PROVENANCE.write_text(json.dumps(provenance, indent=2) + "\n")
    write_coverage()


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

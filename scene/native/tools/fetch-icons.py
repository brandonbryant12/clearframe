#!/usr/bin/env python3
"""Fetch the curated Tabler subset at the pinned MIT revision into assets/icons/tabler.

Idempotent: files already listed in manifest.json are verified, never replaced.
Only path-only outline icons are accepted; generate-icons.py re-verifies every hash.
Usage: fetch-icons.py            (network, adds any missing aliases)
"""
import hashlib
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

NATIVE = Path(__file__).resolve().parents[1]
ASSETS = NATIVE.parents[1] / "film/assets/icons/tabler"
REVISION = "74929e50416e2b7c0abb8368cdc74bdcb2560ab6"
RAW = f"https://raw.githubusercontent.com/tabler/tabler-icons/{REVISION}/"
# ClearFrame alias -> upstream outline icon. Aliases are stable author-facing names.
ALIASES = {
    "alert": "alert-triangle", "atom": "atom", "bell": "bell", "bike": "bike", "bolt": "bolt",
    "brain": "brain", "briefcase": "briefcase", "building": "building", "calendar": "calendar",
    "car": "car", "chart-bar": "chart-bar", "chart-line": "chart-line", "chart-pie": "chart-pie",
    "chat": "messages", "clock": "clock", "close": "x", "cloud": "cloud", "code": "code",
    "coin": "coin", "database": "database", "dna": "dna", "eye": "eye", "file": "file-text",
    "flag": "flag", "flame": "flame", "flask": "flask", "folder": "folder", "gift": "gift",
    "globe": "world", "headphones": "headphones", "home": "home", "info": "info-circle",
    "key": "key", "laptop": "device-laptop", "link": "link", "lock": "lock", "mail": "mail",
    "message": "message-circle", "microphone": "microphone", "moon": "moon", "mountain": "mountain",
    "package": "package", "phone": "device-mobile", "photo": "photo", "plus": "plus",
    "puzzle": "puzzle", "recycle": "recycle", "refresh": "refresh", "rocket": "rocket",
    "ruler": "ruler", "scale": "scale", "school": "school", "search": "search", "server": "server",
    "settings": "settings", "shield": "shield-check", "shopping-cart": "shopping-cart",
    "sparkles": "sparkles", "star": "star", "target": "target", "thumb-up": "thumb-up",
    "tree": "tree", "trending-down": "trending-down", "trending-up": "trending-up",
    "trophy": "trophy", "truck": "truck", "user": "user", "user-check": "user-check",
    "users": "users", "video": "video", "wifi": "wifi",
}


def path_only(data: bytes) -> bool:
    root = ET.fromstring(data)
    for element in root:
        if element.tag != "{http://www.w3.org/2000/svg}path":
            return False
        attributes = set(element.attrib)
        invisible = element.attrib.get("stroke") == "none" and element.attrib.get("fill") == "none"
        if attributes != {"d"} and not (invisible and attributes == {"d", "stroke", "fill"}):
            return False
        if not re.fullmatch(r"[MmLlHhVvCcSsQqTtAaZzEe0-9.,+\s-]+", element.attrib["d"]):
            return False
    return 1 <= len(root) <= 30


def main() -> None:
    manifest_path = ASSETS / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    assert manifest["revision"] == REVISION and manifest["license"] == "MIT"
    known = {entry["file"] for entry in manifest["files"]}
    rejected = []
    for alias, upstream in sorted(ALIASES.items()):
        file = f"{alias}.svg"
        if file in known:
            continue
        upstream_path = f"icons/outline/{upstream}.svg"
        with urllib.request.urlopen(RAW + upstream_path, timeout=30) as response:
            data = response.read()
        if not path_only(data):
            rejected.append(alias)
            continue
        (ASSETS / file).write_bytes(data)
        manifest["files"].append({"file": file, "upstreamPath": upstream_path, "url": RAW + upstream_path,
                                  "sha256": hashlib.sha256(data).hexdigest()})
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{len(manifest['files']) - 1} icons in manifest; rejected (not path-only): {rejected or 'none'}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build a single offline SVG symbol atlas from the pinned OpenMoji assets."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BANK_FILE = ROOT / "web/static/animal-bank.js"
SOURCE_DIR = ROOT / "assets/openmoji/animals"
OUTPUT_FILE = ROOT / "web/static/animal-atlas.svg"
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


def main() -> None:
    bank = BANK_FILE.read_text(encoding="utf-8")
    codes = re.findall(r"\['([^']+)',\s*'[^']+'\]", bank)
    if len(codes) != 100 or len(set(codes)) != 100:
        raise SystemExit(f"expected 100 unique animals, found {len(codes)} entries and {len(set(codes))} codes")

    root = ET.Element(f"{{{SVG_NS}}}svg", {
        "width": "0",
        "height": "0",
        "aria-hidden": "true",
        "focusable": "false",
    })
    defs = ET.SubElement(root, f"{{{SVG_NS}}}defs")
    for code in codes:
        source_path = SOURCE_DIR / f"{code}.svg"
        if not source_path.is_file():
            raise SystemExit(f"missing source icon: {source_path}")
        source = ET.parse(source_path).getroot()
        symbol = ET.SubElement(defs, f"{{{SVG_NS}}}symbol", {
            "id": f"animal-{code}",
            "viewBox": source.get("viewBox", "0 0 618 618"),
        })
        for child in source:
            if child.tag.rsplit("}", 1)[-1] not in {"title", "desc", "metadata"}:
                symbol.append(child)

    ET.ElementTree(root).write(OUTPUT_FILE, encoding="utf-8", xml_declaration=True)
    print(f"built {len(codes)} symbols in {OUTPUT_FILE} ({OUTPUT_FILE.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

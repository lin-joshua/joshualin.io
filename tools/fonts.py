#!/usr/bin/env python3
# /// script
# dependencies = ["fonttools", "brotli"]
# ///
"""Rebuild the site's small copy of LXGW WenKai GB Screen, the font for its
Chinese (assets/fonts/lxgw-wenkai/).

    uv run tools/fonts.py

The site sets its text in Alegreya, which has no Chinese, so the browser
falls through to WenKai for it (--font-text in assets/css/site.css). The
whole of WenKai is many megabytes; the site keeps only the characters it
uses in it: every Chinese character in the pages. Run this
after adding Chinese text anywhere, and it makes the font again with
exactly those characters, and sets the unicode-range of its @font-face in
assets/css/fonts.css to match.

It fetches the pieces of the font that hold those characters from the
font's own web release on jsDelivr (lxgw-wenkai-screen-web), keeps only
those characters, and joins them into one file. It needs fontTools, which
`uv run` installs for it.
"""

import pathlib
import re
import sys
import tempfile
import urllib.request

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
RELEASE = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-web@1.530.0/lxgwwenkaigbscreen/"
OUT = ROOT / "assets/fonts/lxgw-wenkai/lxgw-wenkai-gb-screen-subset.woff2"
FONTS_CSS = ROOT / "assets/css/fonts.css"

# Characters to set in WenKai that are not Chinese. None, now: the arrows
# (← →) it once held were for the library, which is no longer part of the site.
EXTRA = ""


def chinese(text):
    return {c for c in text if 0x2E80 <= ord(c) <= 0x9FFF or 0xF900 <= ord(c) <= 0xFAFF or 0x20000 <= ord(c) <= 0x2FFFF}


def wanted():
    sources = list(ROOT.glob("*.html"))
    found = set(EXTRA)
    for path in sources:
        found |= chinese(path.read_text(encoding="utf-8"))
    return sorted(found)


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "fonts.py"})) as response:
        return response.read()


def ranges(text):
    out = []
    for part in text.split(","):
        part = part.strip().lower().replace("u+", "")
        first, _, last = part.partition("-")
        out.append((int(first, 16), int(last or first, 16)))
    return out


def main():
    characters = wanted()
    css = fetch(RELEASE + "result.min.css").decode("utf-8")
    # Which piece of the font holds each character.
    pieces = {}
    for face in re.findall(r"@font-face\{([^}]*)\}", css):
        url = re.search(r"url\(([^)]+)\)", face).group(1).strip("\"'")
        covers = ranges(re.search(r"unicode-range:([^;}]+)", face).group(1))
        for c in characters:
            if any(a <= ord(c) <= b for a, b in covers):
                pieces.setdefault(url, set()).add(c)
    missing = set(characters) - set().union(*pieces.values()) if pieces else set(characters)
    if missing:
        print("WenKai has no " + "".join(sorted(missing)) + "; the browser will use another font for them.")

    with tempfile.TemporaryDirectory() as work:
        parts = []
        for url, chars in sorted(pieces.items()):
            path = pathlib.Path(work) / url
            path.write_bytes(fetch(RELEASE + url))
            font = TTFont(path)
            options = subset.Options()
            options.name_IDs = ["*"]
            options.name_languages = ["*"]
            options.layout_features = []
            options.notdef_outline = True
            options.hinting = False
            subsetter = subset.Subsetter(options)
            subsetter.populate(text="".join(sorted(chars)))
            subsetter.subset(font)
            font.flavor = None
            part = path.with_suffix(".ttf")
            font.save(part)
            parts.append(str(part))
        merged = Merger().merge(parts)
        merged.flavor = "woff2"
        OUT.parent.mkdir(parents=True, exist_ok=True)
        merged.save(OUT)

    kept = sorted(set(characters) - missing)
    unicode_range = ", ".join(f"U+{ord(c):04X}" for c in kept)
    css_text = FONTS_CSS.read_text(encoding="utf-8")
    pattern = r'(font-family: "LXGW WenKai GB Screen";[^}]*unicode-range: )[^;]+;'
    updated, count = re.subn(pattern, lambda m: m.group(1) + unicode_range + ";", css_text)
    if count != 1:
        sys.exit("Could not find the LXGW WenKai GB Screen @font-face in assets/css/fonts.css.")
    FONTS_CSS.write_text(updated, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes): {''.join(kept)}")


if __name__ == "__main__":
    main()

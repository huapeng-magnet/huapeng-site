#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
extract_strings.py — inventory of translatable strings in the EN pages.

Pulls:
  * text nodes            (>Some text<)
  * translatable attrs    (placeholder / title / aria-label / alt / content)
  * <option> labels
  * JS string literals that contain visible English words

Writes _tools/_inventory.json  ->  { page: [ {s, kind, n} ] }

Run:  python _tools/extract_strings.py
"""
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGES = [
    "index.html",
    "request-quote.html",
    "calculator.html",
    "halbach-simulator.html",
    "magnet-calc.html",
    "order.html",
    "simulation.html",
] + [
    "products/product-%s-n%s.html" % (shape, grade)
    for shape in ("disc", "block", "ring")
    for grade in ("35", "42", "52")
]

ATTRS = ("placeholder", "title", "aria-label", "alt")
META_ATTRS = ("description",)

# strings we never translate
SKIP_EXACT = {
    "", "&nbsp;", "·", "—", "-", "×", "/", "N", "S", "→", "★", "+", "%", "$",
    "N35", "N38", "N40", "N42", "N45", "N48", "N50", "N52", "N55",
    "HUAPENG", "MAGNETICS", "USD", "CNY", "EXW", "FOB", "ISO", "PDF",
}

# a text node counts as translatable when it carries at least this many letters
MIN_ALPHA = 2

WORDY = re.compile(r"[A-Za-z]{2,}")


def is_translatable(s):
    s = s.strip()
    if not s or s in SKIP_EXACT:
        return False
    if len(s) > 400:
        return False
    if not WORDY.search(s):
        return False
    # pure markup / css / urls / code
    if re.match(r"^[\s{}();:,.#\-\[\]<>/\\|=*+&%$!\"'`0-9]+$", s):
        return False
    if re.search(r"[{};]\s*$", s) and re.search(r"[:{;]", s) and " " not in s:
        return False
    if re.match(r"^(https?:|mailto:|tel:|/|\.\.?/|#)", s):
        return False
    if s.startswith("<!--") or s.endswith("-->"):
        return False
    # camelCase / snake_case identifiers
    if re.match(r"^[a-z][a-zA-Z0-9_]*$", s) and ("_" in s or any(c.isupper() for c in s[1:])):
        return False
    if re.match(r"^[a-z][a-z0-9\-]*$", s) and len(s) <= 14:
        return False
    return True


def strip_scripts(html):
    return re.sub(r"<script\b.*?</script>", "", html, flags=re.S | re.I)


def strip_styles(html):
    return re.sub(r"<style\b.*?</style>", "", html, flags=re.S | re.I)


def collect(html):
    found = {}
    body = strip_styles(strip_scripts(html))

    # text nodes
    for m in re.finditer(r">([^<>]+)<", body):
        s = re.sub(r"\s+", " ", m.group(1)).strip()
        if is_translatable(s):
            found.setdefault(s, {"s": s, "kind": "text", "n": 0})
            found[s]["n"] += 1

    # attributes
    for a in ATTRS:
        for m in re.finditer(r'\b%s\s*=\s*"([^"]*)"' % re.escape(a), body):
            s = re.sub(r"\s+", " ", m.group(1)).strip()
            if is_translatable(s):
                k = s
                found.setdefault(k, {"s": s, "kind": a, "n": 0})
                found[k]["n"] += 1

    # meta description / og
    for m in re.finditer(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', body):
        s = re.sub(r"\s+", " ", m.group(1)).strip()
        if is_translatable(s):
            found.setdefault(s, {"s": s, "kind": "meta", "n": 0})
            found[s]["n"] += 1

    # <title>
    m = re.search(r"<title>(.*?)</title>", html, re.S)
    if m:
        s = re.sub(r"\s+", " ", m.group(1)).strip()
        if is_translatable(s):
            found.setdefault(s, {"s": s, "kind": "title", "n": 0})
            found[s]["n"] += 1

    return found


def main():
    inv = {}
    all_strings = {}
    for page in PAGES:
        path = os.path.join(BASE, page)
        if not os.path.exists(path):
            print("  MISSING", page)
            continue
        with open(path, encoding="utf-8") as f:
            html = f.read()
        found = collect(html)
        inv[page] = sorted(found.values(), key=lambda d: (-d["n"], d["s"]))
        for s, d in found.items():
            e = all_strings.setdefault(s, {"s": s, "kind": d["kind"], "pages": [], "n": 0})
            e["pages"].append(page)
            e["n"] += d["n"]
        print("  %-34s %4d strings" % (page, len(found)))

    outdir = os.path.join(BASE, "_tools")
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, "_inventory.json"), "w", encoding="utf-8") as f:
        json.dump(
            {"per_page": inv,
             "unique": sorted(all_strings.values(), key=lambda d: (-len(d["pages"]), -d["n"], d["s"]))},
            f, ensure_ascii=False, indent=1)

    print()
    print("unique strings across all pages:", len(all_strings))
    multi = [d for d in all_strings.values() if len(d["pages"]) > 1]
    print("appearing on 2+ pages:          ", len(multi))
    print("wrote _tools/_inventory.json")


if __name__ == "__main__":
    main()

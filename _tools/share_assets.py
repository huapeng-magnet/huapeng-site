#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
share_assets.py — make every language share ONE /assets/ folder.

Problem
-------
de/ and es/ each carry a full copy of assets/ (~9 MB per language) because the
shared JS (js/main.js, js/quote.js) references images with a *relative* path
("assets/disc_1.jpg"). On /de/ that resolves to /de/assets/... so each locale
needs its own copy.

Fix
---
Rewrite every asset reference to the site-root absolute form "/assets/...".
Then /de/assets and /es/assets can be deleted, and any new locale (ko, ja)
needs no asset copy at all.

Usage
-----
  python _tools/share_assets.py            # dry run: report only
  python _tools/share_assets.py --write    # apply the rewrite
"""
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGETS = [
    "index.html",
    "request-quote.html",
    "calculator.html",
    "halbach-simulator.html",
    "magnet-calc.html",
    "order.html",
    "simulation.html",
    "js/main.js",
    "js/quote.js",
    "js/checkout.js",
    "css/style.css",
    "de/index.html",
    "de/request-quote.html",
    "es/index.html",
    "es/request-quote.html",
]
PRODUCTS = os.path.join(BASE, "products")
if os.path.isdir(PRODUCTS):
    TARGETS += ["products/" + f for f in sorted(os.listdir(PRODUCTS)) if f.endswith(".html")]

# (../)*assets/  ->  /assets/
PATTERN = re.compile(r'(?P<q>["\'(])[./]*(?P<up>(?:\.\./)*)assets/')


def rewrite(text):
    """Return (new_text, n_replacements)."""
    def sub(m):
        return m.group("q") + "/assets/"

    new, n = PATTERN.subn(sub, text)
    return new, n


def main():
    write = "--write" in sys.argv
    total = 0
    touched = []
    for rel in TARGETS:
        path = os.path.join(BASE, rel)
        if not os.path.exists(path):
            print("  MISSING  %s" % rel)
            continue
        with open(path, encoding="utf-8") as f:
            old = f.read()
        new, n = rewrite(old)
        if n:
            total += n
            touched.append((rel, n))
            print("  %-34s %2d reference(s) %s" % (rel, n, "rewritten" if write else "(dry)"))
            if write and new != old:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(new)
        else:
            print("  %-34s  --" % rel)

    print()
    print("total asset references normalised:", total, "in", len(touched), "files")
    if not write:
        print("dry run only - re-run with --write to apply")

    if not write:
        return
    remaining = []
    for rel in TARGETS:
        path = os.path.join(BASE, rel)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            s = f.read()
        for m in re.finditer(r'["\'(](?:\.\./)*assets/', s):
            remaining.append((rel, m.group(0)))
    if remaining:
        print("STILL RELATIVE (would still need per-locale copies):")
        for rel, hit in remaining:
            print("   ", rel, hit)
    else:
        print("OK - no relative assets/ references remain")


if __name__ == "__main__":
    main()

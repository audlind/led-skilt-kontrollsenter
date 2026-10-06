"""Sjekker at alle relative lenker, bilder og ankere i Markdown-filene peker på noe som finnes.
Bruk:  python kontrollsenter/tools/check_links.py        (avslutter med feilkode 1 hvis noe mangler)
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKIP = {".git", "node_modules"}


def slug(heading):
    """GitHubs ankerregel: små bokstaver, fjern tegnsetting (behold bokstaver, tall, - og _), mellomrom blir bindestrek."""
    s = re.sub(r"`|\*|\[|\]", "", heading.strip().lower())
    s = re.sub(r"[^\w\- ]", "", s, flags=re.UNICODE)
    return s.replace(" ", "-")


def anchors(path):
    out, seen = set(), {}
    in_code = False
    for line in open(path, encoding="utf-8"):
        if line.strip().startswith("```"):
            in_code = not in_code
        m = None if in_code else re.match(r"^#{1,6}\s+(.*)$", line)
        if m:
            s = slug(m.group(1))
            n = seen.get(s, 0)
            seen[s] = n + 1
            out.add(s if n == 0 else f"{s}-{n}")
    return out


problems, checked = [], 0
mds = []
for d, dirs, files in os.walk(ROOT):
    dirs[:] = [x for x in dirs if x not in SKIP]
    mds += [os.path.join(d, f) for f in files if f.endswith(".md")]

for md in sorted(mds):
    text = open(md, encoding="utf-8").read()
    text_nocode = re.sub(r"```.*?```", "", text, flags=re.S)
    refs = re.findall(r"\]\(([^)\s]+)\)", text_nocode) + re.findall(r'(?:src|href)="([^"]+)"', text_nocode)
    for ref in refs:
        if re.match(r"^(https?:|mailto:|data:)", ref):
            continue
        path, _, frag = ref.partition("#")
        target = md if not path else os.path.normpath(os.path.join(os.path.dirname(md), path))
        checked += 1
        rel = os.path.relpath(md, ROOT)
        if not os.path.exists(target):
            problems.append(f"{rel}: mangler fil «{ref}»")
        elif frag and target.endswith(".md") and frag not in anchors(target):
            problems.append(f"{rel}: mangler anker «{ref}»")

print(f"sjekket {checked} lenker og bilder i {len(mds)} Markdown-filer")
for p in problems:
    print("FEIL", p)
print("OK" if not problems else f"{len(problems)} problemer")
sys.exit(1 if problems else 0)

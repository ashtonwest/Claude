#!/usr/bin/env python3
"""Art book builder: catalog drawings, catch duplicates, crop, and build a Kobo EPUB.

    python3 artbook.py add                 # take in everything in inbox/
    python3 artbook.py check               # list duplicates and rows missing details
    python3 artbook.py sheet               # contact sheet of how each piece will look
    python3 artbook.py build --sort date   # or: style, medium   (add --reverse)

The catalog (catalog.csv) is the source of truth. Edit it, rebuild, done.
Originals are copied into originals/ and never modified.
"""
import argparse
import csv
import hashlib
import html
import json
import shutil
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

try:  # optional: lets phone HEIC photos be read
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parent
INBOX = ROOT / "inbox"
ORIGINALS = ROOT / "originals"
BUILD = ROOT / "build"
CATALOG = ROOT / "catalog.csv"
CONFIG = ROOT / "book.json"

FIELDS = ["id", "file", "title", "date", "date_source", "medium", "style", "crop",
          "rotate", "enhance", "include", "cover", "duplicate_of", "notes",
          "source_name", "sha256"]
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff", ".bmp", ".gif"}
DEFAULT_CONFIG = {
    "title": "Art & Drawings",
    "author": "",
    "screen_width": 1264,
    "screen_height": 1680,
    "grayscale": False,
    "jpeg_quality": 88,
}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ---------------------------------------------------------------- catalog

def load_config():
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG.exists():
        cfg.update(json.loads(CONFIG.read_text()))
    return cfg


def load_catalog():
    if not CATALOG.exists():
        return []
    with CATALOG.open(newline="", encoding="utf-8") as f:
        return [{k: (row.get(k) or "").strip() for k in FIELDS} for row in csv.DictReader(f)]


def save_catalog(rows):
    with CATALOG.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)


def included(row):
    return row["include"].lower() not in ("no", "n", "false", "0")


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def next_id(rows):
    nums = [int(r["id"][1:]) for r in rows if r["id"][1:].isdigit()]
    return f"A{(max(nums) if nums else 0) + 1:04d}"


def exif_date(path):
    try:
        ex = Image.open(path).getexif()
        raw = ex.get_ifd(0x8769).get(36867) or ex.get(306)
        if raw:
            return datetime.strptime(str(raw)[:10], "%Y:%m:%d").strftime("%Y-%m-%d")
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------- duplicates

_features = {}


def features(path):
    """ORB keypoints of an image, cached. Survives crops, rotation and resizing."""
    import cv2
    import numpy as np
    key = str(path)
    if key not in _features:
        im = ImageOps.exif_transpose(Image.open(path)).convert("L")
        im.thumbnail((1200, 1200))
        orb = cv2.ORB_create(nfeatures=3000)
        _features[key] = orb.detectAndCompute(np.array(im), None)
    return _features[key]


def same_artwork(path_a, path_b, min_inliers=30):
    """True when one image is the other, or a crop / rotation / re-photo of it."""
    import cv2
    import numpy as np
    kp_a, des_a = features(path_a)
    kp_b, des_b = features(path_b)
    if des_a is None or des_b is None or len(kp_a) < 10 or len(kp_b) < 10:
        return 0
    matches = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(des_a, des_b, k=2)
    good = [m[0] for m in matches if len(m) == 2 and m[0].distance < 0.75 * m[1].distance]
    if len(good) < min_inliers:
        return 0
    src = np.float32([kp_a[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst = np.float32([kp_b[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    _, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
    inliers = int(mask.sum()) if mask is not None else 0
    return inliers if inliers >= min_inliers else 0


def find_duplicate(path, rows):
    for r in rows:
        if r["duplicate_of"]:
            continue  # compare against the kept copy only
        if same_artwork(path, ORIGINALS / r["file"]):
            return r
    return None


# ---------------------------------------------------------------- commands

def cmd_add(args):
    INBOX.mkdir(exist_ok=True)
    ORIGINALS.mkdir(exist_ok=True)
    rows = load_catalog()
    hashes = {r["sha256"]: r for r in rows}
    files = sorted(p for p in INBOX.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    if not files:
        print("inbox/ is empty. Drop new drawings there and run this again.")
        return
    added, exact, similar = [], [], []
    for p in files:
        digest = sha256_of(p)
        if digest in hashes:
            exact.append((p.name, hashes[digest]["id"]))
            p.unlink()
            continue
        dup = find_duplicate(p, rows)
        rid = next_id(rows)
        dest = ORIGINALS / f"{rid}{p.suffix.lower()}"
        shutil.copy2(p, dest)
        date = exif_date(dest)
        row = dict.fromkeys(FIELDS, "")
        row.update(id=rid, file=dest.name, title=f"Untitled {rid}", date=date,
                   date_source="photo" if date else "", include="yes",
                   source_name=p.name, sha256=digest)
        if dup:
            row.update(include="no", duplicate_of=dup["id"],
                       notes=f"looks like the same piece as {dup['id']}")
            similar.append((p.name, rid, dup["id"]))
        else:
            added.append((p.name, rid))
        rows.append(row)
        hashes[digest] = row
        p.unlink()
    save_catalog(rows)
    print(f"Added {len(added)} new piece(s).")
    for name, rid in added:
        print(f"  {rid}  {name}")
    if similar:
        print(f"{len(similar)} look like pieces already in the book (kept on file, left out of the book):")
        for name, rid, other in similar:
            print(f"  {rid}  {name}  ~ same as {other}")
    if exact:
        print(f"{len(exact)} exact repeat(s) skipped:")
        for name, other in exact:
            print(f"  {name}  = {other}")
    print("Next: fill in title / medium / style / crop in catalog.csv, then run build.")


def cmd_check(args):
    rows = load_catalog()
    live = [r for r in rows if included(r)]
    print(f"{len(rows)} catalogued, {len(live)} in the book.")
    for r in live:
        missing = [k for k in ("date", "medium", "style") if not r[k]]
        if missing:
            print(f"  {r['id']} missing: {', '.join(missing)}")
        if not (ORIGINALS / r["file"]).exists():
            print(f"  {r['id']} original file not found: {r['file']}")
    if args.duplicates:
        print("Comparing every pair for duplicates...")
        for i, a in enumerate(live):
            for b in live[i + 1:]:
                n = same_artwork(ORIGINALS / a["file"], ORIGINALS / b["file"])
                if n:
                    print(f"  {a['id']} and {b['id']} look like the same piece ({n} matching points)")


def render(row, cfg, size=None):
    """Original -> upright, cropped, rotated, cleaned, sized for the screen."""
    im = ImageOps.exif_transpose(Image.open(ORIGINALS / row["file"]))
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, "black")  # see-through digital canvases show as black in apps
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert("RGB")
    if row["crop"]:
        x0, y0, x1, y1 = (float(v) / 100 for v in row["crop"].replace(";", ",").split(","))
        w, h = im.size
        im = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    if row["rotate"]:
        im = im.rotate(-float(row["rotate"]), expand=True, fillcolor="white")
    if row["enhance"] == "paper":
        im = whiten_paper(im)
    if cfg["grayscale"]:
        im = ImageOps.autocontrast(im.convert("L"), cutoff=1).convert("RGB")
    im.thumbnail(size or (cfg["screen_width"], cfg["screen_height"]), Image.LANCZOS)
    return im


def whiten_paper(im):
    """Photos of white paper come out grey or yellow; pull the paper back to white."""
    import numpy as np
    a = np.asarray(im).astype("float32")
    small = np.asarray(im.resize((200, 200))).reshape(-1, 3).astype("float32")
    paper = np.percentile(small, 70, axis=0)  # paper is the dominant light tone
    a = a / paper * 250.0
    a = (a - 20) * (255 / 235.0)  # deepen the ink a little
    return Image.fromarray(a.clip(0, 255).astype("uint8"))


def pretty_date(d):
    if not d:
        return "Undated"
    parts = d.split("-")
    if len(parts) == 1:
        return parts[0]
    month = MONTHS[int(parts[1]) - 1]
    if len(parts) == 2:
        return f"{month} {parts[0]}"
    return f"{int(parts[2])} {month} {parts[0]}"


def group_key(row, field):
    if field == "date":
        return row["date"][:4] or "Undated"
    return row[field] or "Unsorted"


def grouped(rows, field, reverse=False):
    """[(group name, [rows])], named groups first, pieces in date order inside each."""
    last = {"Undated", "Unsorted"}
    groups = {}
    for r in sorted(rows, key=lambda r: (r["date"] == "", r["date"], r["id"])):
        groups.setdefault(group_key(r, field), []).append(r)
    names = sorted((n for n in groups if n not in last), reverse=reverse)
    names += [n for n in groups if n in last]
    return [(n, groups[n][::-1] if reverse else groups[n]) for n in names]


def font(size, bold=False):
    for name in ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def cmd_sheet(args):
    cfg = load_config()
    rows = [r for r in load_catalog() if included(r) or args.all]
    cell, cols = 420, 5
    lines = (len(rows) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, lines * (cell + 40)), "#888888")
    draw = ImageDraw.Draw(sheet)
    for i, r in enumerate(rows):
        im = render(r, cfg, (cell - 20, cell - 20))
        x, y = (i % cols) * cell, (i // cols) * (cell + 40)
        sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        draw.text((x + 10, y + cell + 4), f"{r['id']} {r['date']} {r['medium']}"[:44],
                  fill="white", font=font(17))
    BUILD.mkdir(exist_ok=True)
    out = BUILD / "contact-sheet.jpg"
    sheet.save(out, quality=85)
    print(out)


# ---------------------------------------------------------------- epub

CSS = """
body { margin: 0; padding: 0; text-align: center; font-family: sans-serif; }
h1 { font-size: 1.5em; margin: 1em 0 0.3em; }
h2 { font-size: 1.15em; margin: 1.2em 0 0.4em; border-bottom: 1px solid #999; }
p.cap { font-size: 0.7em; margin: 0.5em 0 0; line-height: 1.3; }
p.cap b { font-size: 1.15em; }
p.links { font-size: 0.6em; margin: 0.3em 0 0; color: #555; }
div.art { margin: 0; padding: 0; }
div.art img, div.cover img { display: block; margin: 0 auto; }
div.divider { margin-top: 35%; }
div.divider p { font-size: 0.9em; color: #555; }
a { color: inherit; }
div.tile { display: inline-block; width: 30%; margin: 0 1% 0.8em; vertical-align: top;
           font-size: 0.6em; line-height: 1.2; }
div.tile img { max-width: 100%; max-height: 9em; }
div.tile a { text-decoration: none; }
p.big { font-size: 1.1em; margin: 1em 0; }
"""


def page(title, body):
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
            '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">'
            f'<head><meta charset="utf-8"/><title>{html.escape(title)}</title>'
            '<link rel="stylesheet" type="text/css" href="style.css"/></head>'
            f'<body>{body}</body></html>')


def cmd_build(args):
    cfg = load_config()
    if args.gray:
        cfg["grayscale"] = True
    rows = [r for r in load_catalog() if included(r)]
    if not rows:
        sys.exit("Nothing to build: the catalog has no included pieces.")
    e = html.escape
    sw, sh = cfg["screen_width"], cfg["screen_height"]
    files = {}  # path inside the book -> bytes
    manifest, spine, nav_items = [], [], []

    def add_page(name, title, body, props=""):
        files[name] = page(title, body).encode("utf-8")
        manifest.append((name, "application/xhtml+xml", props))
        spine.append(name)

    def jpeg(im):
        import io
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=cfg["jpeg_quality"], optimize=True)
        return buf.getvalue()

    # images
    sizes = {}
    for r in rows:
        im = render(r, cfg, (sw, int(sh * 0.9)))  # leave room for the caption
        sizes[r["id"]] = im.size
        files[f"img/{r['id']}.jpg"] = jpeg(im)
        manifest.append((f"img/{r['id']}.jpg", "image/jpeg", ""))
        im.thumbnail((300, 300), Image.LANCZOS)
        files[f"thumb/{r['id']}.jpg"] = jpeg(im)
        manifest.append((f"thumb/{r['id']}.jpg", "image/jpeg", ""))

    # cover: chosen piece on a plain page with the title under it
    cover_row = next((r for r in rows if r["cover"].lower() in ("yes", "y", "true", "1")), rows[0])
    art = render(cover_row, cfg, (sw - 120, sh - 420))
    cover = Image.new("RGB", (sw, sh), "white")
    cover.paste(art, ((sw - art.width) // 2, 80 + (sh - 420 - art.height) // 2))
    draw = ImageDraw.Draw(cover)
    draw.text((sw // 2, sh - 230), cfg["title"], fill="black", font=font(76, True), anchor="mm")
    if cfg["author"]:
        draw.text((sw // 2, sh - 130), cfg["author"], fill="#333333", font=font(46), anchor="mm")
    files["img/cover.jpg"] = jpeg(cover)
    manifest.append(("img/cover.jpg", "image/jpeg", "cover-image"))
    add_page("cover.xhtml", cfg["title"],
             f'<div class="cover"><img src="img/cover.jpg" alt="{e(cfg["title"])}" style="width:100%"/></div>')
    nav_items.append(("cover.xhtml", "Cover", []))

    # front page with the three ways in
    add_page("start.xhtml", cfg["title"],
             f'<h1>{e(cfg["title"])}</h1><p>{e(cfg["author"])}</p>'
             f'<p>{len(rows)} pieces</p>'
             '<p class="big"><a href="idx-date.xhtml">Browse by date</a></p>'
             '<p class="big"><a href="idx-style.xhtml">Browse by style</a></p>'
             '<p class="big"><a href="idx-medium.xhtml">Browse by medium</a></p>')
    nav_items.append(("start.xhtml", "Start", []))

    for field in ("date", "style", "medium"):
        body = [f"<h1>By {field}</h1>"]
        for name, members in grouped(rows, field, args.reverse and field == args.sort):
            body.append(f"<h2>{e(name)} ({len(members)})</h2><div>")
            for r in members:
                body.append(f'<div class="tile"><a href="{r["id"]}.xhtml">'
                            f'<img src="thumb/{r["id"]}.jpg" alt=""/><br/>{e(r["title"])}</a></div>')
            body.append("</div>")
        add_page(f"idx-{field}.xhtml", f"By {field}", "".join(body))
        nav_items.append((f"idx-{field}.xhtml", f"Browse by {field}", []))

    # the pieces, in the chosen order, one chapter per group
    for gi, (name, members) in enumerate(grouped(rows, args.sort, args.reverse)):
        div = f"group-{gi + 1:02d}.xhtml"
        add_page(div, name, f'<div class="divider"><h1>{e(name)}</h1>'
                            f'<p>{len(members)} piece{"s" if len(members) != 1 else ""}</p></div>')
        children = []
        for r in members:
            w, h = sizes[r["id"]]
            # width that keeps the whole piece plus caption on one 3:4 screen
            pct = max(20, min(100, round(100 * (0.86 * sh / sw) * (w / h))))
            bits = [pretty_date(r["date"])] + [r[k] for k in ("medium", "style") if r[k]]
            body = (f'<div class="art"><img src="img/{r["id"]}.jpg" alt="{e(r["title"])}" '
                    f'style="width:{pct}%"/></div>'
                    f'<p class="cap"><b>{e(r["title"])}</b><br/>{e(" · ".join(bits))}</p>'
                    '<p class="links"><a href="idx-date.xhtml">date</a> · '
                    '<a href="idx-style.xhtml">style</a> · '
                    '<a href="idx-medium.xhtml">medium</a></p>')
            add_page(f"{r['id']}.xhtml", r["title"], body)
            children.append((f"{r['id']}.xhtml", r["title"], []))
        nav_items.append((div, name, children))

    # navigation
    def nav_list(items):
        out = ["<ol>"]
        for href, label, kids in items:
            out.append(f'<li><a href="{href}">{e(label)}</a>{nav_list(kids) if kids else ""}</li>')
        return "".join(out) + "</ol>"

    files["nav.xhtml"] = page("Contents", f'<nav epub:type="toc" id="toc"><h1>Contents</h1>{nav_list(nav_items)}</nav>').encode()
    manifest.append(("nav.xhtml", "application/xhtml+xml", "nav"))

    book_id = "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL, "artbook:" + cfg["title"] + cfg["author"]))
    order = [0]

    def ncx_points(items):
        out = []
        for href, label, kids in items:
            order[0] += 1
            out.append(f'<navPoint id="n{order[0]}" playOrder="{order[0]}"><navLabel><text>{e(label)}</text>'
                       f'</navLabel><content src="{href}"/>{ncx_points(kids)}</navPoint>')
        return "".join(out)

    files["toc.ncx"] = ('<?xml version="1.0" encoding="utf-8"?>'
                        '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head>'
                        f'<meta name="dtb:uid" content="{book_id}"/><meta name="dtb:depth" content="2"/>'
                        '<meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/>'
                        f'</head><docTitle><text>{e(cfg["title"])}</text></docTitle>'
                        f'<navMap>{ncx_points(nav_items)}</navMap></ncx>').encode()
    manifest.append(("toc.ncx", "application/x-dtbncx+xml", ""))
    files["style.css"] = CSS.encode()
    manifest.append(("style.css", "text/css", ""))

    items = "".join(
        f'<item id="i{n}" href="{href}" media-type="{mt}"' + (f' properties="{props}"' if props else "") + "/>"
        for n, (href, mt, props) in enumerate(manifest))
    ids = {href: f"i{n}" for n, (href, _, _) in enumerate(manifest)}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    files["content.opf"] = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">'
        '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
        f'<dc:identifier id="bookid">{book_id}</dc:identifier>'
        f'<dc:title>{e(cfg["title"])}</dc:title><dc:language>en</dc:language>'
        + (f'<dc:creator>{e(cfg["author"])}</dc:creator>' if cfg["author"] else "")
        + f'<meta property="dcterms:modified">{now}</meta>'
        f'<meta name="cover" content="{ids["img/cover.jpg"]}"/></metadata>'
        f'<manifest>{items}</manifest>'
        f'<spine toc="{ids["toc.ncx"]}">' + "".join(f'<itemref idref="{ids[s]}"/>' for s in spine)
        + '</spine></package>').encode()

    BUILD.mkdir(exist_ok=True)
    slug = "-".join("".join(c if c.isalnum() else " " for c in cfg["title"]).lower().split()) or "artbook"
    out = BUILD / f"{slug}-by-{args.sort}.kepub.epub"
    with zipfile.ZipFile(out, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml",
                   '<?xml version="1.0"?><container version="1.0" '
                   'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>'
                   '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
                   '</rootfiles></container>', zipfile.ZIP_DEFLATED)
        for name, data in files.items():
            store = zipfile.ZIP_STORED if name.endswith(".jpg") else zipfile.ZIP_DEFLATED
            z.writestr("OEBPS/" + name, data, store)
    print(f"{out}  ({len(rows)} pieces, {out.stat().st_size / 1e6:.1f} MB, sorted by {args.sort})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("add").set_defaults(fn=cmd_add)
    c = sub.add_parser("check")
    c.add_argument("--duplicates", action="store_true", help="re-compare every pair")
    c.set_defaults(fn=cmd_check)
    s = sub.add_parser("sheet")
    s.add_argument("--all", action="store_true", help="include left-out pieces")
    s.set_defaults(fn=cmd_sheet)
    b = sub.add_parser("build")
    b.add_argument("--sort", choices=["date", "style", "medium"], default="date")
    b.add_argument("--reverse", action="store_true")
    b.add_argument("--gray", action="store_true", help="grayscale, for black-and-white Kobos")
    b.set_defaults(fn=cmd_build)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

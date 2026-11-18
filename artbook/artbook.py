#!/usr/bin/env python3
"""Art book builder: catalog drawings, catch duplicates, crop, and build a Kobo EPUB.

    python3 artbook.py add                 # take in everything in inbox/
    python3 artbook.py check               # list duplicates and rows missing details
    python3 artbook.py sheet               # contact sheet of how each piece will look
    python3 artbook.py build --sort date   # one book; chapters by date, style or medium

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

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

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
    "jpeg_quality": 90,
    "color_boost": 1.6,
    "contrast_boost": 1.15,
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
    im.thumbnail(size or (cfg["screen_width"], cfg["screen_height"]), Image.LANCZOS)
    return tune_for_screen(im, cfg)


def whiten_paper(im):
    """Photos of paper come out grey, yellow or unevenly lit; flatten the paper to white."""
    import cv2
    import numpy as np
    a = np.asarray(im).astype("float32")
    h, w = a.shape[:2]
    scale = 500 / max(h, w)
    small = cv2.resize(a, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    # the brightest tone around each spot is the bare paper there, shadows included
    paper = cv2.dilate(small, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    paper = cv2.resize(cv2.GaussianBlur(paper, (0, 0), 25), (w, h), interpolation=cv2.INTER_LINEAR)
    a = a / np.maximum(paper, 1) * 255
    a = (a - 30) * (255 / 200.0)  # paper grain to pure white, ink a little deeper
    return Image.fromarray(a.clip(0, 255).astype("uint8"))


def is_monochrome(im):
    import numpy as np
    a = np.asarray(im.resize((120, 120))).astype("int16")
    return (a.max(axis=2) - a.min(axis=2)).mean() < 10


def tune_for_screen(im, cfg):
    """Colour e-ink is pale and coarse: black-and-white work goes out as crisp
    greyscale, colour work gets extra saturation and contrast to compensate."""
    if cfg["grayscale"] or is_monochrome(im):
        return ImageOps.autocontrast(im.convert("L"), cutoff=0.5).convert("RGB")
    im = ImageEnhance.Color(im).enhance(cfg["color_boost"])
    return ImageEnhance.Contrast(im).enhance(cfg["contrast_boost"])


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
# Every page is one full-screen picture (fixed layout), so the Kobo cannot
# rescale, re-margin or reflow anything: what is drawn here is what shows.

def fit_text(draw, text, size, bold, max_width):
    while size > 16 and draw.textlength(text, font=font(size, bold)) > max_width:
        size -= 2
    return font(size, bold)


def art_page(row, cfg):
    sw, sh = cfg["screen_width"], cfg["screen_height"]
    margin, caption = round(sw * 0.02), round(sh * 0.085)
    art = render(row, cfg, (sw - 2 * margin, sh - caption - 2 * margin))
    pg = Image.new("RGB", (sw, sh), "white")
    pg.paste(art, ((sw - art.width) // 2, margin + (sh - caption - 2 * margin - art.height) // 2))
    draw = ImageDraw.Draw(pg)
    when = pretty_date(row["date"])
    if row["date"] and row["date_source"] == "circa":
        when = "c. " + when
    details = "  \u00b7  ".join([when] + [row[k] for k in ("medium", "style") if row[k]])
    y = sh - caption
    draw.text((sw // 2, y + caption * 0.30), row["title"], fill="black", anchor="mm",
              font=fit_text(draw, row["title"], round(sh * 0.026), True, sw - 80))
    draw.text((sw // 2, y + caption * 0.70), details, fill="#222222", anchor="mm",
              font=fit_text(draw, details, round(sh * 0.019), False, sw - 80))
    return pg


def divider_page(name, count, cfg):
    sw, sh = cfg["screen_width"], cfg["screen_height"]
    pg = Image.new("RGB", (sw, sh), "white")
    draw = ImageDraw.Draw(pg)
    draw.text((sw // 2, sh * 0.44), name, fill="black", anchor="mm",
              font=fit_text(draw, name, round(sh * 0.11), True, sw - 120))
    draw.line((sw * 0.3, sh * 0.53, sw * 0.7, sh * 0.53), fill="black", width=4)
    draw.text((sw // 2, sh * 0.58), f"{count} piece{'s' if count != 1 else ''}", fill="#222222",
              anchor="mm", font=font(round(sh * 0.028)))
    return pg


def cover_page(row, cfg):
    sw, sh = cfg["screen_width"], cfg["screen_height"]
    art = render(row, cfg, (sw - 120, sh - 420))
    pg = Image.new("RGB", (sw, sh), "white")
    pg.paste(art, ((sw - art.width) // 2, 80 + (sh - 420 - art.height) // 2))
    draw = ImageDraw.Draw(pg)
    draw.text((sw // 2, sh - 230), cfg["title"], fill="black", font=font(76, True), anchor="mm")
    if cfg["author"]:
        draw.text((sw // 2, sh - 130), cfg["author"], fill="#333333", font=font(46), anchor="mm")
    return pg


def cmd_build(args):
    cfg = load_config()
    if args.gray:
        cfg["grayscale"] = True
    rows = [r for r in load_catalog() if included(r)]
    if not rows:
        sys.exit("Nothing to build: the catalog has no included pieces.")
    e = html.escape
    sw, sh = cfg["screen_width"], cfg["screen_height"]
    files, manifest, spine, nav_items = {}, [], [], []

    def add_page(name, title, im, cover=False):
        import io
        buf = io.BytesIO()
        if is_monochrome(im):
            im = im.convert("L")  # smaller file, and e-ink shows pure greys at full sharpness
        im.save(buf, "JPEG", quality=cfg["jpeg_quality"], optimize=True)
        files[f"img/{name}.jpg"] = buf.getvalue()
        manifest.append((f"img/{name}.jpg", "image/jpeg", "cover-image" if cover else ""))
        files[f"{name}.xhtml"] = (
            '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
            '<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/>'
            f'<title>{e(title)}</title><meta name="viewport" content="width={sw}, height={sh}"/>'
            '<link rel="stylesheet" type="text/css" href="style.css"/></head>'
            f'<body><img src="img/{name}.jpg" alt="{e(title)}" width="{sw}" height="{sh}"/></body></html>'
        ).encode("utf-8")
        manifest.append((f"{name}.xhtml", "application/xhtml+xml", ""))
        spine.append(f"{name}.xhtml")

    cover_row = next((r for r in rows if r["cover"].lower() in ("yes", "y", "true", "1")), rows[0])
    add_page("cover", cfg["title"], cover_page(cover_row, cfg), cover=True)
    nav_items.append(("cover.xhtml", "Cover", []))

    # one chapter per group, pieces in date order inside it
    for gi, (name, members) in enumerate(grouped(rows, args.sort, args.reverse)):
        div = f"chapter-{gi + 1:02d}"
        add_page(div, name, divider_page(name, len(members), cfg))
        children = []
        for r in members:
            add_page(r["id"], r["title"], art_page(r, cfg))
            children.append((f"{r['id']}.xhtml", r["title"], []))
        nav_items.append((f"{div}.xhtml", name, children))

    def nav_list(items):
        out = ["<ol>"]
        for href, label, kids in items:
            out.append(f'<li><a href="{href}">{e(label)}</a>{nav_list(kids) if kids else ""}</li>')
        return "".join(out) + "</ol>"

    files["nav.xhtml"] = (
        '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">'
        f'<head><meta charset="utf-8"/><title>Contents</title><meta name="viewport" content="width={sw}, height={sh}"/></head>'
        f'<body><nav epub:type="toc" id="toc"><h1>Contents</h1>{nav_list(nav_items)}</nav></body></html>').encode()
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
    files["style.css"] = b"html, body { margin: 0; padding: 0; } img { display: block; }\n"
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
        '<meta property="rendition:layout">pre-paginated</meta>'
        '<meta property="rendition:orientation">portrait</meta>'
        '<meta property="rendition:spread">none</meta>'
        f'<meta name="cover" content="{ids["img/cover.jpg"]}"/></metadata>'
        f'<manifest>{items}</manifest>'
        f'<spine toc="{ids["toc.ncx"]}">' + "".join(f'<itemref idref="{ids[s]}"/>' for s in spine)
        + '</spine></package>').encode()

    BUILD.mkdir(exist_ok=True)
    out = BUILD / f"{cfg['title']}.kepub.epub"
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
    print(f"{out}  ({len(rows)} pieces, {out.stat().st_size / 1e6:.1f} MB, chapters by {args.sort})")


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

#!/usr/bin/env python3
"""Build the presenter from stops.json.

Each stop takes one frame from a working copy of a source video (never the original).
Flat stops: one still view. Look-around stops ("pano"): the whole 360 frame plus a wide and a
close view; their shapes are drawn on the close still and converted to directions on the sphere,
so the same marks serve the look-around view and the still fallback.

usage: build.py <dir with v1/ v2/ v3/ video copies> <cache dir>
Writes index.html (page body for publishing) and Itirapina-roteiro-offline.html (complete file).
"""
import base64, io, json, pathlib, subprocess, sys
from PIL import Image
import proj

here = pathlib.Path(__file__).resolve().parent
src, cache = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
cache.mkdir(parents=True, exist_ok=True)
views = here / "views"; views.mkdir(exist_ok=True)
uri = lambda b: "data:image/jpeg;base64," + base64.b64encode(b).decode()

def frame(v):
    eq = cache / f"{v['video']}_{v['t']}.png"
    if not eq.exists():
        video = next((src / v["video"]).glob("*.mp4"))
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(v["t"]), "-i", str(video), "-frames:v", "1", str(eq)], check=True)
    return eq

out = []
for s in json.loads((here / "stops.json").read_text()):
    o = {k: s.get(k, "") for k in ("id", "room", "item", "do", "limit", "status")}
    if "list" in s:
        o["list"] = s["list"]; out.append(o); continue
    v = s["source"]; eq = frame(v); jpg = views / f"{s['id']}.jpg"
    o["shapes"] = s["shapes"]
    if "pano" in s:
        p = s["pano"]; im = Image.open(eq)
        proj.render(im, p["close"]).save(jpg, quality=88)
        buf = io.BytesIO(); im.convert("RGB").save(buf, "JPEG", quality=80)
        ll = lambda q: proj.px_to_lonlat(q[0], q[1], p["close"])
        o["pano"] = {"eq": uri(buf.getvalue()), "wide": p["wide"], "close": p["close"],
                     "shapes": [dict(sh, pts=[ll(q) for q in sh["pts"]], **({"at": ll(sh["at"])} if "at" in sh else {})) for sh in s["shapes"]]}
    else:
        vf = f"v360=e:flat:yaw={v['yaw']}:pitch={v['pitch']}:h_fov={v['fov']}:w=1600:h=900:interp=lanczos,unsharp=5:5:0.6"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(eq), "-vf", vf, "-q:v", "4", str(jpg)], check=True)
    o["img"] = uri(jpg.read_bytes())
    out.append(o)

page = (here / "template.html").read_text().replace("/*__STOPS__*/[]", json.dumps(out, ensure_ascii=False))
(here / "index.html").write_text(page)
head, body = page.split('<div id="stage">', 1)
full = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}'
        'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
        + head + '</head>\n<body>\n<div id="stage">' + body + '\n</body>\n</html>\n')
(here / "Itirapina-roteiro-offline.html").write_text(full)
print(len(out), "stops;", round(len(page) / 1e6, 2), "MB page;", round(len(full) / 1e6, 2), "MB offline file")

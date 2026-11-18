#!/usr/bin/env python3
"""Assemble the guided tour.

Inputs: tour.json (stops, outlines, scope list), per-clip motion data and tracked outlines, encoded clips, source video copies.
Outputs: tour/ (index.html page body + media/ for publishing) and Itirapina-tour-offline/ (complete index.html,
media/<name>.js with each clip and still embedded, guia-v5.html).
usage: build_tour.py <scratch dir with src/, tour/data and tour/media>
"""
import base64, io, json, math, pathlib, shutil, subprocess, sys
from PIL import Image
import proj

here = pathlib.Path(__file__).resolve().parent; S = pathlib.Path(sys.argv[1])
cfg = json.loads((here / "tour.json").read_text()); FPS = 10; STEP = 2.5
out = here / "tour"; shutil.rmtree(out / "media", ignore_errors=True); (out / "media").mkdir(parents=True)
off = here / "Itirapina-tour-offline"; shutil.rmtree(off, ignore_errors=True); (off / "media").mkdir(parents=True)
stillcache = S / "tour/stills"; stillcache.mkdir(parents=True, exist_ok=True)

clips, data = {}, {}
for cid, c in cfg["clips"].items():
    d = json.loads((S / "tour/data" / f"{cid}.json").read_text()); data[cid] = d
    assert abs(d["t0"] - c["t0"]) < 1e-6 and abs(d["t1"] - c["t1"]) < 1e-6, f"clip {cid}: motion data does not match tour.json"
    clips[cid] = {"video": c["video"], "t0": c["t0"], "dur": round(c["t1"] - c["t0"], 2), "ref": d["ref"], "rot": d["rot"], "hd": d["hd"]}

def source_frame(video, src):   # one full frame from the working copy of a source video
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(src), "-i", str(next((S / "src" / video).glob("*.mp4"))), "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "-"], stdout=subprocess.PIPE, check=True).stdout
    return Image.open(io.BytesIO(png)).convert("RGB")

# stops
nodes = []
for n in cfg["nodes"]:
    c = cfg["clips"][n["clip"]]; o = {"id": n["id"], "name": n["name"], "clip": n["clip"], "t": round(n["src"] - c["t0"], 2), "look": [n["view"]["yaw"], n["view"]["pitch"]] if n.get("view") else None}
    if n.get("cut"): o["cut"] = n["cut"]
    if n.get("cont"): o["cont"] = True
    if n.get("outlines"):   # where to face on a fresh arrival so the marked surfaces are in view
        v = [0.0, 0.0, 0.0]
        for ol in n["outlines"]:
            for q in ol["pts"]:
                lo, la = proj.px_to_lonlat(q[0], q[1], n["view"]); lo, la = math.radians(lo), math.radians(la)
                v[0] += math.cos(la) * math.sin(lo); v[1] += math.sin(la); v[2] += math.cos(la) * math.cos(lo)
        m = math.sqrt(sum(x * x for x in v)) or 1
        o["frame"] = [round(math.degrees(math.atan2(v[0], v[2])), 1), round(max(-25, min(15, math.degrees(math.asin(v[1] / m)))), 1)]
    nodes.append(o)

# walks between stops, and a viewpoint every few steps along each (plus every frame where outlines were drawn)
is_leg = lambda i: i + 1 < len(nodes) and not nodes[i + 1].get("cut") and ((nodes[i]["clip"] == nodes[i + 1]["clip"] and nodes[i + 1]["t"] > nodes[i]["t"]) or nodes[i + 1].get("cont"))
keys = {}   # clip -> {frame index: set of outline ids drawn on that frame}
for n in cfg["nodes"] + cfg.get("anchors", []):
    k = int(round((n["src"] - cfg["clips"][n["clip"]]["t0"]) * FPS)); keys.setdefault(n["clip"], {}).setdefault(k, set()).update(o["target"] for o in n.get("outlines", []))
way = []
for i in range(len(nodes) - 1):
    if not is_leg(i): continue
    a, b = nodes[i], nodes[i + 1]; cid = b["clip"]; t0 = a["t"] if a["clip"] == cid else 0.0; t1 = b["t"]
    steps = max(1, round((t1 - t0) / STEP)); ts = [round(t0 + (t1 - t0) * j / steps, 1) for j in range(steps + 1)]; ts[0], ts[-1] = round(t0, 1), round(t1, 1)
    for k in sorted(keys.get(cid, {})):
        tk = k / FPS
        if t0 + 0.3 < tk < t1 - 0.3:
            j = min(range(1, len(ts) - 1), key=lambda j: abs(ts[j] - tk), default=None)
            if j is not None and abs(ts[j] - tk) < STEP * 0.6: ts[j] = tk
            else: ts.append(tk)
    way.append(sorted(set(ts)))

# outlines: only on the frames where they were drawn (and the frame either side), never carried further
tracks = {}
for cid in clips:
    tr = json.loads((S / "tour/data" / f"{cid}.tracks.json").read_text())["tracks"]; kept = {}
    for tid, frames in tr.items():
        fm = {i: pts for i, pts in frames}
        for k, ids in keys.get(cid, {}).items():
            if tid in ids:
                for i in (k - 1, k, k + 1):
                    if i in fm: kept.setdefault(tid, {})[str(i)] = [round(x, 1) for x in fm[i]]
    tracks[cid] = kept

# media: clips, one sharp still per viewpoint, a thumbnail per stop
total = 0
def ship(name, ext, b):
    global total; total += len(b); (out / "media" / f"{name}.{ext}").write_bytes(b)
    (off / "media" / f"{name}.js").write_text('(window.__MEDIA=window.__MEDIA||{})["%s"]="%s";' % (name, base64.b64encode(b).decode()))
for cid in clips: ship(cid, "mp4", (S / "tour/media" / f"{cid}.mp4").read_bytes())
seg = 0; done = set()
for i in range(len(nodes) - 1):
    if not is_leg(i): continue
    cid = nodes[i + 1]["clip"]; c = cfg["clips"][cid]
    for t in way[seg]:
        key = f"{cid}_{int(round(t * FPS))}"
        if key in done: continue
        done.add(key); jpg = stillcache / f"{key}.jpg"
        if not jpg.exists(): source_frame(c["video"], c["t0"] + t).resize((2880, 1440), Image.LANCZOS).save(jpg, quality=80)
        ship("w_" + key, "jpg", jpg.read_bytes())
    seg += 1
for n, o in zip(cfg["nodes"], nodes):
    c = cfg["clips"][n["clip"]]; jpg = stillcache / f"{n['clip']}_{int(round(o['t'] * FPS))}.jpg"
    look = o.get("frame") or o.get("look") or [data[n["clip"]]["ref"][int(round(o["t"] * FPS))], -6]
    th = proj.render(Image.open(jpg), {"yaw": look[0], "pitch": look[1], "w": 95, "h": 60}, 208, 116); buf = io.BytesIO(); th.save(buf, "JPEG", quality=70)
    o["thumb"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

tour = {"clips": clips, "tracks": tracks, "nodes": nodes, "way": way, "targets": cfg["targets"], "scope": cfg["scope"]}
page = (here / "tour_template.html").read_text().replace("/*__TOUR__*/{}", json.dumps(tour, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
(out / "index.html").write_text(page)
head, body = page.split('<div id="stage">', 1)
(off / "index.html").write_text('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    + head + '</head>\n<body>\n<div id="stage">' + body + '\n</body>\n</html>\n')
v5 = here / "Itirapina-roteiro-offline.html"
if v5.exists(): shutil.copy(v5, off / "guia-v5.html"); shutil.copy(v5, out / "guia-v5.html")
print(len(nodes), "stops,", len(done), "viewpoints,", len(clips), "clips,", round(total / 1e6, 1), "MB media,", sum(len(v) for v in tracks.values()), "outline sets")

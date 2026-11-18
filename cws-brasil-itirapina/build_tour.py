#!/usr/bin/env python3
"""Assemble the guided tour.

Inputs: tour.json (stops, outlines, scope list), per-clip motion data and tracked outlines, encoded clips.
Outputs in tour/: index.html (page body for publishing) + media/<clip>.mp4, and
Itirapina-tour-offline/ (complete index.html, media/<clip>.js with the clip embedded, guia-v5.html).
usage: build_tour.py <scratch dir with tour/data and tour/media>
"""
import base64, json, pathlib, shutil, sys, hashlib
import proj
here = pathlib.Path(__file__).resolve().parent; S = pathlib.Path(sys.argv[1])
cfg = json.loads((here / "tour.json").read_text())
clips, tracks = {}, {}
for cid, c in cfg["clips"].items():
    d = json.loads((S / "tour/data" / f"{cid}.json").read_text())
    clips[cid] = {"video": c["video"], "t0": c["t0"], "dur": round(c["t1"] - c["t0"], 2), "ref": d["ref"], "rot": d["rot"]}
    tr = json.loads((S / "tour/data" / f"{cid}.tracks.json").read_text())["tracks"]
    tracks[cid] = {k: {str(i): [round(x, 1) for x in pts] for i, pts in v} for k, v in tr.items()}
nodes = []
for n in cfg["nodes"]:
    c = cfg["clips"][n["clip"]]; o = {"id": n["id"], "name": n["name"], "clip": n["clip"], "t": round(n["src"] - c["t0"], 2), "look": [n["view"]["yaw"], n["view"]["pitch"]] if n.get("view") else None}
    if n.get("look"): o["look"] = n["look"]
    if n.get("arrow"): o["arrow"] = proj.px_to_lonlat(n["arrow"][0], n["arrow"][1], n["view"])
    if n.get("cut"): o["cut"] = n["cut"]
    nodes.append(o)
tour = {"clips": clips, "tracks": tracks, "nodes": nodes, "targets": cfg["targets"], "scope": cfg["scope"]}
page = (here / "tour_template.html").read_text().replace("/*__TOUR__*/{}", json.dumps(tour, ensure_ascii=False, separators=(",", ":")))
out = here / "tour"; (out / "media").mkdir(parents=True, exist_ok=True)
(out / "index.html").write_text(page)
off = here / "Itirapina-tour-offline"; shutil.rmtree(off, ignore_errors=True); (off / "media").mkdir(parents=True)
head, body = page.split('<div id="stage">', 1)
(off / "index.html").write_text('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    + head + '</head>\n<body>\n<div id="stage">' + body + '\n</body>\n</html>\n')
total = 0
for cid in clips:
    b = (S / "tour/media" / f"{cid}.mp4").read_bytes(); total += len(b)
    (out / "media" / f"{cid}.mp4").write_bytes(b)
    (off / "media" / f"{cid}.js").write_text('(window.__MEDIA=window.__MEDIA||{})["%s"]="%s";' % (cid, base64.b64encode(b).decode()))
v5 = here / "Itirapina-roteiro-offline.html"
if v5.exists(): shutil.copy(v5, off / "guia-v5.html"); shutil.copy(v5, out / "guia-v5.html")
print(len(nodes), "stops,", len(clips), "clips,", round(total / 1e6, 1), "MB video,", sum(len(v) for v in tracks.values()), "outline tracks")

#!/usr/bin/env python3
"""Build the presenter from stops.json.

For each stop: take one frame from a working copy of the source video (never the
original), render a flat view of the 360 frame, and embed it in a single HTML file.

usage: build.py <dir with v1/ and v2/ video copies> <cache dir>
"""
import base64, json, pathlib, subprocess, sys

here = pathlib.Path(__file__).resolve().parent
src = pathlib.Path(sys.argv[1])
cache = pathlib.Path(sys.argv[2])
cache.mkdir(parents=True, exist_ok=True)
views = here / "views"
views.mkdir(exist_ok=True)

stops = json.loads((here / "stops.json").read_text())
out = []
for s in stops:
    v = s["source"]
    eq = cache / f"{v['video']}_{v['t']}.png"
    if not eq.exists():
        video = next((src / v["video"]).glob("*.mp4"))
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(v["t"]), "-i", str(video), "-frames:v", "1", str(eq)], check=True)
    jpg = views / f"{s['id']}.jpg"
    vf = f"v360=e:flat:yaw={v['yaw']}:pitch={v['pitch']}:h_fov={v['fov']}:w=1600:h=900:interp=lanczos,unsharp=5:5:0.6"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(eq), "-vf", vf, "-q:v", "4", str(jpg)], check=True)
    out.append({
        "id": s["id"], "room": s["room"], "item": s.get("item", ""), "do": s["do"], "limit": s.get("limit", ""),
        "status": s["status"], "shapes": s["shapes"],
        "img": "data:image/jpeg;base64," + base64.b64encode(jpg.read_bytes()).decode(),
    })

html = (here / "template.html").read_text().replace("/*__STOPS__*/[]", json.dumps(out, ensure_ascii=False))
(here / "index.html").write_text(html)
print(len(out), "stops,", round(len(html) / 1e6, 2), "MB")

# track.py <clip> : follow each authored outline through the clip frames; stop when the match is not solid
import sys, json, numpy as np, cv2
sys.path.insert(0, "/home/user/Claude/cws-brasil-itirapina"); import proj
S = "/tmp/claude-0/-home-user-Claude/ac14c686-5231-5440-9483-820e9194016f/scratchpad"
cid = sys.argv[1]; meta = json.load(open(f"{S}/tour/data/{cid}.json")); fr = np.load(f"{S}/tour/frames/{cid}.npy", mmap_mode="r")
N, H, W = fr.shape; FPS = meta["fps"]; TOUR = json.load(open("/home/user/Claude/cws-brasil-itirapina/tour.json"))
auth = [dict(o, src=n["src"], view=n.get("view")) for n in TOUR["nodes"] + TOUR.get("anchors", []) if n["clip"] == cid for o in n.get("outlines", [])]
def to_px(ll): return [(ll[0] / 360 + 0.5) * W, (0.5 - ll[1] / 180) * H]
def to_ll(p): return [round(((p[0] / W - 0.5) * 360 + 180) % 360 - 180, 2), round((0.5 - p[1] / H) * 180, 2)]
def small_step(A, B, poly):
    """Small fixtures on plain walls (lights, AC units): follow the object itself; accept only a tight, consistent shift."""
    x0, y0 = poly.min(0); x1, y1 = poly.max(0)
    if max(x1 - x0, y1 - y0) > 110: return None
    m = np.zeros((H, W), np.uint8); cv2.rectangle(m, (int(x0 - 14), int(y0 - 14)), (int(x1 + 14), int(y1 + 14)), 255, -1)
    pts = cv2.goodFeaturesToTrack(A, 40, 0.01, 3, mask=m)
    if pts is None or len(pts) < 5: return None
    q, st, _ = cv2.calcOpticalFlowPyrLK(A, B, pts, None, winSize=(21, 21), maxLevel=3)
    bk, st2, _ = cv2.calcOpticalFlowPyrLK(B, A, q, None, winSize=(21, 21), maxLevel=3)
    ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.abs(bk - pts).reshape(-1, 2).max(1) < 0.8)
    if ok.sum() < 5: return None
    d = (q - pts).reshape(-1, 2)[ok]; med = np.median(d, 0)
    if np.median(np.abs(d - med)) > 1.2 or np.abs(med).max() > 45: return None
    new = poly + med
    if new[:, 1].min() < H * 0.08 or new[:, 1].max() > H * 0.93: return None
    return new.astype(np.float32)
def step(A, B, poly):
    r = big_step(A, B, poly)
    return r if r is not None else small_step(A, B, poly)
def big_step(A, B, poly):
    x0, y0 = poly.min(0); x1, y1 = poly.max(0); pad = 0.3 * max(x1 - x0, y1 - y0, 40)
    m = np.zeros((H, W), np.uint8); cv2.rectangle(m, (int(x0 - pad), int(y0 - pad)), (int(x1 + pad), int(y1 + pad)), 255, -1)
    pts = cv2.goodFeaturesToTrack(A, 300, 0.005, 5, mask=m)
    if pts is None or len(pts) < 12: return None
    q, st, _ = cv2.calcOpticalFlowPyrLK(A, B, pts, None, winSize=(27, 27), maxLevel=3)
    bk, st2, _ = cv2.calcOpticalFlowPyrLK(B, A, q, None, winSize=(27, 27), maxLevel=3)
    ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.abs(bk - pts).reshape(-1, 2).max(1) < 1.0)
    if ok.sum() < 12: return None
    Hm, inl = cv2.findHomography(pts[ok], q[ok], cv2.RANSAC, 2.5)
    if Hm is None or inl.sum() < 10 or inl.mean() < 0.45: return None
    new = cv2.perspectiveTransform(poly.reshape(-1, 1, 2).astype(np.float32), Hm).reshape(-1, 2)
    a0, a1 = cv2.contourArea(poly.astype(np.float32)), cv2.contourArea(new.astype(np.float32))
    if not (0.75 < a1 / max(a0, 1) < 1.33) or np.abs(new - poly).max() > 70: return None
    if new[:, 1].min() < H * 0.08 or new[:, 1].max() > H * 0.93: return None
    return new
out = {}
for a in auth:   # {target, src, view:{yaw,pitch,w,h}, pts:[[x,y]..] in the 1600x900 authoring view, max: seconds}
    k = int(round((a["src"] - meta["t0"]) * FPS)); ll = [proj.px_to_lonlat(x, y, a["view"]) for x, y in a["pts"]]
    poly0 = np.array([to_px(q) for q in ll], np.float32); shift = int(W / 2 - poly0[:, 0].mean())
    roll = lambda i: np.roll(np.asarray(fr[i]), shift, axis=1)
    track = {k: poly0 + [shift, 0]}; lim = int(a.get("max", 8) * FPS)
    def fill(p): x, y, w, h = cv2.boundingRect(p.astype(np.float32)); return cv2.contourArea(p.astype(np.float32)) / max(1, w * h), cv2.contourArea(p.astype(np.float32))
    f0, a0 = fill(track[k])
    for d in (1, -1):
        poly = track[k]; i = k
        while 0 <= i + d < N and abs(i + d - k) <= lim:
            new = step(roll(i), roll(i + d), poly)
            if new is None: break
            f1, a1 = fill(new)
            if not (0.7 < f1 / max(f0, 1e-6) < 1.4) or not (0.35 < a1 / max(a0, 1) < 2.8): break
            poly = new; i += d; track[i] = poly
    frames = sorted(track); out.setdefault(a["target"], []).append({"key": k, "f": {i: [to_ll(p - [shift, 0]) for p in track[i]] for i in frames}})
    print(a["target"], "key", k, "tracked", frames[0] / FPS, "->", frames[-1] / FPS, "s")
# merge: at each frame use the outline from the nearest authored key
res = {}
for tg, lst in out.items():
    fs = sorted(set(i for t in lst for i in t["f"])); res[tg] = {}
    for i in fs:
        best = min((t for t in lst if i in t["f"]), key=lambda t: abs(i - t["key"])); res[tg][i] = best["f"][i]
json.dump({"fps": FPS, "tracks": {tg: [[i, [c for p in v for c in p]] for i, v in sorted(d.items())] for tg, d in res.items()}}, open(f"{S}/tour/data/{cid}.tracks.json", "w"))

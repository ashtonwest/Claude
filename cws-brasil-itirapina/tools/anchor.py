import pycolmap, json, math, sys, numpy as np, pathlib
sys.path.insert(0, "/home/user/Claude/cws-brasil-itirapina"); import proj
S = pathlib.Path("/tmp/claude-0/-home-user-Claude/ac14c686-5231-5440-9483-820e9194016f/scratchpad")
rec = pycolmap.Reconstruction(str(S / "sfm1/out/0")); T = json.load(open("/home/user/Claude/cws-brasil-itirapina/tour.json"))
SRC0, RATE, CLIP_T0, W, H = 291.0, 3.0, 293.0, 1920, 960
ims = sorted(rec.images.values(), key=lambda im: im.name); N = len(ims)
Rs = np.array([im.cam_from_world().rotation.matrix() for im in ims]); ts = np.array([im.cam_from_world().translation for im in ims]); Cs = np.array([-R.T @ t for R, t in zip(Rs, ts)])
P3 = {pid: p.xyz for pid, p in rec.points3D.items()}
# which pixel convention does the equirect model use? try candidates against the observed keypoints
def cam_to_lonlat(v, conv):
    x, y, z = v[..., 0], v[..., 1], v[..., 2]; n = np.linalg.norm(v, axis=-1)
    if conv == 0: return np.degrees(np.arctan2(x, z)), np.degrees(-np.arcsin(y / n))     # x right, y down, z forward
    if conv == 1: return np.degrees(np.arctan2(x, z)), np.degrees(np.arcsin(y / n))
    if conv == 2: return np.degrees(np.arctan2(-x, -z)), np.degrees(-np.arcsin(y / n))
im = ims[40]; obs = [(p.xy, P3[p.point3D_id]) for p in im.points2D if p.has_point3D()]
xy = np.array([o[0] for o in obs]); X = np.array([o[1] for o in obs]); Xc = X @ Rs[40].T + ts[40]
for conv in (0, 1, 2):
    lon, lat = cam_to_lonlat(Xc, conv); u = (lon / 360 + 0.5) * W; v = (0.5 - lat / 180) * H
    print("conv", conv, "median px error", round(float(np.median(np.hypot(((u - xy[:, 0] + W / 2) % W) - W / 2, v - xy[:, 1]))), 2))
CONV = 0
def lonlat_to_cam(lon, lat):
    lo, la = math.radians(lon), math.radians(lat); return np.array([math.cos(la) * math.sin(lo), -math.sin(la), math.cos(la) * math.cos(lo)])
up = (Rs.transpose(0, 2, 1) @ np.array([0, -1.0, 0])).mean(0); up /= np.linalg.norm(up)
ups = Rs.transpose(0, 2, 1) @ np.array([0, -1.0, 0]); print("up consistency, max deviation deg:", round(float(np.degrees(np.arccos(np.clip(ups @ up, -1, 1))).max()), 2))
def slerp_pose(f):   # f = fractional SfM frame index
    f = max(0, min(N - 1, f)); i = int(math.floor(f)); j = min(N - 1, i + 1); k = f - i
    qa = pycolmap.Rotation3d(Rs[i]); qb = pycolmap.Rotation3d(Rs[j]); a, b = np.array(qa.quat), np.array(qb.quat)
    if a @ b < 0: b = -b
    q = a + (b - a) * k; q /= np.linalg.norm(q); R = pycolmap.Rotation3d(q).matrix(); C = Cs[i] + (Cs[j] - Cs[i]) * k
    return R, C
fidx = lambda src: (src - SRC0) * RATE
pathlen = float(np.linalg.norm(np.diff(Cs, axis=0), axis=1).sum()); print("camera path length (model units):", round(pathlen, 2))
def fit_plane(Q, tol):
    best = None; rng = np.random.default_rng(0)
    for _ in range(400):
        a, b, c = Q[rng.choice(len(Q), 3, replace=False)]; n = np.cross(b - a, c - a); ln = np.linalg.norm(n)
        if ln < 1e-9: continue
        n /= ln; d = np.abs((Q - a) @ n); inl = d < tol
        if best is None or inl.sum() > best[0]: best = (inl.sum(), inl)
    Qi = Q[best[1]]; c = Qi.mean(0); n = np.linalg.svd(Qi - c)[2][-1]; return c, n, int(best[0])
def inside(x, y, poly):
    c = False; n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i - 1) % n]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]: c = not c
    return c
SKIP = {("telao", 309), ("telao", 319.5), ("painel@dir", 309), ("painel@dir", 319.5)}
HORIZ = {"porcelanato", "carpete", "poltronas", "poltronas3"}
ALLX = np.array(list(P3.values())); TOL = pathlen * 0.002
def in_poly_points(R, C, view, poly):
    Xc = (ALLX - C) @ R.T; lon, lat = cam_to_lonlat(Xc, CONV); a, b = np.radians(lon), np.radians(lat); fo = proj.focal(view, 1600, 900); yw, pi = math.radians(view["yaw"]), math.radians(view["pitch"])
    wx, wy, wz = np.cos(b) * np.sin(a), np.sin(b), np.cos(b) * np.cos(a); rx, rz = wx * math.cos(yw) - wz * math.sin(yw), wx * math.sin(yw) + wz * math.cos(yw); y, z = wy * math.cos(pi) - rz * math.sin(pi), wy * math.sin(pi) + rz * math.cos(pi)
    ok = z > 0.05; px = 800 + fo * rx / np.where(ok, z, 1); py = 450 - fo * y / np.where(ok, z, 1)
    return ALLX[[i for i in np.nonzero(ok)[0] if inside(px[i], py[i], poly)]]
def mode1d(v, tol):
    best = max(v, key=lambda c: (np.abs(v - c) < tol).sum()); inl = np.abs(v - best) < tol; return float(v[inl].mean()), int(inl.sum())
e1 = np.cross(up, [1, 0, 0]); e1 /= np.linalg.norm(e1); e2 = np.cross(up, e1)
cand, cam_h = [], []
for n in [x for x in T["nodes"] if x["clip"] == "P"]:
    R, C = slerp_pose(fidx(n["src"]))
    for o in n.get("outlines", []):
        if (o["target"], n["src"]) in SKIP: continue
        Q = in_poly_points(R, C, n["view"], o["pts"]); kind = o["target"].split("@")[0]; plane = None; how = ""
        if kind in HORIZ:
            if len(Q) >= 6:
                h, ninl = mode1d(Q @ up, TOL * 4); plane = (up * h, up); how = f"horizontal, height from {ninl}/{len(Q)} points"
                if kind in ("porcelanato", "carpete") and ninl >= 10: cam_h.append(C @ up - h)
        elif len(Q) >= 6:
            A = np.c_[Q @ e1, Q @ e2]; best = None; rng = np.random.default_rng(1)
            for _ in range(300):
                i, j = rng.choice(len(A), 2, replace=False); d = A[j] - A[i]; ln = np.linalg.norm(d)
                if ln < 1e-6: continue
                nn = np.array([-d[1], d[0]]) / ln; inl = np.abs((A - A[i]) @ nn) < TOL * 4
                if best is None or inl.sum() > best[0]: best = (inl.sum(), inl)
            Ai = A[best[1]]; c2 = Ai.mean(0); nn = np.linalg.svd(Ai - c2)[2][-1]; nrm = nn[0] * e1 + nn[1] * e2
            if best[0] >= 5: plane = (c2[0] * e1 + c2[1] * e2 + up * float((Q[best[1]] @ up).mean()), nrm); how = f"vertical, {int(best[0])}/{len(Q)} points"
        cand.append((n, o, R, C, plane, how, len(Q)))
hc = float(np.median(cam_h)) if cam_h else None; print("camera height above floor (model units):", hc and round(hc, 3), "from", len(cam_h), "floor fits")
shapes = []
for n, o, R, C, plane, how, nq in cand:
    kind = o["target"].split("@")[0]
    if plane is None and kind in ("porcelanato", "carpete") and hc: plane = (C - up * hc, up); how = "horizontal, floor at camera height (no points)"
    if plane is None: print("  SKIP", n["id"], o["target"], "points:", nq); continue
    c, nrm = plane; V = []
    for x, y in o["pts"]:
        d = R.T @ lonlat_to_cam(*proj.px_to_lonlat(x, y, n["view"])); den = d @ nrm; sc = ((c - C) @ nrm) / den if abs(den) > 1e-6 else -1
        V.append(None if sc <= 0 or sc > pathlen * 3 else C + sc * d)
    if any(v is None for v in V): print("  SKIP", n["id"], o["target"], "ray misses plane"); continue
    shapes.append({"id": kind + "@" + (o["target"].split("@")[1] + "-" if "@" in o["target"] else "") + n["id"], "kind": kind, "target": o["target"], "node": n["id"], "src": n["src"], "V": [v.tolist() for v in V], "n": np.asarray(nrm).tolist(), "how": how})
    print("  ok  ", n["id"], o["target"], "|", how)
json.dump({"shapes": shapes, "up": up.tolist(), "path": Cs.tolist(), "pathlen": pathlen}, open(S / "sfm1/shapes.json", "w"))
# project every shape into every 10 fps frame of clip P
import base64, io
from PIL import Image, ImageDraw
tr = {}; pos = []
for k in range(280):
    R, C = slerp_pose(fidx(CLIP_T0 + k / 10)); pos.append((R, C))
    for s_ in shapes:
        hall = s_["node"] == "hall-porta"; key = int(round((s_["src"] - CLIP_T0) * 10))
        if (hall and k > 125) or (not hall and k < 118): continue
        if s_["kind"] == "rodizio" or s_["id"] == "porcelanato@plen-mesas":
            if abs(k - key) > 8: continue                               # weak fit: keep it only around the frame where it was drawn
        V = (np.array(s_["V"]) - C) @ R.T; dist = np.linalg.norm(V, axis=1)
        if dist.min() < pathlen * 0.05: continue                        # standing on it: skip rather than draw a smear
        lon, lat = cam_to_lonlat(V, CONV); span = np.ptp(np.unwrap(np.radians(lon)))
        if span > math.radians(150) or lat.min() < -62: continue
        tr.setdefault(s_["id"], {})[str(k)] = [round(float(x), 2) for p in zip(lon, lat) for x in p]
# top-down map from the reconstructed points
CC = np.array([C for _, C in pos]); A2 = np.c_[CC @ e1, CC @ e2]; pc = np.linalg.svd(A2 - A2.mean(0))[2][0]; e1, e2 = pc[0] * e1 + pc[1] * e2, None; e2 = np.cross(up, e1)   # turn the map so the walk runs left to right
hts = ALLX @ up; floor = float(np.median([C @ up for _, C in pos])) - hc
keep = (hts > floor + 0.12 * hc) & (hts < floor + 1.7 * hc); U = np.c_[ALLX[keep] @ e1, ALLX[keep] @ e2]
lo = np.percentile(U, 1.5, axis=0); hi = np.percentile(U, 98.5, axis=0); pad = 0.06 * (hi - lo).max(); lo -= pad; hi += pad; sc = 420 / (hi - lo).max(); MW, MH = int((hi - lo)[0] * sc), int((hi - lo)[1] * sc)
px = lambda X: ((np.asarray(X) @ e1 - lo[0]) * sc, (np.asarray(X) @ e2 - lo[1]) * sc)
im = Image.new("RGBA", (MW, MH), (14, 20, 24, 235)); d = ImageDraw.Draw(im, "RGBA")
for s_ in shapes:
    P2 = [px(v) for v in s_["V"]]
    if s_["kind"] in HORIZ: d.polygon(P2, fill=(25, 224, 195, 70), outline=(25, 224, 195, 200))
    else: d.line(P2 + [P2[0]], fill=(25, 224, 195, 230), width=3)
for u, v in zip(*px(ALLX[keep])):
    if 0 <= u < MW and 0 <= v < MH: d.point((u, v), fill=(243, 246, 248, 150))
d.line([px(C) for _, C in pos], fill=(255, 197, 61, 255), width=2)
buf = io.BytesIO(); im.save(buf, "PNG"); im.save(S / "work/map.png")
f0 = pos[100][0].T @ np.array([0, 0, 1.0]); r0 = pos[100][0].T @ np.array([1.0, 0, 0]); af, ar = math.atan2(f0 @ e2, f0 @ e1), math.atan2(r0 @ e2, r0 @ e1); sign = 1 if ((ar - af + 3 * math.pi) % (2 * math.pi)) - math.pi > 0 else -1
P = []
for R, C in pos:
    f = R.T @ np.array([0, 0, 1.0]); x, y = px(C); P.append([round(float(x), 1), round(float(y), 1), round(math.degrees(math.atan2(f @ e2, f @ e1)), 1)])
json.dump({"tracks3d": {"P": tr}, "map": {"clip": "P", "img": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), "w": MW, "h": MH, "pos": P, "sign": sign}}, open(S / "sfm1/demo3d.json", "w"))
print(len(shapes), "shapes; map", MW, "x", MH, "; frames with any shape:", len({k for v in tr.values() for k in v}), "of 280")

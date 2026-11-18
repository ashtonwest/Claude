# clip.py <id> <video v1|v2|v3> <t0> <t1> : encode a silent 360 clip and compute its motion track at 10 fps
import sys, subprocess, json, glob, numpy as np, cv2
S = "/tmp/claude-0/-home-user-Claude/ac14c686-5231-5440-9483-820e9194016f/scratchpad"
cid, v, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
LOOK = json.loads(sys.argv[5]) if len(sys.argv) > 5 else []   # [[source_seconds, camera_lon], ...] authored look directions
CRF = sys.argv[6] if len(sys.argv) > 6 else "29"
src = glob.glob(f"{S}/src/{v}/*.mp4")[0]; mp4 = f"{S}/tour/media/{cid}.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t0), "-i", src, "-t", str(t1 - t0), "-an", "-vf", "scale=1920:960,fps=30",
  "-c:v", "libx264", "-preset", "slow", "-crf", CRF, "-g", "15", "-keyint_min", "15", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], check=True)
W, H, FPS = 1280, 640, 10
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"fps={FPS},scale={W}:{H}", "-pix_fmt", "gray", "-f", "rawvideo", "-"], stdout=subprocess.PIPE).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W); np.save(f"{S}/tour/frames/{cid}.npy", fr)
y0, y1 = int(H * (0.5 - 35 / 180)), int(H * (0.5 + 12 / 180)); rows = [[0, 0, 0]]
for i in range(1, len(fr)):
    ext = lambda g: np.hstack([g[:, -80:], g, g[:, :80]]); A, B = ext(fr[i - 1]), ext(fr[i])
    mask = np.zeros_like(A); mask[y0:y1, 80:-80] = 255
    pts = cv2.goodFeaturesToTrack(A, 600, 0.01, 7, mask=mask); r = a = h = 0.0
    if pts is not None and len(pts) > 40:
        q, st, _ = cv2.calcOpticalFlowPyrLK(A, B, pts, None, winSize=(25, 25), maxLevel=3)
        bk, st2, _ = cv2.calcOpticalFlowPyrLK(B, A, q, None, winSize=(25, 25), maxLevel=3)
        ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.abs(bk - pts).reshape(-1, 2).max(1) < 1.0)
        P, Q = pts.reshape(-1, 2)[ok], q.reshape(-1, 2)[ok]
        if len(P) > 40:
            lon = ((P[:, 0] - 80) / W - 0.5) * 2 * np.pi; dx = (Q[:, 0] - P[:, 0]) * 360 / W
            M = np.c_[np.ones_like(lon), np.sin(lon), np.cos(lon)]; keep = np.ones(len(lon), bool)
            for _ in range(3):
                c, *_ = np.linalg.lstsq(M[keep], dx[keep], rcond=None); res = np.abs(M @ c - dx); keep = res < max(0.4, 2.5 * np.median(res))
            r, a, h = float(c[0]), float(np.hypot(c[1], c[2])), float(np.degrees(np.arctan2(-c[2], c[1])))
    rows.append([r, a, h])
R = np.array(rows); r, a, h = R[:, 0], R[:, 1], R[:, 2]
# walking = sustained translation; reference look direction follows the smoothed travel direction while walking,
# and stays fixed in the room (follows camera turn r) while standing
k = np.ones(15) / 15; am = np.convolve(a, k, "same"); walking = am > 0.22
rot = np.cumsum(r)                      # how far the scene has shifted in longitude since the clip start
Href = np.zeros(len(R))
if LOOK:
    ks = sorted((int(round((s - t0) * FPS)), l) for s, l in LOOK); ks = [(max(0, min(len(R) - 1, i)), l) for i, l in ks]
    for i in range(len(R)):
        if i <= ks[0][0]: Href[i] = ks[0][1] + rot[i] - rot[ks[0][0]]
        elif i >= ks[-1][0]: Href[i] = ks[-1][1] + rot[i] - rot[ks[-1][0]]
        else:
            j = max(n for n in range(len(ks)) if ks[n][0] <= i); (ia, la), (ib, lb) = ks[j], ks[j + 1]
            held = la + rot[i] - rot[ia]; miss = (((lb - (la + rot[ib] - rot[ia])) + 540) % 360) - 180
            Href[i] = held + miss * (i - ia) / max(1, ib - ia)   # room-fixed direction, eased toward the next authored look
json.dump({"id": cid, "video": v, "t0": t0, "t1": t1, "fps": FPS, "ref": [round(float(((x + 180) % 360) - 180), 1) for x in Href], "rot": [round(float(x), 1) for x in rot],
           "walk": [int(w) for w in walking], "a": [round(float(x), 2) for x in am]}, open(f"{S}/tour/data/{cid}.json", "w"))
import os; print(cid, len(fr), "frames@10fps", round(os.path.getsize(mp4) / 1e6, 2), "MB", "walking %", round(100 * walking.mean()))

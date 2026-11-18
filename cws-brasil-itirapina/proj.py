"""Shared 360 geometry: same maths as the in-page viewer.
Equirect (u,v): lon=(u-0.5)*360, lat=(0.5-v)*180. Camera: yaw right+, pitch up+, no roll.
A view is {yaw, pitch, w, h}: the angular box (degrees) that must fit on screen."""
import math, numpy as np
from PIL import Image, ImageDraw

def focal(view, W, H):
    return min(W / (2 * math.tan(math.radians(view["w"]) / 2)), H / (2 * math.tan(math.radians(view["h"]) / 2)))

def px_to_lonlat(x, y, view, W=1600, H=900):
    f = focal(view, W, H); yw = math.radians(view["yaw"]); p = math.radians(view["pitch"])
    cx, cy, cz = x - W / 2, H / 2 - y, f
    ry = cy * math.cos(p) + cz * math.sin(p); rz = -cy * math.sin(p) + cz * math.cos(p); rx = cx
    wx = rx * math.cos(yw) + rz * math.sin(yw); wz = -rx * math.sin(yw) + rz * math.cos(yw); wy = ry
    n = math.sqrt(wx * wx + wy * wy + wz * wz)
    return [round(math.degrees(math.atan2(wx, wz)), 3), round(math.degrees(math.asin(wy / n)), 3)]

def render(eq, view, W=1600, H=900):
    """eq: PIL equirect image -> PIL flat view (bilinear)."""
    a = np.asarray(eq.convert("RGB"), dtype=np.float32); EH, EW = a.shape[:2]
    f = focal(view, W, H); yw = math.radians(view["yaw"]); p = math.radians(view["pitch"])
    xs, ys = np.meshgrid(np.arange(W) + 0.5 - W / 2, H / 2 - (np.arange(H) + 0.5))
    ry = ys * math.cos(p) + f * math.sin(p); rz = -ys * math.sin(p) + f * math.cos(p); rx = xs
    wx = rx * math.cos(yw) + rz * math.sin(yw); wz = -rx * math.sin(yw) + rz * math.cos(yw)
    lon = np.arctan2(wx, wz); lat = np.arctan2(ry, np.hypot(wx, wz))
    u = (lon / (2 * math.pi) + 0.5) * EW - 0.5; v = (0.5 - lat / math.pi) * EH - 0.5
    u0 = np.floor(u).astype(int); v0 = np.clip(np.floor(v).astype(int), 0, EH - 1); v1 = np.clip(v0 + 1, 0, EH - 1)
    fu = (u - u0)[..., None]; fv = np.clip(v - v0, 0, 1)[..., None]
    u0m = u0 % EW; u1m = (u0 + 1) % EW
    out = (a[v0, u0m] * (1 - fu) + a[v0, u1m] * fu) * (1 - fv) + (a[v1, u0m] * (1 - fu) + a[v1, u1m] * fu) * fv
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def grid(img):
    d = ImageDraw.Draw(img); W, H = img.size
    for x in range(0, W, 100):
        d.line([(x, 0), (x, H)], fill=(255, 255, 0), width=1)
        if x % 200 == 0 and x: d.text((x + 3, 3), str(x), fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0), font_size=22)
    for y in range(100, H, 100):
        d.line([(0, y), (W, y)], fill=(255, 255, 0), width=1); d.text((3, y + 3), str(y), fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0), font_size=22)
    return img

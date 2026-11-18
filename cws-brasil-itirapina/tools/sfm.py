import pycolmap, pathlib, numpy as np, sys, time
from PIL import Image
S = pathlib.Path("/tmp/claude-0/-home-user-Claude/ac14c686-5231-5440-9483-820e9194016f/scratchpad/sfm1")
m = np.full((960, 1920), 255, np.uint8); m[int(960 * (0.5 + 38 / 180)):, :] = 0      # ignore the area under the camera (the person carrying it)
for f in sorted((S / "img").glob("*.jpg")): Image.fromarray(m).save(S / "mask" / (f.name + ".png"))
t = time.time()
ro = pycolmap.ImageReaderOptions(); ro.camera_model = "EQUIRECTANGULAR"; ro.mask_path = str(S / "mask")
eo = pycolmap.FeatureExtractionOptions(); eo.num_threads = 4
try: eo.sift.max_num_features = 6000
except Exception as e: print("opt", e)
pycolmap.extract_features(S / "db.db", S / "img", reader_options=ro, extraction_options=eo, camera_mode=pycolmap.CameraMode.SINGLE, device=pycolmap.Device.cpu)
print("features", round(time.time() - t), "s"); t = time.time()
po = pycolmap.SequentialPairingOptions(); po.overlap = 12; po.quadratic_overlap = True; po.loop_detection = False
pycolmap.match_sequential(S / "db.db", pairing_options=po, device=pycolmap.Device.cpu)
print("matching", round(time.time() - t), "s"); t = time.time()
recs = pycolmap.incremental_mapping(S / "db.db", S / "img", S / "out")
print("mapping", round(time.time() - t), "s")
for k, r in recs.items(): print(k, r.summary())

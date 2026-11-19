#!/usr/bin/env python3
"""Cut the loudest moments of a stream recording into vertical Shorts.

Needs Python 3.9+ and ffmpeg on PATH. Captions are optional and need
`pip install faster-whisper`.

Example:
    python3 clipper.py stream.mp4 --count 5 --hashtags "#KreekCraft #GTA6"

Each clip gets an .mp4 (1080x1920), a thumbnail .jpg taken at the peak
moment, and a row in posting_sheet.csv where the title is written.
"""
import argparse
import csv
import json
import re
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def run(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(f"ffmpeg failed:\n{' '.join(map(str, cmd))}\n{proc.stderr[-2000:]}")
    return proc


def probe_duration(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "json", str(path)]).stdout
    return float(json.loads(out)["format"]["duration"])


def loudness_per_second(path):
    """Return a list of RMS levels in dB, one per second of audio."""
    with tempfile.TemporaryDirectory() as tmp:
        log = Path(tmp) / "rms.txt"
        # ffmpeg filter args treat ':' and '\' specially, so use a relative
        # file name and run from the temp directory.
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(Path(path).resolve()), "-vn", "-af",
             "aresample=8000,asetnsamples=8000,astats=metadata=1:reset=1,"
             "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=rms.txt",
             "-f", "null", "-"],
            cwd=tmp, check=True, capture_output=True)
        levels = []
        for line in log.read_text().splitlines():
            m = re.match(r"lavfi\.astats\.Overall\.RMS_level=(.+)", line)
            if m:
                try:
                    v = float(m.group(1))
                except ValueError:
                    v = -90.0
                levels.append(max(v, -90.0) if v == v else -90.0)
        return levels


def pick_moments(levels, count, length, lead_in):
    """Pick the `count` loudest non-overlapping windows.

    A moment is scored by how far its loudest 5 seconds rise above the
    stream's normal level: shouting, laughing and chaos read as spikes.
    """
    if len(levels) < length:
        return [(0, len(levels), 0.0, 0)] if levels else []
    baseline = statistics.median(levels)
    span = 5
    spike = [sum(levels[i:i + span]) / span - baseline
             for i in range(len(levels) - span + 1)]
    order = sorted(range(len(spike)), key=lambda i: spike[i], reverse=True)
    chosen = []
    for peak in order:
        start = max(0, min(peak - lead_in, len(levels) - length))
        if all(abs(start - s) >= length for s, *_ in chosen):
            chosen.append((start, length, round(spike[peak], 1), peak + span // 2))
        if len(chosen) == count:
            break
    return sorted(chosen)


def find_font(explicit):
    for f in ([explicit] if explicit else []) + FONT_CANDIDATES:
        if f and Path(f).exists():
            return f
    sys.exit("No bold font found. Pass one with --font /path/to/font.ttf")


def esc(path):
    """Escape a path for use inside an ffmpeg filter argument."""
    return str(path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def wrap(text, width=22):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    return "\n".join(lines + [cur])


def transcribe(clip, model_name):
    """Return [(start, end, text)] for the clip, or None if whisper is absent."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("  captions skipped: run `pip install faster-whisper` to enable")
        return None
    model = transcribe.cache.setdefault(
        model_name, WhisperModel(model_name, device="cpu", compute_type="int8"))
    segments, _ = model.transcribe(str(clip), word_timestamps=True)
    words = [w for s in segments for w in (s.words or [])]
    lines, i = [], 0
    while i < len(words):  # three words on screen at a time
        group = words[i:i + 3]
        lines.append((group[0].start, group[-1].end,
                      " ".join(w.word.strip() for w in group)))
        i += 3
    return lines


transcribe.cache = {}


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def build_filter(layout, font, hook_file, disclosure_file, srt_file):
    if layout == "crop":  # fill the screen, lose the sides
        base = "[0:v]scale=-2:1920,crop=1080:1920,setsar=1[v0]"
    else:  # whole frame (stream overlay stays visible) over a blurred copy
        base = ("[0:v]split[a][b];"
                "[a]scale=1080:1920:force_original_aspect_ratio=increase,"
                "crop=1080:1920,boxblur=30:5,eq=brightness=-0.15[bg];"
                "[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v0]")
    steps, last = [base], "v0"

    def add(f):
        nonlocal last
        nxt = f"v{len(steps)}"
        steps.append(f"[{last}]{f}[{nxt}]")
        last = nxt

    text = (f"fontfile='{esc(font)}':fontcolor=white:borderw=6:bordercolor=black:"
            "line_spacing=12:x=(w-text_w)/2")
    if hook_file:
        add(f"drawtext=textfile='{esc(hook_file)}':fontsize=76:y=300:{text}")
    if disclosure_file:
        add(f"drawtext=textfile='{esc(disclosure_file)}':fontsize=44:y=180:"
            f"enable='lt(t,4)':{text}")
    if srt_file:
        add(f"subtitles='{esc(srt_file)}':force_style='FontName=Arial,Bold=1,"
            "FontSize=16,Outline=2,Alignment=2,MarginV=60'")
    return ";".join(steps), last


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("video", type=Path, help="stream recording or VOD file")
    p.add_argument("--out", type=Path, default=Path("clips"))
    p.add_argument("--count", type=int, default=5, help="clips to make")
    p.add_argument("--length", type=int, default=35, help="seconds per clip")
    p.add_argument("--lead-in", type=int, default=8,
                   help="seconds of build-up kept before the loud moment")
    p.add_argument("--layout", choices=["fit", "crop"], default="fit",
                   help="fit keeps the whole frame incl. stream overlay")
    p.add_argument("--hook", default="",
                   help="big text at the top of every clip (per-clip text: "
                        "edit hooks in posting_sheet.csv and re-run with --sheet)")
    p.add_argument("--disclosure", default="",
                   help="ad disclosure shown for the first 4 seconds, e.g. '#ad'")
    p.add_argument("--hashtags", default="", help="added to the posting sheet")
    p.add_argument("--captions", action="store_true",
                   help="burn in word captions (needs faster-whisper)")
    p.add_argument("--whisper-model", default="small.en")
    p.add_argument("--sheet", type=Path,
                   help="re-render from an edited posting_sheet.csv")
    p.add_argument("--font")
    a = p.parse_args()

    if not a.video.exists():
        sys.exit(f"No such file: {a.video}")
    a.out.mkdir(parents=True, exist_ok=True)
    font = find_font(a.font)

    if a.sheet:
        with a.sheet.open(newline="") as f:
            rows = list(csv.DictReader(f))
        moments = [(int(r["start_sec"]), int(r["length_sec"]),
                    float(r["spike_db"]), int(r["peak_sec"])) for r in rows]
        hooks = [r.get("hook", "") for r in rows]
    else:
        print(f"Scanning audio of {a.video.name} "
              f"({probe_duration(a.video) / 60:.0f} min)...")
        moments = pick_moments(loudness_per_second(a.video), a.count,
                               a.length, a.lead_in)
        rows, hooks = [], [a.hook] * len(moments)
    if not moments:
        sys.exit("No audio found to score.")

    out_rows = []
    for n, (start, length, spike, peak) in enumerate(moments, 1):
        name = f"clip_{n:02}"
        clip, thumb = a.out / f"{name}.mp4", a.out / f"{name}.jpg"
        print(f"{name}: {start // 3600}:{start // 60 % 60:02}:{start % 60:02} "
              f"for {length}s (spike +{spike} dB)")
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            raw = tmp / "raw.mp4"
            run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-i", str(a.video),
                 "-t", str(length), "-c:v", "libx264", "-preset", "veryfast",
                 "-crf", "18", "-c:a", "aac", str(raw)])
            hook_file = disclosure_file = srt_file = None
            transcript = ""
            if hooks[n - 1]:
                hook_file = tmp / "hook.txt"
                hook_file.write_text(wrap(hooks[n - 1].upper()))
            if a.disclosure:
                disclosure_file = tmp / "ad.txt"
                disclosure_file.write_text(a.disclosure)
            if a.captions:
                lines = transcribe(raw, a.whisper_model)
                if lines:
                    srt_file = tmp / "cap.srt"
                    srt_file.write_text("\n".join(
                        f"{i}\n{srt_time(s)} --> {srt_time(e)}\n{t.upper()}\n"
                        for i, (s, e, t) in enumerate(lines, 1)))
                    transcript = " ".join(t for _, _, t in lines)
            graph, last = build_filter(a.layout, font, hook_file,
                                       disclosure_file, srt_file)
            run(["ffmpeg", "-v", "error", "-y", "-i", str(raw),
                 "-filter_complex", graph, "-map", f"[{last}]", "-map", "0:a?",
                 "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                 "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                 "-movflags", "+faststart", str(clip)])
        # Thumbnail: the frame at the loud moment, taken from the finished clip.
        at = min(max(peak - start, 0), length - 1)
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(at), "-i", str(clip),
             "-frames:v", "1", "-q:v", "2", str(thumb)])
        old = rows[n - 1] if rows else {}
        out_rows.append({
            "clip": clip.name, "thumbnail": thumb.name, "start_sec": start,
            "length_sec": length, "peak_sec": peak, "spike_db": spike,
            "thumb_at_sec": at, "hook": hooks[n - 1],
            "title": old.get("title", ""),
            "hashtags": old.get("hashtags", a.hashtags),
            "transcript": transcript or old.get("transcript", ""),
            "posted_url": old.get("posted_url", ""),
            "submitted": old.get("submitted", ""),
        })

    sheet = a.out / "posting_sheet.csv"
    with sheet.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0]))
        w.writeheader()
        w.writerows(out_rows)
    print(f"\nDone: {len(out_rows)} clips in {a.out}/, sheet at {sheet}")


if __name__ == "__main__":
    main()

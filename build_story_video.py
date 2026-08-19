#!/usr/bin/env python3
"""Build the 4-minute Arabic story video from generated storyboard sheets."""
from __future__ import annotations

import math
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "video_assets"
SCENES = ASSETS / "scenes"
OUTPUT = ROOT / "outputs" / "بوصلة_آدم_4_دقائق.mp4"
TOTAL_SECONDS = 240.0
SCENE_COUNT = 63


def run(*args: str) -> None:
    print("+", " ".join(map(str, args)))
    subprocess.run(list(map(str, args)), check=True)


def ffmpeg_path() -> str:
    explicit = os.environ.get("FFMPEG")
    if explicit:
        return explicit
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg  # type: ignore
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as exc:
        raise SystemExit("Install ffmpeg or imageio-ffmpeg, or set FFMPEG=/path/to/ffmpeg") from exc


def dimensions(path: Path) -> tuple[int, int]:
    out = subprocess.check_output(["identify", "-format", "%w %h", str(path)], text=True)
    w, h = out.split()
    return int(w), int(h)


def make_scenes() -> None:
    SCENES.mkdir(parents=True, exist_ok=True)
    number = 1
    regular = [
        (col / 3, row / 3, (col + 1) / 3, (row + 1) / 3)
        for row in range(3) for col in range(3)
    ]
    # The model varied the square contact-sheet layouts. These normalized boxes isolate
    # complete panels rather than slicing through the wider middle and lower frames.
    special = {
        4: [
            (0, 0, 1/3, 1/4), (1/3, 0, 2/3, 1/4), (2/3, 0, 1, 1/4),
            (0, 1/4, 1/2, 1/2), (1/2, 1/4, 1, 1/2),
            (0, 1/2, 1/2, 3/4), (1/2, 1/2, 1, 3/4),
            (1/3, 3/4, 2/3, 1), (2/3, 3/4, 1, 1),
        ],
        5: [
            (0, 0, 1/3, 1/4), (1/3, 0, 2/3, 1/4), (2/3, 0, 1, 1/4),
            (0, 1/4, 1/2, 1/2), (1/2, 1/4, 1, 1/2),
            (0, 1/2, 1/2, 3/4), (1/2, 1/2, 1, 3/4),
            (0, 3/4, 1/2, 1), (1/2, 3/4, 1, 1),
        ],
    }
    for sheet_num in range(1, 8):
        sheet = ASSETS / f"sheet_{sheet_num:02d}.png"
        w, h = dimensions(sheet)
        for left, top, right, bottom in special.get(sheet_num, regular):
            x0, y0 = round(left * w), round(top * h)
            x1, y1 = round(right * w), round(bottom * h)
            inset_x = max(2, round((x1 - x0) * 0.012))
            inset_y = max(2, round((y1 - y0) * 0.018))
            x, y = x0 + inset_x, y0 + inset_y
            cw, ch = x1 - x0 - 2 * inset_x, y1 - y0 - 2 * inset_y
            dest = SCENES / f"scene_{number:03d}.jpg"
            run(
                "convert", sheet,
                "-crop", f"{cw}x{ch}+{x}+{y}", "+repage",
                "-resize", "1280x720^",
                "-gravity", "center", "-extent", "1280x720",
                "-colorspace", "sRGB", "-quality", "90", dest,
            )
            number += 1
    assert number - 1 == SCENE_COUNT


def make_audio(ffmpeg: str) -> Path:
    narrations = [ASSETS / f"narration_{n:02d}.mp3" for n in range(1, 4)]
    concat_file = ASSETS / "narration_concat.txt"
    concat_file.write_text("".join(f"file '{p.resolve()}'\n" for p in narrations), encoding="utf-8")
    audio = ASSETS / "narration_4min.m4a"
    # Original narration is about 5:08. A natural 1.285× tempo makes it exactly four minutes.
    run(
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
        "-filter:a", "atempo=1.2852,apad,atrim=0:240,afade=t=in:st=0:d=0.5,afade=t=out:st=238.5:d=1.5",
        "-c:a", "aac", "-b:a", "128k", audio,
    )
    return audio


def make_video(ffmpeg: str, audio: Path) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    seconds_per_scene = TOTAL_SECONDS / SCENE_COUNT
    concat_file = ASSETS / "scenes_concat.txt"
    lines: list[str] = []
    for number in range(1, SCENE_COUNT + 1):
        scene = (SCENES / f"scene_{number:03d}.jpg").resolve()
        lines.extend((f"file '{scene}'\n", f"duration {seconds_per_scene:.9f}\n"))
    # concat demuxer needs the last frame repeated for its duration to take effect.
    lines.append(f"file '{(SCENES / f'scene_{SCENE_COUNT:03d}.jpg').resolve()}'\n")
    concat_file.write_text("".join(lines), encoding="utf-8")
    run(
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
        "-i", audio, "-t", "240",
        "-vf", "fps=24,fade=t=in:st=0:d=0.6,fade=t=out:st=238.5:d=1.5,format=yuv420p",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "2500k", "-bufsize", "5000k",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", OUTPUT,
    )
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    ffmpeg = ffmpeg_path()
    make_scenes()
    audio = make_audio(ffmpeg)
    make_video(ffmpeg, audio)

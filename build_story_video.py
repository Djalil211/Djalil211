#!/usr/bin/env python3
"""Build the 4-minute Arabic story video from generated storyboard sheets."""
from __future__ import annotations

import math
import os
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
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


def make_music(ffmpeg: str) -> Path:
    """Create a restrained ambient score that stays beneath the narration."""
    music = ASSETS / "quiet_score.m4a"
    # A soft minor pad for the difficult years, joined by a warmer fifth near the ending.
    expr = (
        "0.020*sin(2*PI*110*t)+0.014*sin(2*PI*164.81*t)+0.010*sin(2*PI*220*t)"
        "+if(gte(t\\,170)\\,0.010*sin(2*PI*293.66*t)\\,0)"
    )
    run(
        ffmpeg, "-y", "-f", "lavfi", "-i", f"aevalsrc={expr}:s=48000:d=240",
        "-af", "lowpass=f=1100,aecho=0.8:0.45:900:0.18,afade=t=in:st=0:d=4,afade=t=out:st=236:d=4",
        "-c:a", "aac", "-b:a", "128k", music,
    )
    return music


def make_motion_clips(ffmpeg: str) -> Path:
    """Give every shot a stable cinematic dolly or pan—never handheld shake."""
    clips = ASSETS / "motion_clips"
    clips.mkdir(parents=True, exist_ok=True)

    def render(number: int) -> Path:
        scene = SCENES / f"scene_{number:03d}.jpg"
        clip = clips / f"clip_{number:03d}.mp4"
        # 27×92 + 36×91 = exactly 5760 frames = 4:00 at 24 fps.
        frames = 92 if number <= 27 else 91
        last = frames - 1
        mode = (number - 1) % 5
        if mode == 0:  # slow centered push-in
            z = "1+0.075*on/%d" % last
            x, y = "iw/2-iw/zoom/2", "ih/2-ih/zoom/2"
        elif mode == 1:  # composed left-to-right slider move
            z = "1.08"
            x, y = "(iw-iw/zoom)*on/%d" % last, "ih/2-ih/zoom/2"
        elif mode == 2:  # composed right-to-left slider move
            z = "1.08"
            x, y = "(iw-iw/zoom)*(1-on/%d)" % last, "ih/2-ih/zoom/2"
        elif mode == 3:  # slow upward reveal
            z = "1.07"
            x, y = "iw/2-iw/zoom/2", "(ih-ih/zoom)*(1-on/%d)" % last
        else:  # very gentle pull-back
            z = "1.075-0.065*on/%d" % last
            x, y = "iw/2-iw/zoom/2", "ih/2-ih/zoom/2"
        vf = (
            f"scale=1536:864:force_original_aspect_ratio=increase,crop=1536:864,"
            f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s=1280x720:fps=24,"
            "format=yuv420p"
        )
        subprocess.run(
            [ffmpeg, "-y", "-loop", "1", "-i", str(scene), "-vf", vf,
             "-frames:v", str(frames), "-an", "-c:v", "libx264", "-preset", "veryfast",
             "-crf", "21", "-g", "48", str(clip)],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        print(f"Animated scene {number:02d}/{SCENE_COUNT}")
        return clip

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(render, range(1, SCENE_COUNT + 1)))

    concat_file = ASSETS / "motion_concat.txt"
    concat_file.write_text(
        "".join(f"file '{(clips / f'clip_{n:03d}.mp4').resolve()}'\n" for n in range(1, SCENE_COUNT + 1)),
        encoding="utf-8",
    )
    motion = ASSETS / "motion_picture.mp4"
    run(ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", concat_file, "-c", "copy", motion)
    return motion


def make_video(ffmpeg: str, audio: Path) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    motion = make_motion_clips(ffmpeg)
    music = make_music(ffmpeg)
    run(
        ffmpeg, "-y", "-i", motion, "-i", audio, "-i", music, "-t", "240",
        "-filter_complex",
        "[1:a]volume=1.12[voice];[2:a]volume=0.32[music];"
        "[voice][music]amix=inputs=2:duration=longest:normalize=0,"
        "alimiter=limit=0.95,afade=t=out:st=238.5:d=1.5[a]",
        "-map", "0:v:0", "-map", "[a]",
        "-vf", "fade=t=in:st=0:d=0.7,fade=t=out:st=238.5:d=1.5",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-maxrate", "3000k", "-bufsize", "6000k",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUTPUT,
    )
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    ffmpeg = ffmpeg_path()
    make_scenes()
    audio = make_audio(ffmpeg)
    make_video(ffmpeg, audio)

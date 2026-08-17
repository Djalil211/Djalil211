"""اختبارات سريعة بدون شبكة: python3 -m tests.test_aivideo"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aivideo.cli import main, slugify           # noqa: E402
from aivideo.models import BY_ALIAS, resolve    # noqa: E402
from aivideo.prompt import build_negative, build_prompt  # noqa: E402
from aivideo.providers.base import Provider     # noqa: E402

FAILS = []


def check(name: str, cond: bool) -> None:
    print(("  ✓ " if cond else "  ✗ ") + name)
    if not cond:
        FAILS.append(name)


def test_prompt() -> None:
    print("\nprompt:")
    p = build_prompt("a man walking", style="cinematic")
    check("يضيف لبنات الواقعية", "ARRI Alexa" in p and "photorealistic" in p)
    check("يضيف نمط cinematic", "cinematic feature-film look" in p)
    check("يحافظ على الفكرة", p.startswith("a man walking"))

    plain = build_prompt("a man walking", style="none", enhance=False)
    check("no-enhance يعطي الفكرة فقط", plain == "a man walking.")

    cam = build_prompt("x", style="none", camera="slow dolly-in", enhance=False)
    check("يدمج وصف الكاميرا", "slow dolly-in" in cam)

    neg = build_negative("ugly")
    check("negative يجمع الافتراضي والإضافي", "cartoon" in neg and "ugly" in neg)
    check("تعطيل negative", build_negative(None, use_default=False) is None)


def test_models() -> None:
    print("\nmodels:")
    check("kling موجود", "kling" in BY_ALIAS)
    check("resolve بالاختصار", resolve("veo3").provider == "replicate")
    check("resolve لمعرّف Replicate كامل", resolve("owner/model").provider == "replicate")
    check("resolve لمعرّف fal كامل", resolve("fal-ai/some/model").provider == "fal")
    try:
        resolve("nope")
        check("يرفض نموذجاً مجهولاً", False)
    except KeyError:
        check("يرفض نموذجاً مجهولاً", True)

    kling = BY_ALIAS["kling"]
    payload = kling.build_input({"prompt": "p", "image": "u", "resolution": "1080p", "duration": 5})
    check("يعيد تسمية image إلى start_image", payload.get("start_image") == "u")
    check("يحذف الحقول غير المدعومة", "resolution" not in payload)
    check("يطبّق القيم الافتراضية", payload.get("duration") == 5)
    check("يتجاهل القيم None", "seed" not in kling.build_input({"prompt": "p", "seed": None}))


def test_extract_urls() -> None:
    print("\nاستخراج الروابط:")
    check("رابط مباشر", Provider.extract_video_urls("https://x.com/a.mp4") == ["https://x.com/a.mp4"])
    check("داخل قاموس", Provider.extract_video_urls({"video": {"url": "https://x/b.mp4"}}) == ["https://x/b.mp4"])
    check("داخل قائمة", Provider.extract_video_urls(["https://x/c.mp4", "https://x/d.mov"]) ==
          ["https://x/c.mp4", "https://x/d.mov"])
    check("إزالة التكرار", Provider.extract_video_urls(["https://x/e.mp4"] * 3) == ["https://x/e.mp4"])
    check("يتجاهل الصور", Provider.extract_video_urls({"image": "https://x/f.png"}) == [])
    check("يتعامل مع رابط فيه query", Provider.extract_video_urls("https://x/g.mp4?token=1") ==
          ["https://x/g.mp4?token=1"])


def test_cli() -> None:
    print("\nCLI:")
    check("models يعمل", main(["models"]) == 0)
    check("prompt يعمل", main(["prompt", "test scene"]) == 0)
    check("dry-run لا يحتاج مفتاحاً", main(["generate", "a cat", "-m", "kling", "--dry-run"]) == 0)
    check("dry-run لـ fal", main(["generate", "a cat", "-m", "fal-veo3", "--dry-run"]) == 0)
    check("slugify", slugify("Hello World!! ") == "hello-world")


def test_no_deps() -> None:
    print("\nالاعتماديات:")
    src = "\n".join(p.read_text(encoding="utf-8")
                    for p in Path(__file__).resolve().parent.parent.glob("aivideo/**/*.py"))
    check("لا يستورد requests", "import requests" not in src)
    check("لا يستورد replicate SDK", "import replicate" not in src)


if __name__ == "__main__":
    for fn in (test_prompt, test_models, test_extract_urls, test_cli, test_no_deps):
        fn()
    print()
    if FAILS:
        print(f"✗ فشل {len(FAILS)} اختبار: {json.dumps(FAILS, ensure_ascii=False)}")
        raise SystemExit(1)
    print("✓ كل الاختبارات نجحت")

"""واجهة سطر الأوامر لتوليد فيديو واقعي بالذكاء الاصطناعي.

أمثلة:
    python -m aivideo generate "رجل يمشي في سوق قديم عند الغروب" -m kling -d 5
    python -m aivideo models
    python -m aivideo generate "..." --dry-run
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import __version__, http
from .models import BY_ALIAS, MODELS, resolve
from .prompt import STYLE_PRESETS, build_negative, build_prompt
from .providers import get_provider
from .providers.base import MissingApiKey, ProviderError

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "outputs"


# --------------------------------------------------------------------------
# أدوات مساعدة
# --------------------------------------------------------------------------
def load_dotenv(path: Path = ROOT / ".env") -> None:
    """يحمّل متغيّرات من ملف .env دون الكتابة فوق متغيّرات البيئة الموجودة."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip("'\"")
        os.environ.setdefault(key, val)


def c(text: str, code: str) -> str:
    if os.environ.get("NO_COLOR") or not sys.stdout.isatty():
        return text
    return f"\033[{code}m{text}\033[0m"


bold = lambda t: c(t, "1")
green = lambda t: c(t, "32")
yellow = lambda t: c(t, "33")
red = lambda t: c(t, "31")
cyan = lambda t: c(t, "36")
dim = lambda t: c(t, "2")


def slugify(text: str, limit: int = 42) -> str:
    text = re.sub(r"[^\w\u0600-\u06FF]+", "-", text, flags=re.UNICODE).strip("-").lower()
    return (text[:limit].strip("-") or "video")


def to_data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or "image/png"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def resolve_image(value: str) -> str:
    """يقبل رابطاً http(s) أو مساراً محلياً (يُحوَّل إلى data URI)."""
    if value.startswith(("http://", "https://", "data:")):
        return value
    p = Path(value).expanduser()
    if not p.is_file():
        raise SystemExit(red(f"ملف الصورة غير موجود: {value}"))
    return to_data_uri(p)


# --------------------------------------------------------------------------
# الأوامر
# --------------------------------------------------------------------------
def cmd_models(args: argparse.Namespace) -> int:
    print()
    print(bold("  النماذج المدعومة لتوليد فيديو واقعي"))
    print(dim("  " + "─" * 74))
    for m in MODELS:
        stars = "★" * m.realism + "☆" * (5 - m.realism)
        flags = [f"واقعية {stars}"]
        flags.append("صوت أصلي ✓" if m.audio else "بدون صوت")
        if m.image_to_video:
            flags.append("صورة→فيديو ✓")
        print(f"  {bold(cyan(m.alias))}  {dim('·')}  {m.provider}  {dim('·')}  {m.model_id}")
        print(f"     {' | '.join(flags)}")
        print(f"     التكلفة: {m.approx_cost}")
        print(dim(f"     {m.notes}"))
        print()
    print(dim("  المفاتيح المطلوبة:  REPLICATE_API_TOKEN  |  FAL_KEY"))
    print(dim("  الأنماط المتاحة (--style): " + ", ".join(STYLE_PRESETS)))
    print()
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    print()
    print(bold("  فحص المفاتيح والإعدادات"))
    ok = True
    for env, label, url in (
        ("REPLICATE_API_TOKEN", "Replicate", "https://replicate.com/account/api-tokens"),
        ("FAL_KEY", "fal.ai", "https://fal.ai/dashboard/keys"),
    ):
        val = os.environ.get(env, "")
        if val:
            masked = val[:6] + "…" + val[-4:] if len(val) > 12 else "****"
            print(f"  {green('✓')} {label:<10} {env} = {masked}")
        else:
            ok = False
            print(f"  {yellow('✗')} {label:<10} {env} غير مضبوط  {dim('→ ' + url)}")
    env_file = ROOT / ".env"
    print(f"  {'✓' if env_file.is_file() else '·'} ملف .env: {env_file if env_file.is_file() else dim('غير موجود')}")
    print()
    if not ok:
        print(dim("  انسخ .env.example إلى .env وضع مفاتيحك داخله."))
        print()
    return 0 if ok else 1


def cmd_generate(args: argparse.Namespace) -> int:
    spec = resolve(args.model)

    # 1) بناء الـ prompt
    prompt = build_prompt(
        args.prompt,
        style=args.style,
        camera=args.camera,
        enhance=not args.no_enhance,
    )
    negative = build_negative(args.negative, use_default=not args.no_negative)

    opts: Dict[str, Any] = {
        "prompt": prompt,
        "negative_prompt": negative,
        "duration": args.duration,
        "aspect_ratio": args.aspect,
        "resolution": args.resolution,
        "seed": args.seed,
    }
    if args.image:
        if not spec.image_to_video and spec.alias in BY_ALIAS:
            print(yellow(f"  تنبيه: النموذج {spec.alias} لا يدعم صورة→فيديو، سيتم تجاهل --image."))
        else:
            opts["image"] = resolve_image(args.image)

    payload = spec.build_input(opts)
    for extra in args.set or []:
        key, _, raw = extra.partition("=")
        try:
            payload[key.strip()] = json.loads(raw)
        except json.JSONDecodeError:
            payload[key.strip()] = raw

    # 2) عرض الملخّص
    print()
    print(bold("  ملخّص الطلب"))
    print(f"  النموذج : {cyan(spec.alias)}  ({spec.provider} · {spec.model_id})")
    print(f"  النمط   : {args.style}   المدة: {args.duration}s   النسبة: {args.aspect}")
    print(f"  النسخ   : {args.count}")
    print(dim(f"  Prompt  : {prompt[:220]}{'…' if len(prompt) > 220 else ''}"))
    if re.search(r"[\u0600-\u06FF]", args.prompt):
        print(yellow("  ملاحظة: أغلب نماذج الفيديو مدرّبة على الإنجليزية — الوصف بالإنجليزية"))
        print(yellow("          يعطي نتائج أدقّ بكثير. العربية تعمل لكن بدقّة أقل."))
    print()

    if args.dry_run:
        print(bold("  --dry-run: هذا هو الـ payload الذي سيُرسل"))
        print(json.dumps({"provider": spec.provider, "model": spec.model_id, "input": payload},
                         ensure_ascii=False, indent=2))
        print()
        return 0

    # 3) التشغيل
    try:
        provider = get_provider(spec.provider, log=lambda m: print(dim("  " + m)))
        provider.require_key()
    except MissingApiKey as exc:
        print(red("  ✗ " + str(exc)))
        return 2

    outdir = Path(args.output).expanduser()
    outdir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = f"{stamp}_{spec.alias}_{slugify(args.prompt)}"

    saved: List[Path] = []
    for i in range(args.count):
        run_payload = dict(payload)
        if args.count > 1 and args.seed is not None:
            run_payload["seed"] = args.seed + i
        label = f"[{i + 1}/{args.count}]" if args.count > 1 else ""
        print(bold(f"  ⏳ جارٍ التوليد {label}…"))
        started = time.time()
        try:
            result = provider.generate(
                spec.model_id, run_payload,
                poll_interval=args.poll, timeout=args.timeout,
            )
        except ProviderError as exc:
            print(red(f"  ✗ {exc}"))
            return 1

        took = time.time() - started
        print(green(f"  ✓ تم التوليد في {took:.0f} ثانية"))

        for j, url in enumerate(result.video_urls):
            suffix = f"_{i + 1}" if args.count > 1 else ""
            suffix += f"_{j + 1}" if len(result.video_urls) > 1 else ""
            dest = outdir / f"{base}{suffix}.mp4"
            print(dim(f"  ↓ تنزيل: {url[:90]}…"))
            http.download(url, str(dest))
            saved.append(dest)
            print(green(f"  ✓ حُفظ: {dest}"))

        meta = outdir / f"{base}{'_' + str(i + 1) if args.count > 1 else ''}.json"
        meta.write_text(json.dumps({
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "idea": args.prompt,
            "final_prompt": prompt,
            "negative_prompt": negative,
            "provider": result.provider,
            "model": result.model_id,
            "request_id": result.request_id,
            "input": run_payload,
            "video_urls": result.video_urls,
            "seconds": round(took, 1),
        }, ensure_ascii=False, indent=2), encoding="utf-8")

    print()
    print(bold(green(f"  انتهى — {len(saved)} ملف في {outdir}")))
    for p in saved:
        print(f"    • {p.name}")
    print()
    return 0


def cmd_prompt(args: argparse.Namespace) -> int:
    print()
    print(build_prompt(args.prompt, style=args.style, camera=args.camera, enhance=not args.no_enhance))
    print()
    if not args.no_negative:
        print(dim("negative: " + (build_negative(args.negative) or "")))
        print()
    return 0


# --------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="aivideo",
        description="توليد فيديو واقعي بالذكاء الاصطناعي عبر Replicate / fal.ai",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""أمثلة:
  python -m aivideo models
  python -m aivideo check
  python -m aivideo generate "امرأة تشرب قهوة في مقهى باريسي صباحاً" -m kling -d 5
  python -m aivideo generate "طائرة ورقية فوق شاطئ" -m veo3 --style documentary --aspect 9:16
  python -m aivideo generate "منتج عطر يدور ببطء" -m seedance --count 3 --seed 42
  python -m aivideo generate "حرّك هذه الصورة" -m kling --image ./photo.jpg
  python -m aivideo generate "..." --dry-run""",
    )
    p.add_argument("-V", "--version", action="version", version=f"aivideo {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("models", help="عرض النماذج المدعومة").set_defaults(func=cmd_models)
    sub.add_parser("check", help="فحص مفاتيح الـ API").set_defaults(func=cmd_check)

    def add_prompt_args(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("prompt", help="وصف المشهد (بالعربية أو الإنجليزية)")
        sp.add_argument("--style", default="cinematic", help=f"النمط: {', '.join(STYLE_PRESETS)}")
        sp.add_argument("--camera", help="وصف حركة الكاميرا، مثل: slow dolly-in")
        sp.add_argument("--negative", help="إضافات للـ negative prompt")
        sp.add_argument("--no-enhance", action="store_true", help="عدم إضافة لبنات الواقعية")
        sp.add_argument("--no-negative", action="store_true", help="تعطيل الـ negative prompt الافتراضي")

    g = sub.add_parser("generate", aliases=["gen"], help="توليد فيديو")
    add_prompt_args(g)
    g.add_argument("-m", "--model", default="kling", help="النموذج (انظر `models`)")
    g.add_argument("-d", "--duration", type=int, default=5, help="المدة بالثواني (افتراضي 5)")
    g.add_argument("-a", "--aspect", default="16:9", help="نسبة العرض: 16:9 | 9:16 | 1:1")
    g.add_argument("-r", "--resolution", default="1080p", help="الدقة: 720p | 1080p | 4k")
    g.add_argument("-i", "--image", help="صورة البداية (مسار محلي أو رابط) لوضع صورة→فيديو")
    g.add_argument("-n", "--count", type=int, default=1, help="عدد النسخ المولّدة")
    g.add_argument("-s", "--seed", type=int, help="بذرة عشوائية لإعادة إنتاج النتيجة")
    g.add_argument("-o", "--output", default=str(DEFAULT_OUT), help="مجلّد الحفظ")
    g.add_argument("--set", action="append", metavar="KEY=VALUE", help="تمرير حقل خام للنموذج")
    g.add_argument("--poll", type=float, default=4.0, help="فاصل الاستعلام بالثواني")
    g.add_argument("--timeout", type=int, default=1800, help="أقصى مدة انتظار بالثواني")
    g.add_argument("--dry-run", action="store_true", help="عرض الطلب دون إرساله (لا يكلّف شيئاً)")
    g.set_defaults(func=cmd_generate)

    pr = sub.add_parser("prompt", help="بناء prompt محسّن فقط دون توليد")
    add_prompt_args(pr)
    pr.set_defaults(func=cmd_prompt)

    return p


def main(argv: Optional[List[str]] = None) -> int:
    load_dotenv()
    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args))
    except KeyError as exc:
        print(red(f"  ✗ {exc.args[0] if exc.args else exc}"))
        return 2
    except KeyboardInterrupt:
        print(yellow("\n  أُلغي بواسطة المستخدم."))
        return 130


if __name__ == "__main__":
    raise SystemExit(main())

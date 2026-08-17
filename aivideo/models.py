"""سجل النماذج المدعومة (اختصارات سهلة -> معرّفات المزوّد).

الأسعار تقريبية ولأغراض المقارنة فقط، راجع صفحة المزوّد للأسعار الرسمية.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class ModelSpec:
    alias: str                 # الاسم المختصر المستعمل في سطر الأوامر
    provider: str              # replicate | fal
    model_id: str              # المعرّف عند المزوّد
    realism: int               # تقييم الواقعية من 5
    audio: bool                # هل يولّد صوتاً أصلياً
    image_to_video: bool       # هل يدعم صورة -> فيديو
    approx_cost: str           # تكلفة تقريبية
    notes: str = ""
    # خرائط الحقول: الاسم القياسي عندنا -> اسم الحقل عند المزوّد (None = غير مدعوم)
    field_map: Dict[str, Optional[str]] = field(default_factory=dict)
    defaults: Dict[str, object] = field(default_factory=dict)
    # صيغة المدة عند المزوّد: "int" (5) | "str" ("5") | "suffix" ("5s")
    duration_format: str = "int"

    def _fmt_duration(self, value: object) -> object:
        try:
            n = int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return value
        if self.duration_format == "str":
            return str(n)
        if self.duration_format == "suffix":
            return f"{n}s"
        return n

    def build_input(self, opts: Dict[str, object]) -> Dict[str, object]:
        """يحوّل الخيارات القياسية إلى payload خاص بالنموذج."""
        fmap = {
            "prompt": "prompt",
            "negative_prompt": "negative_prompt",
            "duration": "duration",
            "aspect_ratio": "aspect_ratio",
            "resolution": "resolution",
            "seed": "seed",
            "image": "image",
        }
        fmap.update(self.field_map)

        payload: Dict[str, object] = dict(self.defaults)
        for std_key, value in opts.items():
            if value is None:
                continue
            target = fmap.get(std_key, std_key)
            if target is None:      # الحقل غير مدعوم في هذا النموذج
                continue
            if std_key == "duration":
                value = self._fmt_duration(value)
            payload[target] = value
        return payload


# ---------------------------------------------------------------------------
# النماذج. الترتيب = ترتيب العرض في `aivideo models`
# ---------------------------------------------------------------------------
MODELS: List[ModelSpec] = [
    ModelSpec(
        alias="veo3",
        provider="replicate",
        model_id="google/veo-3.1",
        realism=5,
        audio=True,
        image_to_video=True,
        approx_cost="~$0.15–0.40 / ثانية",
        notes="الأفضل للحوار وتزامن الشفاه والصوت الأصلي. جودة سينمائية عالية.",
        field_map={"duration": "duration", "resolution": "resolution", "image": "image"},
        defaults={"resolution": "1080p"},
    ),
    ModelSpec(
        alias="veo3-fast",
        provider="replicate",
        model_id="google/veo-3.1-fast",
        realism=4,
        audio=True,
        image_to_video=True,
        approx_cost="~$0.15 / ثانية",
        notes="نسخة أسرع وأرخص من Veo 3.1 — ممتازة للتجريب قبل اللقطة النهائية.",
        field_map={"image": "image"},
    ),
    ModelSpec(
        alias="kling",
        provider="replicate",
        model_id="kwaivgi/kling-v2.5-turbo-pro",
        realism=5,
        audio=False,
        image_to_video=True,
        approx_cost="~$0.07–0.14 / ثانية",
        notes="أفضل توازن سعر/واقعية، قوي جداً في حركة البشر ولقطات المنتجات.",
        field_map={"image": "start_image", "resolution": None, "duration": "duration"},
        defaults={"duration": 5},
    ),
    ModelSpec(
        alias="hailuo",
        provider="replicate",
        model_id="minimax/hailuo-02",
        realism=4,
        audio=False,
        image_to_video=True,
        approx_cost="~$0.25 / فيديو",
        notes="تسعير ثابت لكل فيديو، جيد لأعمال الحركة والكاميرا الديناميكية.",
        field_map={"image": "first_frame_image", "aspect_ratio": None, "negative_prompt": None},
        defaults={"duration": 6, "resolution": "1080p"},
    ),
    ModelSpec(
        alias="wan",
        provider="replicate",
        model_id="wan-video/wan-2.5-t2v",
        realism=4,
        audio=True,
        image_to_video=False,
        approx_cost="~$0.07 / ثانية",
        notes="الخيار مفتوح المصدر الأرخص، جودة جيدة جداً مقابل السعر.",
        field_map={},
        defaults={"resolution": "720p"},
    ),
    ModelSpec(
        alias="seedance",
        provider="replicate",
        model_id="bytedance/seedance-1-pro",
        realism=4,
        audio=False,
        image_to_video=True,
        approx_cost="~$0.03–0.10 / ثانية",
        notes="سعر منخفض جداً للثانية، ممتاز لتوليد عدة نسخ واختيار الأفضل.",
        field_map={"image": "image", "negative_prompt": None},
        defaults={"resolution": "1080p", "fps": 24},
    ),
    ModelSpec(
        alias="fal-veo3",
        provider="fal",
        model_id="fal-ai/veo3",
        realism=5,
        audio=True,
        image_to_video=False,
        approx_cost="حسب تسعير fal",
        notes="Veo 3 عبر fal.ai — بديل إن لم يتوفّر لديك حساب Replicate.",
        field_map={"resolution": None},
        duration_format="suffix",
    ),
    ModelSpec(
        alias="fal-kling",
        provider="fal",
        model_id="fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
        realism=5,
        audio=False,
        image_to_video=False,
        approx_cost="حسب تسعير fal",
        notes="Kling عبر fal.ai، واقعية عالية للبشر.",
        field_map={"resolution": None},
        defaults={"duration": "5"},
        duration_format="str",
    ),
    ModelSpec(
        alias="fal-wan",
        provider="fal",
        model_id="fal-ai/wan/v2.5/text-to-video",
        realism=4,
        audio=True,
        image_to_video=False,
        approx_cost="حسب تسعير fal",
        notes="Wan 2.5 عبر fal.ai مع صوت أصلي.",
        field_map={},
    ),
]

BY_ALIAS: Dict[str, ModelSpec] = {m.alias: m for m in MODELS}


def resolve(name: str) -> ModelSpec:
    """يعيد النموذج حسب الاختصار، أو ينشئ واحداً من معرّف كامل مثل owner/model."""
    if name in BY_ALIAS:
        return BY_ALIAS[name]
    if name.startswith("fal-ai/"):
        return ModelSpec(name, "fal", name, 0, False, False, "غير معروف", "نموذج مخصّص")
    if "/" in name:
        return ModelSpec(name, "replicate", name, 0, False, False, "غير معروف", "نموذج مخصّص")
    raise KeyError(
        f"نموذج غير معروف: {name}\nالمتاح: {', '.join(BY_ALIAS)}\n"
        "أو مرّر معرّفاً كاملاً مثل owner/model (Replicate) أو fal-ai/... (fal)."
    )

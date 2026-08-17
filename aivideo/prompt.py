"""بناء وتحسين الـ prompt لزيادة واقعية الفيديو الناتج."""

from __future__ import annotations

from typing import Optional

# لبنات واقعية: عدسة/إضاءة/حبيبات فيلم/عيوب واقعية تكسر «المظهر الاصطناعي»
REALISM_SUFFIX = (
    "shot on ARRI Alexa 35 with a 35mm anamorphic prime lens, shallow depth of field, "
    "natural motion blur, physically accurate lighting with soft practical sources and "
    "realistic falloff, subtle handheld camera micro-movements, true-to-life skin texture "
    "with pores and imperfections, accurate subsurface scattering, fine film grain, "
    "photorealistic, cinematic color grading, 4K detail, 24fps"
)

DEFAULT_NEGATIVE = (
    "cartoon, anime, illustration, 3d render, cgi look, plastic skin, waxy skin, "
    "oversaturated colors, overexposed highlights, blurry, low resolution, watermark, "
    "text overlay, logo, distorted hands, extra fingers, deformed face, warped anatomy, "
    "flickering, jittery motion, morphing objects, duplicated limbs, uncanny valley"
)

STYLE_PRESETS = {
    "documentary": "observational documentary style, available light, slight handheld sway, neutral color grade",
    "cinematic": "cinematic feature-film look, dramatic key light, teal-and-amber grade, wide dynamic range",
    "commercial": "high-end commercial product cinematography, glossy studio lighting, motion-controlled camera move",
    "phone": "casual smartphone footage, vertical framing, slightly noisy sensor, imperfect autofocus, everyday realism",
    "drone": "aerial drone footage, smooth gimbal glide, wide establishing shot, golden hour haze",
    "interview": "talking-head interview, 85mm lens, soft key light with gentle rim, blurred background bokeh",
    "none": "",
}


def build_prompt(
    idea: str,
    *,
    style: str = "cinematic",
    camera: Optional[str] = None,
    enhance: bool = True,
) -> str:
    """يبني prompt نهائياً من فكرة بسيطة."""
    parts = [idea.strip().rstrip(".")]

    style_text = STYLE_PRESETS.get(style, style if style != "none" else "")
    if style_text:
        parts.append(style_text)
    if camera:
        parts.append(camera.strip().rstrip("."))
    if enhance:
        parts.append(REALISM_SUFFIX)

    return ". ".join(p for p in parts if p) + "."


def build_negative(extra: Optional[str] = None, *, use_default: bool = True) -> Optional[str]:
    chunks = []
    if use_default:
        chunks.append(DEFAULT_NEGATIVE)
    if extra:
        chunks.append(extra.strip())
    return ", ".join(chunks) if chunks else None

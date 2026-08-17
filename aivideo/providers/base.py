"""الواجهة المشتركة للمزوّدين."""

from __future__ import annotations

import abc
import os
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional


class ProviderError(RuntimeError):
    """خطأ من طرف المزوّد."""


class MissingApiKey(ProviderError):
    """مفتاح API غير موجود."""


@dataclass
class GenerationResult:
    video_urls: List[str]
    raw: Dict[str, Any]
    provider: str
    model_id: str
    request_id: Optional[str] = None


Logger = Callable[[str], None]


class Provider(abc.ABC):
    name: str = "base"
    env_var: str = ""
    signup_url: str = ""

    def __init__(self, api_key: Optional[str] = None, log: Optional[Logger] = None):
        self.api_key = api_key or os.environ.get(self.env_var, "").strip()
        self.log: Logger = log or (lambda _msg: None)

    def require_key(self) -> str:
        if not self.api_key:
            raise MissingApiKey(
                f"مفتاح {self.name} غير موجود.\n"
                f"  1) أنشئ مفتاحاً من: {self.signup_url}\n"
                f"  2) صدّره:  export {self.env_var}=\"...\"\n"
                f"     أو ضعه في ملف .env بجانب المشروع."
            )
        return self.api_key

    @abc.abstractmethod
    def generate(
        self,
        model_id: str,
        payload: Dict[str, Any],
        *,
        poll_interval: float = 4.0,
        timeout: int = 1800,
    ) -> GenerationResult:
        """يشغّل النموذج وينتظر النتيجة ويعيد روابط الفيديو."""

    # أدوات مساعدة مشتركة -------------------------------------------------
    @staticmethod
    def extract_video_urls(obj: Any) -> List[str]:
        """يستخرج كل روابط الفيديو من أي بنية JSON متداخلة."""
        found: List[str] = []
        exts = (".mp4", ".webm", ".mov", ".m4v")

        def walk(node: Any) -> None:
            if isinstance(node, str):
                low = node.split("?")[0].lower()
                if node.startswith("http") and (low.endswith(exts) or "/video" in low):
                    found.append(node)
            elif isinstance(node, dict):
                for key in ("url", "video_url", "output", "video"):
                    if key in node:
                        walk(node[key])
                for k, v in node.items():
                    if k not in ("url", "video_url", "output", "video"):
                        walk(v)
            elif isinstance(node, (list, tuple)):
                for item in node:
                    walk(item)

        walk(obj)
        # إزالة التكرار مع الحفاظ على الترتيب
        seen, uniq = set(), []
        for u in found:
            if u not in seen:
                seen.add(u)
                uniq.append(u)
        return uniq

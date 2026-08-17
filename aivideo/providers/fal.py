"""مزوّد fal.ai — https://fal.ai

يستعمل نظام الطابور (queue):
  POST https://queue.fal.run/{model_id}
  GET  https://queue.fal.run/{app}/requests/{id}/status
  GET  https://queue.fal.run/{app}/requests/{id}
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from .. import http
from .base import GenerationResult, Provider, ProviderError

QUEUE = "https://queue.fal.run"
TERMINAL_OK = {"COMPLETED"}
TERMINAL_BAD = {"FAILED", "CANCELLED", "ERROR"}


def _app_root(model_id: str) -> str:
    """fal-ai/kling-video/v2.5/... -> fal-ai/kling-video (جذر التطبيق للاستعلام)."""
    parts = model_id.split("/")
    return "/".join(parts[:2]) if len(parts) > 2 else model_id


class FalProvider(Provider):
    name = "fal"
    env_var = "FAL_KEY"
    signup_url = "https://fal.ai/dashboard/keys"

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Key {self.require_key()}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    def submit(self, model_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{QUEUE}/{model_id}"
        self.log(f"→ POST {url}")
        return http.post(url, headers=self._headers(), json_body=payload, timeout=120)

    def status(self, model_id: str, request_id: str) -> Dict[str, Any]:
        url = f"{QUEUE}/{_app_root(model_id)}/requests/{request_id}/status"
        return http.get(url, headers=self._headers(), timeout=60)

    def result(self, model_id: str, request_id: str) -> Dict[str, Any]:
        url = f"{QUEUE}/{_app_root(model_id)}/requests/{request_id}"
        return http.get(url, headers=self._headers(), timeout=120)

    # ------------------------------------------------------------------
    def generate(
        self,
        model_id: str,
        payload: Dict[str, Any],
        *,
        poll_interval: float = 4.0,
        timeout: int = 1800,
    ) -> GenerationResult:
        sub = self.submit(model_id, payload)
        request_id: Optional[str] = sub.get("request_id") or sub.get("requestId")
        if not request_id:
            raise ProviderError(f"لم يُعِد fal معرّف طلب: {sub}")

        self.log(f"  معرّف الطلب: {request_id}")
        deadline = time.time() + timeout
        state = sub.get("status", "IN_QUEUE")
        last_state = None

        while state not in TERMINAL_OK:
            if state in TERMINAL_BAD:
                raise ProviderError(f"فشل التوليد على fal ({state}).")
            if time.time() > deadline:
                raise ProviderError(f"انتهت المهلة ({timeout}s) والطلب ما زال بحالة: {state}")
            time.sleep(poll_interval)
            st = self.status(model_id, request_id)
            state = st.get("status", state)
            if state != last_state:
                self.log(f"  الحالة: {state}")
                last_state = state

        data = self.result(model_id, request_id)
        urls = self.extract_video_urls(data)
        if not urls:
            raise ProviderError(f"نجح الطلب لكن لم يُعثر على رابط فيديو: {data}")

        return GenerationResult(urls, data, self.name, model_id, request_id)

"""مزوّد Replicate — https://replicate.com

يستعمل واجهة predictions الرسمية:
  POST https://api.replicate.com/v1/models/{owner}/{name}/predictions
  GET  https://api.replicate.com/v1/predictions/{id}
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from .. import http
from .base import GenerationResult, Provider, ProviderError

API = "https://api.replicate.com/v1"
TERMINAL = {"succeeded", "failed", "canceled"}


class ReplicateProvider(Provider):
    name = "replicate"
    env_var = "REPLICATE_API_TOKEN"
    signup_url = "https://replicate.com/account/api-tokens"

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.require_key()}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    def create_prediction(self, model_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if ":" in model_id and "/" in model_id.split(":")[0]:
            # نسخة محدّدة  owner/model:version
            version = model_id.split(":", 1)[1]
            url = f"{API}/predictions"
            body = {"version": version, "input": payload}
        else:
            owner, _, model = model_id.partition("/")
            if not model:
                raise ProviderError(f"معرّف نموذج Replicate غير صالح: {model_id}")
            url = f"{API}/models/{owner}/{model}/predictions"
            body = {"input": payload}

        self.log(f"→ POST {url}")
        return http.post(url, headers=self._headers(), json_body=body, timeout=120)

    def get_prediction(self, prediction_id: str) -> Dict[str, Any]:
        return http.get(f"{API}/predictions/{prediction_id}", headers=self._headers(), timeout=60)

    def cancel(self, prediction_id: str) -> Dict[str, Any]:
        return http.post(f"{API}/predictions/{prediction_id}/cancel", headers=self._headers())

    # ------------------------------------------------------------------
    def generate(
        self,
        model_id: str,
        payload: Dict[str, Any],
        *,
        poll_interval: float = 4.0,
        timeout: int = 1800,
    ) -> GenerationResult:
        pred = self.create_prediction(model_id, payload)
        pred_id: Optional[str] = pred.get("id")
        if not pred_id:
            raise ProviderError(f"لم يُعِد Replicate معرّف تنبؤ: {pred}")

        self.log(f"  معرّف الطلب: {pred_id}")
        deadline = time.time() + timeout
        status = pred.get("status", "starting")
        last_status = None

        while status not in TERMINAL:
            if time.time() > deadline:
                self.log("  انتهت المهلة — إلغاء الطلب…")
                try:
                    self.cancel(pred_id)
                except Exception:
                    pass
                raise ProviderError(f"انتهت المهلة ({timeout}s) والطلب ما زال بحالة: {status}")
            time.sleep(poll_interval)
            pred = self.get_prediction(pred_id)
            status = pred.get("status", status)
            if status != last_status:
                self.log(f"  الحالة: {status}")
                last_status = status

        if status != "succeeded":
            err = pred.get("error") or pred.get("logs") or status
            raise ProviderError(f"فشل التوليد على Replicate ({status}): {err}")

        urls = self.extract_video_urls(pred.get("output"))
        if not urls:
            raise ProviderError(f"نجح الطلب لكن لم يُعثر على رابط فيديو في المخرجات: {pred.get('output')}")

        return GenerationResult(urls, pred, self.name, model_id, pred_id)

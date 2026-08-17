"""طبقة HTTP خفيفة مبنية على urllib (بدون requests) مع إعادة المحاولة."""

from __future__ import annotations

import json
import random
import ssl
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

USER_AGENT = "aivideo/1.0 (+https://github.com/Djalil211)"
DEFAULT_TIMEOUT = 120


class HttpError(RuntimeError):
    """خطأ HTTP مع الحالة والجسم."""

    def __init__(self, status: int, body: str, url: str):
        self.status = status
        self.body = body
        self.url = url
        super().__init__(f"HTTP {status} من {url}\n{body[:1500]}")


def _ssl_context() -> ssl.SSLContext:
    return ssl.create_default_context()


def request(
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    json_body: Optional[Any] = None,
    timeout: int = DEFAULT_TIMEOUT,
    retries: int = 4,
) -> Dict[str, Any]:
    """ينفّذ طلباً ويعيد JSON كقاموس (أو {"_raw": text} إن لم يكن JSON)."""
    data = None
    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    if json_body is not None:
        data = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")

    last_exc: Optional[Exception] = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=hdrs, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                if not raw.strip():
                    return {}
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return {"_raw": raw}
        except urllib.error.HTTPError as exc:  # 4xx / 5xx
            body = exc.read().decode("utf-8", errors="replace")
            # أخطاء العميل (عدا 408/429) لا فائدة من إعادتها
            if exc.code < 500 and exc.code not in (408, 429):
                raise HttpError(exc.code, body, url) from None
            last_exc = HttpError(exc.code, body, url)
        except (urllib.error.URLError, TimeoutError, ssl.SSLError) as exc:
            last_exc = exc

        if attempt < retries:
            sleep_s = min(30, (2 ** attempt) + random.uniform(0, 1.0))
            time.sleep(sleep_s)

    raise last_exc if last_exc else RuntimeError("فشل الطلب لسبب غير معروف")


def get(url: str, **kw: Any) -> Dict[str, Any]:
    return request("GET", url, **kw)


def post(url: str, **kw: Any) -> Dict[str, Any]:
    return request("POST", url, **kw)


def download(url: str, dest: str, *, timeout: int = 600, chunk: int = 1 << 16) -> str:
    """يحمّل ملفاً (فيديو) إلى المسار dest ويعيد المسار."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp, open(dest, "wb") as fh:
        while True:
            block = resp.read(chunk)
            if not block:
                break
            fh.write(block)
    return dest

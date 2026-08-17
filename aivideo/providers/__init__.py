"""مزوّدو توليد الفيديو."""

from __future__ import annotations

from typing import Dict, Type

from .base import Provider, ProviderError
from .fal import FalProvider
from .replicate import ReplicateProvider

REGISTRY: Dict[str, Type[Provider]] = {
    "replicate": ReplicateProvider,
    "fal": FalProvider,
}


def get_provider(name: str, **kw) -> Provider:
    try:
        cls = REGISTRY[name]
    except KeyError:
        raise ProviderError(f"مزوّد غير معروف: {name}. المتاح: {', '.join(REGISTRY)}") from None
    return cls(**kw)


__all__ = ["Provider", "ProviderError", "ReplicateProvider", "FalProvider", "get_provider", "REGISTRY"]

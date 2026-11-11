"""특색 캐릭터 참조 이미지 받기 (S3 presigned GET 등 http(s) 주소)."""
from __future__ import annotations

import urllib.request
from io import BytesIO

from PIL import Image

MAX_BYTES = 20 * 2**20


def fetch_image(url: str, max_side: int, timeout: float = 15.0) -> Image.Image:
    if not url.startswith(("https://", "http://")):
        raise ValueError(f"http(s) 주소가 아님: {url[:60]}")
    with urllib.request.urlopen(url, timeout=timeout) as r:
        data = r.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("참조 이미지가 20MB 를 넘음")
    img = Image.open(BytesIO(data))
    img.load()
    if img.mode in ("RGBA", "LA", "P"):  # 투명 배경은 흰색으로 채운다 (ai/scripts/variant_test.py 와 같음)
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, "white")
        bg.paste(img, mask=img.getchannel("A"))
        img = bg
    img = img.convert("RGB")
    img.thumbnail((max_side, max_side))
    return img

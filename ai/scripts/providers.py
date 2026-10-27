"""이미지 생성 provider 인터페이스 (generate_candidates.py, infer.py --method api_ref 공통).

새 provider 추가 방법:
  1) ImageProvider 를 상속해 generate() 를 구현한다 (레퍼런스 이미지 첨부 지원).
  2) PROVIDERS 에 이름을 등록한다.
  3) .env 의 IMAGE_API_PROVIDER 를 그 이름으로 바꾼다.
API 키는 .env 에서만 읽는다 (코드/설정 파일에 쓰지 말 것).
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from common import AI_DIR


def load_env() -> None:
    try:
        from dotenv import load_dotenv
        load_dotenv(AI_DIR / ".env")
    except ImportError:
        pass


@dataclass
class Job:
    key: str                 # 저장 경로 등 식별자
    prompt: str
    refs: list[Path]
    size: int = 1024
    seed: int | None = None


class ImageProvider:
    name = "base"
    cost_per_image_usd = 0.0

    def generate(self, job: Job) -> Image.Image:
        raise NotImplementedError

    def generate_batch(self, jobs: list[Job]):
        """기본 구현: 순서대로 1장씩. (job, image|None, sec, error) 를 yield."""
        for job in jobs:
            t0 = time.perf_counter()
            try:
                img = self.generate(job)
                yield job, img, time.perf_counter() - t0, None
            except Exception as e:  # noqa: BLE001
                yield job, None, time.perf_counter() - t0, f"{type(e).__name__}: {e}"

    def close(self) -> None:
        pass


class DryRunProvider(ImageProvider):
    """이미지를 만들지 않고 프롬프트/레퍼런스만 로그로 확인한다."""
    name = "dry_run"

    def generate(self, job: Job) -> Image.Image:
        print(f"[dry_run] {job.key} refs={[p.name for p in job.refs]} prompt={job.prompt[:120]}...")
        raise RuntimeError("dry_run: no image generated")


class ExternalApiProvider(ImageProvider):
    """TODO({{IMAGE_API_PROVIDER}}): 팀이 외부 이미지 API를 확정하면 여기를 구현한다.

    요구사항: 레퍼런스 이미지(anchors) 첨부, 1024px 정사각형 출력, 장당 비용을 cost_per_image_usd 로 기록.
    키: os.environ["IMAGE_API_KEY"]
    """
    name = "external_api"

    def __init__(self) -> None:
        load_env()
        self.provider = os.environ.get("IMAGE_API_PROVIDER", "")
        self.api_key = os.environ.get("IMAGE_API_KEY", "")
        self.cost_per_image_usd = float(os.environ.get("IMAGE_API_COST_PER_IMAGE_USD", "0") or 0)

    def generate(self, job: Job) -> Image.Image:
        raise NotImplementedError(
            "IMAGE_API_PROVIDER 가 아직 정해지지 않았습니다. scripts/providers.py 의 ExternalApiProvider.generate()"
            " 를 구현하고 .env 에 IMAGE_API_PROVIDER / IMAGE_API_KEY 를 채워 주세요.")


class KleinLocalProvider(ImageProvider):
    """로컬 FLUX.2 klein 4B distilled 로 생성 (API 비용 0). 레퍼런스가 있으면 편집(reference) 모드.

    2단계로 동작: 모든 프롬프트 임베딩을 먼저 계산 -> 텍스트 인코더 언로드 -> 트랜스포머 로드 후 생성.
    """
    name = "klein_local"

    def __init__(self, precision: str = "fp8", steps: int = 4) -> None:
        self.precision = precision
        self.steps = steps

    def generate_batch(self, jobs: list[Job]):
        from klein_runtime import encode_prompts, free_cuda, generate, load_generator
        embeds, _ = encode_prompts([j.prompt for j in jobs])
        pipe = load_generator(self.precision)
        try:
            for job in jobs:
                t0 = time.perf_counter()
                try:
                    refs = [Image.open(p).convert("RGB") for p in job.refs] or None
                    img = generate(pipe, embeds[job.prompt], job.size, job.seed or 0, steps=self.steps,
                                   ref_images=refs)
                    yield job, img, time.perf_counter() - t0, None
                except Exception as e:  # noqa: BLE001
                    yield job, None, time.perf_counter() - t0, f"{type(e).__name__}: {e}"
        finally:
            del pipe
            free_cuda()


PROVIDERS = {
    "dry_run": DryRunProvider,
    "external_api": ExternalApiProvider,
    "klein_local": KleinLocalProvider,
}


def get_provider(name: str | None = None, **kw) -> ImageProvider:
    load_env()
    name = name or os.environ.get("IMAGE_PROVIDER_IMPL") or "external_api"
    if name not in PROVIDERS:
        raise ValueError(f"unknown provider '{name}'. 사용 가능: {list(PROVIDERS)}")
    return PROVIDERS[name](**kw)

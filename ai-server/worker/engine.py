"""이미지 생성. 모델은 프로세스가 시작할 때 한 번 올리고 계속 둔다.

H200 에서는 텍스트 인코더 + 트랜스포머 + VAE + LoRA 를 bf16 으로 전부 올려도 약 16GB 라서,
노트북(ai/scripts/klein_runtime.py)처럼 인코더를 올렸다 내리지 않는다.
GPU 선택은 CUDA_VISIBLE_DEVICES 로 한다 (__main__.py --gpu).
"""
from __future__ import annotations

import hashlib
import logging
import time
from typing import Protocol

from PIL import Image, ImageDraw

from .config import Settings

log = logging.getLogger(__name__)

MIN_FREE_GB = 24  # 모델을 GPU 로 올리기 전에 이만큼은 비어 있어야 한다 (bf16 전체 약 16GB + 생성 여유)


class FatalEngineError(RuntimeError):
    """GPU 상태가 망가져서 이 프로세스로는 더 그릴 수 없음 → 프로세스를 끝내고 run_worker.sh 가 다시 띄운다."""


class Engine(Protocol):
    size: int

    def generate(self, prompt: str, seed: int, ref_image: Image.Image | None = None) -> Image.Image: ...


def seed_for(request_id: str) -> int:
    """같은 요청(SQS 메시지 ID)은 항상 같은 seed → 다시 처리해도 같은 그림. 다시 그리기는 새 요청이라 다른 그림."""
    return int.from_bytes(hashlib.sha256(request_id.encode()).digest()[:4], "big") % 2**31


class KleinEngine:
    def __init__(self, s: Settings):
        import torch
        from diffusers import Flux2KleinPipeline

        if not torch.cuda.is_available():
            raise SystemExit("CUDA 를 쓸 수 없다. GPU 없이 흐름만 보려면 --fake-engine")
        if not s.lora.is_file():
            raise SystemExit(f"LoRA 파일이 없음: {s.lora} (config.yaml model.lora)")
        self.torch = torch
        self.size, self.steps, self.guidance = s.size, s.steps, s.guidance
        self.idle_release_sec = s.idle_release_sec
        self.on_gpu = False
        self.last_used = time.monotonic()

        # 모델은 CPU 메모리에 올려 두고, 요청이 오면 GPU 로 옮긴다 (공용 서버라 쉬는 동안 GPU 를 비워 둔다)
        t = time.perf_counter()
        pipe = Flux2KleinPipeline.from_pretrained(s.model_repo, torch_dtype=torch.bfloat16)
        # 폴더 + 파일 이름으로 넘긴다. 파일 경로만 주면 HF_HUB_OFFLINE=1 일 때 diffusers 가 파일인지 보기 전에
        # "offline mode 에서는 weight_name 을 지정하라" 오류를 낸다
        pipe.load_lora_weights(str(s.lora.parent), weight_name=s.lora.name, adapter_name="mochi")
        pipe.set_adapters(["mochi"], adapter_weights=[s.lora_scale])
        pipe.set_progress_bar_config(disable=True)
        self.pipe = pipe
        log.info("모델 로드 (CPU 메모리) %.1fs: %s + %s, bf16", time.perf_counter() - t, s.model_repo, s.lora.name)

        t = time.perf_counter()
        try:
            self.generate("mochi_char, calm, resting, home living room, sunny window light, medium shot", 0)
        except RuntimeError as e:
            raise SystemExit(f"워밍업 실패: {e}") from e
        log.info("워밍업 1장 %.1fs (GPU 로 옮기는 시간 포함)", time.perf_counter() - t)

    def _to_gpu(self) -> None:
        if self.on_gpu:
            return
        torch = self.torch
        free, total = (v / 2**30 for v in torch.cuda.mem_get_info())
        if free < MIN_FREE_GB:
            raise RuntimeError(f"GPU 빈 메모리 {free:.0f}/{total:.0f}GB < {MIN_FREE_GB}GB. "
                               "다른 사용자가 쓰는 중일 수 있다 (nvidia-smi 확인)")
        t = time.perf_counter()
        self.pipe.to("cuda")
        self.on_gpu = True
        log.info("모델을 GPU 로 올림 %.1fs: %s, VRAM %.1fGB (올리기 전 빈 메모리 %.0f/%.0fGB)",
                 time.perf_counter() - t, torch.cuda.get_device_name(), torch.cuda.memory_allocated() / 2**30,
                 free, total)

    def release_if_idle(self) -> None:
        """idle_release_sec 동안 그리지 않았으면 모델을 CPU 로 내려 GPU 메모리를 돌려준다. 0 이면 계속 GPU 에 둔다."""
        if not self.on_gpu or self.idle_release_sec <= 0:
            return
        idle = time.monotonic() - self.last_used
        if idle < self.idle_release_sec:
            return
        self.pipe.to("cpu")
        self.torch.cuda.empty_cache()
        self.on_gpu = False
        log.info("%.0f초 동안 요청이 없어 모델을 CPU 로 내림 (GPU 메모리 반환, 남은 VRAM %.1fGB)", idle,
                 self.torch.cuda.memory_reserved() / 2**30)

    def generate(self, prompt: str, seed: int, ref_image: Image.Image | None = None) -> Image.Image:
        torch = self.torch
        self._to_gpu()
        kw = dict(prompt=prompt, height=self.size, width=self.size, num_inference_steps=self.steps,
                  guidance_scale=self.guidance, generator=torch.Generator("cpu").manual_seed(seed))  # 노트북과 같은 CPU 노이즈
        if ref_image is not None:
            kw["image"] = [ref_image]
        try:
            with torch.inference_mode():
                return self.pipe(**kw).images[0]
        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()
            raise
        except RuntimeError as e:
            if "CUDA error" in str(e) or "device-side assert" in str(e):
                raise FatalEngineError(str(e)) from e
            raise
        finally:
            self.last_used = time.monotonic()


class FakeEngine:
    """GPU 없이 SQS → S3 → SQS 흐름을 시험할 때 쓴다. 프롬프트를 적은 단색 이미지를 돌려준다."""

    def __init__(self, s: Settings, delay_sec: float = 1.0):
        self.size, self.delay_sec = s.size, delay_sec
        log.info("가짜 엔진 (장당 %.1fs)", delay_sec)

    def generate(self, prompt: str, seed: int, ref_image: Image.Image | None = None) -> Image.Image:
        time.sleep(self.delay_sec)
        img = Image.new("RGB", (self.size, self.size), ((seed >> 16) % 256, (seed >> 8) % 256, seed % 256))
        d = ImageDraw.Draw(img)
        d.rectangle((0, 0, self.size, 120), fill="white")
        for i in range(0, min(len(prompt), 400), 80):
            d.text((8, 8 + i // 80 * 20), prompt[i:i + 80], fill="black")
        if ref_image is not None:
            img.paste(ref_image.resize((160, 160)), (self.size - 168, self.size - 168))
        return img

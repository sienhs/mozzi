"""FLUX.2 [klein] 4B 로딩/인코딩 공통 코드 (infer.py, generate_candidates.py 의 klein_local provider).

6GB VRAM에서는 Qwen3-4B 텍스트 인코더(bf16 약 8GB)와 트랜스포머(bf16 약 7.75GB)를 동시에 올릴 수 없다.
그래서 2단계로 나눈다.
  1) encode_prompts(): 텍스트 인코더만 로드 -> 프롬프트 임베딩 계산 -> 디스크 캐시 -> 언로드
  2) load_generator(): 트랜스포머(precision별) + VAE (+ LoRA) 로드 -> prompt_embeds 로 생성
텍스트 인코더는 모든 precision 비교에서 bf16으로 고정한다 (precision 축은 트랜스포머에만 적용).
"""
from __future__ import annotations

import gc
import hashlib
import time

import torch

from common import OUTPUTS

DISTILLED_REPO = "black-forest-labs/FLUX.2-klein-4B"
BASE_REPO = "black-forest-labs/FLUX.2-klein-base-4B"
GGUF_FILES = {
    # unsloth/FLUX.2-klein-4B-GGUF (Apache 2.0, gated 아님)
    "gguf_q8": "https://huggingface.co/unsloth/FLUX.2-klein-4B-GGUF/blob/main/flux-2-klein-4b-Q8_0.gguf",
    "gguf_q4": "https://huggingface.co/unsloth/FLUX.2-klein-4B-GGUF/blob/main/flux-2-klein-4b-Q4_K_M.gguf",
}
PRECISIONS = ["bf16", "fp8", "gguf_q8", "gguf_q4"]
TE_CACHE = OUTPUTS / "cache" / "te"
DTYPE = torch.bfloat16


def _key(repo: str, text: str, max_len: int) -> str:
    return hashlib.sha1(f"{repo}|{max_len}|{text}".encode("utf-8")).hexdigest()


def free_cuda() -> None:
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()


def encode_prompts(texts: list[str], repo: str = DISTILLED_REPO, te_device: str = "cuda",
                   max_sequence_length: int = 512, log=print) -> tuple[dict[str, torch.Tensor], dict]:
    """텍스트 -> prompt_embeds (CPU 텐서). 캐시에 있으면 재사용한다.

    반환 stats: te_load_sec, te_encode_sec_mean(이번에 새로 인코딩한 것 기준, 없으면 캐시 기록값),
               n_encoded, n_cached, te_vram_peak_gb
    """
    from diffusers import Flux2KleinPipeline

    TE_CACHE.mkdir(parents=True, exist_ok=True)
    out: dict[str, torch.Tensor] = {}
    todo: list[str] = []
    cached_times: list[float] = []
    for t in dict.fromkeys(texts):
        p = TE_CACHE / f"{_key(repo, t, max_sequence_length)}.pt"
        if p.exists():
            d = torch.load(p, map_location="cpu")
            out[t] = d["embeds"]
            cached_times.append(d.get("encode_sec", float("nan")))
        else:
            todo.append(t)
    stats = {"te_load_sec": None, "te_encode_sec_mean": None, "n_encoded": len(todo), "n_cached": len(out),
             "te_device": te_device, "te_vram_peak_gb": None}
    if not todo:
        valid = [x for x in cached_times if x == x]
        stats["te_encode_sec_mean"] = sum(valid) / len(valid) if valid else None
        return out, stats

    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()
    t0 = time.perf_counter()
    pipe = Flux2KleinPipeline.from_pretrained(repo, transformer=None, vae=None, torch_dtype=DTYPE)
    pipe.text_encoder.to(te_device)
    if te_device.startswith("cuda"):
        torch.cuda.synchronize()
    stats["te_load_sec"] = time.perf_counter() - t0
    log(f"[TE] loaded on {te_device} in {stats['te_load_sec']:.1f}s, encoding {len(todo)} prompts")
    times = []
    with torch.inference_mode():
        for i, t in enumerate(todo):
            t1 = time.perf_counter()
            emb, _ = pipe.encode_prompt(prompt=t, device=torch.device(te_device),
                                        max_sequence_length=max_sequence_length)
            if te_device.startswith("cuda"):
                torch.cuda.synchronize()
            dt = time.perf_counter() - t1
            times.append(dt)
            emb = emb.to("cpu", DTYPE)
            out[t] = emb
            torch.save({"embeds": emb, "encode_sec": dt, "text": t}, TE_CACHE / f"{_key(repo, t, max_sequence_length)}.pt")
            if (i + 1) % 10 == 0:
                log(f"[TE] {i + 1}/{len(todo)}")
    stats["te_encode_sec_mean"] = sum(times) / len(times)
    if torch.cuda.is_available():
        stats["te_vram_peak_gb"] = torch.cuda.max_memory_allocated() / 2**30
    del pipe
    free_cuda()
    return out, stats


def load_transformer(precision: str, repo: str = DISTILLED_REPO):
    from diffusers import Flux2Transformer2DModel

    if precision == "bf16":
        tr = Flux2Transformer2DModel.from_pretrained(repo, subfolder="transformer", torch_dtype=DTYPE)
    elif precision == "fp8":
        # FP8 저장 + BF16 연산 (diffusers layerwise casting). 가중치 메모리 약 절반.
        # casting 은 load_generator 에서 LoRA 를 붙인 "뒤에" 켠다 (enable_fp8_storage 참고).
        tr = Flux2Transformer2DModel.from_pretrained(repo, subfolder="transformer", torch_dtype=DTYPE)
    elif precision in GGUF_FILES:
        from diffusers import GGUFQuantizationConfig
        tr = Flux2Transformer2DModel.from_single_file(
            GGUF_FILES[precision],
            quantization_config=GGUFQuantizationConfig(compute_dtype=DTYPE),
            config=repo, subfolder="transformer", torch_dtype=DTYPE,
        )
    else:
        raise ValueError(f"unknown precision: {precision} (지원: {PRECISIONS})")
    return tr


def enable_fp8_storage(transformer) -> None:
    """layerwise casting 을 켠다. 반드시 LoRA 를 붙인 뒤에 호출해야 한다.

    diffusers 는 PEFT 레이어가 이미 있으면 lora_A/lora_B 를 casting 대상에서 자동 제외한다
    (원본 base_layer 만 fp8 저장). 순서가 반대면 LoRA 층이 fp8 로 만들어지고 hook 이 없어
    'addmm_cuda not implemented for Float8_e4m3fn' 오류가 난다.
    """
    transformer.enable_layerwise_casting(storage_dtype=torch.float8_e4m3fn, compute_dtype=DTYPE)


def load_generator(precision: str, lora: str | None = None, lora_scale: float = 1.0,
                   repo: str = DISTILLED_REPO, device: str = "cuda", cpu_offload: bool = False, log=print):
    """트랜스포머 + VAE (+LoRA) 파이프라인. 텍스트 인코더는 올리지 않는다."""
    from diffusers import Flux2KleinPipeline

    tr = load_transformer(precision, repo)
    pipe = Flux2KleinPipeline.from_pretrained(repo, transformer=tr, text_encoder=None, tokenizer=None,
                                              torch_dtype=DTYPE)
    if lora:
        log(f"[LoRA] {lora} (scale={lora_scale})")
        pipe.load_lora_weights(lora, adapter_name="mochi")
        pipe.set_adapters(["mochi"], adapter_weights=[lora_scale])
    if precision == "fp8":
        enable_fp8_storage(pipe.transformer)
    if cpu_offload:
        pipe.enable_model_cpu_offload()
    else:
        pipe.to(device)
    return pipe


class TooSlowError(RuntimeError):
    """한 장 생성이 제한 시간을 넘음 (6GB 초과 → sysmem fallback 등)."""


def generate(pipe, embeds: torch.Tensor, size: int, seed: int, steps: int = 4, guidance: float = 1.0,
             ref_images=None, max_sec: float | None = None):
    gen = torch.Generator("cpu").manual_seed(seed)  # CPU generator: precision과 무관하게 같은 초기 노이즈
    kw = dict(prompt_embeds=embeds.to(pipe._execution_device), height=size, width=size,
              num_inference_steps=steps, guidance_scale=guidance, generator=gen)
    if ref_images:
        kw["image"] = ref_images
    if max_sec:
        t0 = time.perf_counter()

        def _deadline(_pipe, step, _t, cb_kwargs):  # 디노이즈 step 마다 경과 시간 확인
            el = time.perf_counter() - t0
            if el > max_sec:
                raise TooSlowError(f"{el:.0f}s after step {step + 1}/{steps} > max {max_sec:.0f}s per image")
            return cb_kwargs

        kw["callback_on_step_end"] = _deadline
    return pipe(**kw).images[0]

"""GPU 서버 환경 점검: 패키지 버전, GPU, 디스크, 외부 연결.

  python check_env.py              # 점검만
  python check_env.py --download   # + 추론 모델(FLUX.2 klein 4B, 약 20GB)을 HF 캐시에 받기
"""
from __future__ import annotations

import argparse
import importlib.metadata as md
import os
import shutil
import sys
import urllib.request
from pathlib import Path

PACKAGES = ["torch", "diffusers", "transformers", "accelerate", "safetensors", "peft", "gguf",
            "sentencepiece", "huggingface_hub", "pillow", "pyyaml", "boto3", "python-dotenv"]
URLS = ["https://huggingface.co", "https://sqs.ap-northeast-2.amazonaws.com",
        "https://s3.ap-northeast-2.amazonaws.com"]
MODEL_REPO = "black-forest-labs/FLUX.2-klein-4B"
NEED_DISK_GB = 40


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--download", action="store_true", help=f"{MODEL_REPO} 를 HF 캐시에 받는다")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    ok = True

    print("== 패키지 ==")
    for p in PACKAGES:
        try:
            print(f"  {p:16s} {md.version(p)}")
        except md.PackageNotFoundError:
            print(f"  {p:16s} 없음")
            ok = False

    print("== GPU ==")
    import torch
    print(f"  torch {torch.__version__}, CUDA 빌드 {torch.version.cuda}, 사용 가능 {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            p = torch.cuda.get_device_properties(i)
            print(f"  [{i}] {p.name}, {p.total_memory / 2**30:.0f}GB, bf16 {torch.cuda.is_bf16_supported()}")
        x = torch.randn(1024, 1024, device="cuda", dtype=torch.bfloat16)
        print(f"  bf16 행렬곱 시험: {(x @ x).float().abs().mean().item():.3f}")
    else:
        ok = False

    print("== 디스크 (HF 캐시) ==")
    hf_home = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))
    hf_home.mkdir(parents=True, exist_ok=True)
    free = shutil.disk_usage(hf_home).free / 2**30
    print(f"  HF_HOME={hf_home}  여유 {free:.0f}GB (필요 약 {NEED_DISK_GB}GB)")
    if free < NEED_DISK_GB:
        print("  ! 여유 공간 부족: 큰 디스크로 HF_HOME 을 옮긴다 (export HF_HOME=/큰/디스크/hf_cache)")
        ok = False

    print("== 외부 연결 ==")
    for u in URLS:
        try:
            code = urllib.request.urlopen(u, timeout=10).status
        except urllib.error.HTTPError as e:  # 4xx 도 서버까지는 닿은 것
            code = e.code
        except Exception as e:  # noqa: BLE001
            code = f"실패 ({type(e).__name__})"
            ok = False
        print(f"  {u:48s} {code}")

    if args.download:
        from huggingface_hub import snapshot_download
        print(f"== 모델 받기: {MODEL_REPO} ==")
        print(f"  {snapshot_download(MODEL_REPO)}")

    print("== 결과 ==", "OK" if ok else "확인 필요 (위 ! / 없음 / 실패 항목)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

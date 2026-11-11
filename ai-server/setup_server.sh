#!/usr/bin/env bash
# GPU 서버(Linux, conda)에서 ai-server 환경을 만든다. 여러 번 실행해도 안전하다.
#
#   cd ai-server && bash setup_server.sh
#
# 바꿀 수 있는 값 (환경 변수):
#   ENV_NAME   conda 환경 이름 (기본 mochi)
#   CUDA_TAG   torch CUDA 빌드 (기본 cu128: 드라이버 570 = CUDA 12.8 까지 지원)
#   TORCH_VER  torch 버전 (기본 2.11.0: cu128 로 나온 마지막 버전. ai/ 는 2.13.0+cu130)
set -euo pipefail
cd "$(dirname "$0")"

ENV_NAME="${ENV_NAME:-mochi}"
CUDA_TAG="${CUDA_TAG:-cu128}"
TORCH_VER="${TORCH_VER:-2.11.0}"

source "$(conda info --base)/etc/profile.d/conda.sh"

if conda env list | awk '{print $1}' | grep -qx "$ENV_NAME"; then
  echo "[setup] conda 환경 '$ENV_NAME' 이미 있음 → 그대로 사용"
else
  echo "[setup] conda 환경 '$ENV_NAME' 생성 (python 3.12, conda-forge)"
  # conda-forge 만 쓴다 (Anaconda 기본 채널 약관 문제 회피)
  conda create -n "$ENV_NAME" -c conda-forge --override-channels python=3.12 -y
fi
conda activate "$ENV_NAME"

python -m pip install --upgrade pip
echo "[setup] torch==$TORCH_VER ($CUDA_TAG)"
if ! python -m pip install "torch==$TORCH_VER" --index-url "https://download.pytorch.org/whl/$CUDA_TAG"; then
  echo "[setup] torch==$TORCH_VER $CUDA_TAG 빌드를 찾지 못함. 받을 수 있는 버전:"
  python -m pip index versions torch --index-url "https://download.pytorch.org/whl/$CUDA_TAG" || true
  echo "[setup] 위 목록에서 고른 뒤 TORCH_VER=<버전> bash setup_server.sh 로 다시 실행"
  exit 1
fi

echo "[setup] 나머지 패키지 (requirements.txt)"
python -m pip install -r requirements.txt

python check_env.py
echo "[setup] 완료. 다음부터는: conda activate $ENV_NAME"

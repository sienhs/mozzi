#!/usr/bin/env bash
# 배정받은 GPU 하나에 워커 하나를 띄우고, 워커가 끝나면 5초 뒤 다시 띄운다. tmux 창 안에서 실행한다.
#
#   bash run_worker.sh 4     # 배정받은 GPU 번호 (nvidia-smi 번호). 공용 서버라 반드시 지정한다
#
# Ctrl+C 한 번: 처리 중인 1건을 끝내고 워커 종료 → 5초 뒤 새 코드로 다시 뜸
# 다시 뜨기 전 5초 안에 Ctrl+C: 완전히 종료
set -uo pipefail
cd "$(dirname "$0")"

GPU="${1:?배정받은 GPU 번호를 준다 (예: bash run_worker.sh 4)}"
shift

source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate "${ENV_NAME:-mochi}"

while true; do
  python -m worker --gpu "$GPU" "$@"
  echo "[run_worker] 워커 종료 (exit $?). 5초 뒤 다시 띄움. 완전히 끄려면 지금 Ctrl+C"
  sleep 5 || exit 0
done

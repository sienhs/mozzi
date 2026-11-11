#!/usr/bin/env bash
# 매일 Jupyter 로그인 후 한 번 실행한다. 워커가 없으면 tmux 세션 "worker" 안에 띄우고, 있으면 그대로 둔다.
# (공용 서버 규정: Jupyter 세션 24시간이 지나면 tmux 안의 워커도 종료된다)
#
#   bash start_worker.sh 0      # 0: 배정받은 GPU 번호
#
# 띄운 뒤: tmux attach -t worker 로 들어가서 보고, Ctrl+B, D 로 빠져나온다.
set -euo pipefail
cd "$(dirname "$0")"

GPU="${1:?배정받은 GPU 번호를 준다 (예: bash start_worker.sh 0)}"

if tmux has-session -t worker 2>/dev/null; then
  echo "[start_worker] 이미 실행 중이다. 보기: tmux attach -t worker"
  exit 0
fi
tmux new-session -d -s worker "bash run_worker.sh $GPU"
echo "[start_worker] GPU $GPU 워커를 띄웠다. 모델을 올리는 데 10초쯤 걸린다"
echo "  보기: tmux attach -t worker   (빠져나오기: Ctrl+B, D)"
echo "  로그: tail -f logs/worker_gpu$GPU.log"

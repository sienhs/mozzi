"""워커 진입점.

  python -m worker --gpu 4                  # 배정받은 GPU 4 에서 실행 (보통 run_worker.sh 로 띄운다)
  python -m worker --fake-engine            # GPU 없이 SQS → S3 → SQS 흐름만 시험 (노트북)
  python -m worker --gpu 4 --once           # 1건만 처리하고 종료
"""
from __future__ import annotations

import argparse
import getpass
import logging
import os
import sys
from pathlib import Path

from .config import ROOT


def setup_logging(name: str) -> None:
    (ROOT / "logs").mkdir(exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s", "%Y-%m-%d %H:%M:%S")
    handlers = [logging.StreamHandler(sys.stdout), logging.FileHandler(ROOT / "logs" / f"worker_{name}.log", encoding="utf-8")]
    for h in handlers:
        h.setFormatter(fmt)
    logging.basicConfig(level=logging.INFO, handlers=handlers)
    for noisy in ("botocore", "boto3", "urllib3", "httpx", "diffusers", "transformers"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def set_process_title(title: str, log: logging.Logger) -> None:
    """ps·nvidia-smi 에 'python' 대신 계정 이름이 든 이름으로 보이게 한다 (공용 서버: ps -ef | grep 계정명 으로 찾음)."""
    try:
        from setproctitle import setproctitle
    except ImportError:
        log.warning("setproctitle 이 없어 프로세스 이름이 python 으로 보인다 (pip install setproctitle)")
        return
    setproctitle(title)
    log.info("프로세스 이름: %s", title)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(prog="python -m worker", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gpu", type=int, default=None, help="배정받은 GPU 번호 (nvidia-smi 번호)")
    ap.add_argument("--config", type=Path, default=ROOT / "config.yaml")
    ap.add_argument("--fake-engine", action="store_true", help="모델 없이 가짜 이미지를 만든다")
    ap.add_argument("--fake-delay", type=float, default=1.0, help="가짜 엔진의 장당 시간 (초)")
    ap.add_argument("--once", action="store_true", help="1건 처리하고 종료")
    args = ap.parse_args()

    # 공용 서버 규정: 배정받은 GPU 번호를 반드시 지정한다. torch 를 import 하기 전에 정해야 한다.
    # 번호는 nvidia-smi 와 같은 순서(PCI 버스)로 센다. 기본값(빠른 GPU 먼저)이면 배정 번호와 다른 GPU 를 잡을 수 있다
    os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"
    given = os.environ.get("CUDA_VISIBLE_DEVICES", "").strip()
    if args.gpu is None and not args.fake_engine:
        ap.error("--gpu 배정받은 GPU 번호를 지정한다 (공용 서버 규정). GPU 없이 시험하려면 --fake-engine")
    if args.gpu is not None:
        allowed = [d.strip() for d in given.split(",") if d.strip()]
        if allowed and str(args.gpu) not in allowed:  # 서버가 미리 정해 둔 GPU 가 있으면 그 밖은 쓰지 않는다
            raise SystemExit(f"--gpu {args.gpu}: 이 환경은 GPU {given} 만 쓰도록 정해져 있다")
        os.environ["CUDA_VISIBLE_DEVICES"] = str(args.gpu)
    name = f"gpu{args.gpu}" if args.gpu is not None else "local"
    setup_logging(name)
    log = logging.getLogger("worker")
    log.info("CUDA_VISIBLE_DEVICES: 원래 %s → %s", given or "(없음)", os.environ.get("CUDA_VISIBLE_DEVICES", "(없음)"))
    set_process_title(f"{getpass.getuser()}-mochi-worker-{name}", log)

    from .config import load_settings
    from .engine import FakeEngine, KleinEngine
    from .loop import Worker
    from .s3 import Storage
    from .sqs import Queue

    s = load_settings(name, args.config)
    log.info("시작: %s (%s)", s.worker, "가짜 엔진" if args.fake_engine else f"GPU {args.gpu}")
    engine = FakeEngine(s, args.fake_delay) if args.fake_engine else KleinEngine(s)
    try:
        Worker(s, engine, Queue(s), Storage(s)).run(once=args.once)
    except KeyboardInterrupt:
        log.info("바로 종료")
    return 0


if __name__ == "__main__":
    sys.exit(main())

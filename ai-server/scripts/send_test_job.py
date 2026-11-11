"""가짜 Java: 요청 큐에 시험 요청(ai-request)을 넣고, 결과 큐에서 그 결과를 기다린다.

  python scripts/send_test_job.py                                   # 기본 장면 1건, 결과까지 기다림
  python scripts/send_test_job.py --what reading --where "at a cafe" --who "with my friend" --emotion CALM
  python scripts/send_test_job.py --char-url https://.../7.webp --char-prompt "wearing ..."
  python scripts/send_test_job.py -n 4                              # 4건
  python scripts/send_test_job.py --bad                             # what 이 빈 요청 (INVALID_INPUT 결과가 오는지)
  python scripts/send_test_job.py --no-wait                         # 넣기만 함

시험 요청은 test: true, diaryId 900000000 이상, userId 0 으로 보낸다 (S3: test-diary/0/...).
결과 큐에서 이 스크립트가 보낸 diaryId 가 아닌 메시지는 지우지 않고 바로 돌려놓는다 (visibility 0).
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from worker.config import load_settings  # noqa: E402


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-n", type=int, default=1, help="보낼 요청 수")
    ap.add_argument("--what", default="cooking")
    ap.add_argument("--where", default="at home")
    ap.add_argument("--who", default="with mom")
    ap.add_argument("--emotion", default="HAPPY", help="HAPPY | CALM | NEUTRAL | SAD | ANGRY")
    ap.add_argument("--weather", default="on a rainy day")
    ap.add_argument("--time", default="in the evening", help="timeOfDay")
    ap.add_argument("--char-url", default="DEFAULT", help='characterImageUrl ("DEFAULT": 기본 모찌)')
    ap.add_argument("--char-prompt", default="a white round mochi with pink cheeks and short limbs",
                    help="characterPrompt")
    ap.add_argument("--bad", action="store_true", help="what 이 빈 요청을 보낸다")
    ap.add_argument("--no-wait", action="store_true")
    ap.add_argument("--timeout", type=float, default=300, help="결과를 기다릴 최대 시간 (초)")
    args = ap.parse_args()

    import boto3

    s = load_settings("test")
    sqs = boto3.client("sqs", region_name=s.aws_region)
    pending: dict[int, float] = {}
    for _ in range(args.n):
        diary_id = random.randint(900_000_000, 999_999_999)
        body = {"diaryId": diary_id, "userId": 0, "test": True, "date": date.today().isoformat(), "emotion": args.emotion,
                "characterImageUrl": args.char_url, "characterPrompt": args.char_prompt,
                "weather": args.weather, "timeOfDay": args.time, "where": args.where, "who": args.who,
                "what": "" if args.bad else args.what}
        sqs.send_message(QueueUrl=s.request_queue_url, MessageBody=json.dumps(body, ensure_ascii=False))
        pending[diary_id] = time.time()
        print(f"[보냄] diaryId={diary_id}")
    if args.no_wait:
        return 0

    deadline = time.time() + args.timeout
    while pending and time.time() < deadline:
        r = sqs.receive_message(QueueUrl=s.result_queue_url, MaxNumberOfMessages=10, WaitTimeSeconds=10)
        for m in r.get("Messages", []):
            try:
                res = json.loads(m["Body"])
            except json.JSONDecodeError:
                res = {}
            diary_id = res.get("diaryId")
            if diary_id in pending:
                sqs.delete_message(QueueUrl=s.result_queue_url, ReceiptHandle=m["ReceiptHandle"])
                print(f"[결과] diaryId={diary_id} ({time.time() - pending.pop(diary_id):.1f}s)")
                print(json.dumps(res, ensure_ascii=False, indent=2))
            else:  # 다른 사람(Java)의 결과: 건드리지 않고 돌려놓는다
                sqs.change_message_visibility(QueueUrl=s.result_queue_url, ReceiptHandle=m["ReceiptHandle"],
                                              VisibilityTimeout=0)
    if pending:
        print(f"[시간 초과] 결과를 못 받음: {', '.join(map(str, pending))}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

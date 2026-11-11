"""SQS: 요청 받기·삭제·visibility 연장, 결과 보내기."""
from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator

from .config import Settings
from .messages import Result

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Message:
    id: str
    receipt_handle: str
    body: str
    receive_count: int      # 이번이 몇 번째 받은 것인지 (1부터)
    sent_at: datetime       # 요청 큐에 들어간 시각 (대기 시간 계산용)


class Queue:
    def __init__(self, s: Settings, client=None):
        import boto3  # 여기서 import: 시험(tests/)은 boto3 없이 Message 만 쓴다

        self.s = s
        self.client = client or boto3.client("sqs", region_name=s.aws_region)

    def receive(self) -> Message | None:
        r = self.client.receive_message(
            QueueUrl=self.s.request_queue_url, MaxNumberOfMessages=1, WaitTimeSeconds=self.s.wait_sec,
            VisibilityTimeout=self.s.visibility_sec,
            MessageSystemAttributeNames=["ApproximateReceiveCount", "SentTimestamp"])
        msgs = r.get("Messages") or []
        if not msgs:
            return None
        m = msgs[0]
        a = m.get("Attributes", {})
        return Message(id=m["MessageId"], receipt_handle=m["ReceiptHandle"], body=m["Body"],
                       receive_count=int(a.get("ApproximateReceiveCount", 1)),
                       sent_at=datetime.fromtimestamp(int(a.get("SentTimestamp", 0)) / 1000, timezone.utc))

    def send_result(self, result: Result) -> str:
        """결과 큐에 보내고 SQS 가 붙인 메시지 ID 를 돌려준다 (Java 쪽 기록과 맞춰 볼 때 쓴다)."""
        r = self.client.send_message(QueueUrl=self.s.result_queue_url, MessageBody=result.to_json())
        return r.get("MessageId", "")

    def delete(self, msg: Message) -> None:
        self.client.delete_message(QueueUrl=self.s.request_queue_url, ReceiptHandle=msg.receipt_handle)

    @contextmanager
    def keep_alive(self, msg: Message) -> Iterator[None]:
        """처리하는 동안 visibility timeout 의 절반마다 연장해서, 다른 워커가 같은 메시지를 가져가지 않게 한다."""
        stop = threading.Event()

        def extend() -> None:
            while not stop.wait(self.s.visibility_sec / 2):
                try:
                    self.client.change_message_visibility(QueueUrl=self.s.request_queue_url,
                                                          ReceiptHandle=msg.receipt_handle,
                                                          VisibilityTimeout=self.s.visibility_sec)
                except Exception as e:  # noqa: BLE001  연장 실패는 처리 자체를 막지 않는다
                    log.warning("visibility 연장 실패 %s: %s", msg.id, e)

        t = threading.Thread(target=extend, daemon=True)
        t.start()
        try:
            yield
        finally:
            stop.set()

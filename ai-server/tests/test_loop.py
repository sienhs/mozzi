"""한 건 처리(Worker.handle)의 실패 처리 규칙 시험. 가짜 큐·저장소·엔진을 써서 GPU·AWS 없이 돈다."""
from __future__ import annotations

import json
import logging
import tempfile
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image

from worker.config import Settings
from worker.engine import FakeEngine, FatalEngineError, seed_for
from worker.loop import Worker
from worker.sqs import Message

MESSAGE_ID = "6f1c2a9e-1b2c-4d5e-8f90-123456789abc"


def settings() -> Settings:
    return Settings(worker="gpu_server:0", name="gpu0", aws_region="ap-northeast-2", request_queue_url="req",
                    result_queue_url="res", s3_bucket="bucket", image_base_url="https://img.example",
                    s3_prefix="diary", model_repo="repo", lora=Path("x"), lora_scale=1.0,
                    size=64, steps=4, guidance=1.0, ref_side=64, expire_sec=600, wait_sec=0, visibility_sec=120)


def message(**over) -> Message:
    sent_at = over.pop("sent_at", datetime.now(timezone.utc))
    d = {"diaryId": 1, "userId": 7, "date": "2026-10-28", "emotion": "HAPPY", "characterImageUrl": "DEFAULT",
         "characterPrompt": "a white round mochi with pink cheeks and short limbs", "timeOfDay": "", "weather": "",
         "where": "", "who": "", "what": "cooking"}
    d.update(over)
    return Message(id=MESSAGE_ID, receipt_handle="rh", body=json.dumps(d), receive_count=1, sent_at=sent_at)


class FakeQueue:
    def __init__(self, fail_send: bool = False):
        self.results, self.deleted, self.fail_send = [], [], fail_send

    def send_result(self, result):
        if self.fail_send:
            raise ConnectionError("result queue down")
        self.results.append(json.loads(result.to_json()))
        return f"result-{len(self.results)}"

    def delete(self, msg):
        self.deleted.append(msg.id)

    @contextmanager
    def keep_alive(self, msg):
        yield


class FakeStorage:
    def __init__(self, exc: Exception | None = None):
        self.uploaded, self.exc = {}, exc

    def upload_png(self, key, image):
        if self.exc:
            raise self.exc
        self.uploaded[key] = image.size

    def url(self, key):
        return f"https://img.example/{key}"


class BrokenEngine:
    size = 64

    def __init__(self, exc: Exception):
        self.exc = exc

    def generate(self, prompt, seed, ref_image=None):
        raise self.exc


class HandleTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.jobs = Path(self.tmp.name) / "jobs.jsonl"
        self.queue, self.storage = FakeQueue(), FakeStorage()
        logging.disable(logging.CRITICAL)  # 실패 로그가 시험 출력에 섞이지 않게

    def tearDown(self):
        logging.disable(logging.NOTSET)
        self.tmp.cleanup()

    def worker(self, engine=None, fetch=None) -> Worker:
        s = settings()
        kw = {"fetch": fetch} if fetch else {}
        return Worker(s, engine or FakeEngine(s, delay_sec=0), self.queue, self.storage, jobs_log=self.jobs, **kw)

    def failed_with(self, code: str) -> dict:
        self.assertEqual(len(self.queue.results), 1)
        r = self.queue.results[0]
        self.assertEqual((r["status"], r["errorCode"]), ("FAILED", code))
        self.assertTrue(r["errorMessage"])
        self.assertEqual(self.queue.deleted, [MESSAGE_ID])  # 실패도 지운다
        return r

    def record(self) -> dict:
        return json.loads(self.jobs.read_text("utf-8").splitlines()[-1])

    def test_success(self):
        self.worker().handle(message())
        key = "diary/7/1/6f1c2a9e1b2c.png"
        self.assertEqual(self.queue.results, [{"diaryId": 1, "userId": 7, "status": "SUCCEEDED",
                                               "imageUrl": f"https://img.example/{key}",
                                               "errorCode": None, "errorMessage": None}])
        self.assertEqual(self.storage.uploaded, {key: (64, 64)})
        self.assertEqual(self.queue.deleted, [MESSAGE_ID])
        rec = self.record()
        self.assertEqual(rec["status"], "SUCCEEDED")
        self.assertEqual(rec["result_message_id"], "result-1")  # 결과 큐 메시지 ID 가 기록에 남는다
        self.assertEqual(rec["seed"], seed_for(MESSAGE_ID))
        self.assertTrue(rec["prompt"].startswith("mochi_char, happy, cooking, home kitchen"))
        self.assertEqual(rec["fixes"], [])  # DEFAULT 캐릭터의 기본 설명은 보정 대상이 아니다

    def test_unreadable_message_is_dropped_without_result(self):
        msg = Message(id="m1", receipt_handle="rh", body="{broken", receive_count=1, sent_at=datetime.now(timezone.utc))
        self.worker().handle(msg)
        self.assertEqual(self.queue.results, [])
        self.assertEqual(self.queue.deleted, ["m1"])
        self.assertEqual(self.record()["status"], "DROPPED")

    def test_invalid_input(self):
        self.worker().handle(message(what=""))
        self.failed_with("INVALID_INPUT")
        self.assertEqual(self.storage.uploaded, {})
        self.assertIn('"what": ""', self.record()["request"])  # 무엇이 왔는지 기록에 남는다

    def test_fixes_are_logged_not_sent(self):
        self.worker(fetch=lambda url, side: Image.new("RGB", (8, 8))).handle(
            message(characterImageUrl="https://x/pumpkin.png", characterPrompt="a white round mochi with pink cheeks"))
        self.assertEqual(self.queue.results[0]["status"], "SUCCEEDED")
        self.assertNotIn("fixes", self.queue.results[0])
        self.assertTrue(self.record()["fixes"][0].startswith("characterPrompt:"))

    def test_expired(self):
        self.worker().handle(message(sent_at=datetime.now(timezone.utc) - timedelta(hours=1)))
        self.failed_with("EXPIRED")

    def test_ref_image_failed(self):
        def fetch(url, side):
            raise TimeoutError("timed out")
        self.worker(fetch=fetch).handle(message(characterImageUrl="https://x/lemon.png"))
        self.assertIn("timed out", self.failed_with("REF_IMAGE_FAILED")["errorMessage"])

    def test_ref_image_passed_to_engine(self):
        seen = {}

        class Spy(FakeEngine):
            def generate(self, prompt, seed, ref_image=None):
                seen["ref"] = ref_image
                return super().generate(prompt, seed, ref_image)

        self.worker(engine=Spy(settings(), 0), fetch=lambda url, side: Image.new("RGB", (8, 8))).handle(
            message(characterImageUrl="https://x/lemon.png"))
        self.assertEqual(seen["ref"].size, (8, 8))
        self.assertEqual(self.queue.results[0]["status"], "SUCCEEDED")

    def test_generation_error_fails_and_deletes(self):
        self.worker(engine=BrokenEngine(RuntimeError("out of memory"))).handle(message())
        self.assertIn("out of memory", self.failed_with("GENERATION_FAILED")["errorMessage"])
        self.assertIn("Traceback", self.record()["traceback"])

    def test_fatal_engine_error_fails_deletes_then_raises(self):
        with self.assertRaises(FatalEngineError):
            self.worker(engine=BrokenEngine(FatalEngineError("CUDA error"))).handle(message())
        self.failed_with("GENERATION_FAILED")

    def test_test_request_goes_to_test_folder(self):
        self.worker().handle(message(test=True))
        key = "test-diary/7/1/6f1c2a9e1b2c.png"
        self.assertEqual(self.storage.uploaded, {key: (64, 64)})
        self.assertEqual(self.queue.results[0]["imageUrl"], f"https://img.example/{key}")
        self.assertTrue(self.record()["test"])

    def test_upload_error(self):
        self.storage = FakeStorage(exc=ConnectionError("s3 down"))
        self.worker().handle(message())
        self.assertIn("s3 down", self.failed_with("UPLOAD_FAILED")["errorMessage"])

    def test_result_send_failure_keeps_message(self):
        self.queue = FakeQueue(fail_send=True)
        with self.assertRaises(ConnectionError):
            self.worker().handle(message())
        self.assertEqual(self.queue.deleted, [])


if __name__ == "__main__":
    unittest.main()

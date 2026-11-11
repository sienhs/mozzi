"""메인 반복과 한 건 처리. 실패 처리 규칙은 WORKER_DESIGN.md 5-2.

어떤 오류든 실패 결과(FAILED)를 Java 에 보내고 요청을 지운다. 다시 시도하지 않는다 (다시 그리기는 Java 가 새 요청으로).
예외는 결과 전송 자체가 안 될 때뿐이다: 그때는 지우지 않아서, visibility timeout 이 지나면 다시 처리된다.
그래서 같은 결과가 드물게 두 번 갈 수 있다.
"""
from __future__ import annotations

import json
import logging
import signal
import time
import traceback
from pathlib import Path
from typing import Any, Callable

from PIL import Image

from .config import ROOT, Settings
from .engine import Engine, FatalEngineError, seed_for
from .messages import ErrorCode, InvalidMessage, Result, failure, now, parse_request
from .prompt import build_prompt
from .refimage import fetch_image
from .s3 import object_key

log = logging.getLogger(__name__)


class Worker:
    def __init__(self, s: Settings, engine: Engine, queue, storage,
                 fetch: Callable[[str, int], Image.Image] = fetch_image, jobs_log: Path | None = None):
        self.s, self.engine, self.queue, self.storage, self.fetch = s, engine, queue, storage, fetch
        self.jobs_log = jobs_log if jobs_log is not None else ROOT / "logs" / f"jobs_{s.name}.jsonl"
        self.busy = False
        self.stopping = False

    # ------------------------------------------------------------------ 반복
    def run(self, once: bool = False) -> None:
        signal.signal(signal.SIGINT, self._on_signal)
        signal.signal(signal.SIGTERM, self._on_signal)
        log.info("요청 대기 시작 (%s)", self.s.request_queue_url)
        while not self.stopping:
            try:
                msg = self.queue.receive()
            except Exception as e:  # noqa: BLE001  네트워크 끊김 등: 잠깐 쉬고 다시
                log.warning("받기 실패, 5초 뒤 다시: %s", e)
                time.sleep(5)
                continue
            if msg is None:  # 받을 요청이 없음: 오래 쉬었으면 GPU 메모리를 돌려준다
                try:
                    getattr(self.engine, "release_if_idle", lambda: None)()
                except Exception:  # noqa: BLE001
                    log.exception("모델을 GPU 에서 내리지 못함")
                continue
            self.busy = True
            try:
                self.handle(msg)
            except FatalEngineError:
                log.critical("GPU 오류라 워커를 종료한다. run_worker.sh 가 5초 뒤 다시 띄운다")
                raise
            except Exception:  # noqa: BLE001  결과 전송·삭제 실패: 메시지는 큐에 남아 다시 처리된다
                log.exception("[처리 실패] 결과를 보내지 못해 요청을 큐에 남김 (메시지 %s)", msg.id)
            finally:
                self.busy = False
            if once:
                break
        log.info("종료")

    def _on_signal(self, signum, _frame) -> None:
        if self.busy and not self.stopping:
            self.stopping = True
            log.info("종료 신호: 처리 중인 1건을 끝내고 종료 (한 번 더 누르면 바로 종료)")
            return
        raise KeyboardInterrupt  # 대기 중이면 바로 종료. 받던 메시지는 visibility timeout 뒤 큐로 돌아간다

    # ------------------------------------------------------------------ 한 건
    def handle(self, msg) -> None:
        t0 = time.perf_counter()
        info: dict[str, Any] = {"message_id": msg.id, "receive_count": msg.receive_count,
                                "queue_wait_sec": round((now() - msg.sent_at).total_seconds(), 2)}
        try:
            req = parse_request(msg.body)
        except InvalidMessage as e:
            info["request"] = msg.body[:1000]
            if e.diary_id is None:  # 결과를 받을 일기(diaryId)를 모른다: 기록만 하고 버린다
                log.error("[버림] diaryId 를 읽을 수 없는 요청: %s | 요청: %.300s", e, msg.body)
                self.queue.delete(msg)
                self._record({"status": "DROPPED", "error_message": str(e), **info})
                return
            return self._finish(msg, failure(e.diary_id, e.user_id, ErrorCode.INVALID_INPUT, str(e)), info)
        info["test"] = req.test

        def fail(code: ErrorCode, message: str) -> None:
            self._finish(msg, failure(req.diary_id, req.user_id, code, message), info)

        if msg.sent_at.timestamp() > 0 and info["queue_wait_sec"] > self.s.expire_sec:  # SentTimestamp 없으면 생략
            return fail(ErrorCode.EXPIRED, f"요청 큐에서 {info['queue_wait_sec']:.0f}초 기다림 "
                                           f"(한도 {self.s.expire_sec}초)")
        try:
            prompt = build_prompt(req.scene)
        except InvalidMessage as e:
            info["request"] = msg.body[:1000]
            return fail(ErrorCode.INVALID_INPUT, str(e))
        info.update(prompt=prompt.text, fixes=prompt.fixes)

        ref = None
        if req.character_image_url:
            try:
                ref = self.fetch(req.character_image_url, self.s.ref_side)
            except Exception as e:  # noqa: BLE001
                return fail(ErrorCode.REF_IMAGE_FAILED, f"{req.character_image_url} 받기 실패: {_short(e)}")

        info["seed"] = seed = seed_for(msg.id)
        key = object_key(self.s.s3_test_prefix if req.test else self.s.s3_prefix, req, msg.id)
        with self.queue.keep_alive(msg):
            t1 = time.perf_counter()
            try:
                image = self.engine.generate(prompt.text, seed, ref)
            except Exception as e:  # noqa: BLE001  GPU 오류도 실패를 알리고 지운 뒤에 종료한다
                info["traceback"] = traceback.format_exc()
                fail(ErrorCode.GENERATION_FAILED, _short(e))
                if isinstance(e, FatalEngineError):
                    raise
                return
            info["gen_sec"] = round(time.perf_counter() - t1, 2)
            try:
                self.storage.upload_png(key, image)
            except Exception as e:  # noqa: BLE001
                info["traceback"] = traceback.format_exc()
                return fail(ErrorCode.UPLOAD_FAILED, f"s3://{self.s.s3_bucket}/{key}: {_short(e)}")

        info["total_sec"] = round(time.perf_counter() - t0, 2)
        self._finish(msg, Result(diary_id=req.diary_id, user_id=req.user_id, status="SUCCEEDED",
                                 image_url=self.storage.url(key)), info)

    def _finish(self, msg, result: Result, info: dict[str, Any]) -> None:
        """결과 전송 → 요청 삭제 (이 순서). 전송이 실패하면 예외가 올라가고 메시지는 큐에 남는다."""
        info["result_message_id"] = self.queue.send_result(result)
        self.queue.delete(msg)
        self._record({**result.to_dict(), **info})
        name = f"diary-{result.diary_id}" + (" (test)" if info.get("test") else "")
        if result.status == "SUCCEEDED":
            log.info("[완료] %s 대기 %.1fs, 생성 %.2fs → %s", name, info["queue_wait_sec"], info["gen_sec"],
                     result.image_url)
        else:
            log.error("[실패] %s %s: %s", name, result.error_code, result.error_message)
            if "request" in info:
                log.error("  요청: %s", info["request"])
            if "prompt" in info:
                log.error("  프롬프트: %s", info["prompt"])
            if "traceback" in info:
                log.error("  %s", info["traceback"].rstrip())
        if info.get("fixes"):
            log.info("  보정: %s", "; ".join(info["fixes"]))
        log.info("  결과 전송 → %s (메시지 ID %s): %s", self.s.result_queue_url.rsplit("/", 1)[-1],
                 info["result_message_id"], result.to_json())

    def _record(self, line: dict) -> None:
        self.jobs_log.parent.mkdir(parents=True, exist_ok=True)
        line = {"at": now().isoformat(timespec="seconds"), "worker": self.s.worker, **line}
        with self.jobs_log.open("a", encoding="utf-8") as f:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")


def _short(e: Exception) -> str:
    return f"{type(e).__name__}: {e}"[:400]

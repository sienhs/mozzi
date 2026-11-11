"""설정 읽기: 비밀값·큐 주소는 .env, 나머지는 config.yaml."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent  # ai-server/


@dataclass(frozen=True)
class Settings:
    worker: str             # 결과 메시지의 worker 값 (예: gpu_server:0)
    name: str               # 로그 파일 이름에 쓰는 짧은 이름 (예: gpu0)
    # .env
    aws_region: str
    request_queue_url: str
    result_queue_url: str
    s3_bucket: str
    image_base_url: str     # 결과 imageUrl 의 앞부분. 없으면 S3 기본 주소
    # config.yaml
    s3_prefix: str
    model_repo: str
    lora: Path
    lora_scale: float
    size: int
    steps: int
    guidance: float
    ref_side: int
    expire_sec: int
    wait_sec: int
    visibility_sec: int
    idle_release_sec: int = 0   # 요청 없이 이만큼 지나면 모델을 GPU 에서 내림 (0: 계속 올려 둠)
    s3_test_prefix: str = "test-diary"   # 요청의 test 가 true 일 때 S3 키 앞부분


def load_settings(name: str, config_path: Path = ROOT / "config.yaml", *, need_aws: bool = True) -> Settings:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")  # boto3 는 AWS_ACCESS_KEY_ID 등을 환경 변수에서 바로 읽는다
    cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))

    def env(key: str) -> str:
        v = os.environ.get(key, "")
        if need_aws and not v:
            raise SystemExit(f".env 에 {key} 가 없다 (.env.example 참고)")
        return v

    lora = Path(cfg["model"]["lora"])
    region = os.environ.get("AWS_REGION", "ap-northeast-2")
    bucket = env("S3_BUCKET")
    return Settings(
        worker=f"gpu_server:{name.removeprefix('gpu')}" if name.startswith("gpu") else name,
        name=name,
        aws_region=region,
        request_queue_url=env("REQUEST_QUEUE_URL"),
        result_queue_url=env("RESULT_QUEUE_URL"),
        s3_bucket=bucket,
        image_base_url=os.environ.get("IMAGE_BASE_URL") or f"https://{bucket}.s3.{region}.amazonaws.com",
        s3_prefix=str(cfg["output"]["prefix"]).strip("/"),
        model_repo=cfg["model"]["repo"],
        lora=lora if lora.is_absolute() else ROOT / lora,
        lora_scale=float(cfg["model"].get("lora_scale", 1.0)),
        size=int(cfg["generate"]["size"]),
        steps=int(cfg["generate"]["steps"]),
        guidance=float(cfg["generate"]["guidance"]),
        ref_side=int(cfg["generate"].get("ref_side", 768)),
        expire_sec=int(cfg["job"]["expire_sec"]),
        wait_sec=int(cfg["sqs"]["wait_sec"]),
        visibility_sec=int(cfg["sqs"]["visibility_sec"]),
        idle_release_sec=int(cfg["generate"].get("idle_release_sec", 0)),
        s3_test_prefix=str(cfg["output"].get("test_prefix", "test-diary")).strip("/"),
    )

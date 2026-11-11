"""S3 업로드와 저장 위치."""
from __future__ import annotations

from io import BytesIO

from PIL import Image

from .config import Settings
from .messages import Request


def object_key(prefix: str, req: Request, message_id: str) -> str:
    """{prefix}/{userId}/{diaryId}/{요청 ID 12자}.png
    같은 일기를 다시 그리면 새 요청이라 파일 이름이 달라진다: 이전 그림을 덮어쓰지 않고, 앱·CDN 캐시에 옛 그림이
    남는 문제도 없다. 같은 요청을 다시 처리하면(워커가 죽은 뒤 등) 같은 파일을 덮어쓴다."""
    return f"{prefix}/{req.user_id}/{req.diary_id}/{message_id.replace('-', '')[:12]}.png"


class Storage:
    def __init__(self, s: Settings, client=None):
        import boto3  # 여기서 import: 시험(tests/)은 boto3 없이 object_key 만 쓴다

        self.bucket = s.s3_bucket
        self.base_url = s.image_base_url.rstrip("/")
        self.client = client or boto3.client("s3", region_name=s.aws_region)

    def upload_png(self, key: str, image: Image.Image) -> None:
        buf = BytesIO()
        image.save(buf, format="PNG")
        self.client.put_object(Bucket=self.bucket, Key=key, Body=buf.getvalue(), ContentType="image/png")

    def url(self, key: str) -> str:
        return f"{self.base_url}/{key}"

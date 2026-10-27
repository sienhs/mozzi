# 홈 · 캘린더 · 앱 메타

## `GET /home` — 홈 (H-01, H-02, H-03, E-01)

홈의 네 가지 상태를 한 번에 결정한다.

Response `200`

```json
{
  "today": "2026-10-22",
  "todayStatus": "COMPLETED",
  "todayDiary": { /* DiaryDetail */ },
  "recentDiaries": [ /* DiarySummary, 최대 3건 */ ],
  "gacha": { "ticketCount": 1 }
}
```

| `todayStatus` | 화면 | `todayDiary` |
|---|---|---|
| `NOT_RECORDED` | H-01 | `null` |
| `IMAGE_IN_PROGRESS` | H-03 | `DiaryDetail`, `image.status`가 `PENDING` 또는 `GENERATING` |
| `COMPLETED` | H-02 | `DiaryDetail` |
| `IMAGE_FAILED` | E-01 | `DiaryDetail`, `image.status`가 `FAILED` |

- `recentDiaries`는 오늘을 제외한 최근 3건. "지난 기록" 행은 감정 얼굴만 쓰므로 이미지 URL이 없다.
- 헤더의 "10월 22일 목요일"은 `today`로 앱이 만든다.
- [DiaryDetail, DiarySummary](diary.md#응답-객체)

## `GET /calendar?yearMonth=2026-10` — 월간 캘린더 (C-01, C-02)

Response `200`

```json
{
  "yearMonth": "2026-10",
  "today": "2026-10-22",
  "recordedCount": 14,
  "prevAvailable": true,
  "nextAvailable": false,
  "days": [
    {
      "date": "2026-10-21",
      "type": "RECORDED",
      "diary": {
        "diaryId": 101,
        "emotion": "SAD",
        "title": "조금 늦었던 퇴근",
        "activities": ["WORK"],
        "imageStatus": "SUCCEEDED"
      }
    },
    { "date": "2026-10-18", "type": "EMPTY", "diary": null },
    { "date": "2026-10-23", "type": "FUTURE", "diary": null }
  ]
}
```

- `days`에는 그 달의 모든 날짜(28~31개)가 들어간다. 날짜를 누르면 아래 기록 행을 추가 호출 없이 그린다.
- `type`: `RECORDED` 감정 색 칠함 · `EMPTY` 빈 날 (누르면 C-02) · `FUTURE` 비활성
- 그림이 생성 중이거나 실패한 날도 `RECORDED`다. 그림은 행을 눌러 `GET /diaries/{id}`로 받는다.
- `prevAvailable` / `nextAvailable`: 가입한 달 이전, 이번 달 이후로는 이동할 수 없다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `yearMonth` 형식 오류 |

## `GET /meta` — 앱 메타

인증: 없음. 앱 시작 시 1회 호출한다.

Response `200`

```json
{
  "emotions": [
    { "code": "HAPPY", "label": "행복" },
    { "code": "CALM", "label": "평온" },
    { "code": "NEUTRAL", "label": "보통" },
    { "code": "SAD", "label": "우울" },
    { "code": "ANGRY", "label": "화남" }
  ],
  "activities": [
    { "code": "STUDY", "label": "공부" },
    { "code": "WORK", "label": "업무" },
    { "code": "EXERCISE", "label": "운동" },
    { "code": "REST", "label": "휴식" },
    { "code": "FRIEND", "label": "친구" },
    { "code": "HOBBY", "label": "취미" },
    { "code": "FAMILY", "label": "가족" },
    { "code": "ETC", "label": "기타" }
  ],
  "memoMaxLength": 100,
  "termsUrl": "https://mozzi.app/terms",
  "privacyUrl": "https://mozzi.app/privacy",
  "termsVersions": { "TERMS": "1.0", "PRIVACY": "1.0" },
  "minSupportedVersion": "1.0.0",
  "latestVersion": "1.0.0"
}
```

- `activities`는 표시 순서대로 내려간다.
- `termsVersions`는 `POST /auth/signup`의 `agreedTerms`에 그대로 보낸다.

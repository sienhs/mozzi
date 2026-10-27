# 감정 검색

사용자가 자연어로 물으면 서버가 질문을 조건(기간·감정·활동·키워드)으로 해석하고, DB에서 기록을 찾은 뒤 한두 문장으로 요약한다. 답이 지어낸 내용이 되지 않도록 근거가 된 기록 목록을 함께 내려준다.

## `GET /emotion-search/suggestions` — 추천 질문 (S-01)

Response `200`

```json
{
  "suggestions": [
    "마음이 편했던 날을 보여 줘",
    "가족과 보낸 날은 언제였어?",
    "이번 달엔 어떤 기분이 많았어?"
  ]
}
```

처음에는 고정 문구를 내려준다.

## `POST /emotion-search` — 질문하기 (S-02, E-04, E-05)

Request

```json
{ "question": "마음이 편했던 날을 보여 줘" }
```

`question`: 1~200자

Response `200` — 결과 있음 (S-02)

```json
{
  "searchId": 3001,
  "question": "마음이 편했던 날을 보여 줘",
  "resultType": "FOUND",
  "answer": "10월에 평온 모찌를 고른 날이 5일 있었어요. 휴식과 가족 기록이 자주 함께였어요.",
  "interpretedFilter": {
    "from": "2026-10-01",
    "to": "2026-10-31",
    "emotions": ["CALM"],
    "activities": [],
    "keyword": null
  },
  "stats": {
    "matchedCount": 5,
    "topActivities": [
      { "activity": "REST", "count": 4 },
      { "activity": "FAMILY", "count": 3 }
    ],
    "emotionCounts": null
  },
  "featured": { /* DiaryDetail — 큰 카드 1장 */ },
  "diaries": [ /* DiarySummary — 아래 기록 행 */ ]
}
```

| `resultType` | 의미 |
|---|---|
| `FOUND` | 기록 목록이 답 |
| `EMPTY` | 맞는 기록 없음 (E-04). `answer`, `featured`는 `null`, `diaries`는 `[]` |
| `STATS_ONLY` | "이번 달엔 어떤 기분이 많았어?"처럼 통계가 답. `stats.emotionCounts`에 `[{ "emotion": "CALM", "count": 5 }]` 형태로 채움 |

- 응답 제한 시간 10초. 넘으면 503.
- E-05 "다시 물어보기"는 같은 질문을 다시 보낸다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | 질문이 비었거나 200자 초과 |
| 429 | `RATE_LIMITED` | 분당 10회 초과 |
| 503 | `SEARCH_UNAVAILABLE` | E-05 "지금은 답을 찾지 못했어요" |

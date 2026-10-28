# 감정 검색

사용자가 자연어로 물으면 서버가 질문을 조건(기간·감정·활동·키워드)으로 해석하고, DB에서 기록을 찾은 뒤 한두 문장으로 요약한다. 답이 지어낸 내용이 되지 않도록 근거가 된 기록 목록을 함께 내려준다.

## 처리 흐름

```
질문 → ① 조건 해석 (LLM) → ② 조회 (SQL 필터 + pgvector 유사도) → ③ 주간 맥락 (SQL)
     → ④ 답변 (LLM) → 저장 → 응답
```

1. **조건 해석** — LLM이 질문을 `interpretedFilter`로 바꾼다. 기간 표현의 기준일은 서버가 준 오늘 날짜다.
2. **조회** — 기간·감정·활동은 SQL로 거른다. `keyword`가 있으면 남은 후보를 질문 임베딩과 `diary_embedding`의 유사도 순으로 정렬한다. 통계 질문은 `group by`로 센다. 개수는 LLM에 세게 하지 않는다.
3. **주간 맥락** — 오늘을 포함한 최근 7일(`record_date` 기준)의 일기 감정과 이 회원의 검색 감정을 서버가 읽는다. "3일 연속 우울" 같은 변화도 서버가 미리 계산해 사실로 넘긴다.
4. **답변** — LLM은 ②의 기록·통계와 ③의 맥락만 근거로 답한다. 답에 쓴 기록 id를 함께 받고, ②의 결과에 없는 id가 있으면 실패로 본다.

- 질문 하나에 답 하나다. 이전 질문·답변 원문은 LLM에 넣지 않고, 화면에 다시 보여 주지도 않는다. 이전 검색은 ③의 감정 요약으로만 쓴다.
- 감정 변화를 평가하거나 진단하지 않는다("요즘 우울하신가 봐요" ✗). 부정 감정이 이어지면 비교 문장을 빼고 담담하게 답한다.
- 임베딩은 SSAFY GMS(`https://gms.ssafy.io/gmsapi/api.openai.com/v1/embeddings`, OpenAI 호환)의 `text-embedding-3-large`를 `dimensions: 1536`으로 쓴다. 질문과 일기는 반드시 같은 모델·차원으로 만든다.
- LLM은 GMS의 `gpt-6-luna`를 Responses API(`/v1/responses`)로 쓴다. ①은 `text.format: json_schema`(`strict`)로 받고 `reasoning.effort: none`이다. 감정·활동은 스키마의 `enum`으로 막는다.
- 질문 임베딩은 질문 원문만 필요하므로 ①과 동시에 보낸다. 호출마다 타임아웃을 두고(약 4초) 넘으면 `FAILED`로 저장한 뒤 503을 돌려준다.
- 주소·키·모델은 설정값이다. GMS는 OpenAI 호환 프록시라 업체를 바꿔도 코드가 바뀌지 않는다.
- 일기 메모가 GMS를 거쳐 OpenAI로 나간다. `docs/legal/` 처리방침의 위탁·국외 이전 항목과 `RELEASE_CHECKLIST.md`를 함께 고쳐야 한다. GMS를 운영에서 써도 되는지, 과정 종료 뒤에도 키가 유지되는지는 확인이 필요하다.

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
| `STATS_ONLY` | "이번 달엔 어떤 기분이 많았어?"처럼 통계가 답. `stats.emotionCounts`에 `[{ "emotion": "CALM", "count": 5 }]` 형태로 채움. `featured`는 `null`, `diaries`는 `[]` |

- `interpretedFilter.keyword`: 기간·감정·활동으로 표현되지 않는 의미 검색 문구("칭찬"). 기록을 거르지 않고 순서만 정한다.
  - 없으면: 조건에 맞는 기록이 모두 답이다. 최신순이고 `stats`는 SQL로 센다.
  - 있으면: 유사도 순 후보 중 LLM이 질문과 관련 있다고 고른 기록만 답이다. `stats`는 고른 기록으로 센다. 하나도 고르지 않으면 `EMPTY`.
  - 고른 기록의 개수 문장("관련된 날이 N일 있었어요.")은 서버가 답 앞에 붙인다. LLM에는 개수를 쓰지 말라고 하고 고르기 전 후보 수도 보여 주지 않는다. 그래서 답의 숫자와 `stats.matchedCount`가 어긋나지 않는다.
  - 질문 임베딩이 실패하거나 늦으면 503 대신 최신순으로 후보를 정한다. 순서만 잃고 답은 낸다. 답변 호출 한 번의 타임아웃(5초)을 남기는 데까지만 기다린다.
  - 통계 질문에 keyword가 있으면("칭찬받은 날은 몇 번이야?") SQL로 셀 수 없으므로 같은 방식으로 LLM이 고른 기록만 센다. 결과는 `STATS_ONLY`이고, 후보가 최대 20개라 그 이상은 세지 못한다.
- `diaries`는 최대 20개. `featured`는 그중 그림이 완성된 첫 기록, 없으면 첫 기록이다.
- `EMPTY`면 답변 LLM을 부르지 않는다.
- 응답 제한 시간 10초(`mozzi.search.time-budget`). LLM 호출 2번과 임베딩 1번이 모두 여기 포함된다. 단계 사이마다 확인하고, 넘으면 503 + `FAILED`.
- LLM 답이 strict 스키마를 어기면(필수 목록이 `null` 등) 500이 아니라 503 + `FAILED`다.
- 실패한 질문도 `result_type = FAILED`로 저장한다. 분당 10회 제한은 이 행까지 센다.
- E-05 "다시 물어보기"는 같은 질문을 다시 보낸다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | 질문이 비었거나 200자 초과 |
| 429 | `RATE_LIMITED` | 분당 10회 초과 |
| 503 | `SEARCH_UNAVAILABLE` | E-05 "지금은 답을 찾지 못했어요" |

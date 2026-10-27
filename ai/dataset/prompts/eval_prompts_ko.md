# 검증·평가 프롬프트 한국어 요약 (보기용)

`scripts/export_prompts.py` 로 자동 생성 (원본: `val.csv`, `test.csv`). 라벨은 `configs/labels_ko.yaml`.

- LoRA(`klein_lora`) 입력 = 영어 캡션 + 화풍 문구 (기본. 끄기: `infer.py --no-inference-style`):
  `, warm children's picture-book illustration, crayon and watercolor textures`
- LoRA 없는 방법(`klein_base`, `klein_ref`, `api_ref`)은 긴 생성 프롬프트(`prompt` 열)를 쓴다.

## 검증 (학습 중 샘플, 체크포인트 sweep) (12개)

| id | 한국어 | 영어 캡션 |
|---|---|---|
| val_001 | 모찌, 평온, 게임, 집, 동행: 연인(분홍색, 하트), 비, 미디엄 샷 | `mochi_char, calm, gaming, home bedroom, with a pale pink partner mochi with a tiny heart, rain on the window with soft gray light, medium shot` |
| val_002 | 모찌, 우울, 식사, 카페, 동행: 동료(하늘색, 사원증), 흐림, 풀샷 | `mochi_char, sad, eating, cozy cafe, with a small pale blue mochi with a tiny ID badge, soft overcast light through the window, full shot` |
| val_003 | 모찌, 화남, 요리, 식당, 맑음, 와이드(모찌 작게) | `mochi_char, angry, cooking, restaurant, sunny window light, small in a wide scene` |
| val_004 | 모찌, 기본, 휴식, 공원, 동행: 친구(살구색), 눈, 미디엄 샷 | `mochi_char, neutral, resting, park, with a pale peach friend mochi, gentle snowfall and snowy ground, medium shot` |
| val_005 | 모찌, 행복, 산책, 여행지, 동행: 고양이, 맑음, 풀샷 | `mochi_char, happy, walking, scenic travel spot, with a round mochi-style kitten, bright sunny daylight, full shot` |
| val_006 | 모찌, 우울, 일하기, 회사/학교, 비, 클로즈업 | `mochi_char, sad, working, office, rain on the window with soft gray light, close-up shot` |
| val_007 | 모찌, 화남, 운동, 집, 동행: 강아지, 눈, 풀샷 | `mochi_char, angry, exercising, home living room, with a round mochi-style puppy, snow falling outside the window, full shot` |
| val_008 | 모찌, 행복, 여행, 여행지, 동행: 가족(노란색), 흐림, 미디엄 샷 | `mochi_char, happy, traveling, scenic travel spot, with a pale yellow family mochi, soft cloudy daylight, medium shot` |
| val_009 | 모찌, 평온, 독서, 공원, 동행: 가족 2명(노란색, 크기 다름), 비, 풀샷 | `mochi_char, calm, reading, park, with two pale yellow family mochi of different sizes, light rain and wet ground, full shot` |
| val_010 | 모찌, 행복, 공부, 카페, 눈, 와이드(모찌 작게) | `mochi_char, happy, studying, cozy cafe, snow falling outside the window, small in a wide scene` |
| val_011 | 모찌, 기본, 공부, 회사/학교, 동행: 동료(하늘색, 사원증), 맑음, 미디엄 샷 | `mochi_char, neutral, studying, school classroom, with a small pale blue mochi with a tiny ID badge, sunny window light, medium shot` |
| val_012 | 모찌, 기본, 영화 보기, 집, 흐림, 클로즈업 | `mochi_char, neutral, watching a movie, home living room sofa, soft overcast light through the window, close-up shot` |

## 테스트 - 조합 (24개)

| id | 한국어 | 영어 캡션 |
|---|---|---|
| test_combo_001 | 모찌, 화남, 쇼핑, 여행지, 맑음, 풀샷 | `mochi_char, angry, shopping, scenic travel spot, bright sunny daylight, full shot` |
| test_combo_002 | 모찌, 평온, 휴식, 집, 동행: 고양이, 비, 미디엄 샷 | `mochi_char, calm, resting, home bedroom, with a round mochi-style kitten, rain on the window with soft gray light, medium shot` |
| test_combo_003 | 모찌, 우울, 독서, 공원, 동행: 연인(분홍색, 하트), 흐림, 미디엄 샷 | `mochi_char, sad, reading, park, with a pale pink partner mochi with a tiny heart, soft cloudy daylight, medium shot` |
| test_combo_004 | 모찌, 행복, 요리, 식당, 동행: 동료(하늘색, 사원증), 눈, 풀샷 | `mochi_char, happy, cooking, restaurant, with a small pale blue mochi with a tiny ID badge, snow falling outside the window, full shot` |
| test_combo_005 | 모찌, 기본, 청소, 회사/학교, 흐림, 클로즈업 | `mochi_char, neutral, cleaning, office, soft overcast light through the window, close-up shot` |
| test_combo_006 | 모찌, 화남, 공부, 카페, 동행: 친구(살구색), 눈, 미디엄 샷 | `mochi_char, angry, studying, cozy cafe, with a pale peach friend mochi, snow falling outside the window, medium shot` |
| test_combo_007 | 모찌, 우울, 식사, 카페, 동행: 강아지, 비, 풀샷 | `mochi_char, sad, eating, cozy cafe, with a round mochi-style puppy, rain on the window with soft gray light, full shot` |
| test_combo_008 | 모찌, 기본, 식사, 식당, 동행: 가족 2명(노란색, 크기 다름), 맑음, 미디엄 샷 | `mochi_char, neutral, eating, restaurant, with two pale yellow family mochi of different sizes, sunny window light, medium shot` |
| test_combo_009 | 모찌, 평온, 일하기, 집, 눈, 와이드(모찌 작게) | `mochi_char, calm, working, home desk, snow falling outside the window, small in a wide scene` |
| test_combo_010 | 모찌, 기본, 운동, 공원, 동행: 가족(노란색), 비, 풀샷 | `mochi_char, neutral, exercising, park, with a pale yellow family mochi, light rain and wet ground, full shot` |
| test_combo_011 | 모찌, 행복, 여행, 여행지, 동행: 가족(노란색), 맑음, 미디엄 샷 | `mochi_char, happy, traveling, scenic travel spot, with a pale yellow family mochi, bright sunny daylight, medium shot` |
| test_combo_012 | 모찌, 평온, 산책, 여행지, 동행: 가족 2명(노란색, 크기 다름), 흐림, 풀샷 | `mochi_char, calm, walking, scenic travel spot, with two pale yellow family mochi of different sizes, soft cloudy daylight, full shot` |
| test_combo_013 | 모찌, 화남, 독서, 회사/학교, 비, 와이드(모찌 작게) | `mochi_char, angry, reading, school library, rain on the window with soft gray light, small in a wide scene` |
| test_combo_014 | 모찌, 행복, 게임, 집, 동행: 강아지, 흐림, 풀샷 | `mochi_char, happy, gaming, home bedroom, with a round mochi-style puppy, soft overcast light through the window, full shot` |
| test_combo_015 | 모찌, 우울, 산책, 공원, 맑음, 클로즈업 | `mochi_char, sad, walking, park, bright sunny daylight, close-up shot` |
| test_combo_016 | 모찌, 평온, 독서, 회사/학교, 동행: 친구(살구색), 맑음, 풀샷 | `mochi_char, calm, reading, school library, with a pale peach friend mochi, sunny window light, full shot` |
| test_combo_017 | 모찌, 기본, 쇼핑, 여행지, 동행: 강아지, 눈, 미디엄 샷 | `mochi_char, neutral, shopping, scenic travel spot, with a round mochi-style puppy, gentle snowfall and snowy ground, medium shot` |
| test_combo_018 | 모찌, 행복, 휴식, 카페, 눈, 클로즈업 | `mochi_char, happy, resting, cozy cafe, snow falling outside the window, close-up shot` |
| test_combo_019 | 모찌, 우울, 공부, 회사/학교, 동행: 동료(하늘색, 사원증), 흐림, 미디엄 샷 | `mochi_char, sad, studying, school classroom, with a small pale blue mochi with a tiny ID badge, soft overcast light through the window, medium shot` |
| test_combo_020 | 모찌, 기본, 일하기, 카페, 동행: 연인(분홍색, 하트), 맑음, 풀샷 | `mochi_char, neutral, working, cozy cafe, with a pale pink partner mochi with a tiny heart, sunny window light, full shot` |
| test_combo_021 | 모찌, 화남, 청소, 집, 동행: 연인(분홍색, 하트), 눈, 풀샷 | `mochi_char, angry, cleaning, home living room, with a pale pink partner mochi with a tiny heart, snow falling outside the window, full shot` |
| test_combo_022 | 모찌, 행복, 영화 보기, 집, 동행: 가족 2명(노란색, 크기 다름), 비, 미디엄 샷 | `mochi_char, happy, watching a movie, home living room sofa, with two pale yellow family mochi of different sizes, rain on the window with soft gray light, medium shot` |
| test_combo_023 | 모찌, 평온, 요리, 식당, 비, 클로즈업 | `mochi_char, calm, cooking, restaurant, rain on the window with soft gray light, close-up shot` |
| test_combo_024 | 모찌, 화남, 식사, 공원, 동행: 고양이, 흐림, 미디엄 샷 | `mochi_char, angry, eating, park, with a round mochi-style kitten, soft cloudy daylight, medium shot` |

## 테스트 - 일기 디테일 (6개)

| id | 한국어 | 영어 캡션 |
|---|---|---|
| test_diary_001 | 모찌, 기본, 운동, 여행지, 동행: 연인(분홍색, 하트), 흐림, 디테일: cherry blossom petals floating around, 미디엄 샷 (일기: 벚꽃이 피었다) | `mochi_char, neutral, exercising, scenic travel spot, with a pale pink partner mochi with a tiny heart, soft cloudy daylight, cherry blossom petals floating around, medium shot` |
| test_diary_002 | 모찌, 평온, 식사, 회사/학교, 비, 디테일: a small birthday cake with candles, 와이드(모찌 작게) (일기: 생일 케이크를 받았다) | `mochi_char, calm, eating, office, rain on the window with soft gray light, a small birthday cake with candles, small in a wide scene` |
| test_diary_003 | 모찌, 화남, 청소, 집, 동행: 강아지, 눈, 디테일: a soft rainbow in the background, 풀샷 (일기: 무지개를 봤다) | `mochi_char, angry, cleaning, home living room, with a round mochi-style puppy, snow falling outside the window, a soft rainbow in the background, full shot` |
| test_diary_004 | 모찌, 우울, 독서, 공원, 동행: 가족 2명(노란색, 크기 다름), 맑음, 디테일: a little letter in an envelope, 풀샷 (일기: 친구에게 편지를 받았다) | `mochi_char, sad, reading, park, with two pale yellow family mochi of different sizes, bright sunny daylight, a little letter in an envelope, full shot` |
| test_diary_005 | 모찌, 행복, 휴식, 카페, 동행: 가족(노란색), 비, 디테일: a small new potted plant, 미디엄 샷 (일기: 화분을 새로 샀다) | `mochi_char, happy, resting, cozy cafe, with a pale yellow family mochi, rain on the window with soft gray light, a small new potted plant, medium shot` |
| test_diary_006 | 모찌, 우울, 공부, 카페, 흐림, 디테일: a cup of hot cocoa, 클로즈업 (일기: 따뜻한 코코아를 마셨다) | `mochi_char, sad, studying, cozy cafe, soft overcast light through the window, a cup of hot cocoa, close-up shot` |

## 테스트 - 서브 활동 여러 개 (6개)

| id | 한국어 | 영어 캡션 |
|---|---|---|
| test_multi_001 | 모찌, 기본, 식사, 집, 동행: 가족 2명(노란색, 크기 다름), 비, 소품: 물병·게임 컨트롤러, 풀샷 | `mochi_char, neutral, eating, home dining table, with two pale yellow family mochi of different sizes, rain on the window with soft gray light, a small water bottle on the table, a game controller on the table, full shot` |
| test_multi_002 | 모찌, 우울, 여행, 여행지, 동행: 연인(분홍색, 하트), 맑음, 소품: 펼친 책·노트북, 미디엄 샷 | `mochi_char, sad, traveling, scenic travel spot, with a pale pink partner mochi with a tiny heart, bright sunny daylight, an open book nearby, a small laptop nearby, medium shot` |
| test_multi_003 | 모찌, 평온, 게임, 카페, 눈, 소품: 여행가방·팝콘, 와이드(모찌 작게) | `mochi_char, calm, gaming, cozy cafe, snow falling outside the window, a small suitcase on the table, a bowl of popcorn on the table, small in a wide scene` |
| test_multi_004 | 모찌, 화남, 산책, 공원, 동행: 고양이, 흐림, 소품: 노트북·펼친 책, 풀샷 | `mochi_char, angry, walking, park, with a round mochi-style kitten, soft cloudy daylight, a small laptop nearby, an open book nearby, full shot` |
| test_multi_005 | 모찌, 행복, 청소, 회사/학교, 동행: 동료(하늘색, 사원증), 눈, 소품: 노트북·공책·연필, 미디엄 샷 | `mochi_char, happy, cleaning, office, with a small pale blue mochi with a tiny ID badge, snow falling outside the window, a small laptop on the table, a notebook and pencil on the table, medium shot` |
| test_multi_006 | 모찌, 평온, 요리, 식당, 동행: 친구(살구색), 흐림, 소품: 쿠션·여행가방, 미디엄 샷 | `mochi_char, calm, cooking, restaurant, with a pale peach friend mochi, soft overcast light through the window, a soft cushion on the table, a small suitcase on the table, medium shot` |

## 테스트 - 동행 2명 (4개)

| id | 한국어 | 영어 캡션 |
|---|---|---|
| test_two_companions_001 | 모찌, 기본, 독서, 카페, 동행: 가족 2명(노란색, 크기 다름), 눈, 미디엄 샷 | `mochi_char, neutral, reading, cozy cafe, with two pale yellow family mochi of different sizes, snow falling outside the window, medium shot` |
| test_two_companions_002 | 모찌, 행복, 공부, 카페, 동행: 친구(살구색) + 강아지, 흐림, 미디엄 샷 | `mochi_char, happy, studying, cozy cafe, with a pale peach friend mochi and a round mochi-style puppy, soft overcast light through the window, medium shot` |
| test_two_companions_003 | 모찌, 평온, 요리, 집, 동행: 연인(분홍색, 하트) + 고양이, 맑음, 미디엄 샷 | `mochi_char, calm, cooking, home kitchen, with a pale pink partner mochi with a tiny heart and a round mochi-style kitten, sunny window light, medium shot` |
| test_two_companions_004 | 모찌, 화남, 일하기, 회사/학교, 동행: 친구(살구색) + 동료(하늘색, 사원증), 맑음, 풀샷 | `mochi_char, angry, working, office, with a pale peach friend mochi and a small pale blue mochi with a tiny ID badge, sunny window light, full shot` |

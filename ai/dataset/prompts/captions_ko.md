# 캡션 한국어 요약 (보기용)

`scripts/export_prompts.py` 로 자동 생성. 라벨은 `configs/labels_ko.yaml`. **학습에는 영어 캡션만 쓴다.**

## 기준(anchor) (5개)

| slot_id | 한국어 | 영어 캡션 (학습용) | 파일명 |
|---|---|---|---|
| anc_01 | 모찌, 행복, 서 있음, 단색 배경, 정면 | `mochi_char, happy, standing, plain cream background, front view, full shot` | happy_anchor_plain_alone_none_01.png |
| anc_02 | 모찌, 평온, 서 있음, 단색 배경, 정면 | `mochi_char, calm, standing, plain cream background, front view, full shot` | calm_anchor_plain_alone_none_01.png |
| anc_03 | 모찌, 기본, 서 있음, 단색 배경, 정면 | `mochi_char, neutral, standing, plain cream background, front view, full shot` | neutral_anchor_plain_alone_none_01.png |
| anc_04 | 모찌, 우울, 서 있음, 단색 배경, 정면 | `mochi_char, sad, standing, plain cream background, front view, full shot` | sad_anchor_plain_alone_none_01.png |
| anc_05 | 모찌, 화남, 서 있음, 단색 배경, 정면 | `mochi_char, angry, standing, plain cream background, front view, full shot` | angry_anchor_plain_alone_none_01.png |

## 모찌 시트 (10개)

| slot_id | 한국어 | 영어 캡션 (학습용) | 파일명 |
|---|---|---|---|
| ms_01 | 모찌, 행복, 서 있음, 단색 배경, 정면 | `mochi_char, happy, standing, plain cream background, front view, full shot` | happy_sheet-front_plain_alone_none_01.png |
| ms_02 | 모찌, 행복, 서 있음, 단색 배경, 3/4 측면 | `mochi_char, happy, standing, plain cream background, three-quarter view, full shot` | happy_sheet-34_plain_alone_none_01.png |
| ms_03 | 모찌, 평온, 서 있음, 단색 배경, 정면 | `mochi_char, calm, standing, plain cream background, front view, full shot` | calm_sheet-front_plain_alone_none_01.png |
| ms_04 | 모찌, 평온, 서 있음, 단색 배경, 3/4 측면 | `mochi_char, calm, standing, plain cream background, three-quarter view, full shot` | calm_sheet-34_plain_alone_none_01.png |
| ms_05 | 모찌, 기본, 서 있음, 단색 배경, 정면 | `mochi_char, neutral, standing, plain cream background, front view, full shot` | neutral_sheet-front_plain_alone_none_01.png |
| ms_06 | 모찌, 기본, 서 있음, 단색 배경, 3/4 측면 | `mochi_char, neutral, standing, plain cream background, three-quarter view, full shot` | neutral_sheet-34_plain_alone_none_01.png |
| ms_07 | 모찌, 우울, 서 있음, 단색 배경, 정면 | `mochi_char, sad, standing, plain cream background, front view, full shot` | sad_sheet-front_plain_alone_none_01.png |
| ms_08 | 모찌, 우울, 서 있음, 단색 배경, 3/4 측면 | `mochi_char, sad, standing, plain cream background, three-quarter view, full shot` | sad_sheet-34_plain_alone_none_01.png |
| ms_09 | 모찌, 화남, 서 있음, 단색 배경, 정면 | `mochi_char, angry, standing, plain cream background, front view, full shot` | angry_sheet-front_plain_alone_none_01.png |
| ms_10 | 모찌, 화남, 서 있음, 단색 배경, 3/4 측면 | `mochi_char, angry, standing, plain cream background, three-quarter view, full shot` | angry_sheet-34_plain_alone_none_01.png |

## 동행 시트 (6개)

| slot_id | 한국어 | 영어 캡션 (학습용) | 파일명 |
|---|---|---|---|
| cs_01 | 친구(살구색) 단독 (흰 모찌 없음), 서 있음, 단색 배경, 정면 | `a pale peach friend mochi, standing, plain cream background, front view, full shot` | none_sheet-front_plain_friend_none_01.png |
| cs_02 | 가족(노란색) 단독 (흰 모찌 없음), 서 있음, 단색 배경, 정면 | `a pale yellow family mochi, standing, plain cream background, front view, full shot` | none_sheet-front_plain_family_none_01.png |
| cs_03 | 연인(분홍색, 하트) 단독 (흰 모찌 없음), 서 있음, 단색 배경, 정면 | `a pale pink partner mochi with a tiny heart, standing, plain cream background, front view, full shot` | none_sheet-front_plain_partner_none_01.png |
| cs_04 | 동료(하늘색, 사원증) 단독 (흰 모찌 없음), 서 있음, 단색 배경, 정면 | `a small pale blue mochi with a tiny ID badge, standing, plain cream background, front view, full shot` | none_sheet-front_plain_coworker_none_01.png |
| cs_05 | 강아지 단독 (흰 모찌 없음), 서 있음, 단색 배경, 정면 | `a round mochi-style puppy, standing, plain cream background, front view, full shot` | none_sheet-front_plain_pet-puppy_none_01.png |
| cs_06 | 모찌, 행복, 서 있음, 단색 배경, 친구(살구색)와 함께, 정면 | `mochi_char, happy, standing, plain cream background, with a pale peach friend mochi, front view, full shot` | happy_sheet-front_plain_friend_none_01.png |

## 장면 (40개)

| slot_id | 한국어 | 영어 캡션 (학습용) | 파일명 |
|---|---|---|---|
| sc_01 | 모찌, 평온, 운동, 공원, 동행: 동료(하늘색, 사원증), 비, 미디엄 샷 | `mochi_char, calm, exercising, park, with a small pale blue mochi with a tiny ID badge, light rain and wet ground, medium shot` | calm_exercise_park_coworker_rainy_01.png |
| sc_02 | 모찌, 행복, 운동, 공원, 눈, 클로즈업 | `mochi_char, happy, exercising, park, gentle snowfall and snowy ground, close-up shot` | happy_exercise_park_alone_snowy_01.png |
| sc_03 | 모찌, 우울, 운동, 집, 동행: 강아지, 맑음, 소품: 쿠션, 미디엄 샷 | `mochi_char, sad, exercising, home living room, with a round mochi-style puppy, sunny window light, a soft cushion on the table, medium shot` | sad_exercise_home_pet-puppy_sunny_01.png |
| sc_04 | 모찌, 평온, 산책, 공원, 동행: 친구(살구색), 흐림, 소품: 노트북·쇼핑백, 미디엄 샷 | `mochi_char, calm, walking, park, with a pale peach friend mochi, soft cloudy daylight, a small laptop nearby, a shopping bag nearby, medium shot` | calm_walk_park_friend_cloudy_01.png |
| sc_05 | 모찌, 행복, 산책, 여행지, 눈, 미디엄 샷 | `mochi_char, happy, walking, scenic travel spot, gentle snowfall and snowy ground, medium shot` | happy_walk_travel_spot_alone_snowy_01.png |
| sc_06 | 모찌, 기본, 산책, 공원, 맑음, 소품: 여행가방, 풀샷 | `mochi_char, neutral, walking, park, bright sunny daylight, a small suitcase nearby, full shot` | neutral_walk_park_alone_sunny_01.png |
| sc_07 | 모찌, 화남, 독서, 공원, 비, 소품: 쇼핑백, 와이드(모찌 작게) | `mochi_char, angry, reading, park, light rain and wet ground, a shopping bag nearby, small in a wide scene` | angry_reading_park_alone_rainy_01.png |
| sc_08 | 모찌, 평온, 독서, 집, 동행: 연인(분홍색, 하트), 맑음, 풀샷 | `mochi_char, calm, reading, home living room, with a pale pink partner mochi with a tiny heart, sunny window light, full shot` | calm_reading_home_partner_sunny_01.png |
| sc_09 | 모찌, 기본, 독서, 회사/학교, 흐림, 미디엄 샷 | `mochi_char, neutral, reading, school library, soft overcast light through the window, medium shot` | neutral_reading_office_school_alone_cloudy_01.png |
| sc_10 | 모찌, 화남, 영화 보기, 집, 동행: 친구(살구색), 눈, 미디엄 샷 | `mochi_char, angry, watching a movie, home living room sofa, with a pale peach friend mochi, snow falling outside the window, medium shot` | angry_movie_home_friend_snowy_01.png |
| sc_11 | 모찌, 기본, 영화 보기, 집, 맑음, 소품: 물병, 와이드(모찌 작게) | `mochi_char, neutral, watching a movie, home living room sofa, sunny window light, a small water bottle on the table, small in a wide scene` | neutral_movie_home_alone_sunny_01.png |
| sc_12 | 모찌, 우울, 영화 보기, 집, 비, 클로즈업 | `mochi_char, sad, watching a movie, home living room sofa, rain on the window with soft gray light, close-up shot` | sad_movie_home_alone_rainy_01.png |
| sc_13 | 모찌, 행복, 게임, 카페, 맑음, 소품: 음식 그릇, 와이드(모찌 작게) | `mochi_char, happy, gaming, cozy cafe, sunny window light, a bowl of food on the table, small in a wide scene` | happy_gaming_cafe_alone_sunny_01.png |
| sc_14 | 모찌, 기본, 게임, 집, 동행: 가족(노란색), 눈, 미디엄 샷 | `mochi_char, neutral, gaming, home bedroom, with a pale yellow family mochi, snow falling outside the window, medium shot` | neutral_gaming_home_family_snowy_01.png |
| sc_15 | 모찌, 우울, 게임, 카페, 동행: 연인(분홍색, 하트), 흐림, 미디엄 샷 | `mochi_char, sad, gaming, cozy cafe, with a pale pink partner mochi with a tiny heart, soft overcast light through the window, medium shot` | sad_gaming_cafe_partner_cloudy_01.png |
| sc_16 | 모찌, 평온, 공부, 집, 눈, 클로즈업 | `mochi_char, calm, studying, home desk, snow falling outside the window, close-up shot` | calm_studying_home_alone_snowy_01.png |
| sc_17 | 모찌, 행복, 공부, 회사/학교, 동행: 친구(살구색), 맑음, 소품: 프라이팬, 미디엄 샷 | `mochi_char, happy, studying, school classroom, with a pale peach friend mochi, sunny window light, a small frying pan on the table, medium shot` | happy_studying_office_school_friend_sunny_01.png |
| sc_18 | 모찌, 기본, 공부, 카페, 동행: 고양이, 비, 미디엄 샷 | `mochi_char, neutral, studying, cozy cafe, with a round mochi-style kitten, rain on the window with soft gray light, medium shot` | neutral_studying_cafe_pet-kitten_rainy_01.png |
| sc_19 | 모찌, 화남, 일하기, 카페, 동행: 가족 2명(노란색, 크기 다름), 맑음, 미디엄 샷 | `mochi_char, angry, working, cozy cafe, with two pale yellow family mochi of different sizes, sunny window light, medium shot` | angry_work_cafe_family-2_sunny_01.png |
| sc_20 | 모찌, 행복, 일하기, 집, 흐림, 클로즈업 | `mochi_char, happy, working, home desk, soft overcast light through the window, close-up shot` | happy_work_home_alone_cloudy_01.png |
| sc_21 | 모찌, 우울, 일하기, 회사/학교, 눈, 와이드(모찌 작게) | `mochi_char, sad, working, office, snow falling outside the window, small in a wide scene` | sad_work_office_school_alone_snowy_01.png |
| sc_22 | 모찌, 화남, 요리, 식당, 동행: 연인(분홍색, 하트), 눈, 소품: 게임 컨트롤러, 미디엄 샷 | `mochi_char, angry, cooking, restaurant, with a pale pink partner mochi with a tiny heart, snow falling outside the window, a game controller on the table, medium shot` | angry_cooking_restaurant_partner_snowy_01.png |
| sc_23 | 모찌, 기본, 요리, 식당, 맑음, 클로즈업 | `mochi_char, neutral, cooking, restaurant, sunny window light, close-up shot` | neutral_cooking_restaurant_alone_sunny_01.png |
| sc_24 | 모찌, 우울, 요리, 식당, 흐림, 미디엄 샷 | `mochi_char, sad, cooking, restaurant, soft overcast light through the window, medium shot` | sad_cooking_restaurant_alone_cloudy_01.png |
| sc_25 | 모찌, 화남, 청소, 회사/학교, 동행: 동료(하늘색, 사원증), 맑음, 소품: 팝콘·음식 그릇, 미디엄 샷 | `mochi_char, angry, cleaning, office, with a small pale blue mochi with a tiny ID badge, sunny window light, a bowl of popcorn on the table, a bowl of food on the table, medium shot` | angry_cleaning_office_school_coworker_sunny_01.png |
| sc_26 | 모찌, 평온, 청소, 회사/학교, 비, 클로즈업 | `mochi_char, calm, cleaning, office, rain on the window with soft gray light, close-up shot` | calm_cleaning_office_school_alone_rainy_01.png |
| sc_27 | 모찌, 행복, 청소, 집, 동행: 강아지, 흐림, 풀샷 | `mochi_char, happy, cleaning, home living room, with a round mochi-style puppy, soft overcast light through the window, full shot` | happy_cleaning_home_pet-puppy_cloudy_01.png |
| sc_28 | 모찌, 화남, 식사, 카페, 흐림, 클로즈업 | `mochi_char, angry, eating, cozy cafe, soft overcast light through the window, close-up shot` | angry_eating_cafe_alone_cloudy_01.png |
| sc_29 | 모찌, 평온, 식사, 식당, 맑음, 소품: 공책·연필, 와이드(모찌 작게) | `mochi_char, calm, eating, restaurant, sunny window light, a notebook and pencil on the table, small in a wide scene` | calm_eating_restaurant_alone_sunny_01.png |
| sc_30 | 모찌, 행복, 식사, 식당, 동행: 가족(노란색), 비, 소품: 펼친 책·쿠션, 미디엄 샷 | `mochi_char, happy, eating, restaurant, with a pale yellow family mochi, rain on the window with soft gray light, an open book on the table, a soft cushion on the table, medium shot` | happy_eating_restaurant_family_rainy_01.png |
| sc_31 | 모찌, 우울, 식사, 회사/학교, 동행: 동료(하늘색, 사원증), 눈, 풀샷 | `mochi_char, sad, eating, office, with a small pale blue mochi with a tiny ID badge, snow falling outside the window, full shot` | sad_eating_office_school_coworker_snowy_01.png |
| sc_32 | 모찌, 화남, 쇼핑, 집, 흐림, 소품: 프라이팬, 와이드(모찌 작게) | `mochi_char, angry, shopping, home living room, soft overcast light through the window, a small frying pan on the table, small in a wide scene` | angry_shopping_home_alone_cloudy_01.png |
| sc_33 | 모찌, 행복, 쇼핑, 집, 동행: 연인(분홍색, 하트), 비, 미디엄 샷 | `mochi_char, happy, shopping, home living room, with a pale pink partner mochi with a tiny heart, rain on the window with soft gray light, medium shot` | happy_shopping_home_partner_rainy_01.png |
| sc_34 | 모찌, 우울, 쇼핑, 여행지, 맑음, 클로즈업 | `mochi_char, sad, shopping, scenic travel spot, bright sunny daylight, close-up shot` | sad_shopping_travel_spot_alone_sunny_01.png |
| sc_35 | 모찌, 평온, 휴식, 카페, 눈, 미디엄 샷 | `mochi_char, calm, resting, cozy cafe, snow falling outside the window, medium shot` | calm_resting_cafe_alone_snowy_01.png |
| sc_36 | 모찌, 기본, 휴식, 집, 동행: 친구(살구색), 비, 소품: 여행가방·빗자루, 풀샷 | `mochi_char, neutral, resting, home bedroom, with a pale peach friend mochi, rain on the window with soft gray light, a small suitcase on the table, a little broom on the table, full shot` | neutral_resting_home_friend_rainy_01.png |
| sc_37 | 모찌, 우울, 휴식, 공원, 동행: 가족 2명(노란색, 크기 다름), 맑음, 소품: 물병·아령, 미디엄 샷 | `mochi_char, sad, resting, park, with two pale yellow family mochi of different sizes, bright sunny daylight, a small water bottle nearby, a small dumbbell nearby, medium shot` | sad_resting_park_family-2_sunny_01.png |
| sc_38 | 모찌, 화남, 여행, 여행지, 비, 풀샷 | `mochi_char, angry, traveling, scenic travel spot, light rain and wet ground, full shot` | angry_traveling_travel_spot_alone_rainy_01.png |
| sc_39 | 모찌, 평온, 여행, 여행지, 동행: 고양이, 맑음, 미디엄 샷 | `mochi_char, calm, traveling, scenic travel spot, with a round mochi-style kitten, bright sunny daylight, medium shot` | calm_traveling_travel_spot_pet-kitten_sunny_01.png |
| sc_40 | 모찌, 기본, 여행, 여행지, 동행: 동료(하늘색, 사원증), 흐림, 소품: 공책·연필, 미디엄 샷 | `mochi_char, neutral, traveling, scenic travel spot, with a small pale blue mochi with a tiny ID badge, soft cloudy daylight, a notebook and pencil nearby, medium shot` | neutral_traveling_travel_spot_coworker_cloudy_01.png |

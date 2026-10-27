# manifest 리포트 (seed=20261019)

## scene 할당량 충족
| 축 | 값 | 목표 | 실제 | 충족 |
|---|---|---|---|---|
| main_activity | exercise | 3 | 3 | O |
| main_activity | walk | 3 | 3 | O |
| main_activity | reading | 3 | 3 | O |
| main_activity | movie | 3 | 3 | O |
| main_activity | gaming | 3 | 3 | O |
| main_activity | studying | 3 | 3 | O |
| main_activity | work | 3 | 3 | O |
| main_activity | cooking | 3 | 3 | O |
| main_activity | cleaning | 3 | 3 | O |
| main_activity | eating | 4 | 4 | O |
| main_activity | shopping | 3 | 3 | O |
| main_activity | resting | 3 | 3 | O |
| main_activity | traveling | 3 | 3 | O |
| mood | happy | 8 | 8 | O |
| mood | calm | 8 | 8 | O |
| mood | neutral | 8 | 8 | O |
| mood | sad | 8 | 8 | O |
| mood | angry | 8 | 8 | O |
| place | home | 12 | 12 | O |
| place | cafe | 6 | 6 | O |
| place | office_school | 6 | 6 | O |
| place | park | 6 | 6 | O |
| place | restaurant | 5 | 5 | O |
| place | travel_spot | 5 | 5 | O |
| companion | alone | 20 | 20 | O |
| companion | friend | 4 | 4 | O |
| companion | family | 4 | 4 | O |
| companion | partner | 4 | 4 | O |
| companion | coworker | 4 | 4 | O |
| companion | pet | 4 | 4 | O |
| weather | sunny | 13 | 13 | O |
| weather | cloudy | 9 | 9 | O |
| weather | rainy | 9 | 9 | O |
| weather | snowy | 9 | 9 | O |
| shot | close_up | 8 | 8 | O |
| shot | medium | 20 | 20 | O |
| shot | full | 6 | 6 | O |
| shot | small_in_scene | 6 | 6 | O |
| 활동별 기분 종류 | 최소 2 | 전 활동 | min=3 | O |
| 서브 활동 소품 | 1~2개 | 15 | 15 | O |
| 동행 장면 구도 | medium/full | 위반 0 | 0 | O |

## pairwise 커버리지
| 축 쌍 | 가능한 조합 | 커버 | 비율 | 최대 중복 |
|---|---|---|---|---|
| activity × mood | 65 | 40 | 62% | 1 |
| activity × place | 35 | 28 | 80% | 3 |
| activity × companion | 77 | 33 | 43% | 2 |
| activity × weather | 52 | 40 | 77% | 1 |
| activity × shot | 52 | 33 | 63% | 2 |
| mood × place | 30 | 30 | 100% | 3 |
| mood × companion | 30 | 25 | 83% | 4 |
| mood × weather | 20 | 20 | 100% | 3 |
| mood × shot | 20 | 20 | 100% | 4 |
| place × companion | 31 | 22 | 71% | 5 |
| place × weather | 24 | 24 | 100% | 3 |
| place × shot | 24 | 21 | 88% | 4 |
| companion × weather | 24 | 22 | 92% | 6 |
| companion × shot | 14 | 13 | 93% | 8 |
| weather × shot | 16 | 16 | 100% | 6 |
| **전체** | 514 | 387 | 75% | |

## 홀드아웃
- val: 12
- test_combo: 24
- test_diary: 6
- test_multi: 6
- test_two_companions: 4

# 학습 비교

| run_id | precision | rank | res | status | steps | s/it | 예상 총(h) | 2000step 환산(h) | 소요(min) | VRAM smi | shared | fallback | RAM | error |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20261020_train_qfloat8_r8_smoke | qfloat8 | 8 | 512 | success | 50/50 | 3.61 | 0.05 | 2.00 | 8.4 | 5.96 | – | – | 19.0 |  |
| 20261020_train_qfloat8_r8_smoke-2 | qfloat8 | 8 | 512 | success | 50/50 | 3.67 | 0.05 | 2.04 | 4.7 | 5.97 | 0.99 | False | 19.0 |  |
| 20261022_train_qfloat8_r8_smoke | qfloat8 | 8 | 768 | success | 50/50 | 7.08 | 0.10 | 3.93 | 7.7 | 5.97 | 0.93 | False | 14.1 |  |
| 20261022_train_qfloat8_r8_smoke-2 | qfloat8 | 8 | 1024 | success | 50/50 | 12.35 | 0.17 | 6.86 | 13.4 | 5.96 | 1.56 | True | 17.0 |  |
| 20261023_train_qfloat8_r16 | qfloat8 | 16 | 768 | success | 2000/2000 | 6.04 | 3.35 | 3.36 | 51.8 | 5.98 | 0.96 | False | 14.8 |  |

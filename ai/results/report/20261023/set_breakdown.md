# test 세트별 품질

| method | precision | res | set | n | dino_sim | clip_t | dino_crop |
|---|---|---|---|---|---|---|---|
| klein_base | fp8 | 768 | test_combo | 24 | 0.458 | 33.75 | 0.561 |
| klein_base | fp8 | 768 | test_diary | 6 | 0.455 | 34.49 | 0.567 |
| klein_base | fp8 | 768 | test_multi | 6 | 0.421 | 34.49 | 0.562 |
| klein_base | fp8 | 768 | test_two_companions | 4 | 0.408 | 32.08 | 0.541 |
| klein_lora | fp8 | 768 | test_combo | 24 | 0.396 | 34.12 | 0.568 |
| klein_lora | fp8 | 768 | test_diary | 6 | 0.469 | 35.41 | 0.583 |
| klein_lora | fp8 | 768 | test_multi | 6 | 0.338 | 34.62 | 0.463 |
| klein_lora | fp8 | 768 | test_two_companions | 4 | 0.364 | 32.94 | 0.539 |
| klein_lora | gguf_q4 | 768 | test_combo | 24 | 0.376 | 34.30 | 0.559 |
| klein_lora | gguf_q4 | 768 | test_diary | 6 | 0.451 | 35.84 | 0.566 |
| klein_lora | gguf_q4 | 768 | test_multi | 6 | 0.339 | 34.41 | 0.466 |
| klein_lora | gguf_q4 | 768 | test_two_companions | 4 | 0.358 | 33.39 | 0.579 |
| klein_lora | gguf_q8 | 768 | test_combo | 24 | 0.372 | 34.13 | 0.549 |
| klein_lora | gguf_q8 | 768 | test_diary | 6 | 0.462 | 35.61 | 0.580 |
| klein_lora | gguf_q8 | 768 | test_multi | 6 | 0.358 | 34.35 | 0.491 |
| klein_lora | gguf_q8 | 768 | test_two_companions | 4 | 0.382 | 33.05 | 0.543 |
| klein_ref | fp8 | 768 | test_combo | 24 | 0.420 | 33.74 | 0.590 |
| klein_ref | fp8 | 768 | test_diary | 6 | 0.431 | 35.38 | 0.588 |
| klein_ref | fp8 | 768 | test_multi | 6 | 0.387 | 35.39 | 0.566 |
| klein_ref | fp8 | 768 | test_two_companions | 4 | 0.297 | 31.89 | 0.523 |

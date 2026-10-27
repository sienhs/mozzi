# LoRA 유무 비교 (품질, precision=fp8)

dino_sim/clip_i: anchors 대비 캐릭터 일관성, clip_t: 프롬프트 충실도, dino_sim_crop: 주인공 크롭 기준

| res | method | precision | dino_sim | clip_i | clip_t | dino_crop | human | run_id |
|---|---|---|---|---|---|---|---|---|
| 768 | klein_base | fp8 | 0.447 | 0.699 | 33.80 | 0.560 | – | 20261023_klein_base_fp8_768 |
| 768 | klein_ref | fp8 | 0.405 | 0.734 | 34.05 | 0.580 | – | 20261023_klein_ref_fp8_768 |
| 768 | klein_lora | fp8 | 0.395 | 0.743 | 34.27 | 0.552 | – | 20261023_klein_lora_fp8_768 |

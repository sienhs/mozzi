# 양자화 비교 (klein 계열)

latency = 디노이즈 4-step + VAE 디코드 (텍스트 인코딩 제외, warmup 1장 제외)
VRAM torch = max_memory_allocated, smi = NVML 디바이스 사용량 피크, shared = 공유 GPU 메모리 피크

| method | precision | res | status | dino_sim | clip_t | lat_med(s) | lat_p90(s) | load(s) | VRAM torch | VRAM smi | shared | fallback | temp | error |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| klein_lora | fp8 | 768 | success | – | – | 9.38 | 9.40 | 11.1 | 5.21 | 5.96 | 0.88 | True | 58 |  |
| klein_lora | gguf_q4 | 768 | success | – | – | 8.51 | 8.59 | 8.0 | 3.99 | 5.54 | 0.08 | False | 58 |  |
| klein_base | bf16 | 768 | too_slow | – | – | – | – | 7.9 | – | – | – | – | – | warmup 1장이 5분 넘게(09:19:28~09:25:00) 끝나지 않아 수동 중단. 트랜스포머 7.75 |
| klein_base | fp8 | 768 | success | – | 33.83 | 9.01 | 9.13 | 7.8 | 5.18 | 5.97 | 0.81 | True | 58 |  |
| klein_base | gguf_q8 | 768 | success | – | – | 10.09 | 10.13 | 7.9 | 5.55 | 5.96 | 1.09 | True | 57 |  |
| klein_base | gguf_q4 | 768 | success | – | – | 7.93 | 7.95 | 5.5 | 3.97 | 5.51 | 0.08 | False | 59 |  |

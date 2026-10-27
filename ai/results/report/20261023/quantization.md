# 양자화 비교 (klein 계열)

latency = 디노이즈 4-step + VAE 디코드 (텍스트 인코딩 제외, warmup 1장 제외)
VRAM torch = max_memory_allocated, smi = NVML 디바이스 사용량 피크, shared = 공유 GPU 메모리 피크

| method | precision | res | status | dino_sim | clip_t | lat_med(s) | lat_p90(s) | load(s) | VRAM torch | VRAM smi | shared | fallback | temp | error |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| klein_lora | bf16 | 768 | too_slow | – | – | – | – | 7.5 | 7.93 | 5.99 | 2.87 | True | 56 | TooSlowError: 206s after step 3/4 > max 120s per image |
| klein_lora | fp8 | 768 | success | 0.395 | 34.27 | 8.15 | 8.20 | 8.2 | 5.23 | 5.98 | 0.81 | True | 73 |  |
| klein_lora | gguf_q8 | 768 | success | 0.385 | 34.28 | 9.49 | 9.51 | 8.7 | 5.60 | 5.97 | 1.06 | True | 72 |  |
| klein_lora | gguf_q4 | 768 | success | 0.380 | 34.45 | 7.49 | 7.56 | 5.5 | 4.01 | 5.56 | 0.08 | False | 77 |  |
| klein_base | fp8 | 768 | success | 0.447 | 33.80 | 7.52 | 7.57 | 7.6 | 5.19 | 5.97 | 0.81 | True | 73 |  |
| klein_ref | fp8 | 768 | success | 0.405 | 34.05 | 69.35 | 69.75 | 7.3 | 5.35 | 5.99 | 1.08 | True | 71 |  |

# 모찌 LoRA 실험 환경 설치 (Windows PowerShell). ai/ 폴더에서 실행:  .\setup.ps1
# 필요: uv (https://docs.astral.sh/uv/), git, NVIDIA 드라이버 (CUDA 13.0 이상 지원)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# ai-toolkit 은 검증한 커밋으로 고정한다 (FLUX.2 klein 지원, v0.13.34)
$AitkCommit = "2d4c89d39253e42bb6c6ff17549174bc3ebb9422"
if (-not (Test-Path "third_party\ai-toolkit")) {
    git clone https://github.com/ostris/ai-toolkit.git third_party\ai-toolkit
}
git -C third_party\ai-toolkit fetch --depth 1 origin $AitkCommit
git -C third_party\ai-toolkit checkout $AitkCommit

if (-not (Test-Path ".venv")) { uv venv .venv --python 3.12 }
$py = ".venv\Scripts\python.exe"
Write-Host "[설치] PyTorch 2.13.0 CUDA 13.0 빌드 (약 3GB)"
uv pip install --python $py torch==2.13.0 torchvision==0.28.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu130
Write-Host "[설치] ai-toolkit 의존성"
uv pip install --python $py -r third_party\ai-toolkit\requirements.txt
uv pip install --python $py -r requirements.txt
& $py -c "import torch; print('torch', torch.__version__, 'cuda', torch.cuda.is_available(), torch.cuda.get_device_name(0))"
if (-not (Test-Path ".env")) { Copy-Item .env.example .env; Write-Host "[안내] .env 를 만들었습니다. 값을 채워 주세요." }

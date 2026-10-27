"""공통 유틸: 경로, 환경 정보 기록, 리소스 모니터, 요약 CSV append."""
from __future__ import annotations

import csv
import datetime as dt
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Iterable

import yaml

# Windows(개발자 모드 꺼짐)에서는 HF 캐시 심볼릭 링크 생성이 WinError 1314로 실패한다 → 실제 파일로 저장
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

AI_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = AI_DIR.parent
CONFIGS = AI_DIR / "configs"
DATASET = AI_DIR / "dataset"
PROMPTS = DATASET / "prompts"
OUTPUTS = AI_DIR / "outputs"
RUNS = OUTPUTS / "runs"
RESULTS = AI_DIR / "results"
REPORT = RESULTS / "report"
AITK_DIR = AI_DIR / "third_party" / "ai-toolkit"
ANCHORS_DIR = OUTPUTS / "anchors"
EXPERIMENTS_MD = AI_DIR / "experiments.md"

INFERENCE_SUMMARY = RESULTS / "inference_summary.csv"
TRAINING_SUMMARY = RESULTS / "training_summary.csv"

INFERENCE_COLUMNS = [
    "run_id", "date", "status", "error", "method", "precision", "resolution", "lora", "lora_step",
    "prompt_set", "n_images", "steps", "guidance", "seeds_per_prompt",
    "model_load_sec", "te_load_sec", "te_encode_sec_mean",
    "latency_median_sec", "latency_p90_sec", "latency_mean_sec", "latency_e2e_median_sec",
    "vram_peak_gb_torch", "vram_reserved_peak_gb_torch", "vram_peak_gb_smi", "shared_peak_gb",
    "sysmem_fallback", "ram_peak_gb", "gpu_temp_max", "power_plugged",
    "dino_sim", "clip_i", "clip_t", "dino_sim_crop", "human_score",
    "git_commit", "notes",
]
TRAINING_COLUMNS = [
    "run_id", "date", "status", "error", "config", "train_precision", "qtype", "rank", "resolution",
    "steps_target", "steps_done", "batch_size", "lr", "dataset", "n_images",
    "sec_per_it", "sec_per_it_first50", "est_total_hours", "total_train_min",
    "vram_peak_gb_smi", "dedicated_peak_gb", "shared_peak_gb", "sysmem_fallback", "ram_peak_gb",
    "gpu_temp_max", "power_plugged", "git_commit", "notes",
]


# ---------------------------------------------------------------------------
def load_yaml(path: str | Path) -> Any:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def dump_yaml(obj: Any, path: str | Path) -> None:
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(obj, f, allow_unicode=True, sort_keys=False)


def today() -> str:
    return dt.datetime.now().strftime("%Y%m%d")


def now_iso() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def unique_run_dir(run_id: str) -> tuple[str, Path]:
    """같은 run_id가 있으면 -2, -3 ... 을 붙인다."""
    RUNS.mkdir(parents=True, exist_ok=True)
    cand, i = run_id, 1
    while (RUNS / cand).exists():
        i += 1
        cand = f"{run_id}-{i}"
    d = RUNS / cand
    d.mkdir(parents=True)
    return cand, d


def append_csv(path: Path, columns: list[str], row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    new = not path.exists()
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        if new:
            w.writeheader()
        w.writerow({k: _fmt(row.get(k)) for k in columns})


def upsert_csv(path: Path, columns: list[str], row: dict, key: str = "run_id") -> None:
    """key가 같은 행이 있으면 주어진 값으로 갱신, 없으면 추가."""
    rows: list[dict] = []
    if path.exists():
        with open(path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    for r in rows:
        if r.get(key) == str(row[key]):
            r.update({k: _fmt(v) for k, v in row.items() if k in columns and v is not None})
            break
    else:
        rows.append({k: _fmt(row.get(k)) for k in columns})
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in columns})


def _fmt(v: Any) -> Any:
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:.4f}"
    return v


def append_experiment_line(text: str) -> None:
    with open(EXPERIMENTS_MD, "a", encoding="utf-8") as f:
        f.write(text.rstrip() + "\n")


def write_json(path: Path, obj: Any) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


class Tee:
    """stdout을 log.txt에도 남긴다."""

    def __init__(self, path: Path):
        self.f = open(path, "a", encoding="utf-8")
        self.stdout = sys.stdout

    def write(self, s: str) -> int:
        self.stdout.write(s)
        self.f.write(s)
        self.f.flush()
        return len(s)

    def flush(self) -> None:
        self.stdout.flush()
        self.f.flush()

    def __enter__(self):
        sys.stdout = self
        return self

    def __exit__(self, *exc):
        sys.stdout = self.stdout
        self.f.close()


# ---------------------------------------------------------------------------
# 환경 정보
# ---------------------------------------------------------------------------
def _run(cmd: list[str], cwd: Path | None = None) -> str:
    try:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception:
        return ""


def git_commit(path: Path = REPO_DIR) -> str:
    h = _run(["git", "rev-parse", "HEAD"], cwd=path)
    dirty = _run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=path)
    return (h + ("-dirty" if dirty else "")) if h else ""


def power_plugged() -> bool | None:
    try:
        import psutil
        b = psutil.sensors_battery()
        return None if b is None else bool(b.power_plugged)
    except Exception:
        return None


def pkg_version(name: str) -> str | None:
    try:
        from importlib.metadata import version
        return version(name)
    except Exception:
        return None


def gpu_static_info() -> dict:
    out = _run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total,power.limit",
                "--format=csv,noheader,nounits"])
    info: dict = {}
    if out:
        name, drv, mem, plim = [x.strip() for x in out.splitlines()[0].split(",")]
        info = {"gpu_name": name, "driver_version": drv, "vram_total_mib": float(mem), "power_limit_w": plim}
    smi = _run(["nvidia-smi"])
    m = re.search(r"CUDA Version:\s*([\d.]+)", smi)
    if m:
        info["driver_cuda_version"] = m.group(1)
    return info


def collect_env(extra: dict | None = None) -> dict:
    env: dict[str, Any] = {
        "timestamp": now_iso(),
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "cpu": platform.processor(),
        "git_commit": git_commit(),
        "power_plugged": power_plugged(),
    }
    try:
        import psutil
        env["ram_total_gb"] = round(psutil.virtual_memory().total / 2**30, 1)
    except Exception:
        pass
    env.update(gpu_static_info())
    try:
        import torch
        env["torch"] = torch.__version__
        env["torch_cuda"] = torch.version.cuda
        env["cudnn"] = torch.backends.cudnn.version()
    except Exception:
        pass
    for p in ["diffusers", "transformers", "peft", "accelerate", "gguf", "torchao", "optimum-quanto", "bitsandbytes"]:
        env[p] = pkg_version(p)
    if AITK_DIR.exists():
        ver = (AITK_DIR / "version.py").read_text(encoding="utf-8") if (AITK_DIR / "version.py").exists() else ""
        m = re.search(r'VERSION\s*=\s*"([^"]+)"', ver)
        env["ai_toolkit_version"] = m.group(1) if m else None
        env["ai_toolkit_commit"] = git_commit(AITK_DIR)
    if extra:
        env.update(extra)
    return env


def print_fairness_notice() -> None:
    print("=" * 72)
    print("[측정 안내] 측정 중에는 브라우저·게임·IDE 빌드 등 무거운 프로그램을 꺼 주세요.")
    print("           전원 어댑터를 연결하고, Windows 전원 모드를 '최고 성능'으로 맞춰 주세요.")
    plugged = power_plugged()
    if plugged is False:
        print("[경고] 전원 어댑터가 연결되어 있지 않습니다. 측정값이 왜곡될 수 있습니다.")
    print("=" * 72)


# ---------------------------------------------------------------------------
# 리소스 모니터
# ---------------------------------------------------------------------------
class ResourceMonitor:
    """백그라운드에서 GPU/RAM 사용량을 샘플링한다.

    - vram_peak_gb_smi: NVML 디바이스 사용량 피크 (nvidia-smi와 동일한 값, 다른 프로세스 포함)
    - dedicated/shared_peak_gb: Windows 성능 카운터 'GPU Process Memory' 의 프로세스별
      Dedicated/Shared Usage. 전용 VRAM을 넘으면 드라이버가 공유 GPU 메모리(시스템 RAM)로
      넘기는데(sysmem fallback), 이때 Shared Usage가 증가한다.
    - ram_peak_gb: 대상 프로세스(+자식) RSS 합 피크
    """

    def __init__(self, pids: Iterable[int] | None = None, interval: float = 0.5):
        self.pids = set(pids or [os.getpid()])
        self.interval = interval
        self._stop = threading.Event()
        self.samples = 0
        self.vram_used_peak = 0.0
        self.vram_used_baseline: float | None = None
        self.temp_max: float | None = None
        self.ram_peak = 0.0
        self.dedicated_peak = 0.0
        self.shared_peak = 0.0
        self.shared_baseline: float | None = None
        self.perf_samples = 0
        self.vram_total_gb: float | None = None
        self._threads: list[threading.Thread] = []
        self._typeperf: subprocess.Popen | None = None

    def add_pid(self, pid: int) -> None:
        self.pids.add(pid)

    def _all_pids(self) -> set[int]:
        try:
            import psutil
            pids = set()
            for p in list(self.pids):
                try:
                    proc = psutil.Process(p)
                    pids.add(p)
                    pids.update(c.pid for c in proc.children(recursive=True))
                except psutil.Error:
                    pass
            return pids
        except Exception:
            return set(self.pids)

    def _poll_nvml_ram(self) -> None:
        nv = None
        try:
            import pynvml
            pynvml.nvmlInit()
            nv = pynvml.nvmlDeviceGetHandleByIndex(0)
            self.vram_total_gb = pynvml.nvmlDeviceGetMemoryInfo(nv).total / 2**30
        except Exception:
            nv = None
        import psutil
        while not self._stop.is_set():
            if nv is not None:
                try:
                    used = pynvml.nvmlDeviceGetMemoryInfo(nv).used / 2**30
                    if self.vram_used_baseline is None:
                        self.vram_used_baseline = used
                    self.vram_used_peak = max(self.vram_used_peak, used)
                    t = pynvml.nvmlDeviceGetTemperature(nv, pynvml.NVML_TEMPERATURE_GPU)
                    self.temp_max = t if self.temp_max is None else max(self.temp_max, t)
                except Exception:
                    pass
            rss = 0
            for p in self._all_pids():
                try:
                    rss += psutil.Process(p).memory_info().rss
                except psutil.Error:
                    pass
            self.ram_peak = max(self.ram_peak, rss / 2**30)
            self.samples += 1
            self._stop.wait(self.interval)

    def _poll_perfcounters(self) -> None:
        """Windows 'GPU Process Memory' 카운터를 약 1~2초 간격으로 읽는다.

        typeperf 는 시작 시점에 존재하는 인스턴스만 와일드카드로 펼치므로, 학습처럼 나중에 GPU를 쓰기
        시작하는 자식 프로세스를 잡으려면 매 샘플마다 typeperf 를 새로 실행해야 한다.
        """
        if os.name != "nt" or not shutil.which("typeperf"):
            return
        counters = [r"\GPU Process Memory(*)\Dedicated Usage", r"\GPU Process Memory(*)\Shared Usage"]
        while not self._stop.is_set():
            try:
                out = subprocess.run(["typeperf", *counters, "-sc", "1"], capture_output=True, text=True,
                                     encoding="utf-8", errors="ignore", timeout=15).stdout
            except Exception:
                self._stop.wait(2)
                continue
            rows = [l.strip() for l in out.splitlines() if l.strip().startswith('"')]
            if len(rows) < 2:
                self._stop.wait(1)
                continue
            header = [c.strip('"') for c in rows[0].split('","')]
            cells = [c.strip('"') for c in rows[1].split('","')]
            self.perf_samples += 1
            pids = self._all_pids()
            ded = shr = 0.0
            for name, val in zip(header[1:], cells[1:]):
                m = re.search(r"pid_(\d+)_", name)
                if not m or int(m.group(1)) not in pids:
                    continue
                try:
                    v = float(val) / 2**30
                except ValueError:
                    continue
                if name.endswith("Dedicated Usage"):
                    ded += v
                elif name.endswith("Shared Usage"):
                    shr += v
            if self.shared_baseline is None:
                self.shared_baseline = shr
            self.dedicated_peak = max(self.dedicated_peak, ded)
            self.shared_peak = max(self.shared_peak, shr)

    def start(self) -> "ResourceMonitor":
        for fn in (self._poll_nvml_ram, self._poll_perfcounters):
            t = threading.Thread(target=fn, daemon=True)
            t.start()
            self._threads.append(t)
        return self

    def stop(self) -> dict:
        self._stop.set()
        if self._typeperf is not None:
            try:
                self._typeperf.terminate()
            except Exception:
                pass
        for t in self._threads:
            t.join(timeout=3)
        return self.result()

    def result(self, torch_reserved_peak_gb: float | None = None) -> dict:
        total = self.vram_total_gb
        shared_delta = (self.shared_peak - (self.shared_baseline or 0.0)) if self.shared_peak else 0.0
        fallback = None
        reasons = []
        if total:
            if torch_reserved_peak_gb is not None and torch_reserved_peak_gb > total * 0.98:
                reasons.append("torch_reserved>dedicated")
            if self.dedicated_peak and self.dedicated_peak > total * 0.97 and shared_delta > 0.25:
                reasons.append("dedicated_full+shared_grew")
            elif shared_delta > 1.0:
                reasons.append("shared_grew>1GB")
            perf_ok = self.perf_samples > 0 and self.dedicated_peak > 0
            # 성능 카운터를 못 읽었으면 "넘치지 않음"이라고 단정하지 않는다 (None = 측정 불가)
            fallback = True if reasons else (False if perf_ok else None)
            if not perf_ok:
                reasons.append("perf_counter_unavailable")
        return {
            "vram_total_gb": round(total, 3) if total else None,
            "vram_peak_gb_smi": round(self.vram_used_peak, 3),
            "vram_baseline_gb_smi": round(self.vram_used_baseline, 3) if self.vram_used_baseline else None,
            "dedicated_peak_gb": round(self.dedicated_peak, 3),
            "shared_peak_gb": round(self.shared_peak, 3),
            "shared_baseline_gb": round(self.shared_baseline, 3) if self.shared_baseline is not None else None,
            "sysmem_fallback": fallback,
            "sysmem_fallback_reason": ",".join(reasons) or None,
            "ram_peak_gb": round(self.ram_peak, 3),
            "gpu_temp_max": self.temp_max,
            "monitor_samples": self.samples,
            "perf_counter_samples": self.perf_samples,
        }


def percentile(xs: list[float], q: float) -> float | None:
    if not xs:
        return None
    s = sorted(xs)
    k = (len(s) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def read_lines(path: Path) -> list[str]:
    return [l.strip() for l in path.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]


def read_seeds(path: Path = PROMPTS / "seeds.txt") -> list[int]:
    return [int(x) for x in read_lines(path)]

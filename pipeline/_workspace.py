"""
Per-job workspace resolution for the render engine.

The pipeline used to assume a single shared project root. Now the API server
runs each render in its own isolated workspace (jobs/<jobId>/workspace), so every
step must read/write that job's files instead of the repo root.

Resolution (all overridable by env so the scripts still run standalone):
  PROJECT_ROOT  the job workspace — holds input/, assets/, out/, remotion.json,
                replicate.json. Defaults to the repo root (legacy behaviour).
  SKILL_DIR     the script-reviewer skill. Shared/read-only; defaults to the
                repo's .claude/skills/script-reviewer.
  STYLE_PATH    the art-style reference. Defaults to assets/reference/STYLE.md.
  RENDER_MOCK   when truthy, paid APIs (Anthropic/ElevenLabs/Replicate) are
                replaced by deterministic stubs so the full flow can be tested
                for free.
"""

import os
from pathlib import Path

# The repository this file lives in (one level up from pipeline/).
REPO_ROOT = Path(__file__).resolve().parent.parent


def _env_path(name: str, default: Path) -> Path:
    val = os.environ.get(name)
    return Path(val).resolve() if val else default


def project_root() -> Path:
    """The job workspace (or the repo root when run standalone)."""
    return _env_path("PROJECT_ROOT", REPO_ROOT)


def skill_dir() -> Path:
    return _env_path("SKILL_DIR", REPO_ROOT / ".claude" / "skills" / "script-reviewer")


def style_path() -> Path:
    return _env_path("STYLE_PATH", REPO_ROOT / "assets" / "reference" / "STYLE.md")


def is_mock() -> bool:
    return os.environ.get("RENDER_MOCK", "").strip().lower() in {"1", "true", "yes", "on"}

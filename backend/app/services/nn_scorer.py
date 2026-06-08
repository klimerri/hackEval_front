"""Neural network code submission scorer — multi-output version.

Returns individual scores for: readme, license, deps, run_instructions,
code_quality (each 0..1), plus a weighted composite 0..10.

Model path: app/services/my_model/ or NN_MODEL_DIR env var.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_model = None
_tokenizer = None
_cfg: dict = {}
_loaded = False

README_FILES  = {"readme.md", "readme.rst", "readme.txt", "readme"}
LICENSE_FILES = {"license", "license.md", "license.txt", "copying"}
DEP_FILES     = {"requirements.txt", "pyproject.toml", "pipfile", "package.json", "go.mod", "cargo.toml"}
CODE_EXTS     = (".py", ".js", ".ts", ".tsx", ".jsx")

WEIGHTS = {"readme": 1.5, "license": 1.0, "deps": 1.5, "run_instructions": 1.0, "code_quality": 2.5}


def _model_dir() -> Path:
    # Note: Path("") == Path(".") is truthy, so the env var must be checked for
    # emptiness explicitly — `or` would never fall through to the default.
    env = os.environ.get("NN_MODEL_DIR", "").strip()
    return Path(env) if env else Path(__file__).parent / "my_model"


def _load() -> bool:
    global _model, _tokenizer, _cfg, _loaded
    if _loaded:
        return _model is not None
    _loaded = True
    d = _model_dir()
    if not d.exists():
        logger.info("nn_scorer: model not found at %s", d)
        return False
    try:
        import torch
        from torch import nn
        from transformers import AutoModel, AutoTokenizer

        cfg_path = d / "nn_config.json"
        _cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else {"n_outputs": 5, "output_keys": list(WEIGHTS)}

        n_out = _cfg["n_outputs"]

        class _Model(nn.Module):
            def __init__(self, bert):
                super().__init__()
                self.bert = bert
                self.head = nn.Sequential(
                    nn.Linear(768, 256), nn.ReLU(), nn.Dropout(0.1),
                    nn.Linear(256, n_out), nn.Sigmoid(),
                )
            def forward(self, input_ids, attention_mask):
                out = self.bert(input_ids=input_ids, attention_mask=attention_mask)
                return self.head(out.last_hidden_state[:, 0, :])

        tok  = AutoTokenizer.from_pretrained(str(d))
        bert = AutoModel.from_pretrained(str(d))
        m    = _Model(bert)
        m.head.load_state_dict(torch.load(str(d / "head.pt"), map_location="cpu", weights_only=True))
        m.eval()
        _tokenizer = tok
        _model     = m
        logger.info("nn_scorer: loaded from %s (outputs=%d)", d, n_out)
        return True
    except Exception as exc:
        logger.warning("nn_scorer: load failed: %s", exc)
        return False


def _predict_text(text: str) -> dict[str, float] | None:
    if not _load():
        return None
    try:
        import torch
        enc = _tokenizer(text, max_length=512, padding="max_length", truncation=True, return_tensors="pt")
        with torch.no_grad():
            out = _model(enc["input_ids"], enc["attention_mask"])
        keys = _cfg.get("output_keys", list(WEIGHTS))
        vals = out.squeeze().tolist()
        if not isinstance(vals, list):
            vals = [vals]
        scores = {k: round(float(v), 3) for k, v in zip(keys, vals)}
        total_w   = sum(WEIGHTS.values())
        composite = sum(scores.get(k, 0) * w for k, w in WEIGHTS.items()) / total_w
        scores["composite"] = round(composite * 10, 2)
        return scores
    except Exception as exc:
        logger.warning("nn_scorer: predict failed: %s", exc)
        return None


def build_project_sample(files: list[tuple[str, bytes]]) -> str:
    """Build the [README]/[LICENSE]/[DEPS]/[CODE] string the model expects."""
    index = {n.split("/")[-1].lower(): (n, d) for n, d in files}
    parts: list[str] = []

    readme_text = ""
    for key in README_FILES:
        if key in index:
            try:
                readme_text = index[key][1].decode("utf-8", errors="ignore")[:800]
            except Exception:
                pass
            break
    parts.append(f"[README]\n{readme_text}" if readme_text else "[README]\n(none)")

    for key in LICENSE_FILES:
        if key in index:
            parts.append("[LICENSE]\nMIT License")
            break

    for key in DEP_FILES:
        if key in index:
            try:
                deps = index[key][1].decode("utf-8", errors="ignore")[:300]
                parts.append(f"[DEPS]\n{deps}")
            except Exception:
                pass
            break

    code_files = [(n, d) for n, d in files if any(n.endswith(e) for e in CODE_EXTS)]
    code_parts: list[str] = []
    for _, data in code_files[:3]:
        try:
            text = data.decode("utf-8", errors="ignore")[:600].strip()
            if len(text) >= 30:
                code_parts.append(text)
        except Exception:
            continue
    if code_parts:
        parts.append("[CODE]\n" + "\n---\n".join(code_parts))

    return "\n\n".join(parts)


def score_files(files: list[tuple[str, bytes]]) -> dict[str, float] | None:
    """Score the project. Returns dict with readme/license/deps/run_instructions/
    code_quality (0..1 each) and composite (0..10), or None if unavailable."""
    code_files = [f for f in files if any(f[0].endswith(e) for e in CODE_EXTS)]
    if not code_files:
        return None
    return _predict_text(build_project_sample(files))

import re
from pathlib import Path

from app.core.config import get_settings


def result_image_url(path: str | None) -> str | None:
    if not path:
        return None

    settings = get_settings()
    generated_root = Path(settings.generated_dir)
    try:
        relative_path = Path(path).relative_to(generated_root)
    except ValueError:
        return None

    return f"/media/generated/{relative_path.as_posix()}"


def safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-._")
    return cleaned or "download"

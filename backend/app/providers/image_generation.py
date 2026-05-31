from abc import ABC, abstractmethod
from base64 import b64decode
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from time import sleep
from textwrap import wrap
from urllib.parse import urljoin

import httpx
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import AppSetting


IMAGE_PROVIDER_SETTING_KEYS = {
    "image_provider",
    "image_api_base_url",
    "image_api_key",
    "image_model",
    "image_api_timeout_seconds",
    "image_api_retry_count",
    "mock_image_delay_seconds",
}


@dataclass(frozen=True)
class ImageProviderConfig:
    image_provider: str
    image_api_base_url: str
    image_api_key: str
    image_model: str
    image_api_timeout_seconds: float
    image_api_retry_count: int
    mock_image_delay_seconds: float
    source: str


def _settings_map(db: Session) -> dict[str, str]:
    rows = db.scalars(select(AppSetting).where(AppSetting.key.in_(IMAGE_PROVIDER_SETTING_KEYS))).all()
    return {row.key: row.value for row in rows}


def get_effective_image_provider_config(db: Session | None = None) -> ImageProviderConfig:
    settings = get_settings()
    values = {
        "image_provider": settings.image_provider,
        "image_api_base_url": settings.image_api_base_url,
        "image_api_key": settings.image_api_key,
        "image_model": settings.image_model,
        "image_api_timeout_seconds": str(settings.image_api_timeout_seconds),
        "image_api_retry_count": str(settings.image_api_retry_count),
        "mock_image_delay_seconds": str(settings.mock_image_delay_seconds),
    }

    source = "env"
    if db is not None:
        persisted_values = _settings_map(db)
        if persisted_values:
            values.update(persisted_values)
            source = "web"

    return ImageProviderConfig(
        image_provider=values["image_provider"],
        image_api_base_url=values["image_api_base_url"],
        image_api_key=values["image_api_key"],
        image_model=values["image_model"],
        image_api_timeout_seconds=float(values["image_api_timeout_seconds"] or 60),
        image_api_retry_count=int(values["image_api_retry_count"] or 0),
        mock_image_delay_seconds=float(values["mock_image_delay_seconds"] or 0),
        source=source,
    )


def upsert_image_provider_config(
    db: Session,
    *,
    image_provider: str,
    image_api_base_url: str,
    image_api_key: str | None,
    image_model: str,
    image_api_timeout_seconds: float,
    image_api_retry_count: int,
    mock_image_delay_seconds: float,
) -> ImageProviderConfig:
    existing_values = _settings_map(db)
    next_values = {
        "image_provider": image_provider,
        "image_api_base_url": image_api_base_url,
        "image_api_key": existing_values.get("image_api_key", get_settings().image_api_key)
        if image_api_key is None
        else image_api_key,
        "image_model": image_model,
        "image_api_timeout_seconds": str(image_api_timeout_seconds),
        "image_api_retry_count": str(image_api_retry_count),
        "mock_image_delay_seconds": str(mock_image_delay_seconds),
    }

    for key, value in next_values.items():
        setting = db.get(AppSetting, key)
        if setting is None:
            db.add(AppSetting(key=key, value=value))
        else:
            setting.value = value

    db.flush()
    return get_effective_image_provider_config(db)


class ImageGenerationProvider(ABC):
    @abstractmethod
    def generate(
        self,
        *,
        job_id: int,
        item_id: int,
        title: str,
        prompt: str,
        reference_image_path: str | None,
    ) -> str:
        pass


class MockImageGenerationProvider(ImageGenerationProvider):
    def __init__(self, config: ImageProviderConfig | None = None) -> None:
        self.config = config

    def generate(
        self,
        *,
        job_id: int,
        item_id: int,
        title: str,
        prompt: str,
        reference_image_path: str | None,
    ) -> str:
        settings = get_settings()
        config = self.config or get_effective_image_provider_config()
        if config.mock_image_delay_seconds > 0:
            sleep(config.mock_image_delay_seconds)

        output_dir = Path(settings.generated_dir) / str(job_id)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{item_id}.jpg"

        image = Image.new("RGB", (1024, 768), color=(248, 250, 252))
        draw = ImageDraw.Draw(image)
        font = ImageFont.load_default()

        draw.rectangle((48, 48, 976, 720), outline=(16, 185, 129), width=4)
        draw.text((80, 88), "Mock Image Generation", fill=(4, 120, 87), font=font)
        draw.text((80, 150), f"Job #{job_id} / Item #{item_id}", fill=(15, 23, 42), font=font)
        draw.text((80, 220), "Title:", fill=(71, 85, 105), font=font)
        draw.text((80, 250), title[:120], fill=(15, 23, 42), font=font)
        draw.text((80, 330), "Prompt:", fill=(71, 85, 105), font=font)

        y = 360
        for line in wrap(prompt, width=80)[:8]:
            draw.text((80, y), line, fill=(15, 23, 42), font=font)
            y += 32

        if reference_image_path:
            draw.text((80, 650), f"Reference: {reference_image_path[:100]}", fill=(71, 85, 105), font=font)

        image.save(output_path, format="JPEG", quality=90)
        return str(output_path)


class RealImageGenerationProvider(ImageGenerationProvider):
    def __init__(self, config: ImageProviderConfig | None = None) -> None:
        self.config = config

    def generate(
        self,
        *,
        job_id: int,
        item_id: int,
        title: str,
        prompt: str,
        reference_image_path: str | None,
    ) -> str:
        settings = get_settings()
        config = self.config or get_effective_image_provider_config()
        if not config.image_api_base_url or not config.image_api_key or not config.image_model:
            raise ValueError("IMAGE_API_BASE_URL, IMAGE_API_KEY, and IMAGE_MODEL are required")

        output_dir = Path(settings.generated_dir) / str(job_id)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{item_id}.jpg"

        payload = {
            "model": config.image_model,
            "prompt": self._build_prompt(title, prompt, reference_image_path),
            "n": 1,
            "size": "1024x1024",
        }
        endpoint = urljoin(config.image_api_base_url.rstrip("/") + "/", "images/generations")

        last_error: Exception | None = None
        for attempt in range(config.image_api_retry_count + 1):
            try:
                image_bytes = self._request_image(endpoint, payload, config.image_api_key, config.image_api_timeout_seconds)
                self._save_jpeg(image_bytes, output_path)
                return str(output_path)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt < config.image_api_retry_count:
                    sleep(2**attempt)

        raise RuntimeError(f"Image API failed: {last_error}") from last_error

    def _request_image(
        self,
        endpoint: str,
        payload: dict[str, object],
        api_key: str,
        timeout_seconds: float,
    ) -> bytes:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            body = response.json()

            image_payload = self._extract_image_payload(body)
            if image_payload.get("b64_json"):
                return b64decode(str(image_payload["b64_json"]))
            if image_payload.get("url"):
                image_response = client.get(str(image_payload["url"]))
                image_response.raise_for_status()
                return image_response.content

        raise ValueError("Image API response did not include b64_json or url")

    def _extract_image_payload(self, body: object) -> dict[str, object]:
        if not isinstance(body, dict):
            raise ValueError("Image API response must be a JSON object")

        data = body.get("data")
        if isinstance(data, list) and data and isinstance(data[0], dict):
            return data[0]
        if isinstance(body.get("image"), dict):
            return body["image"]  # type: ignore[return-value]
        return body

    def _build_prompt(self, title: str, prompt: str, reference_image_path: str | None) -> str:
        lines = [f"Title: {title}", f"Prompt: {prompt}"]
        if reference_image_path:
            lines.append(f"Reference image path provided by user: {reference_image_path}")
        return "\n".join(lines)

    def _save_jpeg(self, image_bytes: bytes, output_path: Path) -> None:
        with Image.open(BytesIO(image_bytes)) as image:
            image.convert("RGB").save(output_path, format="JPEG", quality=92)


def get_image_generation_provider(config: ImageProviderConfig | None = None) -> ImageGenerationProvider:
    if config is None:
        with SessionLocal() as db:
            config = get_effective_image_provider_config(db)

    if config.image_provider == "mock":
        return MockImageGenerationProvider(config)
    if config.image_provider == "real":
        return RealImageGenerationProvider(config)
    raise ValueError("IMAGE_PROVIDER must be mock or real")

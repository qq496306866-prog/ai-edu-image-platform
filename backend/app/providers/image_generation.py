from abc import ABC, abstractmethod
from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont

from app.core.config import get_settings


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


def get_image_generation_provider() -> ImageGenerationProvider:
    settings = get_settings()
    if settings.image_provider != "mock":
        raise ValueError("Only IMAGE_PROVIDER=mock is available")
    return MockImageGenerationProvider()

from dataclasses import dataclass
from pathlib import Path

from openpyxl import load_workbook


TITLE_COLUMNS = {"商品标题", "标题", "title", "name"}
PROMPT_COLUMNS = {"提示词", "prompt"}
REFERENCE_IMAGE_COLUMNS = {"参考图片路径", "参考图", "image_path", "reference_image"}


@dataclass(frozen=True)
class ParsedExcelItem:
    row_number: int
    title: str
    prompt: str
    reference_image_path: str | None


def _normalize_header(value: object) -> str:
    return str(value or "").strip().lower()


def _find_column(headers: list[str], candidates: set[str]) -> int | None:
    normalized_candidates = {_normalize_header(candidate) for candidate in candidates}
    for index, header in enumerate(headers):
        if header in normalized_candidates:
            return index
    return None


def parse_generation_excel(path: Path) -> list[ParsedExcelItem]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook.worksheets[0]
    rows = worksheet.iter_rows(values_only=True)

    try:
        header_row = next(rows)
    except StopIteration:
        return []

    headers = [_normalize_header(cell) for cell in header_row]
    title_index = _find_column(headers, TITLE_COLUMNS)
    prompt_index = _find_column(headers, PROMPT_COLUMNS)
    reference_index = _find_column(headers, REFERENCE_IMAGE_COLUMNS)

    if title_index is None or prompt_index is None:
        raise ValueError("Excel must include title and prompt columns")

    parsed_items: list[ParsedExcelItem] = []
    for row_number, row in enumerate(rows, start=2):
        title = str(row[title_index] or "").strip() if title_index < len(row) else ""
        prompt = str(row[prompt_index] or "").strip() if prompt_index < len(row) else ""
        reference_image_path = (
            str(row[reference_index] or "").strip()
            if reference_index is not None and reference_index < len(row)
            else ""
        )

        if not title and not prompt and not reference_image_path:
            continue
        if not title or not prompt:
            continue

        parsed_items.append(
            ParsedExcelItem(
                row_number=row_number,
                title=title,
                prompt=prompt,
                reference_image_path=reference_image_path or None,
            )
        )

    return parsed_items

"""Local, review-only PDF question extractor. Never writes to a database."""

from __future__ import annotations

import json
import hashlib
import re
import sys
import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

import pdfplumber
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_LABEL = "DEMO INGESTION FIXTURE — NOT OFFICIAL"
SET_NAMESPACE = uuid.UUID("92ca607a-bad6-5d22-92ad-55a5b41bce1b")
SECTION_HEADING = re.compile(r"^\s*(?:PHẦN|PART)\s*(I{1,3}|1|2|3)\b", re.I)
QUESTION_HEADING = re.compile(r"^\s*(?:Câu|Question)\s*(\d+)\s*[.:)]\s*(.*)$", re.I)
ANSWER_HEADING = re.compile(
    r"^\s*(?:(?:BẢNG\s*)?ĐÁP\s*ÁN.*|ANSWER\s*KEY.*)\s*$",
    re.I,
)
VISUAL_CUE = re.compile(
    r"(?:như\s+hình(?:\s+vẽ)?|hình\s+(?:vẽ|sau|dưới|minh họa)|(?:đồ\s*thị|biểu\s*đồ)\s+(?:như|ở|trong|được\s+cho)|figure|graph|diagram)",
    re.I,
)
OPTIONS = re.compile(r"^\s*([ABCD])\s*[.)]\s*(.*)$", re.I)
SUBSTATEMENT = re.compile(r"^\s*([a-d])\s*[.)]\s*(.*)$", re.I)
PAGE_FOOTER = re.compile(r"^\s*Trang\s*\d+\s*/\s*\d+", re.I)


class IngestionError(Exception):
    """A user-facing input or extraction error."""


def _section_number(value: str) -> int:
    return {"I": 1, "II": 2, "III": 3}.get(value.upper(), int(value) if value.isdigit() else 0)


def _page_lines(page: pdfplumber.page.Page) -> list[dict[str, Any]]:
    # These PDFs encode word spaces as ~3pt glyph gaps; 3pt drops Vietnamese spaces.
    lines = page.extract_text_lines(layout=False, strip=True, x_tolerance=2.5) or []
    return [line for line in lines if str(line.get("text", "")).strip()]


def _layout_visual_evidence(page: pdfplumber.page.Page, top: float, bottom: float) -> tuple[int, int]:
    vector_count = 0
    embedded_image_count = 0
    for kind in ("image", "line", "curve", "rect"):
        for item in page.objects.get(kind, []):
            if item.get("bottom", -1) >= top and item.get("top", float("inf")) <= bottom:
                width = abs(float(item.get("x1", item.get("xmax", 0))) - float(item.get("x0", item.get("xmin", 0))))
                height = abs(float(item.get("y1", item.get("ymax", 0))) - float(item.get("y0", item.get("ymin", 0))))
                # Ignore tiny rules and glyph-level drawing noise; mathematical diagrams have
                # either an embedded image or several meaningful vector primitives.
                if kind == "image" and width >= 18 and height >= 18:
                    embedded_image_count += 1
                elif width >= 10 or height >= 10:
                    vector_count += 1
    return vector_count, embedded_image_count


def _layout_visual_bottom(page: pdfplumber.page.Page, top: float) -> float | None:
    bottoms: list[float] = []
    for kind in ("image", "line", "curve", "rect"):
        for item in page.objects.get(kind, []):
            item_bottom = float(item.get("bottom", -1))
            if item_bottom < top:
                continue
            width = abs(float(item.get("x1", item.get("xmax", 0))) - float(item.get("x0", item.get("xmin", 0))))
            height = abs(float(item.get("y1", item.get("ymax", 0))) - float(item.get("y0", item.get("ymin", 0))))
            if (kind == "image" and width >= 18 and height >= 18) or width >= 10 or height >= 10:
                bottoms.append(item_bottom)
    return max(bottoms) if bottoms else None


def _segments(pdf: pdfplumber.PDF) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    questions: list[dict[str, Any]] = []
    answer_lines: list[dict[str, Any]] = []
    warnings: list[str] = []
    section: int | None = None
    active: dict[str, Any] | None = None
    answer_mode = False

    for page_index, page in enumerate(pdf.pages, start=1):
        lines = _page_lines(page)
        if answer_mode:
            answer_mode = True
            answer_lines.extend({"page": page_index, **line} for line in lines)
            continue

        answer_start = next(
            (index for index, line in enumerate(lines) if ANSWER_HEADING.match(str(line["text"]))),
            None,
        )
        question_lines = lines if answer_start is None else lines[:answer_start]
        if answer_start is not None:
            answer_mode = True
            answer_lines.extend({"page": page_index, **line} for line in lines[answer_start:])

        page_has_question = False
        for line in question_lines:
            text = str(line["text"]).strip()
            if text == FIXTURE_LABEL:
                continue
            if PAGE_FOOTER.match(text):
                continue
            if re.fullmatch(r"[xyO]", text):
                vectors, images = _layout_visual_evidence(
                    page, float(line["top"]) - 4, float(line["bottom"]) + 4
                )
                if vectors or images:
                    # Standalone axis labels that overlap diagram primitives belong to the crop,
                    # not to the question's prose transcription.
                    continue
            section_match = SECTION_HEADING.match(text)
            if section_match:
                new_section = _section_number(section_match.group(1))
                if active and active["section_number"] != new_section:
                    active = None
                section = new_section
                continue

            question_match = QUESTION_HEADING.match(text)
            if question_match:
                if section is None:
                    warnings.append(f"Question marker on page {page_index} appeared before a section heading.")
                    continue
                active = {
                    "section_number": section,
                    "section": f"part_{section}",
                    "question_number": int(question_match.group(1)),
                    "source_pages": [page_index],
                    "regions": [{"page": page_index, "top": float(line["top"]), "bottom": float(line["bottom"])}],
                    "text_lines": [str(question_match.group(2)).strip()],
                    "visuals": [],
                }
                questions.append(active)
                page_has_question = True
                continue

            if active is not None and section is not None:
                active["text_lines"].append(text)
                region = active["regions"][-1]
                if region["page"] != page_index:
                    active["regions"].append(
                        {"page": page_index, "top": float(line["top"]), "bottom": float(line["bottom"])}
                    )
                    if page_index not in active["source_pages"]:
                        active["source_pages"].append(page_index)
                else:
                    region["bottom"] = float(line["bottom"])
                page_has_question = True

        # A question continuing onto a page with no new marker owns the readable content
        # from the page top to the next section marker. This keeps the page fragments ordered.
        if answer_start is None and active is not None and active["regions"][-1]["page"] != page_index and not page_has_question:
            active["source_pages"].append(page_index)
            active["regions"].append({"page": page_index, "top": 24.0, "bottom": page.height - 24.0})
            active["text_lines"].extend(line["text"] for line in lines)

    if not questions:
        raise IngestionError("No sectioned questions were detected. Expected PHẦN/PART headings and 'Câu n.' markers.")

    # Trim each crop region to the actual line range. A continuation page starts at the page
    # margin, while a first page starts at the question marker. End at the last line before the
    # next question marker so a crop does not accidentally include the following question.
    for index, question in enumerate(questions):
        question["text_lines"] = [line for line in question["text_lines"] if line]
        question["regions"] = [
            {
                **region,
                "top": max(0.0, region["top"] - 4),
                "bottom": min(float(pdf.pages[int(region["page"]) - 1].height), region["bottom"] + 5),
            }
            for region in question["regions"]
        ]
        for region in question["regions"][:-1]:
            page = pdf.pages[int(region["page"]) - 1]
            visual_bottom = _layout_visual_bottom(page, float(region["top"]))
            region["bottom"] = (
                min(float(page.height) - 24.0, visual_bottom + 10.0)
                if visual_bottom is not None
                else float(page.height) - 24.0
            )
        if index + 1 < len(questions):
            next_question = questions[index + 1]
            if next_question["regions"][0]["page"] == question["regions"][-1]["page"]:
                question["regions"][-1]["bottom"] = min(
                    question["regions"][-1]["bottom"], next_question["regions"][0]["top"] - 7
                )
            elif next_question["regions"][0]["page"] > question["regions"][-1]["page"]:
                last_page = pdf.pages[int(question["regions"][-1]["page"]) - 1]
                question["regions"][-1]["bottom"] = float(last_page.height) - 24.0

    return questions, answer_lines, warnings


def _topic_segments(pdf: pdfplumber.PDF) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """Conservatively segment numbered questions in a chapter-practice PDF."""
    questions: list[dict[str, Any]] = []
    answer_lines: list[dict[str, Any]] = []
    warnings: list[str] = []
    active: dict[str, Any] | None = None
    section = 1
    answer_mode = False

    for page_index, page in enumerate(pdf.pages, start=1):
        for line in _page_lines(page):
            text = str(line["text"]).strip()
            if ANSWER_HEADING.match(text):
                answer_mode = True
            if answer_mode:
                answer_lines.append({"page": page_index, **line})
                continue

            section_match = SECTION_HEADING.match(text)
            roman_prefix = re.match(r"^\s*(I{1,3}|[1-3])\s*[.)–:-]?\s*PHẦN\b", text, re.I)
            if section_match or roman_prefix:
                marker = (section_match or roman_prefix).group(1)
                section = _section_number(marker)
                continue

            question_match = QUESTION_HEADING.match(text)
            if question_match:
                active = {
                    "section_number": section,
                    "section": f"part_{section}",
                    "question_number": int(question_match.group(1)),
                    "source_pages": [page_index],
                    "regions": [{"page": page_index, "top": float(line["top"]), "bottom": float(line["bottom"])}],
                    "text_lines": [str(question_match.group(2)).strip()],
                    "explanation_lines": [],
                    "visuals": [],
                    "in_explanation": False,
                }
                questions.append(active)
                continue

            if active is None:
                continue
            if text.casefold().startswith(("lời giải", "hướng dẫn giải", "lời giải chi tiết")):
                active["in_explanation"] = True
            if active["in_explanation"]:
                active["explanation_lines"].append(text)
            else:
                active["text_lines"].append(text)
            region = active["regions"][-1]
            if region["page"] != page_index:
                active["regions"].append(
                    {"page": page_index, "top": float(line["top"]), "bottom": float(line["bottom"])}
                )
                if page_index not in active["source_pages"]:
                    active["source_pages"].append(page_index)
            else:
                region["bottom"] = float(line["bottom"])

        if active is not None and active["regions"][-1]["page"] != page_index and not answer_mode:
            active["source_pages"].append(page_index)
            active["regions"].append({"page": page_index, "top": 24.0, "bottom": float(page.height) - 24.0})

    if not questions:
        raise IngestionError("No numbered questions were detected in this topic practice source.")

    for index, question in enumerate(questions):
        question["text_lines"] = [line for line in question["text_lines"] if line]
        question["regions"] = [
            {
                **region,
                "top": max(0.0, region["top"] - 4),
                "bottom": min(float(pdf.pages[int(region["page"]) - 1].height), region["bottom"] + 5),
            }
            for region in question["regions"]
        ]
        if index + 1 < len(questions):
            next_question = questions[index + 1]
            if next_question["regions"][0]["page"] == question["regions"][-1]["page"]:
                question["regions"][-1]["bottom"] = min(
                    question["regions"][-1]["bottom"], next_question["regions"][0]["top"] - 7
                )
        if question["in_explanation"]:
            warnings.append(
                f"Topic question {question['question_number']} includes a source explanation block; verify its boundary."
            )
    return questions, answer_lines, warnings


def _answer_key(lines: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {"part_1": {}, "part_2": {}, "part_3": {}}
    current: int | None = None
    for line in lines:
        text = str(line["text"]).strip()
        part = SECTION_HEADING.match(text)
        if part:
            current = _section_number(part.group(1))
            continue
        # Some embedded fonts repeat glyphs when extracting answer-table labels. Collapse
        # those runs for parsing only; the original extracted text remains unchanged.
        normalized = re.sub(r"(.)\1{2,}", r"\1", text)
        choose_at = re.search(r"chọn|chon", normalized, re.I)
        table_values = normalized[choose_at.end():] if choose_at else ""
        if current == 1:
            for number, answer in re.findall(r"(?:Câu\s*)?(\d+)\s*[.:)]?\s*([ABCD])\b", text, re.I):
                result["part_1"][number] = answer.upper()
            if choose_at:
                choices = re.findall(r"(?<![A-Za-z])([ABCD])(?=$|[^A-Za-z])", table_values, re.I)
                if len(choices) >= 4:
                    result["part_1"].update(
                        {str(index): answer.upper() for index, answer in enumerate(choices, start=1)}
                    )
        elif current == 2:
            for match in re.finditer(r"(?:Câu\s*)?(\d+)\s*[:.)-]\s*((?:[a-d]\s*[=:.)-]?\s*(?:đúng|sai|đ|s|true|false)\s*[,;]?\s*){4})", text, re.I):
                number, body = match.groups()
                values: dict[str, bool] = {}
                for key, value in re.findall(r"([a-d])\s*[=:.)-]?\s*(đúng|sai|đ|s|true|false)", body, re.I):
                    values[key.lower()] = value.lower() in {"đúng", "đ", "true"}
                if set(values) == set("abcd"):
                    result["part_2"][number] = values
            pairs = re.findall(r"([a-d])\s*\)\s*(đúng|sai|đ|s|true|false)", normalized, re.I)
            if len(pairs) >= 2:
                key = pairs[0][0].lower()
                for question_index, (_, value) in enumerate(pairs, start=1):
                    question_answers = result["part_2"].setdefault(str(question_index), {})
                    question_answers[key] = value.lower() in {"đúng", "đ", "true"}
        elif current == 3:
            for number, answer in re.findall(r"(?:Câu\s*)?(\d+)\s*[:.)-]\s*(-?\d+(?:[,.]\d+)?)", text):
                result["part_3"][number] = answer
            if choose_at:
                answers = re.findall(r"-?\d+(?:[,.]\d+)?", table_values)
                if len(answers) >= 2:
                    result["part_3"].update(
                        {str(index): answer for index, answer in enumerate(answers, start=1)}
                    )
    return result


def _safe_crop(page_image: Image.Image, page_width: float, region: dict[str, Any], dpi: int) -> Image.Image:
    scale = dpi / 72
    left, right = int(24 * scale), min(page_image.width, int((page_width - 24) * scale))
    top = max(0, int(float(region["top"]) * scale))
    bottom = min(page_image.height, int(float(region["bottom"]) * scale))
    if bottom <= top:
        raise IngestionError("Question crop region has no height.")
    return page_image.crop((left, top, right, bottom))


def _parse_question_type(section: int, lines: list[str]) -> tuple[str, str, list[dict[str, Any]], list[dict[str, Any]]]:
    options: list[dict[str, Any]] = []
    statements: list[dict[str, Any]] = []
    statement: list[str] = []
    for line in lines:
        option_matches = list(
            re.finditer(r"(?:^|\s)([ABCD])\s*[.)]\s*(.*?)(?=(?:\s+[ABCD]\s*[.)]\s*)|$)", line)
        ) if section == 1 else []
        substatement = SUBSTATEMENT.match(line)
        if section == 1 and option_matches:
            for option in option_matches:
                options.append({"key": option.group(1).upper(), "text": option.group(2).strip(), "order_index": len(options)})
        elif section == 2 and substatement:
            statements.append({"key": substatement.group(1).lower(), "text": substatement.group(2).strip(), "order_index": len(statements)})
        elif section == 2 and statements:
            # Wrapped fractions/equations belong to the current a/b/c/d item.
            statements[-1]["text"] = f"{statements[-1]['text']}\n{line}".strip()
        elif not substatement:
            statement.append(line)
    if section == 1:
        # Labels a/b/c/d in math notation or true/false items must not be read as
        # uppercase multiple-choice options. Keep only unique, non-empty labels;
        # the original source text and warning preserve any incomplete layout.
        unique_options: list[dict[str, Any]] = []
        seen_option_keys: set[str] = set()
        for option in options:
            if option["key"] in seen_option_keys or not option["text"]:
                continue
            seen_option_keys.add(option["key"])
            unique_options.append({**option, "order_index": len(unique_options)})
        return "multiple_choice", "\n".join(statement).strip(), unique_options, statements
    if section == 2:
        return "true_false", "\n".join(statement).strip(), options, statements
    return "short_answer", "\n".join(statement).strip(), options, statements


def ingest(
    pdf_path: Path,
    output_dir: Path,
    dpi: int = 180,
    *,
    source_id: str | None = None,
    source_kind: str = "exam",
    topic: str | None = None,
    canonical_title: str | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    if not pdf_path.is_file():
        raise IngestionError(f"PDF does not exist: {pdf_path}")
    if pdf_path.suffix.lower() != ".pdf":
        raise IngestionError("Input must be a PDF file.")
    with pdf_path.open("rb") as source:
        if source.read(5) != b"%PDF-":
            raise IngestionError("Input does not have a valid PDF header.")
        source.seek(0)
        source_sha256 = hashlib.file_digest(source, "sha256").hexdigest()

    try:
        pdf = pdfplumber.open(pdf_path, unicode_norm=None)
    except Exception as error:
        raise IngestionError(f"Could not parse PDF: {error}") from error
    with pdf:
        if not pdf.pages:
            raise IngestionError("PDF contains no pages.")
        page_count = len(pdf.pages)
        text_extraction_started = time.perf_counter()
        question_fragments, answer_lines, warnings = (
            _topic_segments(pdf) if source_kind == "topic_practice" else _segments(pdf)
        )
        if source_kind == "exam":
            seen_source_numbers: dict[int, set[int]] = defaultdict(set)
            for question in question_fragments:
                section_number = int(question["section_number"])
                source_number = int(question["question_number"])
                if source_number in seen_source_numbers[section_number]:
                    question.setdefault("segmentation_warnings", []).append("duplicate_source_question_number_boundary_uncertain")
                    warnings.append(
                        f"Repeated source question number {source_number} in Part {section_number}; possible alternate form or solution restatement."
                    )
                seen_source_numbers[section_number].add(source_number)
        answer_key = _answer_key(answer_lines)
        text_extraction_ms = round((time.perf_counter() - text_extraction_started) * 1000)
        output_dir.mkdir(parents=True, exist_ok=True)
        source_document = pdf_path.resolve().relative_to(ROOT).as_posix() if pdf_path.resolve().is_relative_to(ROOT) else pdf_path.name
        is_fixture = pdf_path.name == "demo-ingestion-fixture.pdf"
        source_type = "generated" if is_fixture else ("practice_book" if source_kind == "topic_practice" else "official_exam")
        first_page_text = pdf.pages[0].extract_text() or ""
        is_official_exam = source_kind == "exam" or bool(re.search(r"ĐỀ\s*CHÍNH\s*THỨC", first_page_text, re.I))
        if not is_fixture and not is_official_exam:
            source_type = "practice_book"
        source_year_match = re.search(r"20\d{2}", first_page_text)
        source_year = int(source_year_match.group()) if source_year_match and not is_fixture else None
        set_id = str(uuid.uuid5(SET_NAMESPACE, source_document))
        preserved_review: dict[str, dict[str, Any]] = {}
        preserved_by_location: dict[tuple[str, str, int, int], dict[str, Any]] = {}
        try:
            previous_report = json.loads((output_dir / "extraction-report.json").read_text(encoding="utf-8"))
            if previous_report.get("source_sha256") == source_sha256:
                previous_payload = json.loads((output_dir / "questions.json").read_text(encoding="utf-8"))
                preserved_review = {
                    question["id"]: question
                    for question in previous_payload.get("questions", [])
                    if isinstance(question, dict) and isinstance(question.get("id"), str)
                }
                preserved_by_location = {
                    (
                        str(question.get("section") or ""),
                        str(question.get("source_question_number") or question.get("question_number") or ""),
                        int(question.get("source_page") or 0),
                        int(question.get("order_index") or 0),
                    ): question
                    for question in previous_payload.get("questions", [])
                    if isinstance(question, dict)
                }
        except (OSError, json.JSONDecodeError, TypeError):
            preserved_review = {}
        questions_dir = output_dir / "questions"
        illustrations_dir = output_dir / "illustrations"
        source_pages_dir = output_dir / "source-pages"
        questions_dir.mkdir(exist_ok=True)
        illustrations_dir.mkdir(exist_ok=True)
        source_pages_dir.mkdir(exist_ok=True)

        # Render each source page once and reuse it for every crop that touches that page.
        page_images: dict[int, Image.Image] = {}
        last_page_use: dict[int, int] = {}
        for question_index, question in enumerate(question_fragments, start=1):
            for page_index in question["source_pages"]:
                last_page_use[int(page_index)] = question_index
        rendered_bytes = 0
        records: list[dict[str, Any]] = []
        illustration_count = 0
        missing_count = 0
        possibly_missing_count = 0
        multi_page_count = 0
        review_ids: list[str] = []
        section_numbers: dict[int, int] = defaultdict(int)
        crop_count = 0
        page_render_started = time.perf_counter()
        page_reports: list[dict[str, Any]] = []
        answer_key_pages: list[int] = []
        for page_index, page in enumerate(pdf.pages, start=1):
            lines = _page_lines(page)
            page_text = "\n".join(str(line["text"]) for line in lines)
            detected_page_sections = sorted({
                f"part_{_section_number(match.group(1))}"
                for line in lines
                if (match := SECTION_HEADING.match(str(line["text"])))
            })
            is_answer_page = any(ANSWER_HEADING.match(str(line["text"])) for line in lines)
            if is_answer_page:
                answer_key_pages.append(page_index)
            vector_count, embedded_image_count = _layout_visual_evidence(page, 0, float(page.height))
            table_count = 0
            try:
                table_count = len(page.find_tables())
            except Exception:
                warnings.append(f"Page {page_index}: table-layout detection failed; inspect manually.")
            question_markers = [] if is_answer_page else [
                int(match.group(1))
                for line in lines
                if (match := QUESTION_HEADING.match(str(line["text"])))
            ]
            if not page_text.strip():
                warnings.append(f"Page {page_index} contains no extractable text; OCR may be required.")
            page_reports.append({
                "page": page_index,
                "text_extracted": bool(page_text.strip()),
                "text_character_count": len(page_text),
                "sections": detected_page_sections,
                "question_markers": question_markers,
                "answer_key_page": is_answer_page,
                "embedded_images": embedded_image_count,
                "vector_layout_elements": vector_count,
                "tables_detected": table_count,
                "ocr_required": not bool(page_text.strip()),
            })

        for order_index, question in enumerate(question_fragments, start=1):
            section = int(question["section_number"])
            section_numbers[section] += 1
            question_number = section_numbers[section]
            section_key = f"part_{section}"
            key_value = answer_key[section_key].get(str(question_number))
            question_type, statement, options, substatements = _parse_question_type(section, question["text_lines"])
            raw_statement = "\n".join(question["text_lines"])
            explanation = "\n".join(question.get("explanation_lines", [])).strip() or None
            if not statement:
                warnings.append(f"Part {section} question {question_number} has no extracted statement.")
            question_warnings: list[str] = []
            question_warnings.extend(question.get("segmentation_warnings", []))
            question_text = raw_statement
            if re.search(r"\(cid:\d+\)|�", question_text):
                question_warnings.append("unmapped_pdf_glyph")
            if any(
                len(re.findall(r"[A-Za-zÀ-ỹĐđ]", line)) >= 28
                and len(re.findall(r"\s", line)) / max(1, len(line)) < 0.055
                for line in question["text_lines"]
            ):
                question_warnings.append("possible_word_spacing_loss")
            if any(
                line.strip() in {"A", "B", "C", "D", "E", "F", "O", "x", "y", "z"}
                for line in question["text_lines"]
            ):
                question_warnings.append("possible_diagram_label_in_text")
            if section == 1 and len(options) != 4:
                question_warnings.append("multiple_choice_option_count_uncertain")
            if section == 2 and {item["key"] for item in substatements} != set("abcd"):
                question_warnings.append("true_false_substatement_count_uncertain")
            if question_warnings:
                warnings.append(
                    f"Part {section} question {question_number}: "
                    + ", ".join(question_warnings)
                    + "; compare extracted text against source page and crop."
                )

            per_region_visuals: list[tuple[int, dict[str, Any], int, int]] = []
            for region in question["regions"]:
                page_index = int(region["page"])
                page = pdf.pages[page_index - 1]
                vector_count, image_count = _layout_visual_evidence(page, region["top"], region["bottom"])
                per_region_visuals.append((page_index, region, vector_count, image_count))
            vector_count = sum(entry[2] for entry in per_region_visuals)
            image_count = sum(entry[3] for entry in per_region_visuals)
            visual_required = bool(VISUAL_CUE.search(statement))
            if image_count > 0 or (is_fixture and vector_count >= 3):
                illustration_status = "present"
                illustration_count += 1
            elif visual_required and vector_count >= 3:
                # Vector primitives can be glyphs or equation decoration. Keep the
                # source crop, but require a human to confirm this is a real figure.
                illustration_status = "needs_review"
            elif visual_required:
                illustration_status = "possibly_missing"
                possibly_missing_count += 1
            elif vector_count > 0:
                illustration_status = "needs_review"
            else:
                illustration_status = "not_required"

            crop_parts: list[Image.Image] = []
            for page_index, region, _, _ in per_region_visuals:
                page = pdf.pages[page_index - 1]
                if page_index not in page_images:
                    page_images[page_index] = page.to_image(resolution=dpi, antialias=True).original
                    rendered_bytes += page_images[page_index].width * page_images[page_index].height * 3
                crop_parts.append(_safe_crop(page_images[page_index], float(page.width), region, dpi))
            if not crop_parts:
                raise IngestionError(f"No crop generated for Part {section} question {question_number}.")
            total_height = sum(part.height for part in crop_parts) + max(0, len(crop_parts) - 1) * 14
            combined = Image.new("RGB", (max(part.width for part in crop_parts), total_height), "white")
            y = 0
            for part in crop_parts:
                combined.paste(part, (0, y))
                y += part.height + 14

            image_name = f"q{order_index:02d}.png"
            image_path = questions_dir / image_name
            combined.save(image_path, format="PNG", optimize=False)
            crop_count += 1
            if illustration_status == "present":
                combined.save(illustrations_dir / image_name, format="PNG", optimize=False)
            if len(question["source_pages"]) > 1:
                multi_page_count += 1

            correct_answer: dict[str, Any] | None = None
            if key_value is not None:
                if question_type == "multiple_choice":
                    correct_answer = {"type": "multiple_choice", "option_key": key_value}
                elif question_type == "true_false":
                    correct_answer = {"type": "true_false", "statements": key_value}
                else:
                    correct_answer = {"type": "short_answer", "accepted_values": [key_value], "case_sensitive": False}
            source_question_number = str(question.get("question_number", question_number))
            source_location = ",".join(str(page_number) for page_number in question["source_pages"])
            stable_id = str(uuid.uuid5(
                uuid.UUID(set_id),
                f"{source_sha256}:{section_key}:{source_question_number}:{source_location}:{order_index}",
            ))
            if illustration_status in {"possibly_missing", "missing", "needs_review"} or not statement or correct_answer is None or question_warnings:
                review_ids.append(stable_id)
            illustration_prompt_match = re.search(r"HƯỚNG DẪN AI\s+GEN\s+HÌNH ẢNH.*", raw_statement, re.I | re.S)
            records.append(
                {
                    "id": stable_id,
                    "problem_set_id": set_id,
                    "section": section_key,
                    "question_number": str(question_number),
                    "order_index": order_index,
                    "statement": statement,
                    "raw_statement": raw_statement,
                    "display_statement_vi": statement or raw_statement,
                    "display_statement_en": "",
                    "question_type": question_type,
                    "options": options,
                    "raw_options": options,
                    "display_options_vi": options,
                    "display_options_en": [{**option, "text": ""} for option in options],
                    "substatements": substatements,
                    "raw_true_false_statements": substatements,
                    "display_true_false_statements_vi": substatements,
                    "display_true_false_statements_en": [{**item, "text": ""} for item in substatements],
                    "correct_answer": correct_answer,
                    "answer_provenance": "source_answer_key" if correct_answer is not None else "missing",
                    "explanation": explanation,
                    "raw_explanation": explanation,
                    "display_explanation_vi": explanation,
                    "display_explanation_en": "",
                    "raw_short_answer_prompt": raw_statement if question_type == "short_answer" else "",
                    "display_short_answer_prompt_vi": (statement or raw_statement) if question_type == "short_answer" else "",
                    "display_short_answer_prompt_en": "",
                    "translation_status": "not_started",
                    "content_review_status": "needs_review",
                    "edited_at": None,
                    "edited_by": None,
                    "content_approved_at": None,
                    "translation_approved_at": None,
                    "translation_approved_by": None,
                    "explanation_provenance": "source_solution" if explanation else None,
                    "raw_answer": key_value,
                    "topic": topic,
                    "difficulty": None,
                    "tags": ["synthetic-fixture"] if is_fixture else ([topic] if topic else []),
                    "source_document": source_document,
                    "source_file_hash": source_sha256,
                    "source_page": int(question["source_pages"][0]),
                    "source_pages": list(question["source_pages"]),
                    "source_page_images": [f"source-pages/page-{page_number:02d}.png" for page_number in question["source_pages"]],
                "source_question_number": source_question_number,
                "source_id": source_id or ("synthetic-fixture" if is_fixture else pdf_path.stem),
                "source_type": source_type,
                    "provenance_status": "source_imported",
                    "publication_rights_status": "unknown",
                    "review_status": "needs_review",
                    "publication_status": "draft",
                    "image_path": f"questions/{image_name}",
                    "illustration_prompt": illustration_prompt_match.group(0).strip() if illustration_prompt_match else None,
                    "illustration_status": illustration_status,
                    "extraction_status": "needs_review" if stable_id in review_ids else "extracted",
                    "extraction_warnings": question_warnings,
                    "local_review_status": "pending",
                }
            )

            for page_index in question["source_pages"]:
                if last_page_use.get(int(page_index)) == order_index:
                    page_images.pop(int(page_index), None)

        for record in records:
            previous = preserved_review.get(record["id"]) or preserved_by_location.get(
                (
                    str(record.get("section") or ""),
                    str(record.get("source_question_number") or record.get("question_number") or ""),
                    int(record.get("source_page") or 0),
                    int(record.get("order_index") or 0),
                )
            )
            if previous is None:
                continue
            if previous.get("local_review_status") in {"pending", "approved", "needs_review"}:
                record["local_review_status"] = previous["local_review_status"]
            if isinstance(previous.get("statement"), str) and previous["statement"].strip():
                record["statement"] = previous["statement"]
            for field in (
                "raw_statement", "raw_options", "raw_true_false_statements",
                "raw_short_answer_prompt", "raw_explanation",
            ):
                if field in previous:
                    record[field] = previous[field]
            for field in (
                "display_statement_vi", "display_statement_en", "display_options_vi",
                "display_options_en", "display_true_false_statements_vi",
                "display_true_false_statements_en", "display_short_answer_prompt_vi",
                "display_short_answer_prompt_en", "display_explanation_vi",
                "display_explanation_en", "translation_status", "content_review_status",
                "edited_at", "edited_by", "content_approved_at",
                "translation_approved_at", "translation_approved_by",
            ):
                if field in previous:
                    record[field] = previous[field]
            previous_answer = previous.get("correct_answer")
            if previous_answer is None or isinstance(previous_answer, dict):
                record["correct_answer"] = previous_answer

        import_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        import_payload = {
            "format_version": 1,
            "problem_set": {
                "id": set_id,
                "slug": output_dir.name,
                "title": "MathPath Synthetic PDF Ingestion Fixture" if is_fixture else (canonical_title or f"Bộ đề nhập thử: {pdf_path.name}"),
                "description": FIXTURE_LABEL if is_fixture else "Nhập cục bộ để kiểm chứng pipeline Phase 6B. Quyền sử dụng chưa được xác minh.",
                "language": "vi",
                "category": "comprehensive" if is_fixture else ("topic_review" if source_kind == "topic_practice" else "mock_exam"),
                "source_type": source_type,
                "source_year": source_year,
                "timing_mode": "elapsed" if is_fixture or source_kind == "topic_practice" else "countdown",
                "time_limit_seconds": None if is_fixture or source_kind == "topic_practice" else 5400,
                "estimated_duration_seconds": None if is_fixture or source_kind == "topic_practice" else 5400,
                "exam_metadata": {"fixture_label": FIXTURE_LABEL, "synthetic": True} if is_fixture else {"source_file_hash": source_sha256, "source_page_count": page_count, "source_id": source_id, "source_kind": source_kind, "topic": topic},
                    "source_id": source_id or ("synthetic-fixture" if is_fixture else pdf_path.stem),
                "source_kind": source_kind,
                "topic": topic,
                "exact_source_filename": pdf_path.name,
                "source_title": first_page_text[:1000].strip() or None,
                "source_document": source_document,
                "provenance_status": "source_imported",
                "publication_rights_status": "unknown",
                "review_status": "needs_review",
                "publication_status": "unpublished",
            },
            "questions": records,
        }
        (output_dir / "questions.json").write_text(
            json.dumps(import_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (output_dir / "answer-key.json").write_text(
            json.dumps(answer_key, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

        if is_fixture and len(question_fragments) != 7:
            warnings.append(f"Expected 7 fixture questions; detected {len(question_fragments)}.")
        if is_fixture and any(len(item["source_pages"]) > 1 for item in question_fragments) is False:
            warnings.append("No multi-page question was detected.")
        detected_sections = [
            {"section": f"part_{number}", "question_count": section_numbers[number]}
            for number in (1, 2, 3)
            if section_numbers[number]
        ]
        crop_generation_ms = round((time.perf_counter() - page_render_started) * 1000)
        # Save each complete source page once so reviewers can compare original layout with crops.
        source_page_render_started = time.perf_counter()
        for page_index, page in enumerate(pdf.pages, start=1):
            page.to_image(resolution=100, antialias=True).original.save(
                source_pages_dir / f"page-{page_index:02d}.png", format="PNG", optimize=False
            )
        expected_question_assets = {f"q{index:02d}.png" for index in range(1, crop_count + 1)}
        expected_illustration_assets = {
            Path(record["image_path"]).name
            for record in records if record["illustration_status"] == "present"
        }
        expected_source_pages = {f"page-{index:02d}.png" for index in range(1, page_count + 1)}
        for directory, expected, pattern in (
            (questions_dir, expected_question_assets, re.compile(r"^q\d{2}\.png$")),
            (illustrations_dir, expected_illustration_assets, re.compile(r"^q\d{2}\.png$")),
            (source_pages_dir, expected_source_pages, re.compile(r"^page-\d{2}\.png$")),
        ):
            for existing_asset in directory.iterdir():
                if pattern.match(existing_asset.name) and existing_asset.name not in expected:
                    existing_asset.unlink()
        source_page_render_ms = round((time.perf_counter() - source_page_render_started) * 1000)
        report = {
            "status": "completed_with_review_items" if review_ids or warnings else "completed",
            "fixture_label": FIXTURE_LABEL if is_fixture else None,
            "pdf_path": source_document,
            "source_filename": pdf_path.name,
            "source_id": source_id,
            "source_kind": source_kind,
            "topic": topic,
            "source_title": first_page_text[:1000].strip() or None,
            "source_sha256": source_sha256,
            "page_count": page_count,
            "import_timestamp": import_timestamp,
            "parser": {"name": "mathpath-pdf-ingestion", "version": "0.6.0", "library": "pdfplumber"},
            "ocr_status": "not_required" if all(page["text_extracted"] for page in page_reports) else "required_for_pages_with_no_text",
            "page_reports": page_reports,
            "answer_key_pages": answer_key_pages,
            "detected_sections": detected_sections,
            "questions_detected": len(records),
            "source_question_pages": [
                {"section": record["section"], "question_number": record["question_number"], "source_pages": record["source_pages"]}
                for record in records
            ],
            "source_pages": {record["id"]: record["source_pages"] for record in records},
            "answer_key_count": sum(len(values) for values in answer_key.values()),
            "answers_extracted": sum(len(values) for values in answer_key.values()),
            "explanations_extracted": sum(record["explanation"] is not None for record in records),
            "contradictory_answer_count": None,
            "contradictory_answers_checked": False,
            "answers_missing": [
                {"section": record["section"], "question_number": record["question_number"]}
                for record in records if record["correct_answer"] is None
            ],
            "answer_provenance_breakdown": {
                value: sum(record["answer_provenance"] == value for record in records)
                for value in ("source_answer_key", "source_solution", "ai_generated_source_solution", "manually_verified", "missing", "unknown")
            },
            "question_images_generated": crop_count,
            "illustrations_present": illustration_count,
            "illustrations_missing": missing_count,
            "illustrations_possibly_missing": possibly_missing_count,
            "illustrations_needs_review": sum(record["illustration_status"] == "needs_review" for record in records),
            "multi_page_questions": multi_page_count,
            "source_page_images_generated": page_count,
            "needs_review": review_ids,
            "questions_requiring_review": [record["id"] for record in records if record["review_status"] == "needs_review"],
            "warnings": warnings,
            "errors": [],
            "render_dpi": dpi,
            "unique_pages_rendered": len(page_images),
            "approx_rendered_rgb_megabytes": round(rendered_bytes / (1024 * 1024), 2),
            "text_extraction_ms": text_extraction_ms,
            "crop_generation_ms": crop_generation_ms,
            "source_page_render_ms": source_page_render_ms,
            "processing_time_ms": round((time.perf_counter() - started) * 1000),
        }
        (output_dir / "extraction-report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        # Re-read and validate generated JSON without allowing NaN/Infinity serialization.
        json.loads((output_dir / "questions.json").read_text(encoding="utf-8"))
        return report


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    if len(sys.argv) < 3:
        print("Usage: python scripts/pdf_ingestion.py INPUT.pdf OUTPUT_DIR [DPI]", file=sys.stderr)
        return 2
    input_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()
    try:
        report = ingest(input_path, output_path, int(sys.argv[3]) if len(sys.argv) > 3 else 180)
    except (IngestionError, ValueError) as error:
        print(json.dumps({"status": "failed", "pdf_path": str(input_path), "errors": [str(error)]}, ensure_ascii=False), file=sys.stderr)
        return 1
    except Exception as error:  # Keep malformed/unexpected PDFs from producing partial success output.
        print(json.dumps({"status": "failed", "pdf_path": str(input_path), "errors": [f"{type(error).__name__}: {error}"]}, ensure_ascii=False), file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

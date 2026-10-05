"""Discover and import MathPath's local real-source PDFs as review-only drafts."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import sys
import time
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "content" / "source"
OUTPUT_DIR = ROOT / "content" / "extracted"
EXPECTED = [*(f"d{number}" for number in range(1, 11)), "dao_ham", "nguyen_ham"]
TOPIC_TITLES = {"dao_ham": ("Ôn tập Đạo hàm", "Đạo hàm"), "nguyen_ham": ("Ôn tập Nguyên hàm", "Nguyên hàm")}
TOPIC_PRACTICE_CONFIG = {
    "selection_strategy": "random_by_question_type",
    "target_question_count": 40,
    "question_distribution": {"multiple_choice": 25, "true_false": 8, "short_answer": 7},
    "points_per_question": 0.25,
    "total_score": 10,
    "approved_questions_only": True,
}
SKIP_DIRS = {".git", "node_modules", ".next", "content", "dist", "out"}


def _normalized_stem(stem: str) -> str:
    return re.sub(r"[\s_-]+", "_", stem.strip().casefold())


def discover_sources() -> tuple[list[dict[str, Any]], list[str]]:
    candidates: list[Path] = []
    for directory, child_dirs, files in os.walk(ROOT, topdown=True, followlinks=False):
        child_dirs[:] = [name for name in child_dirs if name.casefold() not in SKIP_DIRS]
        candidates.extend(Path(directory) / name for name in files)
    records: list[dict[str, Any]] = []
    errors: list[str] = []
    for source_id in EXPECTED:
        matches = [path for path in candidates if _normalized_stem(path.stem) == source_id]
        if len(matches) != 1:
            status = "missing" if not matches else "ambiguous"
            errors.append(f"{source_id}: expected one file, found {len(matches)}.")
            records.append({"source_id": source_id, "source_type": "topic_practice" if source_id in TOPIC_TITLES else "exam", "status": status, "matches": [path.relative_to(ROOT).as_posix() for path in matches]})
            continue
        path = matches[0]
        with path.open("rb") as source_file:
            digest = hashlib.file_digest(source_file, "sha256").hexdigest()
        records.append(
            {
                "source_id": source_id,
                "exact_filename": path.name,
                "exact_path": str(path.resolve()),
                "repository_relative_path": path.relative_to(ROOT).as_posix(),
                "extension": path.suffix.lower(),
                "file_size": path.stat().st_size,
                "file_hash": digest,
                "source_type": "topic_practice" if source_id in TOPIC_TITLES else "exam",
                "status": "discovered",
                "matching_rule": "normalized-space-underscore" if path.stem != source_id else "exact-base-name",
            }
        )
    return records, errors


def _load_ingestor():
    script = ROOT / "scripts" / "pdf_ingestion.py"
    spec = importlib.util.spec_from_file_location("mathpath_pdf_ingestion", script)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the PDF ingestion module.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _source_metadata(path: Path) -> dict[str, Any]:
    try:
        import pdfplumber

        with pdfplumber.open(path, unicode_norm=None) as pdf:
            text = "\n".join(
                "\n".join(str(line.get("text", "")) for line in page.extract_text_lines(layout=False, strip=True, x_tolerance=2.5) or [])
                for page in pdf.pages[:2]
            )
            page_count = len(pdf.pages)
    except Exception as error:
        return {"source_title": None, "school": None, "school_year": None, "page_count": None, "metadata_error": f"{type(error).__name__}: {error}"}
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    title_pattern = re.compile(
        r"(?:ĐỀ\s+(?:THI|KIỂM TRA|ĐÁNH GIÁ|ĐỊNH KỲ)|KỲ\s+(?:THI|KIỂM TRA)|BÀI\s+KIỂM TRA)",
        re.I,
    )
    title_candidates = [line for line in lines if title_pattern.search(line)]
    title = next(
        (line for line in title_candidates if re.search(r"\b(?:SỞ|TRƯỜNG)\b", line, re.I)),
        title_candidates[0] if title_candidates else None,
    )
    if title is None:
        title = next((line for line in lines if re.search(r"(?:HÀM SỐ|NGUYÊN HÀM|ĐẠO HÀM|CHUYÊN ĐỀ|BÀI TẬP)", line, re.I)), None)
    schools = list(dict.fromkeys(re.findall(r"TRƯỜNG\s+[^\n]{2,100}", text, re.I)))
    year_match = re.search(r"20\d{2}\s*[–-]\s*20\d{2}|20\d{2}", text)
    return {
        "source_title": title,
        "school": schools or None,
        "school_year": year_match.group(0).strip() if year_match else None,
        "page_count": page_count,
    }


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _failure_output(record: dict[str, Any], metadata: dict[str, Any], error: str) -> dict[str, Any]:
    source_id = record["source_id"]
    output = OUTPUT_DIR / source_id
    output.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    title, topic = TOPIC_TITLES.get(source_id, (metadata.get("source_title") or f"Chưa xác định tên đề {source_id}", None))
    empty_answers = {"part_1": {}, "part_2": {}, "part_3": {}}
    _write_json(output / "answer-key.json", empty_answers)
    payload = {
        "format_version": 1,
        "problem_set": {
            "id": str(__import__("uuid").uuid5(__import__("uuid").NAMESPACE_URL, record.get("file_hash", source_id))),
            "slug": source_id,
            "title": title,
            "description": "Nguồn chưa phân đoạn được; nội dung chưa được công bố.",
            "language": "vi",
            "category": "topic_review" if topic else "mock_exam",
            "source_type": "practice_book" if topic else "official_exam",
            "source_year": None,
            "timing_mode": "elapsed" if topic else "countdown",
            "time_limit_seconds": None if topic else 5400,
            "estimated_duration_seconds": None if topic else (5400 if metadata.get("page_count") else None),
            "exam_metadata": {"source_id": source_id, "source_file_hash": record.get("file_hash"), "source_page_count": metadata.get("page_count"), "processing_error": error},
            "source_document": record.get("repository_relative_path"),
            "source_id": source_id,
            "source_kind": record["source_type"],
            "topic": topic,
            "exact_source_filename": record.get("exact_filename"),
            "source_title": metadata.get("source_title"),
            "provenance_status": "source_imported",
            "publication_rights_status": "unknown",
            "review_status": "needs_review",
            "publication_status": "unpublished",
        },
        "questions": [],
    }
    _write_json(output / "questions.json", payload)
    report = {
        "status": "failed_needs_manual_review",
        "source_id": source_id,
        "source_filename": record.get("exact_filename"),
        "source_document": record.get("repository_relative_path"),
        "source_sha256": record.get("file_hash"),
        "import_timestamp": now,
        "page_count": metadata.get("page_count"),
        "questions_detected": 0,
        "detected_sections": [],
        "answers_extracted": 0,
        "explanations_extracted": 0,
        "illustrations_present": 0,
        "illustrations_missing": 0,
        "incomplete_text_count": metadata.get("page_count") or 0,
        "contradictory_answer_count": None,
        "contradictory_answers_checked": False,
        "needs_review_count": 0,
        "ocr_status": "required_but_unavailable" if "No sectioned questions" in error else "not_run",
        "warnings": [error],
        "errors": [error],
    }
    _write_json(output / "extraction-report.json", report)
    metadata_file = output / ("problem-set.json" if topic else "exam.json")
    meta_payload = {
        "source_id": source_id,
        "exact_source_filename": record.get("exact_filename"),
        "exact_source_path": record.get("exact_path"),
        "title": title,
        "source_title": metadata.get("source_title"),
        "school": metadata.get("school"),
        "school_year": metadata.get("school_year"),
        "source_type": record["source_type"],
        "topic": topic,
        "page_count": metadata.get("page_count"),
        "sections": [],
        "question_count": 0,
        "publication_status": "draft",
        "processing_status": report["status"],
        **(TOPIC_PRACTICE_CONFIG if topic else {}),
        "approved_question_count": 0 if topic else None,
    }
    _write_json(metadata_file, meta_payload)
    for folder in ("questions", "illustrations"):
        (output / folder).mkdir(exist_ok=True)
    return report


def _write_source_metadata(source: dict[str, Any], report: dict[str, Any], meta: dict[str, Any]) -> None:
    source_id = source["source_id"]
    output = OUTPUT_DIR / source_id
    topic_title, topic = TOPIC_TITLES.get(source_id, (None, None))
    imported = json.loads((output / "questions.json").read_text(encoding="utf-8"))
    sections = report.get("detected_sections", [])
    metadata = {
        "source_id": source_id,
        "exact_source_filename": source["exact_filename"],
        "exact_source_path": source["exact_path"],
        "title": topic_title or meta.get("source_title") or imported["problem_set"].get("title"),
        "source_title": meta.get("source_title"),
        "school": meta.get("school"),
        "school_year": meta.get("school_year"),
        "source_type": source["source_type"],
        "topic": topic,
        "sections": sections,
        "question_count": report.get("questions_detected", 0),
        "scoring_configuration": {"time_limit_seconds": 5400, "score_by_section": None} if not topic else {
            "points_per_question": TOPIC_PRACTICE_CONFIG["points_per_question"],
            "total_score": TOPIC_PRACTICE_CONFIG["total_score"],
            "question_distribution": TOPIC_PRACTICE_CONFIG["question_distribution"],
        },
        "publication_status": "draft",
        "processing_status": report.get("status"),
    }
    if topic:
        metadata.update({**TOPIC_PRACTICE_CONFIG, "approved_question_count": 0})
    _write_json(output / ("problem-set.json" if topic else "exam.json"), metadata)
    _write_json(output / "exam.json", metadata) if not topic else None
    report.update({"source_id": source_id, "source_type": source["source_type"], "source_title": meta.get("source_title"), "school": meta.get("school"), "school_year": meta.get("school_year"), "contradictory_answer_count": None, "contradictory_answers_checked": False, "explanations_extracted": report.get("explanations_extracted", 0)})
    _write_json(output / "extraction-report.json", report)


def _summarize(source: dict[str, Any], report: dict[str, Any] | None, metadata: dict[str, Any]) -> dict[str, Any]:
    report = report or {}
    questions_path = OUTPUT_DIR / source["source_id"] / "questions.json"
    questions: list[dict[str, Any]] = []
    try:
        payload = json.loads(questions_path.read_text(encoding="utf-8"))
        questions = payload.get("questions", []) if isinstance(payload, dict) else []
    except (OSError, json.JSONDecodeError):
        pass
    if not questions:
        correct_answer_count = report.get("answers_extracted", 0)
        review_count = report.get("questions_detected", 0)
        approved_count = 0
        draft_count = review_count
    else:
        correct_answer_count = sum(question.get("correct_answer") is not None for question in questions)
        review_count = sum(question.get("review_status") == "needs_review" for question in questions)
        approved_count = sum(question.get("local_review_status") == "approved" for question in questions)
        draft_count = sum(question.get("publication_status") == "draft" for question in questions)
    warnings = report.get("warnings", [])
    return {
        "source_id": source["source_id"],
        "exact_filename": source.get("exact_filename"),
        "exact_path": source.get("exact_path"),
        "source_type": source["source_type"],
        "title": TOPIC_TITLES.get(source["source_id"], (metadata.get("source_title"),))[0] or metadata.get("source_title"),
        "page_count": report.get("page_count", metadata.get("page_count")),
        "question_count": report.get("questions_detected", 0),
        "section_breakdown": report.get("detected_sections", []),
        "answer_count": correct_answer_count,
        "missing_answer_count": max(0, len(questions) - correct_answer_count) if questions else len(report.get("answers_missing", [])),
        "explanation_count": report.get("explanations_extracted", 0),
        "illustration_count": report.get("illustrations_present", 0),
        "missing_illustration_count": report.get("illustrations_missing", 0) + report.get("illustrations_possibly_missing", 0) + report.get("illustrations_needs_review", 0),
        "incomplete_text_count": report.get(
            "incomplete_text_count",
            sum(
                any(
                    token in " ".join(question.get("extraction_warnings", []))
                    for token in (
                        "unmapped_pdf_glyph",
                        "possible_word_spacing_loss",
                        "option_count_uncertain",
                        "substatement_count_uncertain",
                        "suspicious_question_boundary",
                    )
                )
                for question in questions
            ),
        ),
        "contradictory_answer_count": report.get("contradictory_answer_count"),
        "needs_review_count": review_count,
        "approved_count": approved_count,
        "draft_count": draft_count,
        "conflict_count": report.get("contradictory_answer_count"),
        "processing_time_ms": report.get("processing_time_ms"),
        "processing_status": report.get("status", source.get("status", "not_processed")),
        "warning_count": len(warnings),
        "warnings": warnings[:8],
    }


def run() -> int:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sources, discovery_errors = discover_sources()
    discovered_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    _write_json(SOURCE_DIR / "manifest.json", {"manifest_version": 1, "discovered_at": discovered_at, "sources": sources, "errors": discovery_errors})
    module = _load_ingestor()
    summaries: list[dict[str, Any]] = []
    for source in sources:
        source_id = source["source_id"]
        if source.get("status") != "discovered":
            summaries.append(_summarize(source, None, {}))
            continue
        file_path = Path(source["exact_path"])
        output = OUTPUT_DIR / source_id
        metadata = _source_metadata(file_path)
        existing_report_path = output / "extraction-report.json"
        existing_questions_path = output / "questions.json"
        try:
            existing_report = json.loads(existing_report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            existing_report = None
        if (
            isinstance(existing_report, dict)
            and existing_report.get("source_sha256") == source.get("file_hash")
            and existing_report.get("parser", {}).get("version") == "0.6.0"
            and existing_questions_path.is_file()
        ):
            report = existing_report
            if report.get("status") not in {"failed_needs_manual_review", "failed"}:
                _write_source_metadata(source, report, metadata)
            summaries.append(_summarize(source, report, metadata))
            continue
        if file_path.suffix.lower() != ".pdf":
            report = _failure_output(source, metadata, f"Unsupported file extension: {file_path.suffix}")
        else:
            canonical_title, topic = TOPIC_TITLES.get(source_id, (None, None))
            started = time.perf_counter()
            try:
                report = module.ingest(
                    file_path,
                    output,
                    source_id=source_id,
                    source_kind=source["source_type"],
                    topic=topic,
                    canonical_title=canonical_title,
                )
                report["processing_time_ms"] = round((time.perf_counter() - started) * 1000)
                _write_source_metadata(source, report, metadata)
            except Exception as error:
                report = _failure_output(source, metadata, f"{type(error).__name__}: {error}")
        summaries.append(_summarize(source, report, metadata))

    manifest = {
        "manifest_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "all_sources_review_only": True,
        "publication_status": "draft",
        "sources": summaries,
        "discovery_errors": discovery_errors,
        "total_question_count": sum(item["question_count"] for item in summaries),
        "total_review_required_count": sum(item["needs_review_count"] for item in summaries),
        "processing_status": "completed_with_review_items" if all(item["processing_status"] in {"completed", "completed_with_review_items"} for item in summaries) else "partial_with_failures",
    }
    _write_json(OUTPUT_DIR / "manifest.json", manifest)
    print(json.dumps({key: value for key, value in manifest.items() if key != "sources"} | {
        "sources": [{key: source.get(key) for key in ("source_id", "exact_filename", "question_count", "answer_count", "needs_review_count", "processing_status")} for source in summaries]
    }, ensure_ascii=False, indent=2))
    return 0 if not discovery_errors else 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(run())

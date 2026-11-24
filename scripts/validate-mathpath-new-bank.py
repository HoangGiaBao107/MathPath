#!/usr/bin/env python3
"""Validate the private build and public PDF/figure package without printing keys."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pymupdf as fitz


ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / "tmp/mathpath-new-bank-private"
ASSET_ROOT = ROOT / "public/problem-assets/mathpath-new-20261124"
SOURCE_PDFS = ROOT / "MATHPATH_NEW/input/source_package/source_pdfs"


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def key_text(value: str):
    return (
        value.replace("\uf02b", "+")
        .replace("\uf02d", "−")
        .replace("\uf03d", "=")
        .replace("\uf070", "π")
        .replace("\uf028", "(")
        .replace("\uf029", ")")
        .replace("\uf0a2", "′")
        .replace("$", "")
    )


def compact(value: str):
    return re.sub(r"\s+", "", key_text(value)).replace("−", "-")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cycle", type=int, default=0)
    args = parser.parse_args()
    errors = []
    add = lambda code, uid="": errors.append(f"{code}:{uid}" if uid else code)

    patch = read(Path.home() / "Downloads/MathPath_18_de_MASTER_PATCH_for_Codex.json")
    layout = read(ROOT / "MATHPATH_NEW/data/questions_source_layout.json")
    runtime = read(PRIVATE / "runtime-exams.json")
    build = read(PRIVATE / "build-qa.json")
    private_inputs = read(PRIVATE / "build-private-inputs.json")
    layout_by_uid = {item["uid"]: item for item in layout["questions"]}
    exams_by_id = {exam["id"]: exam for exam in runtime}
    questions = [question for exam in runtime for question in exam["questions"]]
    questions_by_uid = {question["source_id"]: question for question in questions}
    patch_exam_ids = {exam["exam_id"] for exam in patch["exam_manifest"]}

    if len(runtime) != 18 or set(exams_by_id) != patch_exam_ids:
        add("EXAM_MANIFEST")
    if len(questions) != 594 or len(questions_by_uid) != 594:
        add("QUESTION_COUNT_OR_DUPLICATE")
    if build.get("runtime_question_count") != 594:
        add("BUILD_COUNT")
    if build.get("answers_independently_derived") is not False:
        add("ANSWER_PROVENANCE")

    expected_asset_paths = set()
    page_checks = 0
    rendered_pages = 0
    key_checks = 0
    manual_key_checks = 0
    practice_keys = {item["question_uid"]: item for item in patch["practice_source_keys"]}
    if len(practice_keys) != 440:
        add("PRACTICE_KEY_COUNT")

    for exam in runtime:
        manifest = next(item for item in patch["exam_manifest"] if item["exam_id"] == exam["id"])
        if len(exam["questions"]) != manifest["expected_question_count"]:
            add("EXAM_QUESTION_COUNT", exam["id"])
        if exam["id"].startswith("THI_"):
            types = Counter(question["type"] for question in exam["questions"])
            if types != Counter({"multiple_choice": 12, "true_false": 4, "short_answer": 6}):
                add("MOCK_STRUCTURE", exam["id"])
        elif len(exam["questions"]) != 40:
            add("PRACTICE_STRUCTURE", exam["id"])

        pdf_path = ASSET_ROOT / "exams" / f"{exam['id']}.pdf"
        try:
            pdf = fitz.open(pdf_path)
        except Exception:
            add("EXAM_PDF_MISSING", exam["id"])
            continue
        mapped_pages = []
        for question in exam["questions"]:
            uid = question["source_id"]
            qtype = question["type"]
            if qtype == "multiple_choice":
                if [option["key"] for option in question["options"]] != list("ABCD"):
                    add("OPTIONS_NOT_A_TO_D", uid)
                if question.get("correctOptionKey") not in "ABCD":
                    add("MC_KEY_INVALID", uid)
            elif qtype == "true_false":
                if set(question.get("correctStatements", {})) != set("abcd"):
                    add("TF_KEY_SHAPE", uid)
                if len(question.get("statements", [])) != 4 or not question.get("scoring"):
                    add("TF_STRUCTURE", uid)
            elif qtype == "short_answer":
                if not question.get("canonicalAnswer") or not question.get("acceptedNormalizedAnswers"):
                    add("SHORT_KEY_EMPTY", uid)
                policy = question.get("inputPolicy") or {}
                if policy.get("kind") not in {"numeric", "expression", "text"}:
                    add("SHORT_POLICY", uid)
            else:
                add("QUESTION_TYPE", uid)

            figure_rows = question.get("figures") or []
            pdf_rows = [row for row in figure_rows if row["url"].endswith(".pdf")]
            if question.get("pdf_page") is None:
                if pdf_rows:
                    add("UNMAPPED_PDF_FIGURE", uid)
                if not question.get("stem", "").strip():
                    add("EMPTY_AUTHORED_STEM", uid)
            else:
                if len(pdf_rows) != 1:
                    add("PDF_FIGURE_COUNT", uid)
                if pdf_rows:
                    match = re.match(r"^\[mp-pdf-page:(\d+)\]", pdf_rows[0]["alt"])
                    if not match or int(match.group(1)) != question["pdf_page"]:
                        add("PDF_PAGE_MAPPING", uid)
                mapped_pages.append(question["pdf_page"])
                try:
                    page = pdf[question["pdf_page"] - 1]
                    text = page.get_text("text")
                    if len(re.sub(r"\s+", "", text)) < 25:
                        add("SOURCE_TEXT_MISSING", uid)
                    if "0946798489" in text or re.search(r"bạn\s+cần.*zalo", text, re.IGNORECASE | re.DOTALL):
                        add("SOURCE_PROMOTION_REMAINS", uid)
                    page_markers = re.findall(r"(?im)^\s*Câu\s+(\d+)\s*[.]", text)
                    if page_markers != [str(question["number"])]:
                        add("EXTRANEOUS_QUESTION_MARKER", uid)
                    pix = page.get_pixmap(matrix=fitz.Matrix(0.18, 0.18), alpha=False)
                    samples = pix.samples
                    channels = pix.n
                    ink = 0
                    for offset in range(0, len(samples), channels):
                        if min(samples[offset : offset + 3]) < 235:
                            ink += 1
                    if ink < max(4, pix.width * pix.height // 500):
                        add("BLANK_SOURCE_PAGE", uid)
                    rendered_pages += 1
                    page_checks += 1
                    if uid == "TD_B01_Q081" and "E." in text:
                        add("OPTION_E_REMAINS", uid)
                except Exception:
                    add("PDF_PAGE_INVALID", uid)

                metadata = question.get("page_metadata") or {}
                for figure in figure_rows:
                    if figure["url"].endswith(".pdf"):
                        continue
                    match = re.match(r"^\[mp-overlay:([\d.,-]+)\]", figure["alt"])
                    if match:
                        coords = [float(value) for value in match[1].split(",")]
                        if len(coords) != 4 or coords[0] < 0 or coords[1] < 0 or coords[2] <= 0 or coords[3] <= 0:
                            add("OVERLAY_GEOMETRY", uid)
                        elif coords[0] + coords[2] > metadata.get("width", 0) + 0.01 or coords[1] + coords[3] > metadata.get("height", 0) + 0.01:
                            add("OVERLAY_OUTSIDE_PAGE", uid)

            for figure in figure_rows:
                if figure["url"].endswith(".pdf"):
                    continue
                relative = figure["url"].lstrip("/")
                expected_asset_paths.add(relative)
                asset_path = ROOT / "public" / relative
                if not asset_path.is_file():
                    add("FIGURE_MISSING", uid)
                else:
                    if figure.get("sha256") and sha(asset_path) != figure["sha256"]:
                        add("FIGURE_HASH", uid)

        if mapped_pages != list(range(1, len(mapped_pages) + 1)) or len(pdf) != len(mapped_pages):
            add("PDF_PAGE_SEQUENCE", exam["id"])
        pdf.close()

    for uid, key in practice_keys.items():
        q = layout_by_uid.get(uid)
        if not q:
            add("KEY_QUESTION_LAYOUT", uid)
            continue
        ref = key["key_reference"]
        try:
            page_number = int(ref["page_reference"])
            key_pdf = fitz.open(SOURCE_PDFS / ref["file"])
            text = key_pdf[page_number - 1].get_text("text", clip=fitz.Rect(ref["bbox"]), sort=True)
            key_pdf.close()
            if compact(text) == compact(str(key["answer"])):
                key_checks += 1
            elif uid == "DH_B05_Q021" and all(
                token in unicodedata.normalize("NFKC", text)
                for token in ("AM", "BN", "12", "20", "√3")
            ):
                key_checks += 1
                manual_key_checks += 1
            else:
                add("KEY_SOURCE_MISMATCH", uid)
        except Exception:
            add("KEY_SOURCE_UNREADABLE", uid)

    mock_key_by_uid = {row["question_uid"]: row for row in patch["answer_records_mock"]}
    replacements = private_inputs["mock_replacements"]
    for uid, row in mock_key_by_uid.items():
        if uid in replacements:
            continue
        question = questions_by_uid.get(uid)
        if not question:
            add("MOCK_KEY_QUESTION", uid)
        elif question["type"] == "multiple_choice" and question.get("correctOptionKey") != row.get("answer"):
            add("MOCK_MC_KEY_MISMATCH", uid)
        elif question["type"] == "true_false" and question.get("correctStatements") != row.get("answer"):
            add("MOCK_TF_KEY_MISMATCH", uid)
        elif question["type"] == "short_answer" and question.get("canonicalAnswer") != str(row.get("answer")):
            add("MOCK_SHORT_KEY_MISMATCH", uid)

    for uid, layout_question in layout_by_uid.items():
        if uid.startswith("THI_") or uid not in questions_by_uid:
            continue
        expected_names = {
            Path(illustration["file"]).name
            for illustration in layout_question.get("illustrations") or []
        }
        if expected_names:
            actual_names = {
                Path(figure["url"]).name
                for figure in questions_by_uid[uid].get("figures", [])
                if not figure["url"].endswith(".pdf")
            }
            if expected_names != actual_names:
                add("NAMED_MOCK_FIGURE_MAPPING", uid)

    actual_assets = {
        path.relative_to(ROOT / "public").as_posix()
        for path in (ASSET_ROOT / "figures").glob("*")
        if path.is_file()
    }
    if actual_assets != expected_asset_paths:
        add("UNREFERENCED_OR_MISSING_ASSETS")
    public_files = {path.suffix.lower() for path in ASSET_ROOT.rglob("*") if path.is_file()}
    if not public_files.issubset({".pdf", ".png", ".jpg", ".jpeg"}):
        add("UNEXPECTED_PUBLIC_FILE_TYPE")
    if key_checks != 440:
        add("KEY_CHECK_TOTAL")

    report = {
        "cycle": args.cycle,
        "exam_count": len(runtime),
        "question_count": len(questions),
        "source_key_cells_checked": key_checks,
        "source_key_cells_visually_resolved": manual_key_checks,
        "public_question_pages_checked": page_checks,
        "public_question_pages_rendered": rendered_pages,
        "named_and_extracted_figures_checked": len(expected_asset_paths),
        "options_removed_from_five_choice_question": "TD_B01_Q081:E",
        "errors": errors,
        "passed": not errors,
    }
    (PRIVATE / f"stress-cycle-{args.cycle:02}.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(2 if errors else 0)


if __name__ == "__main__":
    main()

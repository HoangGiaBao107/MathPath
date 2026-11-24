#!/usr/bin/env python3
"""Build one-question vector PDF pages and private exam runtime data.

The public question PDFs keep the source PDF's selectable text and vector
math. Figure crops are stored separately and placed over the matching source
coordinates by the exam player. Answer records stay in tmp/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
from collections import defaultdict
from pathlib import Path

import pymupdf as fitz


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "MATHPATH_NEW"
DEFAULT_PATCH = Path.home() / "Downloads" / "MathPath_18_de_MASTER_PATCH_for_Codex.json"
ASSET_BASE = Path("problem-assets/mathpath-new-20261124")
PRIVATE_BASE = Path("tmp/mathpath-new-bank-private")
PAGE_WIDTH = 595.28
PAGE_MARGIN = 20.0
PAGE_GAP = 10.0
ARIAL = Path("C:/Windows/Fonts/arial.ttf")
ARIAL_BOLD = Path("C:/Windows/Fonts/arialbd.ttf")


# Exact replacement stems/keys and answer-key layout corrections live only in
# the ignored private-input file under tmp/mathpath-new-bank-private/.
MOCK_REPLACEMENTS = {}
PRACTICE_ANSWER_OVERRIDES = {}
GENERATED_STEM_DISPLAY_OVERRIDES = {
    "SUP_TP_02_016_01": r"Tính độ dài cung của đồ thị $y=\frac{2\sqrt{2}}{3}x^{3/2}$ trên đoạn $0\le x\le1$.",
    "SUP_TP_03_016_01": r"Tính độ dài cung của đồ thị $y=\frac{(x^2+2)^{3/2}}{3}$ trên đoạn $0\le x\le1$.",
    "SUP_TP_03_027_01": r"Trong hệ tọa độ cực, xét miền $D$ nằm bên trong đường $r=2\cos\theta$ và bên ngoài đường $r=\cos\theta$, với $-\frac{\pi}{2}\le\theta\le\frac{\pi}{2}$. Tính diện tích miền $D$.",
    "SUP_XS_02_074_01": r"Trong một hàng của bảng số, ba ô liên tiếp lần lượt ghi $x-1$, $x+2$, $2x+8$, với $x>1$. Biết ba số theo thứ tự đó lập thành một cấp số nhân. Tìm $x$.",
    "SUP_XS_03_042_01": r"Chọn ngẫu nhiên đều một số nguyên $N$ trong tập $\{1,2,3,4,5\}$. Gọi $X$ là số dư khi chia $N^2$ cho $3$. Tính kỳ vọng $\mathbb{E}(X)$.",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def box_union(boxes):
    result = fitz.Rect(boxes[0])
    for box in boxes[1:]:
        result |= fitz.Rect(box)
    return result


def figure_fits_question(record, page_no: int, rect: fitz.Rect, marker_rows_by_page):
    matching_regions = [
        fitz.Rect(region["bbox"])
        for region in record.get("source_regions", [])
        if int(region["page"]) == page_no
    ]
    if not any(region.contains(rect) for region in matching_regions):
        return False

    threshold = (
        fitz.Rect(record["marker_bbox"]).y0
        if int(record.get("start_page") or -1) == page_no
        else min(region.y0 for region in matching_regions)
    )
    next_markers = [
        fitz.Rect(row["marker_bbox"])
        for row in marker_rows_by_page.get((record["source_pdf"], page_no), [])
        if row["uid"] != record["uid"]
        and fitz.Rect(row["marker_bbox"]).y0 > threshold + 1
    ]
    if next_markers and rect.y1 > min(marker.y0 for marker in next_markers) - 2:
        return False
    return True


def question_number(record, exam_type: str) -> str:
    if exam_type == "mock_test":
        return str(record.get("section_question_number") or record["question_number"])
    return str(record["question_number"])


def source_key_value(key: str) -> str:
    return (
        key.replace("\uf02b", "+")
        .replace("\uf02d", "−")
        .replace("\uf03d", "=")
        .replace("\uf070", "π")
        .replace("\uf028", "(")
        .replace("\uf029", ")")
        .replace("\uf0a2", "′")
        .strip()
    )


def normalize_answer_for_storage(value: str) -> str:
    value = source_key_value(value)
    value = value.replace("$", "")
    value = re.sub(r"\\(?:left|right)\s*", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def is_practice_true_false(answer: str) -> bool:
    compact = re.sub(r"\s+", "", source_key_value(answer)).upper()
    return bool(re.fullmatch(r"[DS]{4}", compact))


def parse_practice_true_false(answer: str) -> dict[str, bool]:
    compact = re.sub(r"\s+", "", source_key_value(answer)).upper()
    if not re.fullmatch(r"[DS]{4}", compact):
        raise ValueError(f"Not a four-statement D/S key: {answer!r}")
    return {key: value == "D" for key, value in zip("abcd", compact, strict=True)}


def get_practice_short_answer(uid: str, source_answer: str):
    override = PRACTICE_ANSWER_OVERRIDES.get(uid)
    if override:
        answer = override["answer"]
        policy_kind = override["policy"]
        return (
            answer,
            [answer],
            {"kind": policy_kind, "maxLength": 256},
        )
    answer = normalize_answer_for_storage(source_answer)
    return answer, [answer], infer_input_policy(answer)


def infer_input_policy(answer: str) -> dict:
    candidate = answer.strip().strip("$")
    candidate = candidate.replace("−", "-").replace("π", r"\pi").replace("√", r"\sqrt")
    # Expressions that the bounded exact-expression grader can safely compare.
    if re.search(r"[\\{}()*/^]|sqrt|pi|[−+]", candidate):
        return {"kind": "expression", "maxLength": 256}
    return {"kind": "text", "maxLength": 256}


def extract_mock_figures(source_root: Path, layout_by_uid: dict, active_source_uids: set[str], vector_file: Path, figure_dir: Path, marker_rows_by_page):
    candidates = defaultdict(list)
    excluded = []
    vector_items = read_json(vector_file) if vector_file.exists() else []
    for item in vector_items:
        uid = item.get("uid")
        if uid in active_source_uids and uid in layout_by_uid:
            bbox = fitz.Rect(item["bbox"])
            if not figure_fits_question(
                layout_by_uid[uid], int(item["source_page"]), bbox, marker_rows_by_page
            ):
                excluded.append(uid)
                continue
            candidates[uid].append(
                {
                    "page": int(item["source_page"]),
                    "bbox": item["bbox"],
                    "kind": "vector",
                }
            )

    pdf_root = source_root / "input/source_package/source_pdfs"
    docs = {}
    for uid in sorted(active_source_uids):
        q = layout_by_uid[uid]
        if not uid.startswith("THI_"):
            continue
        source_path = pdf_root / q["source_pdf"]
        doc = docs.setdefault(source_path, fitz.open(source_path) if source_path not in docs else docs[source_path])
        regions = q.get("source_regions", [])
        for page_no in sorted({int(region["page"]) for region in regions}):
            page = doc[page_no - 1]
            page_regions = [fitz.Rect(region["bbox"]) for region in regions if int(region["page"]) == page_no]
            for info in page.get_image_info(xrefs=True):
                bbox = fitz.Rect(info["bbox"])
                if bbox.width < 16 or bbox.height < 16:
                    continue
                if not figure_fits_question(q, page_no, bbox, marker_rows_by_page):
                    excluded.append(uid)
                    continue
                center = fitz.Point((bbox.x0 + bbox.x1) / 2, (bbox.y0 + bbox.y1) / 2)
                if any(region.contains(center) for region in page_regions):
                    candidates[uid].append({"page": page_no, "bbox": list(bbox), "kind": "raster"})

    figure_records = {}
    figure_dir.mkdir(parents=True, exist_ok=True)
    for uid, entries in candidates.items():
        q = layout_by_uid[uid]
        source_path = pdf_root / q["source_pdf"]
        doc = docs.get(source_path)
        if doc is None:
            doc = fitz.open(source_path)
            docs[source_path] = doc
        unique = []
        for entry in sorted(entries, key=lambda x: (x["page"], x["bbox"][1], x["bbox"][0], x["kind"])):
            rect = fitz.Rect(entry["bbox"])
            if any(
                old["page"] == entry["page"]
                and (rect & fitz.Rect(old["bbox"])).get_area() > min(rect.get_area(), fitz.Rect(old["bbox"]).get_area()) * 0.7
                for old in unique
            ):
                continue
            unique.append(entry)
        records = []
        for index, entry in enumerate(unique, 1):
            rect = fitz.Rect(entry["bbox"])
            name = f"{uid}_{index:02}.png"
            out_path = figure_dir / name
            doc[entry["page"] - 1].get_pixmap(
                matrix=fitz.Matrix(3.2, 3.2),
                clip=rect,
                alpha=False,
                annots=False,
            ).save(out_path)
            records.append(
                {
                    "file": str((ASSET_BASE / "figures" / name).as_posix()),
                    "local_file": str(out_path),
                    "page": entry["page"],
                    "bbox": list(rect),
                    "source_components": [{"page": entry["page"], "bbox": list(rect)}],
                    "kind": entry["kind"],
                    "sha256": sha256(out_path),
                }
            )
        figure_records[uid] = records
    for doc in docs.values():
        doc.close()
    return figure_records, excluded


def load_figures(source_root: Path, layout_by_uid: dict, active_source_uids: set[str], mock_vectors: Path, figure_dir: Path, marker_rows_by_page):
    records = {}
    practice_root = source_root
    for uid in active_source_uids:
        q = layout_by_uid[uid]
        if uid.startswith("THI_"):
            continue
        figures = []
        for illustration in q.get("illustrations") or []:
            source_path = practice_root / illustration["file"]
            expected_hash = illustration.get("sha256")
            if not source_path.exists():
                raise FileNotFoundError(f"Missing named figure: {source_path}")
            if expected_hash and sha256(source_path) != expected_hash:
                raise ValueError(f"Figure hash differs from source layout: {source_path.name}")
            target = figure_dir / source_path.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_path, target)
            figures.append(
                {
                    "file": str((ASSET_BASE / "figures" / target.name).as_posix()),
                    "local_file": str(target),
                    "page": int(illustration["source_page"]),
                    "bbox": illustration["bbox"],
                    "source_components": illustration.get("source_components") or [
                        {"page": int(illustration["source_page"]), "bbox": illustration["bbox"]}
                    ],
                    "kind": illustration.get("kind", "source_figure"),
                    "sha256": sha256(target),
                }
            )
        records[uid] = figures
    mock_records, excluded = extract_mock_figures(
        source_root, layout_by_uid, active_source_uids, mock_vectors, figure_dir, marker_rows_by_page
    )
    records.update(mock_records)
    return records, excluded


def span_option_e(page, clip: fitz.Rect):
    blocks = page.get_text("dict", clip=clip, sort=True).get("blocks", [])
    hits = []
    for block in blocks:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "").strip()
                bbox = fitz.Rect(span["bbox"])
                if text.startswith("E.") and bbox.y0 >= clip.y0 + clip.height * 0.45:
                    hits.append(bbox)
    return min(hits, key=lambda r: (r.y0, r.x0)) if hits else None


def copy_source_page(source_doc, page_no: int):
    one = fitz.open()
    one.insert_pdf(source_doc, from_page=page_no - 1, to_page=page_no - 1)
    return one


def build_question_page(q, number: str, source_doc, figure_list, pdf_page, marker_rows_by_page):
    source_regions = q["source_regions"]
    normalized_regions = []
    question_start_page = int(q.get("start_page") or source_regions[0]["page"])
    marker_box = fitz.Rect(q["marker_bbox"])
    for region in source_regions:
        page_no = int(region["page"])
        boxes = [region["bbox"]]
        figure_components = []
        for figure in figure_list:
            for component in figure.get("source_components") or [
                {"page": figure["page"], "bbox": figure["bbox"]}
            ]:
                if int(component["page"]) == page_no:
                    boxes.append(component["bbox"])
                    figure_components.append(fitz.Rect(component["bbox"]))
        clip = box_union(boxes) + (-1, -1, 1, 1)

        # Layout rectangles can overlap the previous or following question.
        # On the first page, begin at this question's marker (or its own
        # extracted diagram when that appears above the marker), then stop
        # before the next marker on every page.
        if page_no == question_start_page:
            top_candidates = [marker_box.y0]
            top_candidates.extend(box.y0 for box in figure_components if box.y0 < marker_box.y0)
            clip.y0 = max(clip.y0, min(top_candidates) - 1)

        threshold = marker_box.y0 if page_no == question_start_page else clip.y0
        next_markers = [
            fitz.Rect(row["marker_bbox"])
            for row in marker_rows_by_page.get((q["source_pdf"], page_no), [])
            if row["uid"] != q["uid"]
            and fitz.Rect(row["marker_bbox"]).y0 > threshold + 1
        ]
        if next_markers:
            clip.y1 = min(clip.y1, min(box.y0 for box in next_markers) - 2)
        normalized_regions.append((page_no, clip))

    content_width = max(rect.width for _, rect in normalized_regions)
    scale = min(1.12, (PAGE_WIDTH - 2 * PAGE_MARGIN) / content_width)
    rendered_width = content_width * scale
    total_height = 2 * PAGE_MARGIN + sum(rect.height * scale for _, rect in normalized_regions)
    total_height += PAGE_GAP * max(0, len(normalized_regions) - 1)
    page_doc = fitz.open()
    out_page = page_doc.new_page(width=PAGE_WIDTH, height=max(total_height, 80))
    out_page.draw_rect(out_page.rect, color=None, fill=(1, 1, 1), overlay=True)
    source_label = fitz.Rect(q["marker_bbox"])
    marker_region_idx = 0
    y_offset = PAGE_MARGIN
    overlay_records = []

    for region_index, (page_no, clip) in enumerate(normalized_regions):
        clean_doc = copy_source_page(source_doc, page_no)
        clean_page = clean_doc[0]

        if page_no == question_start_page and clip.y0 < marker_box.y0 - 1:
            figure_rects = []
            for figure in figure_list:
                for component in figure.get("source_components") or [
                    {"page": figure["page"], "bbox": figure["bbox"]}
                ]:
                    if int(component["page"]) == page_no:
                        figure_rects.append(fitz.Rect(component["bbox"]))
            leading_text = fitz.Rect(clip.x0, clip.y0, clip.x1, marker_box.y0)
            for block in clean_page.get_text("dict", clip=leading_text).get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        span_box = fitz.Rect(span["bbox"])
                        in_own_figure = any(
                            (span_box & figure_box).get_area() >= span_box.get_area() * 0.2
                            for figure_box in figure_rects
                        )
                        if not in_own_figure:
                            clean_page.add_redact_annot(span_box + (-0.5, -0.5, 0.5, 0.5), fill=(1, 1, 1))

        # Strip the source PDF's promotional contact line when it falls inside
        # a continuation-page crop; it is not part of any exam question.
        for block in clean_page.get_text("dict", clip=clip).get("blocks", []):
            for line in block.get("lines", []):
                line_text = " ".join(span.get("text", "") for span in line.get("spans", []))
                if re.search(r"bạn\s+cần", line_text, re.IGNORECASE) and re.search(
                    r"zalo", line_text, re.IGNORECASE
                ):
                    clean_page.add_redact_annot(
                        fitz.Rect(line["bbox"]) + (-1, -1, 1, 1), fill=(1, 1, 1)
                    )

        # Figures are extracted assets. Mask the source copy, then position the
        # named asset at the same coordinates in the PDF text layer.
        for figure in figure_list:
            for component in figure.get("source_components") or [
                {"page": figure["page"], "bbox": figure["bbox"]}
            ]:
                if int(component["page"]) == page_no:
                    clean_page.add_redact_annot(fitz.Rect(component["bbox"]), fill=(1, 1, 1))

        if region_index == marker_region_idx and int(q["source_regions"][0]["page"]) == page_no:
            clean_page.add_redact_annot(source_label, fill=(1, 1, 1))

        if q["uid"] == "TD_B01_Q081":
            option_e = span_option_e(clean_page, clip)
            if option_e is None:
                clean_doc.close()
                page_doc.close()
                raise ValueError("TD_B01_Q081 option E could not be located in the source PDF")
            end_y = min(clip.y1, option_e.y1 + 20)
            clean_page.add_redact_annot(
                fitz.Rect(option_e.x0 - 1, option_e.y0 - 4, clip.x1, end_y),
                fill=(1, 1, 1),
            )

        if clean_page.first_annot:
            clean_page.apply_redactions(images=0, graphics=0)

        dest = fitz.Rect(
            PAGE_MARGIN,
            y_offset,
            PAGE_MARGIN + clip.width * scale,
            y_offset + clip.height * scale,
        )
        out_page.show_pdf_page(dest, clean_doc, 0, clip=clip)

        if region_index == marker_region_idx and int(q["source_regions"][0]["page"]) == page_no:
            x = PAGE_MARGIN + (source_label.x0 - clip.x0) * scale
            baseline = y_offset + (source_label.y1 - clip.y0) * scale - 1.5
            out_page.insert_font(fontname="Arial", fontfile=str(ARIAL))
            out_page.insert_text(
                (x, baseline),
                f"Câu {number}.",
                fontname="Arial",
                fontsize=max(8, 9.6 * scale),
                color=(0.08, 0.1, 0.14),
                overlay=True,
            )

        for figure in figure_list:
            components = figure.get("source_components") or [
                {"page": figure["page"], "bbox": figure["bbox"]}
            ]
            if len(components) != 1 or int(components[0]["page"]) != page_no:
                continue
            box = fitz.Rect(components[0]["bbox"])
            # A source diagram can extend beyond the cropped question area.
            # Keep the full extracted file available as a standalone image in
            # that case instead of emitting an invalid/out-of-page overlay.
            if not clip.contains(box):
                continue
            x = PAGE_MARGIN + (box.x0 - clip.x0) * scale
            y = y_offset + (box.y0 - clip.y0) * scale
            overlay_records.append(
                {
                    "file": figure["file"],
                    "bbox": [round(x, 3), round(y, 3), round(box.width * scale, 3), round(box.height * scale, 3)],
                    "alt": f"Hình minh họa câu {number} ({q['uid']})",
                    "sha256": figure["sha256"],
                }
            )

        y_offset += clip.height * scale + PAGE_GAP
        clean_doc.close()

    positioned_files = {figure["file"] for figure in overlay_records}
    for figure in figure_list:
        if figure["file"] not in positioned_files:
            overlay_records.append(
                {
                    "file": figure["file"],
                    "bbox": None,
                    "alt": f"Hình minh họa câu {number} ({q['uid']})",
                    "sha256": figure["sha256"],
                }
            )

    return page_doc, {
        "page": pdf_page,
        "width": PAGE_WIDTH,
        "height": round(max(total_height, 80), 3),
        "figures": overlay_records,
        "source_uid": q["uid"],
        "source_pages": [int(region["page"]) for region in q["source_regions"]],
    }


def make_source_question(record, layout_q, exam_type: str, source_answer, figure_list, page_number: int):
    number = question_number(record, exam_type)
    source_answer_text = source_answer.strip() if isinstance(source_answer, str) else ""
    is_mc = (
        record.get("section") == "I"
        if exam_type == "mock_test"
        else source_answer_text in {"A", "B", "C", "D"}
    )
    practice_tf = exam_type == "practice" and is_practice_true_false(source_answer_text)
    is_true_false = (exam_type == "mock_test" and record.get("section") == "II") or practice_tf
    if record["uid"] in MOCK_REPLACEMENTS:
        replacement = MOCK_REPLACEMENTS[record["uid"]]
        is_mc = replacement["type"] == "multiple_choice"
    if is_mc:
        options = MOCK_REPLACEMENTS.get(record["uid"], {}).get(
            "options", [{"key": key, "text": ""} for key in "ABCD"]
        )
        answer = MOCK_REPLACEMENTS.get(record["uid"], {}).get("answer", source_answer.strip())
        question_type = "multiple_choice"
        statements = []
        input_policy = None
        accepted = []
        canonical = None
    elif (record["uid"] in MOCK_REPLACEMENTS and MOCK_REPLACEMENTS[record["uid"]]["type"] == "true_false") or is_true_false:
        replacement = MOCK_REPLACEMENTS.get(record["uid"])
        options = []
        if replacement:
            statements = replacement["statements"]
            answer = replacement["answer"]
        elif practice_tf:
            statements = [{"key": key, "text": ""} for key in "abcd"]
            answer = parse_practice_true_false(source_answer_text)
        else:
            statements = [{"key": key, "text": ""} for key in "abcd"]
            answer = source_answer
        question_type = "true_false"
        input_policy = None
        accepted = []
        canonical = None
    elif record["uid"] in MOCK_REPLACEMENTS:
        replacement = MOCK_REPLACEMENTS[record["uid"]]
        options = []
        statements = []
        answer = replacement["answer"]
        question_type = "short_answer"
        input_policy = {"kind": "numeric", "maxLength": 256}
        accepted = [str(answer)]
        canonical = str(answer)
    elif is_mc:
        options = [{"key": key, "text": ""} for key in "ABCD"]
        statements = []
        answer = source_answer.strip()
        question_type = "multiple_choice"
        input_policy = None
        accepted = []
        canonical = None
    else:
        options = []
        statements = []
        answer, accepted, input_policy = get_practice_short_answer(
            record["uid"], source_answer_text
        )
        question_type = "short_answer"
        canonical = answer

    section = record.get("section") or "main"
    points = (
        0.25
        if exam_type == "mock_test" and section == "I"
        else 1
        if exam_type == "mock_test" and section == "II"
        else 0.5
        if exam_type == "mock_test" and section == "III"
        else 1
    )

    figures = []
    if page_number is not None:
        pdf_url = f"/{(ASSET_BASE / 'exams' / f'{record['exam_id']}.pdf').as_posix()}"
        figures.append(
            {
                "url": pdf_url,
                "alt": f"[mp-pdf-page:{page_number}] Văn bản gốc có thể chọn và sao chép ({record['uid']})",
            }
        )
    for figure in figure_list:
        overlay = figure.get("overlay")
        if overlay:
            position = ",".join(str(x) for x in overlay)
            alt = f"[mp-overlay:{position}] {figure['alt']}"
        else:
            alt = figure["alt"]
        figures.append({"url": f"/{figure['file']}", "alt": alt})

    replacement = MOCK_REPLACEMENTS.get(record["uid"])
    if replacement:
        stem = replacement["stem"]
        if replacement["type"] == "true_false":
            statements = replacement["statements"]
            answer = replacement["answer"]
        elif replacement["type"] == "multiple_choice":
            options = replacement["options"]
            answer = replacement["answer"]
        else:
            accepted = [replacement["answer"]]
            canonical = replacement["answer"]
            input_policy = {"kind": "numeric", "maxLength": 256}
    else:
        stem = ""

    return {
        "id": record["uid"],
        "source_id": record["uid"],
        "number": number,
        "question_number": record["question_number"],
        "section": section,
        "type": question_type,
        "stem": stem,
        "options": options,
        "statements": statements,
        "points": points,
        "figures": figures,
        "answer": answer,
        "accepted_values": accepted,
        "canonical_answer": canonical,
        "input_policy": input_policy,
        "solution": replacement.get("solution") if replacement else None,
        "answer_provenance": (
            "author_verified_solution"
            if replacement
            else "official_mock_answer_record"
            if exam_type == "mock_test"
            else "source_answer_key_cell_not_independently_rederived"
        ),
        "source_page": layout_q["source_regions"][0]["page"] if layout_q else None,
        "source_reference": layout_q["source_pdf"] if layout_q else "owner-authored replacement",
        "source_category": layout_q.get("category") if layout_q else "Authored replacement",
        "pdf_page": page_number,
    }


def make_generated_question(record, generated, exam_type: str):
    number = question_number(record, exam_type)
    qtype = generated["question_type"]
    answer = str(generated["answer"])
    input_policy = infer_input_policy(answer)
    if qtype == "multiple_choice":
        raise ValueError("Unexpected generated multiple-choice practice supplement")
    return {
        "id": record["uid"],
        "source_id": record["uid"],
        "number": number,
        "question_number": record["question_number"],
        "section": record.get("section") or "main",
        "type": "short_answer",
        "stem": GENERATED_STEM_DISPLAY_OVERRIDES.get(
            record["uid"], generated["question_text"]
        ),
        "options": [],
        "statements": [],
        "points": 1,
        "figures": [],
        "answer": answer,
        "accepted_values": [answer],
        "canonical_answer": answer,
        "input_policy": input_policy,
        "solution": generated["solution"],
        "answer_provenance": "author_verified_solution",
        "source_page": None,
        "source_reference": "Owner-authorized authored supplement",
        "source_category": generated.get("source_category", "Câu bổ sung"),
        "pdf_page": None,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--patch", type=Path, default=DEFAULT_PATCH)
    parser.add_argument(
        "--private-inputs",
        type=Path,
        default=ROOT / PRIVATE_BASE / "build-private-inputs.json",
    )
    parser.add_argument("--mock-vector-map", type=Path, default=ROOT / "tmp/mock-vector-candidates.json")
    args = parser.parse_args()
    private_inputs = read_json(args.private_inputs)
    MOCK_REPLACEMENTS.update(private_inputs["mock_replacements"])
    PRACTICE_ANSWER_OVERRIDES.update(private_inputs["practice_answer_overrides"])
    source_root = args.source_root.resolve()
    patch = read_json(args.patch)
    source_layout = read_json(source_root / "data/questions_source_layout.json")
    layout_by_uid = {q["uid"]: q for q in source_layout["questions"]}
    marker_rows_by_page = defaultdict(list)
    for layout_question in source_layout["questions"]:
        if layout_question.get("marker_bbox") and layout_question.get("start_page"):
            marker_rows_by_page[
                (layout_question["source_pdf"], int(layout_question["start_page"]))
            ].append(layout_question)
    generated_by_uid = {q["uid"]: q for q in patch["generated_questions"]}
    active_by_uid = {q["uid"]: q for q in patch["active_questions"]}
    practice_key_by_uid = {q["question_uid"]: q["answer"] for q in patch["practice_source_keys"]}
    mock_key_by_uid = {q["question_uid"]: q for q in patch["answer_records_mock"]}
    manifest_by_id = {e["exam_id"]: e for e in patch["exam_manifest"]}

    source_uids = {
        uid
        for uid, record in active_by_uid.items()
        if record["question_origin"] == "source_pdf"
        and uid not in MOCK_REPLACEMENTS
        and not record.get("restoration_required")
    }
    missing_layout = sorted(
        uid
        for uid in source_uids
        if uid not in layout_by_uid or not layout_by_uid[uid].get("source_regions")
    )
    if missing_layout:
        raise ValueError(f"Source layout is missing active question IDs: {missing_layout[:12]}")

    asset_root = ROOT / "public" / ASSET_BASE
    exam_pdf_dir = asset_root / "exams"
    figure_dir = asset_root / "figures"
    for directory in (exam_pdf_dir, figure_dir):
        directory.mkdir(parents=True, exist_ok=True)

    figure_map, excluded_figure_candidates = load_figures(
        source_root,
        layout_by_uid,
        source_uids,
        args.mock_vector_map,
        figure_dir,
        marker_rows_by_page,
    )
    expected_figure_files = {
        Path(item["local_file"]).resolve()
        for rows in figure_map.values()
        for item in rows
    }
    resolved_figure_dir = figure_dir.resolve()
    if resolved_figure_dir.parent != (ROOT / "public" / ASSET_BASE).resolve():
        raise ValueError("Refusing to prune files outside the generated figure directory")
    for old_asset in resolved_figure_dir.iterdir():
        if old_asset.is_file() and old_asset.resolve() not in expected_figure_files:
            old_asset.unlink()
    source_pdf_root = source_root / "input/source_package/source_pdfs"
    opened_docs = {}
    exams = []
    qa = {
        "schema": "mathpath.new-bank-build-qa.v1",
        "active_exam_count": len(manifest_by_id),
        "source_question_count": sum(
            1 for record in active_by_uid.values() if record["question_origin"] == "source_pdf"
        ) - len(MOCK_REPLACEMENTS),
        "authored_question_count": len(generated_by_uid) + len(MOCK_REPLACEMENTS),
        "restored_source_question_count": sum(
            1 for record in active_by_uid.values() if record.get("restoration_required")
        ),
        "figure_count": sum(len(rows) for rows in figure_map.values()),
        "excluded_mock_figure_candidate_count": len(excluded_figure_candidates),
        "excluded_mock_figure_candidate_uids": sorted(set(excluded_figure_candidates)),
        "figures_by_question": {uid: len(rows) for uid, rows in figure_map.items()},
        "question_pages_by_exam": {},
        "figure_association": "Source bounding boxes mapped; visual review required before declaring final.",
        "answers_independently_derived": False,
        "source_key_records": len(practice_key_by_uid),
        "mock_answer_records": len(mock_key_by_uid),
        "removed_five_choice": "TD_B01_Q081 option E",
        "replaced_mock_source_questions": sorted(MOCK_REPLACEMENTS),
    }

    for exam_manifest in patch["exam_manifest"]:
        exam_id = exam_manifest["exam_id"]
        exam_type = exam_manifest["exam_type"]
        q_pdf = fitz.open()
        exam_questions = []
        source_page = 0
        section_counts = defaultdict(int)
        for uid in exam_manifest["question_order"]:
            record = active_by_uid[uid]
            section = record.get("section") or "main"
            section_counts[section] += 1
            generated = generated_by_uid.get(uid)
            if generated:
                exam_questions.append(make_generated_question(record, generated, exam_type))
                continue

            if record.get("restoration_required"):
                restored_answer = str(record.get("answer", {}).get("value", "-2"))
                restored = {
                    "id": record["uid"],
                    "source_id": record["uid"],
                    "number": question_number(record, exam_type),
                    "question_number": record["question_number"],
                    "section": section,
                    "type": "short_answer",
                    "stem": "Trong khai triển $\\left(\\frac{a}{x}-x\\right)^6$, hệ số của $x^4$ là $12$. Tìm $a$.",
                    "options": [],
                    "statements": [],
                    "points": 1,
                    "figures": [],
                    "answer": restored_answer,
                    "accepted_values": [restored_answer],
                    "canonical_answer": restored_answer,
                    "input_policy": {"kind": "numeric", "maxLength": 256},
                    "solution": record.get("answer", {}).get("solution"),
                    "answer_provenance": "source_key_and_independent_derivation",
                    "source_page": record.get("source_start_page"),
                    "source_reference": record.get("source_pdf"),
                    "source_category": record.get("source_category"),
                    "pdf_page": None,
                }
                exam_questions.append(restored)
                continue

            layout_q = layout_by_uid[uid]
            if uid in MOCK_REPLACEMENTS:
                source_figure_rows = []
            else:
                source_figure_rows = figure_map.get(uid, [])

            source_answer = (
                str(practice_key_by_uid.get(uid, ""))
                if exam_type == "practice"
                else (mock_key_by_uid.get(uid) or {}).get("answer", record.get("answer", {}).get("value", ""))
            )
            source_doc_path = source_pdf_root / layout_q["source_pdf"]
            if source_doc_path not in opened_docs:
                opened_docs[source_doc_path] = fitz.open(source_doc_path)
            source_doc = opened_docs[source_doc_path]

            if uid in MOCK_REPLACEMENTS:
                question = make_source_question(
                    record,
                    layout_q,
                    exam_type,
                    "",
                    [],
                    None,
                )
                exam_questions.append(question)
                continue

            source_page += 1
            number = question_number(record, exam_type)
            excerpt, page_metadata = build_question_page(
                layout_q,
                number,
                source_doc,
                source_figure_rows,
                source_page,
                marker_rows_by_page,
            )
            q_pdf.insert_pdf(excerpt)
            one_page_path = ROOT / PRIVATE_BASE / "excerpts" / f"{uid}.pdf"
            one_page_path.parent.mkdir(parents=True, exist_ok=True)
            excerpt.save(one_page_path, garbage=4, deflate=True)
            excerpt.close()
            page_metadata["page_hash"] = sha256(one_page_path)

            runtime_figures = []
            pdf_url = f"/{(ASSET_BASE / 'exams' / f'{exam_id}.pdf').as_posix()}"
            runtime_figures.append(
                {
                    "url": pdf_url,
                    "alt": f"[mp-pdf-page:{source_page}] Văn bản gốc có thể chọn và sao chép ({uid})",
                }
            )
            for figure in source_figure_rows:
                metadata = next(
                    (m for m in page_metadata["figures"] if m["file"] == figure["file"]),
                    None,
                )
                alt = metadata["alt"] if metadata else f"Hình minh họa câu {number} ({uid})"
                if metadata and metadata["bbox"]:
                    position = ",".join(str(value) for value in metadata["bbox"])
                    alt = f"[mp-overlay:{position}] {alt}"
                runtime_figures.append({"url": f"/{figure['file']}", "alt": alt})

            question = make_source_question(
                record,
                layout_q,
                exam_type,
                source_answer,
                [],
                source_page,
            )
            question["figures"] = runtime_figures
            question["source_pages"] = page_metadata["source_pages"]
            question["source_file"] = layout_q["source_pdf"]
            question["page_metadata"] = page_metadata
            if exam_type == "mock_test" and uid in mock_key_by_uid:
                question["answer"] = mock_key_by_uid[uid]["answer"]
            if question["type"] == "multiple_choice":
                question["answer"] = str(question["answer"]).strip()
            elif question["type"] == "short_answer":
                question["accepted_values"] = [str(question["answer"])]
                question["canonical_answer"] = str(question["answer"])
            question["answer_provenance"] = (
                (mock_key_by_uid.get(uid) or {}).get("status", "official_mock_answer_record")
                if exam_type == "mock_test"
                else "source_key_reference_only_not_independently_rederived"
            )
            exam_questions.append(question)

        exam_pdf_path = exam_pdf_dir / f"{exam_id}.pdf"
        q_pdf.save(exam_pdf_path, garbage=4, deflate=True)
        page_count = q_pdf.page_count
        q_pdf.close()
        if page_count != source_page:
            raise ValueError(f"{exam_id}: expected {source_page} source pages, wrote {page_count}")
        qa["question_pages_by_exam"][exam_id] = page_count

        if exam_type == "mock_test":
            sections = [
                {"id": "I", "title": "Phần I · Trắc nghiệm", "description": "Chọn một đáp án đúng.", "maxScore": 3},
                {"id": "II", "title": "Phần II · Đúng / Sai", "description": "Đánh dấu đúng hoặc sai cho từng ý.", "maxScore": 4},
                {"id": "III", "title": "Phần III · Trả lời ngắn", "description": "Nhập kết quả chính xác.", "maxScore": 3},
            ]
            mode = "official_thptqg"
            timing_mode = "countdown"
            duration_seconds = 5400
            total_score = 10
            for q in exam_questions:
                if q["section"] == "II" and q["type"] == "true_false":
                    q["scoring"] = {"kind": "partial", "pointsByCorrectCount": [0, 0.1, 0.25, 0.5, 1]}
        else:
            sections = [
                {"id": "main", "title": "Câu hỏi", "description": "Làm lần lượt 40 câu của đề nâng cao.", "maxScore": 40}
            ]
            mode = "practice"
            timing_mode = "elapsed"
            duration_seconds = None
            total_score = 40

        for q in exam_questions:
            if q["section"] == "main":
                q["section"] = "main"
            q["id"] = f"{exam_id}:{q['id']}"
            q["sectionId"] = q["section"]
            if q["type"] == "true_false":
                q["correctStatements"] = q.pop("answer")
                q.setdefault("scoring", {"kind": "all_or_nothing"})
            elif q["type"] == "multiple_choice":
                q["correctOptionKey"] = q.pop("answer")
            else:
                q["canonicalAnswer"] = str(q.pop("answer"))
                q["acceptedNormalizedAnswers"] = q.pop("accepted_values")
                q["inputPolicy"] = q.pop("input_policy")

        exam_title = {
            "DH": "Ứng dụng đạo hàm và khảo sát hàm số",
            "TD": "Rèn luyện tư duy toán học",
            "THI": "Đề thi thử tốt nghiệp THPT",
            "TP": "Tích phân và ứng dụng",
            "XS": "Tổ hợp và xác suất",
        }[exam_id.split("_")[0]]
        suffix = int(exam_id[-2:])
        title = f"{exam_title} · Đề nâng cao {suffix:02}"
        if exam_id.startswith("THI_"):
            title = f"{exam_title} · Mã đề {suffix:02}"
        exams.append(
            {
                "id": exam_id,
                "title": title,
                "description": (
                    "Đề thi thử theo cấu trúc 12 câu trắc nghiệm, 4 câu đúng/sai và 6 câu trả lời ngắn."
                    if exam_type == "mock_test"
                    else f"Đề ôn tập nâng cao gồm 40 câu được chọn từ tài liệu nguồn {exam_title.lower()}."
                ),
                "mode": mode,
                "demo": False,
                "timingMode": timing_mode,
                "durationSeconds": duration_seconds,
                "totalScore": total_score,
                "sections": [
                    {
                        "id": section["id"],
                        "title": section["title"],
                        "description": section["description"],
                        "maxScore": section["maxScore"],
                    }
                    for section in sections
                ],
                "questions": exam_questions,
            }
        )
        if len(exam_questions) != exam_manifest["expected_question_count"]:
            raise ValueError(f"{exam_id}: question count mismatch")

    for source_doc in opened_docs.values():
        source_doc.close()

    private_dir = ROOT / PRIVATE_BASE
    private_dir.mkdir(parents=True, exist_ok=True)
    runtime_path = private_dir / "runtime-exams.json"
    runtime_path.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")
    qa_path = private_dir / "build-qa.json"
    qa["runtime_question_count"] = sum(len(exam["questions"]) for exam in exams)
    qa["runtime_exam_counts"] = {exam["id"]: len(exam["questions"]) for exam in exams}
    qa_path.write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({**qa, "private_runtime": str(runtime_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

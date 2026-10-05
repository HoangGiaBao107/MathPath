"""Build safe student previews and private solution records from Đề thi.docx.

The original Word file is the sole source. OMML is converted recursively to
LaTeX so fractions, scripts, radicals, accents, and operators retain structure.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from docx import Document
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Đề thi.docx"
PUBLIC = ROOT / "src" / "data" / "mathpath-word-student-previews.json"
PRIVATE = ROOT / "content" / "word-import" / "private-exam-solutions.json"
FIGURE_MANIFEST = ROOT / "content" / "word-import" / "figure-generation-manifest.json"
FIGURE_ROOT = ROOT / "public" / "mathpath-word-figures"
EXPECTED_SECTIONS = [12, 4, 6]
PROMPT_MARKER = "🤖 HƯỚNG DẪN AI GEN HÌNH ẢNH (PROMPT):"
SECTIONS = {
    1: ("part_1", "Phần I · Trắc nghiệm nhiều lựa chọn", "Part I · Multiple choice"),
    2: ("part_2", "Phần II · Đúng / Sai", "Part II · True / False"),
    3: ("part_3", "Phần III · Trả lời ngắn", "Part III · Short answer"),
}
MATH_SYMBOLS = {
    "∞": r"\infty", "≤": r"\leq", "≥": r"\geq", "≠": r"\neq", "≈": r"\approx",
    "≡": r"\equiv", "∈": r"\in", "∉": r"\notin", "⊂": r"\subset", "⊆": r"\subseteq",
    "∪": r"\cup", "∩": r"\cap", "×": r"\times", "·": r"\cdot", "±": r"\pm", "∓": r"\mp",
    "→": r"\to", "↔": r"\leftrightarrow", "⇒": r"\Rightarrow", "⇔": r"\Leftrightarrow",
    "∀": r"\forall", "∃": r"\exists", "∅": r"\emptyset", "ℝ": r"\mathbb{R}", "ℤ": r"\mathbb{Z}",
    "ℕ": r"\mathbb{N}", "ℚ": r"\mathbb{Q}", "ℂ": r"\mathbb{C}", "π": r"\pi", "α": r"\alpha",
    "β": r"\beta", "γ": r"\gamma", "δ": r"\delta", "θ": r"\theta", "λ": r"\lambda",
    "μ": r"\mu", "σ": r"\sigma", "φ": r"\phi", "ω": r"\omega",
    "−": "-",
}


def children(node: Any, local: str) -> list[Any]:
    return [child for child in node if child.tag.endswith("}" + local)]


def first(node: Any, local: str) -> Any | None:
    found = children(node, local)
    return found[0] if found else None


def math_node(node: Any) -> str:
    """Translate Word OMML math nodes without flattening scripts or layout."""
    name = node.tag.rsplit("}", 1)[-1]
    if name in {"oMath", "oMathPara", "e", "num", "den", "sub", "sup", "lim", "fName"}:
        return "".join(math_node(child) for child in node if not child.tag.endswith("Pr"))
    if name in {"r", "t"}:
        if name == "r":
            return "".join(math_node(child) for child in node if child.tag == qn("m:t"))
        value = node.text or ""
        return "".join(MATH_SYMBOLS.get(char, char) for char in value)
    if name == "f":
        numerator, denominator = first(node, "num"), first(node, "den")
        return rf"\frac{{{math_node(numerator) if numerator is not None else ''}}}{{{math_node(denominator) if denominator is not None else ''}}}"
    if name in {"sSup", "sSub", "sSubSup"}:
        base = first(node, "e")
        sup, sub = first(node, "sup"), first(node, "sub")
        result = math_node(base) if base is not None else ""
        if sub is not None:
            result += rf"_{{{math_node(sub)}}}"
        if sup is not None:
            result += rf"^{{{math_node(sup)}}}"
        return result
    if name == "rad":
        degree, radicand = first(node, "deg"), first(node, "e")
        deg = math_node(degree).strip() if degree is not None else ""
        return rf"\sqrt[{deg}]{{{math_node(radicand) if radicand is not None else ''}}}" if deg else rf"\sqrt{{{math_node(radicand) if radicand is not None else ''}}}"
    if name == "d":
        props, content = first(node, "dPr"), first(node, "e")
        begin = end = ""
        if props is not None:
            beg = first(props, "begChr")
            fin = first(props, "endChr")
            begin = beg.get(qn("m:val"), "(") if beg is not None else "("
            end = fin.get(qn("m:val"), ")") if fin is not None else ")"
        delimiters = {"{": r"\{", "}": r"\}", "⟨": r"\langle", "⟩": r"\rangle", "⌊": r"\lfloor", "⌋": r"\rfloor", "⌈": r"\lceil", "⌉": r"\rceil", "∣": r"|"}
        begin = delimiters.get(begin, begin)
        end = delimiters.get(end, end)
        return rf"\left{begin}{math_node(content) if content is not None else ''}\right{end}"
    if name == "acc":
        props, base = first(node, "accPr"), first(node, "e")
        chr_node = first(props, "chr") if props is not None else None
        accent = chr_node.get(qn("m:val"), "⃗") if chr_node is not None else "⃗"
        command = {"⃗": r"\vec", "→": r"\overrightarrow", "¯": r"\overline", "˙": r"\dot", "¨": r"\ddot", "̂": r"\hat", "̃": r"\tilde"}.get(accent, r"\widehat")
        return rf"{command}{{{math_node(base) if base is not None else ''}}}"
    if name == "nary":
        props, base = first(node, "naryPr"), first(node, "e")
        op_node = first(props, "chr") if props is not None else None
        op = op_node.get(qn("m:val"), "∫") if op_node is not None else "∫"
        command = {"∫": r"\int", "∬": r"\iint", "∭": r"\iiint", "∑": r"\sum", "∏": r"\prod", "⋃": r"\bigcup", "⋂": r"\bigcap"}.get(op, r"\int")
        lower, upper = first(node, "sub"), first(node, "sup")
        limits = (rf"_{{{math_node(lower)}}}" if lower is not None else "") + (rf"^{{{math_node(upper)}}}" if upper is not None else "")
        return command + limits + (math_node(base) if base is not None else "")
    if name in {"limLow", "limUpp"}:
        base, limit = first(node, "e"), first(node, "lim")
        marker = "_" if name == "limLow" else "^"
        return (math_node(base) if base is not None else "") + marker + rf"{{{math_node(limit) if limit is not None else ''}}}"
    if name == "groupChr":
        props, base = first(node, "groupChrPr"), first(node, "e")
        chr_node = first(props, "chr") if props is not None else None
        value = chr_node.get(qn("m:val"), "⏞") if chr_node is not None else "⏞"
        command = r"\underbrace" if value in {"⏟", "_"} else r"\overbrace"
        return rf"{command}{{{math_node(base) if base is not None else ''}}}"
    if name == "func":
        return "".join(math_node(child) for child in node if not child.tag.endswith("Pr"))
    if name == "box":
        return "".join(math_node(child) for child in node if not child.tag.endswith("Pr"))
    if name == "m":
        rows = []
        for row in children(node, "mr"):
            cells = children(row, "e")
            rows.append(" & ".join(math_node(cell) for cell in cells))
        return r"\begin{matrix}" + r" \\ ".join(rows) + r"\end{matrix}"
    if name == "limLowPr" or name.endswith("Pr") or name in {"ctrlPr"}:
        return ""
    return "".join(math_node(child) for child in node)


def paragraph_text(paragraph: Any) -> str:
    out: list[str] = []

    def walk(node: Any) -> None:
        local = node.tag.rsplit("}", 1)[-1]
        if node.tag == qn("m:oMath") or node.tag == qn("m:oMathPara"):
            out.append(r"\(" + math_node(node) + r"\)")
            return
        if node.tag == qn("w:t") or node.tag == qn("m:t"):
            out.append(node.text or "")
            return
        if node.tag == qn("w:tab"):
            out.append(" ")
            return
        if node.tag in {qn("w:br"), qn("w:cr")}:
            out.append("\n")
            return
        if local.endswith("Pr") or local in {"pPr", "rPr", "ctrlPr"}:
            return
        for child in node:
            walk(child)

    walk(paragraph._p)
    text = "".join(out).replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def split_exam_stream(text: str) -> tuple[list[dict[str, Any]], list[str]]:
    heading_re = re.compile(r"(?:BẢN FULL[^\n]*?\s*)?ĐỀ\s*(\d+)\s*:", re.I)
    headings = list(heading_re.finditer(text))
    exams: list[dict[str, Any]] = []
    warnings: list[str] = []
    source_numbers = [int(match.group(1)) for match in headings]
    if len(headings) != 8:
        raise ValueError(f"Expected 8 exam headings from Word; found {len(headings)}: {source_numbers}")

    for exam_index, heading in enumerate(headings, start=1):
        end = headings[exam_index].start() if exam_index < len(headings) else len(text)
        raw = text[heading.start():end]
        raw = re.sub(heading_re, "", raw, count=1).strip()
        source_exam_no = int(heading.group(1))
        section_matches = list(re.finditer(r"PHẦN\s+([I1]+|II|III)\s*\.", raw, re.I))
        if len(section_matches) != 3:
            raise ValueError(f"Exam {source_exam_no}: expected three section headings, found {len(section_matches)}")
        sections: list[dict[str, Any]] = []
        private_questions: list[dict[str, Any]] = []
        for sec_i, sec_match in enumerate(section_matches):
            sec_end = section_matches[sec_i + 1].start() if sec_i + 1 < len(section_matches) else len(raw)
            body = raw[sec_match.end():sec_end]
            section_id, vi_label, en_label = SECTIONS[sec_i + 1]
            q_starts = list(re.finditer(r"(?<![\w])Câu\s*(\d+)\s*:", body, re.I))
            expected = EXPECTED_SECTIONS[sec_i]
            accepted: list[re.Match[str]] = []
            next_number = 1
            for q_start in q_starts:
                number = int(q_start.group(1))
                if number == next_number and next_number <= expected:
                    accepted.append(q_start)
                    next_number += 1
            if len(accepted) != expected:
                warnings.append(f"Đề thi thử số {exam_index}, {vi_label}: Word shows {len(accepted)}/{expected} sequential question markers.")
            questions: list[dict[str, Any]] = []
            for q_idx, q_match in enumerate(accepted):
                q_end = accepted[q_idx + 1].start() if q_idx + 1 < len(accepted) else len(body)
                chunk = body[q_match.end():q_end].strip()
                prompt_match = re.search(re.escape(PROMPT_MARKER) + r'\s*"([\s\S]*?)"', chunk)
                prompt = prompt_match.group(1).strip() if prompt_match else None
                if prompt_match:
                    chunk = chunk[:prompt_match.start()] + " " + chunk[prompt_match.end():]
                answer_match = re.search(r"(?<!\w)Đáp án(?:\s*&\s*Giải thích)?\s*:\s*", chunk, re.I)
                explanation_match = re.search(r"(?<!\w)Giải thích\s*:\s*", chunk, re.I)
                private_markers = [m.start() for m in [answer_match, explanation_match] if m]
                public_chunk = chunk[:min(private_markers) if private_markers else len(chunk)].strip()
                answer = ""
                explanation = ""
                if answer_match:
                    answer_end = explanation_match.start() if explanation_match and explanation_match.start() > answer_match.start() else len(chunk)
                    if re.search(r"&\s*Giải thích", answer_match.group(), re.I):
                        explanation = chunk[answer_match.end():].strip()
                    else:
                        answer = chunk[answer_match.end():answer_end].strip()
                if explanation_match:
                    explanation = chunk[explanation_match.end():].strip()
                question_type = ["multiple_choice", "true_false", "short_answer"][sec_i]
                options: list[dict[str, Any]] = []
                statements: list[dict[str, Any]] = []
                subanswers: list[dict[str, str]] = []
                source_warning = ""
                if sec_i == 0:
                    option_candidates = list(re.finditer(r"(?<![A-Za-z0-9])([A-D])\s*\.\s*", public_chunk))
                    option_marks: list[re.Match[str]] = []
                    expected_option = "A"
                    for candidate in option_candidates:
                        if candidate.group(1) == expected_option:
                            option_marks.append(candidate)
                            expected_option = chr(ord(expected_option) + 1)
                            if expected_option > "D":
                                break
                    if len(option_marks) == 4:
                        statement = public_chunk[:option_marks[0].start(1)].strip().rstrip(":")
                        for option_i, option_match in enumerate(option_marks):
                            option_end = option_marks[option_i + 1].start(1) if option_i + 1 < len(option_marks) else len(public_chunk)
                            options.append({"key": option_match.group(1), "text": public_chunk[option_match.end():option_end].strip(), "orderIndex": option_i})
                    else:
                        statement = public_chunk
                        if re.search(r"(?:^|\n)\s*A\s*\.", public_chunk):
                            statement = re.split(r"(?:^|\n)\s*A\s*\.", public_chunk, maxsplit=1)[0].strip()
                            source_warning = "Phương án A–D bị thiếu hoặc cắt dở trong file Word; cần bổ sung từ chủ nguồn."
                elif sec_i == 1:
                    statement = public_chunk
                    marker_candidates = list(re.finditer(r"(?<![A-Za-z0-9])([a-d])\s*[\)\.]\s*", public_chunk, re.I))
                    parts: list[re.Match[str]] = []
                    expected_letter = "a"
                    for candidate in marker_candidates:
                        if candidate.group(1).lower() == expected_letter:
                            parts.append(candidate)
                            expected_letter = chr(ord(expected_letter) + 1)
                            if expected_letter > "d":
                                break
                    if len(parts) == 4:
                        statement = public_chunk[:parts[0].start(1)].strip()
                        for part_i, part in enumerate(parts):
                            part_end = parts[part_i + 1].start(1) if part_i + 1 < len(parts) else len(public_chunk)
                            substatement = public_chunk[part.end():part_end].strip()
                            truth_match = re.search(r"\((Đúng|Sai)\)", substatement, re.I)
                            item_explanation = ""
                            if truth_match:
                                after_truth = substatement[truth_match.end():].strip()
                                item_explanation = re.sub(r"^[-–—]\s*", "", after_truth).strip()
                                substatement = substatement[:truth_match.start()].strip()
                            statements.append({"key": part.group(1).lower(), "text": substatement, "orderIndex": part_i})
                            subanswers.append({"key": part.group(1).lower(), "answer": truth_match.group(1).lower() if truth_match else "", "explanation": item_explanation})
                    else:
                        statement = public_chunk
                qid = f"word-exam-{exam_index}-q{q_match.group(1)}-{sec_i + 1}"
                questions.append({
                    "id": qid,
                    "section": section_id,
                    "sectionLabel": {"vi": vi_label, "en": en_label},
                    "questionNumber": q_match.group(1),
                    "orderIndex": sum(len(section["questions"]) for section in sections) + len(questions) + 1,
                    "questionType": question_type,
                    "statement": statement,
                    "options": options,
                    "substatements": statements,
                    "source": {
                        "slug": f"exam-{exam_index}",
                        "file": "Đề thi.docx",
                        "questionId": qid,
                        "questionNumber": q_match.group(1),
                        "pages": [],
                        "crop": None,
                        "cropWidth": None,
                        "cropHeight": None,
                        "extractionStatus": "word_structure_preserved",
                        "warnings": [source_warning] if source_warning else [],
                        "reviewStatus": "unverified_preview",
                        "figureStatus": "ai_prompt_pending" if prompt else "not_required",
                        "figureKind": "unavailable",
                        "generationStatus": "not_generated",
                    },
                })
                private_questions.append({"id": qid, "answer": answer, "explanation": explanation, "subanswers": subanswers, "figurePrompt": prompt, "sourceContent": chunk, "editorialCorrections": []})
            sections.append({"id": section_id, "label": {"vi": vi_label, "en": en_label}, "questions": questions})
            private_questions.extend([])
        all_questions = [q for section in sections for q in section["questions"]]
        question_warnings = [
            warning
            for question in all_questions
            for warning in question["source"]["warnings"]
        ]
        if exam_index == 1:
            correction_specs = {
                ("part_1", "3", "D"): {
                    "replacement": "$I(-4;0;3)$, $r=16$.",
                    "reason": "Tách phương án D khỏi phương án C trùng lặp theo yêu cầu chủ dự án.",
                },
                ("part_1", "6", "A"): {
                    "replacement": "$x=-5-13t, y=-3-16t, z=-1+t$",
                    "reason": "Chỉnh phương án A để không còn là cùng đường thẳng với đáp án D theo yêu cầu chủ dự án.",
                },
            }
            for question in all_questions:
                for option in question["options"]:
                    key = (question["section"], question["questionNumber"], option["key"])
                    if key not in correction_specs:
                        continue
                    before = option["text"]
                    option["text"] = correction_specs[key]["replacement"]
                    question["source"]["warnings"].append("Phương án đã được biên tập theo yêu cầu chủ dự án; chưa đồng bộ ngược vào file Word nguồn.")
                    private_record = next(item for item in private_questions if item["id"] == question["id"])
                    private_record["editorialCorrections"].append({"option": option["key"], "before": before, "after": option["text"], "reason": correction_specs[key]["reason"]})
        exams.append({
            "slug": f"exam-{exam_index}",
            "title": f"Đề thi thử số {exam_index}",
            "_source_exam_no": source_exam_no,
            "sourceFile": "Đề thi.docx",
            "sourceKind": "word_import",
            "previewStatus": "review_preview",
            "processingStatus": "word_omml_converted",
            "visibleQuestionCount": len(all_questions),
            "warningCount": len(question_warnings) + len([w for w in warnings if f"số {exam_index}," in w]),
            "reportWarnings": question_warnings + [w for w in warnings if f"số {exam_index}," in w],
            "sourcePageCount": 0,
            "unresolvedQuestionCount": 0,
            "answerKeyPagesExcluded": [],
            "questions": all_questions,
        })
        exams[-1]["_private"] = private_questions
    return exams, warnings


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Word source not found: {SOURCE}")
    document = Document(SOURCE)
    stream = "\n".join(filter(None, (paragraph_text(p) for p in document.paragraphs)))
    exams, warnings = split_exam_stream(stream)
    private_exam_data = []
    for exam in exams:
        private_exam_data.append({
            "slug": exam["slug"],
            "title": exam["title"],
            "sourceFile": "Đề thi.docx",
            "sourceExamNumber": exam.pop("_source_exam_no"),
            "questions": exam.pop("_private"),
        })
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    figure_prompts = []
    figure_assets: dict[str, dict[str, Any]] = {}
    for exam in private_exam_data:
        for question in exam["questions"]:
            prompt = question["figurePrompt"]
            if not prompt:
                continue
            asset_relative = Path(exam["slug"]) / f"{question['id']}.png"
            asset_path = FIGURE_ROOT / asset_relative
            is_graph = re.search(r"graph|plot|curve|coordinate|variation table|axis|axes|function|chart", prompt, re.I) is not None
            visual_style = (
                "MathPath visual direction: pure white background; draw the graph and axes in MathPath red (#D71920), make every plotted point black, and use black labels. Clean, accurate high-school exam diagram, crisp vector-like lines, no decoration, no logo, no watermark. Preserve the exact mathematical relationships and all named points from the source prompt; add no unrequested values."
                if is_graph
                else "MathPath visual direction: pure white background with restrained MathPath red (#D71920) geometry/highlights, black points and black labels. Clean, accurate high-school exam diagram, crisp vector-like lines, no decoration, no logo, no watermark. Preserve the exact geometric relationships and all named points from the source prompt; add no unrequested values."
            )
            figure_prompts.append({
                "examSlug": exam["slug"],
                "examTitle": exam["title"],
                "questionId": question["id"],
                "outputPath": (Path("public") / "mathpath-word-figures" / asset_relative).as_posix(),
                "prompt": prompt,
                "promptForImageGeneration": f"{prompt}\n\n{visual_style}",
                "visualStyle": "red_graph_black_points_white_background" if is_graph else "red_black_white_mathpath",
                "status": "generated_needs_review" if asset_path.is_file() else "pending_generation",
            })
            if asset_path.is_file():
                from PIL import Image

                with Image.open(asset_path) as image:
                    width, height = image.size
                figure_assets[question["id"]] = {
                    "url": "/mathpath-word-figures/" + asset_relative.as_posix(),
                    "width": width,
                    "height": height,
                }
    for exam in exams:
        for question in exam["questions"]:
            asset = figure_assets.get(question["id"])
            if asset:
                question["source"].update({
                    "crop": asset["url"],
                    "cropWidth": asset["width"],
                    "cropHeight": asset["height"],
                    "figureStatus": "generated_needs_review",
                    "figureKind": "generated_illustration",
                    "generationStatus": "generated_needs_review",
                })
    public_payload = {
        "formatVersion": 1,
        "source": {"file": "Đề thi.docx", "sha256": source_hash},
        "previewOnly": True,
        "notOfficiallyVerified": True,
        "answersIncluded": False,
        "figuresGenerated": bool(figure_prompts) and len(figure_assets) == len(figure_prompts),
        "figurePromptCount": len(figure_prompts),
        "generatedFigureCount": len(figure_assets),
        "exams": exams,
        "warnings": warnings,
    }
    PRIVATE.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    PRIVATE.write_text(json.dumps({"source": public_payload["source"], "exams": private_exam_data}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PUBLIC.write_text(json.dumps(public_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    FIGURE_MANIFEST.write_text(json.dumps({"source": public_payload["source"], "figures": figure_prompts}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "exams": len(exams),
        "questions": [exam["visibleQuestionCount"] for exam in exams],
        "privateSolutions": sum(len(exam["questions"]) for exam in private_exam_data),
        "aiFigurePrompts": public_payload["figurePromptCount"],
        "generatedFigureCount": public_payload["generatedFigureCount"],
        "warnings": warnings,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

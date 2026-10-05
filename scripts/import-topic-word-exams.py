"""Import the four derivative/antiderivative practice exams from the supplied Word files.

Student-visible question text and server-only answer/explanation records are emitted
separately. The Word documents remain the source of truth; missing structure is fatal.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import uuid
from pathlib import Path
from typing import Any

from docx import Document

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ("dao_ham", "Đạo hàm", ROOT / "De_Dao_Ham_2_De_40_Cau.docx"),
    ("nguyen_ham", "Nguyên hàm", ROOT / "De_Nguyen_Ham_2_De_40_Cau.docx"),
]
PUBLIC = ROOT / "src" / "data" / "mathpath-topic-practice-exams.json"
PRIVATE = ROOT / "content" / "word-import" / "private-topic-practice-keys.json"
NAMESPACE = uuid.UUID("c75ce75c-6266-4e31-9cf4-18a8f07c4488")
SECTION_LABELS = [
    ("part_1", "Phần I · Trắc nghiệm nhiều lựa chọn", "Part I · Multiple choice"),
    ("part_2", "Phần II · Đúng / Sai", "Part II · True / False"),
    ("part_3", "Phần III · Trả lời ngắn", "Part III · Short answer"),
]
EXPECTED_COUNTS = [20, 10, 10]


def load_paragraph_text():
    spec = importlib.util.spec_from_file_location(
        "mathpath_word_importer", ROOT / "scripts" / "import-word-exams.py"
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the shared Word/OMML text reader")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.paragraph_text


paragraph_text = load_paragraph_text()


def tidy(value: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", value.replace("\xa0", " ")).strip()


def question_blocks(text: str) -> list[tuple[str, str]]:
    markers = list(re.finditer(r"(?m)^\s*Câu\s*(\d+)\s*[.:]\s*", text, re.I))
    return [
        (
            marker.group(1),
            tidy(text[marker.end() : markers[index + 1].start() if index + 1 < len(markers) else len(text)]),
        )
        for index, marker in enumerate(markers)
    ]


def exact_exam_heading(line: str, number: int) -> bool:
    return re.fullmatch(rf"\s*ĐỀ\s*0*{number}\s*", line, re.I) is not None


def split_exam(lines: list[str], number: int) -> tuple[str, str]:
    starts = [index for index, line in enumerate(lines) if exact_exam_heading(line, number)]
    if len(starts) != 1:
        raise ValueError(f"Expected one question heading for exam {number}; found {len(starts)}")
    start = starts[0]
    next_exam = next(
        (index for index in range(start + 1, len(lines)) if exact_exam_heading(lines[index], number + 1)),
        len(lines),
    )
    answer = next(
        (
            index
            for index in range(start + 1, next_exam)
            if re.match(rf"\s*ĐỀ\s*0*{number}\s*[–-]\s*ĐÁP ÁN", lines[index], re.I)
        ),
        None,
    )
    if answer is None:
        raise ValueError(f"Answer/explanation heading missing for exam {number}")
    return "\n".join(lines[start + 1 : answer]), "\n".join(lines[answer + 1 : next_exam])


def section_texts(text: str) -> list[str]:
    markers = list(re.finditer(r"(?mi)^\s*PHẦN\s+(I|II|III)\s*\.\s*[^\n]*", text))
    if len(markers) != 3:
        raise ValueError(f"Expected three question sections; found {len(markers)}")
    if [marker.group(1).upper() for marker in markers] != ["I", "II", "III"]:
        raise ValueError("Question sections are not ordered I, II, III")
    return [
        text[marker.end() : markers[index + 1].start() if index + 1 < len(markers) else len(text)]
        for index, marker in enumerate(markers)
    ]


def remove_figure_prompt(value: str) -> str:
    return tidy(re.sub(r"(?m)^\s*Hướng dẫn vẽ hình\s*:[^\n]*", "", value))


def parse_question_block(section_index: int, number: str, raw: str, exam_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    raw = remove_figure_prompt(raw)
    qid = str(uuid.uuid5(NAMESPACE, f"mathpath:{exam_id}:{section_index}:{number}"))
    common = {"id": qid, "sectionId": f"part_{section_index + 1}", "number": number, "points": 0.25}
    explanation = ""

    if section_index == 0:
        options = list(re.finditer(r"(?m)^\s*([A-D])\s*\.\s*", raw))
        if [match.group(1) for match in options] != list("ABCD"):
            raise ValueError(f"{exam_id} Part I question {number}: expected four ordered options")
        stem = tidy(raw[: options[0].start()])
        choices = []
        for index, marker in enumerate(options):
            end = options[index + 1].start() if index + 1 < len(options) else len(raw)
            choices.append({"key": marker.group(1), "text": tidy(raw[marker.end() : end])})
        public = {**common, "type": "multiple_choice", "stem": stem, "options": choices}
        return public, {"id": qid, "type": public["type"], "explanation": explanation}

    if section_index == 1:
        markers = list(re.finditer(r"(?m)^\s*([a-d])\s*[).]\s*", raw, re.I))
        if [match.group(1).lower() for match in markers] != list("abcd"):
            raise ValueError(f"{exam_id} Part II question {number}: expected four ordered statements")
        stem = tidy(raw[: markers[0].start()])
        statements = []
        for index, marker in enumerate(markers):
            end = markers[index + 1].start() if index + 1 < len(markers) else len(raw)
            statement = tidy(raw[marker.end() : end])
            statement = re.sub(r"\s*□\s*Đúng\s*□\s*Sai\s*$", "", statement, flags=re.I).strip()
            statements.append({"key": marker.group(1).lower(), "text": statement})
        public = {**common, "type": "true_false", "stem": stem, "statements": statements}
        return public, {"id": qid, "type": public["type"], "explanation": explanation}

    stem = re.sub(r"(?m)^\s*Trả lời\s*:[^\n]*", "", raw, flags=re.I)
    public = {**common, "type": "short_answer", "stem": tidy(stem)}
    return public, {"id": qid, "type": public["type"], "explanation": explanation}


def answer_sections(text: str) -> list[str]:
    labels = [
        r"(?mi)^\s*I\.\s*Giải thích trắc nghiệm nhiều lựa chọn\s*$",
        r"(?mi)^\s*II\.\s*Giải thích đúng\s*[–-]\s*sai\s*$",
        r"(?mi)^\s*III\.\s*Đáp án và giải thích trả lời ngắn\s*$",
    ]
    matches = [re.search(label, text) for label in labels]
    if any(match is None for match in matches):
        raise ValueError("Could not find all three answer/explanation sections")
    found = [match for match in matches if match is not None]
    if [item.start() for item in found] != sorted(item.start() for item in found):
        raise ValueError("Answer sections are out of order")
    return [
        text[marker.end() : found[index + 1].start() if index + 1 < len(found) else len(text)]
        for index, marker in enumerate(found)
    ]


def parse_answers(
    text: str,
    questions: list[dict[str, Any]],
    exam_id: str,
    source_id: str,
    exam_number: int,
) -> dict[str, dict[str, Any]]:
    parts = answer_sections(text)
    question_by_number: dict[str, list[dict[str, Any]]] = {"part_1": [], "part_2": [], "part_3": []}
    for question in questions:
        question_by_number[question["sectionId"]].append(question)
    keyed: dict[str, dict[str, Any]] = {}

    mcq_answers = {
        match.group(1): match.group(2)
        for match in re.finditer(r"(?mi)^\s*Câu\s*(\d+)\s*:\s*([A-D])\s*[.]", parts[0])
    }
    if len(mcq_answers) != 20:
        raise ValueError(f"{exam_id}: found {len(mcq_answers)}/20 multiple-choice answers")
    for question in question_by_number["part_1"]:
        n = question["number"]
        if n not in mcq_answers:
            raise ValueError(f"{exam_id} Part I question {n}: answer missing")
        key_match = re.search(rf"(?mi)^\s*Câu\s*{n}\s*:\s*[A-D]\s*[.]\s*(.*)$", parts[0])
        keyed[question["id"]] = {
            "correctOptionKey": mcq_answers[n],
            "explanation": tidy(key_match.group(1) if key_match else ""),
        }

    tf_groups: dict[str, dict[str, Any]] = {}
    current_number: str | None = None
    for line in parts[1].splitlines():
        question_marker = re.match(r"\s*Câu\s*(\d+)\s*[.:]", line, re.I)
        if question_marker:
            current_number = question_marker.group(1)
            tf_groups.setdefault(current_number, {"answers": {}, "explanations": {}})
            continue
        statement_marker = re.match(r"\s*([a-d])\s*[).]\s*(Đúng|Sai)\s*:?[\s]*(.*)$", line, re.I)
        if current_number and statement_marker:
            tf_groups[current_number]["answers"][statement_marker.group(1).lower()] = statement_marker.group(2).lower()
            tf_groups[current_number]["explanations"][statement_marker.group(1).lower()] = statement_marker.group(3).strip()
    if len(tf_groups) != 10 or any(set(items["answers"]) != set("abcd") for items in tf_groups.values()):
        raise ValueError(f"{exam_id}: true/false answer key is incomplete")
    for question in question_by_number["part_2"]:
        answers = tf_groups.get(question["number"])
        if not answers:
            raise ValueError(f"{exam_id} Part II question {question['number']}: answers missing")
        keyed[question["id"]] = {
            "correctStatements": {key: value == "đúng" for key, value in answers["answers"].items()},
            "scoring": {"kind": "all_or_nothing"},
            "explanation": "\n".join(
                f"{key}) {answers['explanations'].get(key, '')}" for key in "abcd"
            ),
        }

    short_answers: dict[str, tuple[str, str]] = {}
    for match in re.finditer(r"(?mi)^\s*Câu\s*(\d+)\s*:\s*(.+)$", parts[2]):
        body = match.group(2).strip()
        split = re.match(r"(.+?)(?:\.\s+)(.*)$", body)
        answer = split.group(1).strip().rstrip(".") if split else body.rstrip(".")
        explanation = split.group(2).strip() if split else ""
        short_answers[match.group(1)] = (answer, explanation)
    if len(short_answers) != 10:
        raise ValueError(f"{exam_id}: found {len(short_answers)}/10 short answers")
    for question in question_by_number["part_3"]:
        result = short_answers.get(question["number"])
        if not result:
            raise ValueError(f"{exam_id} Part III question {question['number']}: answer missing")
        answer, explanation = result
        editorial_corrections = []
        if source_id == "nguyen_ham" and exam_number == 2 and question["number"] == "10":
            editorial_corrections.append({
                "sourceAnswer": answer,
                "publishedAnswer": "7",
                "reason": "Kiểm tra trực tiếp: nguyên hàm là 3x³+3x²+x, tổng hệ số bằng 7; đáp án 8 trong Word không khớp phép tính.",
            })
            answer = "7"
        keyed[question["id"]] = {
            "canonicalAnswer": answer,
            "acceptedNormalizedAnswers": [answer],
            "explanation": explanation,
            "editorialCorrections": editorial_corrections,
        }

    if len(keyed) != 40:
        raise ValueError(f"{exam_id}: answer key does not cover all 40 questions")
    return keyed


def parse_source(source_id: str, topic: str, path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
    if not path.is_file():
        raise FileNotFoundError(path)
    document = Document(path)
    lines = [paragraph_text(paragraph) for paragraph in document.paragraphs]
    exams: list[dict[str, Any]] = []
    private: list[dict[str, Any]] = []
    source_meta = {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

    for exam_number in (1, 2):
        question_text, answer_text = split_exam(lines, exam_number)
        public_sections: list[dict[str, Any]] = []
        all_questions: list[dict[str, Any]] = []
        private_questions: list[dict[str, Any]] = []
        for section_index, body in enumerate(section_texts(question_text)):
            blocks = question_blocks(body)
            if len(blocks) != EXPECTED_COUNTS[section_index]:
                raise ValueError(
                    f"{path.name} exam {exam_number} section {section_index + 1}: "
                    f"expected {EXPECTED_COUNTS[section_index]} questions, found {len(blocks)}"
                )
            question_items, private_items = [], []
            for number, raw in blocks:
                item, private_item = parse_question_block(section_index, number, raw, f"{source_id}-{exam_number}")
                question_items.append(item)
                private_items.append(private_item)
            section_id, vi_label, en_label = SECTION_LABELS[section_index]
            public_sections.append({"id": section_id, "label": {"vi": vi_label, "en": en_label}, "questions": question_items})
            all_questions.extend(question_items)
            private_questions.extend(private_items)

        answers = parse_answers(
            answer_text,
            all_questions,
            f"{source_id}-{exam_number}",
            source_id,
            exam_number,
        )
        for private_item in private_questions:
            private_item.update(answers[private_item["id"]])
        slug = f"practice-{source_id}-{exam_number}"
        exams.append({
            "id": slug,
            "slug": slug,
            "title": f"Đề ôn tập {topic} số {exam_number}",
            "description": f"40 câu · 10 điểm · Ôn tập {topic} theo đề Word đã nhập.",
            "language": "vi",
            "mode": "practice",
            "demo": False,
            "category": "topic_review",
            "topicId": source_id,
            "topic": topic,
            "sourceFile": path.name,
            "sourceExamNumber": exam_number,
            "timingMode": "elapsed",
            "durationSeconds": None,
            "totalScore": 10,
            "questionCount": len(all_questions),
            "sections": [
                {"id": section["id"], "title": section["label"]["vi"], "description": "", "maxScore": len(section["questions"]) * 0.25}
                for section in public_sections
            ],
            "questions": all_questions,
            "contentStatus": "owner_approved",
            "publicationRightsStatus": "owner_confirmed",
            "sourceSha256": source_meta["sha256"],
        })
        private.append({"id": slug, "sourceFile": path.name, "sourceExamNumber": exam_number, "questions": private_questions})

    return exams, private, source_meta


def main() -> None:
    public_exams: list[dict[str, Any]] = []
    private_exams: list[dict[str, Any]] = []
    sources = []
    for source_id, topic, path in SOURCES:
        exams, private, source_meta = parse_source(source_id, topic, path)
        public_exams.extend(exams)
        private_exams.extend(private)
        sources.append({"topicId": source_id, "topic": topic, **source_meta})
    if len(public_exams) != 4 or sum(exam["questionCount"] for exam in public_exams) != 160:
        raise ValueError("Expected exactly four exams and 160 questions")
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    PRIVATE.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.write_text(json.dumps({"formatVersion": 1, "sources": sources, "exams": public_exams}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PRIVATE.write_text(json.dumps({"formatVersion": 1, "sources": sources, "exams": private_exams}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"examCount": len(public_exams), "questionCount": 160, "sets": [exam["id"] for exam in public_exams], "sourceFiles": [item["file"] for item in sources]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

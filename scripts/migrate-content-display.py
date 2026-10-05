"""Add editable VI/EN display layers without changing any extracted source fields."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "content" / "extracted"


def migrate_question(question: dict[str, Any]) -> bool:
    before = json.dumps(question, ensure_ascii=False, sort_keys=True)
    statement = question.get("statement", "") or question.get("raw_statement", "")
    options = question.get("options", [])
    statements = question.get("substatements", [])
    explanation = question.get("explanation")
    defaults = {
        "raw_statement": statement,
        "display_statement_vi": statement,
        "display_statement_en": "",
        "raw_options": options,
        "display_options_vi": options,
        "display_options_en": [{**item, "text": ""} for item in options],
        "raw_true_false_statements": statements,
        "display_true_false_statements_vi": statements,
        "display_true_false_statements_en": [{**item, "text": ""} for item in statements],
        "raw_short_answer_prompt": statement,
        "display_short_answer_prompt_vi": statement,
        "display_short_answer_prompt_en": "",
        "raw_explanation": explanation,
        "display_explanation_vi": explanation,
        "display_explanation_en": "",
        "translation_status": "not_started",
        "content_review_status": "needs_review",
        "edited_at": None,
        "edited_by": None,
        "content_approved_at": None,
        "translation_approved_at": None,
        "translation_approved_by": None,
    }
    for key, value in defaults.items():
        question.setdefault(key, value)
    if not question.get("display_statement_vi") and statement:
        question["display_statement_vi"] = statement
    return before != json.dumps(question, ensure_ascii=False, sort_keys=True)


def main() -> int:
    changed = 0
    for path in sorted(CONTENT_ROOT.glob("*/questions.json")):
        document = json.loads(path.read_text(encoding="utf-8"))
        questions = document.get("questions")
        if not isinstance(questions, list):
            continue
        dirty = False
        for question in questions:
            dirty = migrate_question(question) or dirty
        if dirty:
            path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            changed += 1
    print(f"Added separate display layers to {changed} source question files; raw evidence was retained.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

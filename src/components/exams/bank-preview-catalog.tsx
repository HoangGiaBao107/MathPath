"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useLocale } from "@/components/providers/locale-provider";
import { resultDesignCopy } from "@/lib/i18n/result-design-copy";

type CatalogExam = { id: string; title: string; count: number; minutes: number | null; official: boolean };

export function BankPreviewCatalog({ exams }: { exams: CatalogExam[] }) {
  const { locale } = useLocale();
  const copy = resultDesignCopy[locale];
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const visible = exams.filter(exam => (filter === "all" || exam.official === (filter === "mock")) && `${exam.title} ${exam.id}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)));
  return <main className="bank-preview" id="main-content">
    <header className="bank-preview-hero">
      <div><p className="eyebrow">{copy.library}</p><h1>{copy.title}</h1><p className="bank-preview-description">{copy.description}</p></div>
      <div className="bank-preview-stats"><div><strong>{exams.length}</strong><span>{copy.exams}</span></div><div><strong>{exams.reduce((sum, exam) => sum + exam.count, 0)}</strong><span>{copy.questions}</span></div></div>
    </header>
    <p className="bank-preview-notice"><span aria-hidden="true">◉</span> {copy.preview}</p>
    <div className="bank-preview-toolbar">
      <div className="bank-preview-tabs" aria-label={copy.library}>{(["all", "mock", "practice"] as const).map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{copy[key]}</button>)}</div>
      <input type="search" aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => setSearch(event.target.value)} />
    </div>
    <div className="bank-preview-grid">{visible.map(exam => <Link className="bank-preview-card" key={exam.id} href={`/dev/mathpath-bank/${exam.id}` as Route}>
      <div className="bank-preview-card-top"><span className="bank-preview-code">{exam.id}</span><span>{exam.official ? copy.mock : copy.practice}</span></div>
      <h2>{exam.title.replace(/\s*[–—-]\s*MathPath\s*\(biên soạn mới\)/, "")}</h2>
      <div className="bank-preview-meta"><span>{exam.count} {copy.questions}</span>{exam.minutes ? <span>{exam.minutes} {copy.minutes}</span> : null}</div>
      <div className="bank-preview-card-footer"><span>{copy.open}</span><span aria-hidden="true">↗</span></div>
    </Link>)}</div>
    {!visible.length ? <p className="bank-preview-empty" role="status">{copy.empty}</p> : null}
  </main>;
}

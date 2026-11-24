"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamFigure } from "@/lib/exams/types";
import styles from "./question-assets.module.css";

type PdfModule = typeof import("pdfjs-dist");
type PdfDocument = Awaited<ReturnType<PdfModule["getDocument"]>["promise"]>;
type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;

const pdfDocuments = new Map<string, Promise<PdfDocument>>();
let pdfModulePromise: Promise<PdfModule> | null = null;

function loadPdfModule() {
  pdfModulePromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return pdfjs;
  });
  return pdfModulePromise;
}

function getPdfDocument(url: string, pdfjs: PdfModule) {
  let documentPromise = pdfDocuments.get(url);
  if (!documentPromise) {
    documentPromise = pdfjs.getDocument({ url }).promise;
    pdfDocuments.set(url, documentPromise);
    documentPromise.catch(() => pdfDocuments.delete(url));
  }
  return documentPromise;
}

type PositionedFigure = ExamFigure & { box: [number, number, number, number] };

function pdfPageNumber(alt: string) {
  const match = alt.match(/^\[mp-pdf-page:(\d+)\]/);
  return match ? Number(match[1]) : null;
}

function positionFromAlt(figure: ExamFigure): PositionedFigure | null {
  const match = figure.alt.match(/^\[mp-overlay:([\d.,-]+)\]\s*(.*)$/);
  if (!match) return null;
  const values = match[1].split(",").map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  return { ...figure, alt: match[2], box: [values[0], values[1], values[2], values[3]] };
}

export function ExamQuestionAssets({ figures }: { figures?: ExamFigure[] }) {
  const rows = figures ?? [];
  const pdfFigure = rows.find((figure) => pdfPageNumber(figure.alt) !== null);
  const pageNumber = pdfFigure ? pdfPageNumber(pdfFigure.alt) : null;
  const positioned = rows.map(positionFromAlt).filter((row): row is PositionedFigure => row !== null);
  const positionedUrls = new Set(positioned.map((figure) => figure.url));
  const standalone = rows.filter(
    (figure) => figure !== pdfFigure && !positionedUrls.has(figure.url),
  );

  return (
    <>
      {pdfFigure && pageNumber !== null ? (
        <PdfQuestionPage
          figure={pdfFigure}
          overlays={positioned}
          pageNumber={pageNumber}
        />
      ) : null}
      {standalone.map((figure) => (
        <figure className={styles.standaloneFigure} key={figure.url}>
          <img src={figure.url} alt={figure.alt} loading="lazy" />
        </figure>
      ))}
    </>
  );
}

function PdfQuestionPage({
  figure,
  overlays,
  pageNumber,
}: {
  figure: ExamFigure;
  overlays: PositionedFigure[];
  pageNumber: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const loadKey = `${figure.url}#${pageNumber}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    page: PdfPage | null;
    error: boolean;
  }>({ key: "", page: null, error: false });
  const page = loaded.key === loadKey ? loaded.page : null;
  const error = loaded.key === loadKey && loaded.error;

  useEffect(() => {
    const host = scrollRef.current;
    if (!host) return;
    const measure = () => setHostWidth(host.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = scrollRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNearViewport) return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await loadPdfModule();
        const document = await getPdfDocument(figure.url, pdfjs);
        const nextPage = await document.getPage(pageNumber);
        if (!cancelled) setLoaded({ key: loadKey, page: nextPage, error: false });
      } catch {
        if (!cancelled) setLoaded({ key: loadKey, page: null, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [figure.url, isNearViewport, loadKey, pageNumber]);

  const targetWidth = hostWidth ? Math.max(540, Math.min(hostWidth, 760)) : 600;
  const pageWidth = page?.view[2] ? page.view[2] - page.view[0] : 595.28;
  const scale = targetWidth / pageWidth;
  const pageHeight = page ? (page.view[3] - page.view[1]) * scale : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayerContainer = textLayerRef.current;
    if (!isNearViewport || !page || !canvas || !textLayerContainer) return;

    let cancelled = false;
    let renderTask: ReturnType<PdfPage["render"]> | null = null;
    let textLayer: InstanceType<PdfModule["TextLayer"]> | null = null;
    const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.ceil(viewport.width * deviceScale);
    canvas.height = Math.ceil(viewport.height * deviceScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    textLayerContainer.replaceChildren();
    textLayerContainer.style.width = `${viewport.width}px`;
    textLayerContainer.style.height = `${viewport.height}px`;
    textLayerContainer.style.setProperty("--total-scale-factor", String(scale));

    void (async () => {
      try {
        renderTask = page.render({
          canvas,
          viewport,
          ...(deviceScale === 1
            ? {}
            : { transform: [deviceScale, 0, 0, deviceScale, 0, 0] }),
          background: "#fff",
        });
        await renderTask.promise;
        if (cancelled) return;
        const pdfjs = await loadPdfModule();
        const textContent = await page.getTextContent({ includeMarkedContent: true });
        if (cancelled) return;
        textLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerContainer,
          viewport,
        });
        await textLayer.render();
      } catch {
        if (!cancelled) {
          setLoaded((current) =>
            current.key === loadKey ? { ...current, error: true } : current,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      textLayerContainer.replaceChildren();
    };
  }, [isNearViewport, loadKey, page, scale]);

  return (
    <figure className={styles.sourceFigure}>
      <div className={styles.scrollArea} ref={scrollRef}>
        {error ? (
          <div className={styles.error} role="alert">
            Không tải được nội dung đề. Vui lòng tải lại trang.
          </div>
        ) : page ? (
          <div
            className={styles.page}
            style={{ width: targetWidth, height: pageHeight }}
            aria-label={figure.alt.replace(/^\[mp-pdf-page:\d+\]\s*/, "")}
          >
            <canvas aria-hidden="true" className={styles.canvas} ref={canvasRef} />
            <div aria-label="Văn bản đề có thể chọn và sao chép" className={styles.textLayer} ref={textLayerRef} />
            {overlays.map((overlay) => (
              <img
                alt={overlay.alt}
                className={styles.overlay}
                key={overlay.url}
                loading="lazy"
                src={overlay.url}
                style={{
                  left: overlay.box[0] * scale,
                  top: overlay.box[1] * scale,
                  width: overlay.box[2] * scale,
                  height: overlay.box[3] * scale,
                }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.loading} aria-label="Đang tải đề" style={{ width: targetWidth }} />
        )}
      </div>
      <figcaption className={styles.caption}>{figure.alt.replace(/^\[mp-pdf-page:\d+\]\s*/, "")}</figcaption>
    </figure>
  );
}

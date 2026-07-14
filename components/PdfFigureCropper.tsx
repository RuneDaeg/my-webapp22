"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

// PDF 원본은 브라우저 안에서만 렌더링된다 — 서버로는 크롭된 그림(작은 PNG)만 전송된다.
const RENDER_SCALE = 2; // 크롭 품질을 위해 고해상도로 렌더링하고 화면에는 축소 표시

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PdfFigureCropperProps {
  file: File;
  initialPage: number;
  onCropped: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

export function PdfFigureCropper({ file, initialPage, onCropped, onClose }: PdfFigureCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [pageNum, setPageNum] = useState(Math.max(1, initialPage));
  const [totalPages, setTotalPages] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderPage = useCallback(async (num: number) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    const page = await doc.getPage(num);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const data = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setTotalPages(doc.numPages);
        const startPage = Math.min(Math.max(1, initialPage), doc.numPages);
        setPageNum(startPage);
        await renderPage(startPage);
        setLoading(false);
      } catch {
        if (!cancelled) setError("PDF를 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.loadingTask.destroy();
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  async function goToPage(num: number) {
    if (!docRef.current || num < 1 || num > totalPages) return;
    setPageNum(num);
    setRect(null);
    await renderPage(num);
  }

  function pointerPos(e: React.PointerEvent): { x: number; y: number } {
    const bounds = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, e.clientX - bounds.left), bounds.width),
      y: Math.min(Math.max(0, e.clientY - bounds.top), bounds.height),
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (loading || uploading) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = pointerPos(e);
    dragStartRef.current = pos;
    setRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function handlePointerMove(e: React.PointerEvent) {
    const start = dragStartRef.current;
    if (!start) return;
    const pos = pointerPos(e);
    setRect({
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      w: Math.abs(pos.x - start.x),
      h: Math.abs(pos.y - start.y),
    });
  }

  function handlePointerUp() {
    dragStartRef.current = null;
    setRect((r) => (r && r.w > 8 && r.h > 8 ? r : null));
  }

  async function handleCrop() {
    const canvas = canvasRef.current;
    if (!canvas || !rect) return;
    setUploading(true);
    setError(null);
    try {
      // 화면 표시 크기 → 원본 캔버스 좌표로 환산
      const factor = canvas.width / canvas.clientWidth;
      const crop = document.createElement("canvas");
      crop.width = Math.round(rect.w * factor);
      crop.height = Math.round(rect.h * factor);
      const ctx = crop.getContext("2d");
      if (!ctx) throw new Error();
      ctx.drawImage(
        canvas,
        Math.round(rect.x * factor),
        Math.round(rect.y * factor),
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      );
      const blob = await new Promise<Blob | null>((resolve) => crop.toBlob(resolve, "image/png"));
      if (!blob) throw new Error();
      await onCropped(blob);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "그림을 잘라내지 못했습니다.");
      setUploading(false);
      return;
    }
    setUploading(false);
  }

  return (
    <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <button
            type="button"
            onClick={() => goToPage(pageNum - 1)}
            disabled={pageNum <= 1 || loading}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 disabled:opacity-40"
          >
            ◀
          </button>
          <span>
            {pageNum} / {totalPages || "?"}쪽
          </span>
          <button
            type="button"
            onClick={() => goToPage(pageNum + 1)}
            disabled={pageNum >= totalPages || loading}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 disabled:opacity-40"
          >
            ▶
          </button>
        </div>
        <div className="flex items-center gap-2">
          {rect && (
            <button
              type="button"
              onClick={handleCrop}
              disabled={uploading}
              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? "첨부 중..." : "선택 영역 첨부"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">그림 영역을 마우스로 드래그해서 선택하세요.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">PDF 페이지를 불러오는 중...</p>}
      <div
        ref={containerRef}
        className="relative cursor-crosshair select-none overflow-hidden rounded border border-gray-300 bg-white"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <canvas ref={canvasRef} className="block w-full" />
        {rect && (
          <div
            className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/10"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
        )}
      </div>
    </div>
  );
}

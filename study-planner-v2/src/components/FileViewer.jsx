import { useState, useEffect, useRef, useCallback } from "react";
import AiAssistant from "./AiAssistant";

const PDFJS_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const MAMMOTH_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function waitForGlobal(name, timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (window[name]) {
      resolve(window[name]);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window[name]) {
        clearInterval(interval);
        resolve(window[name]);
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for window.${name}`));
      }
    }, 50);
  });
}

export default function FileViewer({ file, onBack }) {
  const [docText, setDocText] = useState("");
  const [renderStatus, setRenderStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [selectionPos, setSelectionPos] = useState(null);
  // AI panel: closed by default on mobile, open on desktop
  const [aiPanelOpen, setAiPanelOpen] = useState(() => window.innerWidth > 768);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const viewerRef = useRef();
  const pdfDocRef = useRef();

  useEffect(() => {
    if (!file) return;
    if (file.type === "pdf") renderPDF();
    else renderDOCX();
  }, [file]);

  // Text selection
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (
        text &&
        text.length > 5 &&
        viewerRef.current?.contains(sel.anchorNode)
      ) {
        setSelectedText(text);
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setSelectionPos({
          top: rect.top + window.scrollY,
          left: rect.left + rect.width / 2,
        });
      } else if (!text) {
        setSelectedText("");
        setSelectionPos(null);
      }
    };
    document.addEventListener("mouseup", handler);
    document.addEventListener("touchend", handler);
    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("touchend", handler);
    };
  }, []);

  // ── PDF rendering ───────────────────────────────────────────────────
  async function renderPDF() {
    try {
      await loadScript(PDFJS_URL);
      const pdfjs = await waitForGlobal("pdfjsLib");
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

      const bufferCopy = file.data.slice(0);
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(bufferCopy) })
        .promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);

      // Extract text for AI (up to 30 pages)
      let fullText = "";
      for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((s) => s.str).join(" ") + "\n";
      }
      setDocText(fullText);

      await renderPDFPage(pdf, 1);
      setRenderStatus("ready");
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "Could not render PDF. The file may be corrupted or password-protected.",
      );
      setRenderStatus("error");
    }
  }

  async function renderPDFPage(pdf, pageNum) {
    const container = viewerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const page = await pdf.getPage(pageNum);

    // ── Mobile-aware scaling ───────────────────────────────────────────
    // Measure the container's actual pixel width (accounts for padding)
    const containerWidth = container.clientWidth || window.innerWidth - 32;
    const natural = page.getViewport({ scale: 1 });

    // Scale so the page fills the container exactly, capped at 1.8 on desktop
    const maxScale = window.innerWidth <= 768 ? 1.0 : 1.8;
    const scale = Math.min(containerWidth / natural.width, maxScale);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Always fill container, never overflow
    canvas.style.width = "100%";
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";

    container.appendChild(canvas);
    await page.render({ canvasContext: context, viewport }).promise;
    setCurrentPage(pageNum);
  }

  async function goToPage(pageNum) {
    if (!pdfDocRef.current) return;
    await renderPDFPage(
      pdfDocRef.current,
      Math.max(1, Math.min(pageNum, totalPages)),
    );
  }

  // ── DOCX rendering ─────────────────────────────────────────────────
  async function renderDOCX() {
    try {
      await loadScript(MAMMOTH_URL);
      const mammoth = await waitForGlobal("mammoth");
      const result = await mammoth.convertToHtml({ arrayBuffer: file.data });
      const html = result.value;

      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      setDocText(tmp.textContent || "");

      if (viewerRef.current) {
        viewerRef.current.innerHTML = `<div class="docx-body">${html}</div>`;
      }
      setRenderStatus("ready");
    } catch (err) {
      console.error(err);
      setErrorMsg("Could not render DOCX file. The file may be corrupted.");
      setRenderStatus("error");
    }
  }

  const clearSelection = useCallback(() => {
    setSelectedText("");
    setSelectionPos(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const isMobile = window.innerWidth <= 768;

  return (
    <div className="file-viewer">
      {/* ── Top bar ── */}
      <div className="fv-topbar">
        <button className="fv-back-btn" onClick={onBack}>
          ← Back
        </button>

        <div className="fv-file-info">
          <span className="fv-filename" title={file.name}>
            {file.name}
          </span>
          {file.type === "pdf" && totalPages > 0 && (
            <span className="fv-page-info">
              {currentPage}/{totalPages}
            </span>
          )}
        </div>

        <button
          className={`fv-ai-toggle ${aiPanelOpen ? "active" : ""}`}
          onClick={() => setAiPanelOpen((p) => !p)}
          title="Toggle AI assistant"
        >
          ◈ AI
        </button>
      </div>

      {/* ── Mobile AI sheet indicator (when closed) ── */}
      {isMobile && !aiPanelOpen && renderStatus === "ready" && (
        <button
          className="fv-mobile-ai-bar"
          onClick={() => setAiPanelOpen(true)}
        >
          ◈ Open AI Assistant
        </button>
      )}

      {/* ── Split layout ── */}
      <div className={`fv-split ${!aiPanelOpen ? "ai-hidden" : ""}`}>
        {/* Document side */}
        <div className="fv-doc-side">
          {renderStatus === "loading" && (
            <div className="fv-loading">
              <div className="fl-spinner lg" />
              <p>Rendering document…</p>
            </div>
          )}

          {renderStatus === "error" && (
            <div className="fv-error">
              <span className="fv-error-icon">⚠</span>
              <p>{errorMsg}</p>
              <button className="btn-ghost" onClick={onBack}>
                Back to library
              </button>
            </div>
          )}

          <div
            ref={viewerRef}
            className={`fv-doc-content ${file.type === "pdf" ? "pdf-mode" : "docx-mode"}`}
            style={{ display: renderStatus === "ready" ? "block" : "none" }}
          />

          {/* PDF page nav */}
          {file.type === "pdf" &&
            renderStatus === "ready" &&
            totalPages > 1 && (
              <div className="fv-page-nav">
                <button
                  className="fv-page-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  ← Prev
                </button>
                <div className="fv-page-input-wrap">
                  <input
                    className="fv-page-input"
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => goToPage(Number(e.target.value))}
                  />
                  <span className="fv-page-total">/ {totalPages}</span>
                </div>
                <button
                  className="fv-page-btn"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next →
                </button>
              </div>
            )}
        </div>

        {/* AI side */}
        {aiPanelOpen && (
          <div className="fv-ai-side">
            {/* Mobile: show close button at top of AI panel */}
            {isMobile && (
              <button
                className="fv-mobile-ai-close"
                onClick={() => setAiPanelOpen(false)}
              >
                ✕ Close AI panel
              </button>
            )}
            <AiAssistant
              documentText={docText}
              fileName={file.name}
              selectedText={selectedText}
              onClearSelection={clearSelection}
            />
          </div>
        )}
      </div>

      {/* Floating explain tooltip */}
      {selectedText && selectionPos && aiPanelOpen && (
        <div
          className="fv-selection-tooltip"
          style={{ top: selectionPos.top - 44, left: selectionPos.left }}
        >
          <button
            className="fv-tooltip-btn"
            onClick={() =>
              document.querySelector(".ai-quick-actions .highlight")?.click()
            }
          >
            ◈ Explain this
          </button>
          <button className="fv-tooltip-close" onClick={clearSelection}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

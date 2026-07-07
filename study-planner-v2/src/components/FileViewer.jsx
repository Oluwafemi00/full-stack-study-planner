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
  const [pageTexts, setPageTexts] = useState([]);

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

      // Extract only the first 5 pages upfront for general document context (fast loading)
      let initialText = "";
      const initialPageTexts = new Array(pdf.numPages).fill("");

      for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((s) => s.str).join(" ");
        initialPageTexts[i - 1] = pageText;
        initialText += pageText + "\n";
      }

      setDocText(initialText);
      setPageTexts(initialPageTexts);

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

    const pdfjs = await waitForGlobal("pdfjsLib");
    const page = await pdf.getPage(pageNum);

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = container.clientWidth || window.innerWidth - 32;
    const natural = page.getViewport({ scale: 1 });
    const cssScale = containerWidth / natural.width;
    const renderScale = cssScale * dpr;
    const viewport = page.getViewport({ scale: renderScale });

    // 1. Create a positioning wrapper for this page
    const pageWrapper = document.createElement("div");
    pageWrapper.className = "pdf-page-container";
    pageWrapper.style.width = `${Math.floor(viewport.width / dpr)}px`;
    pageWrapper.style.height = `${Math.floor(viewport.height / dpr)}px`;

    // 2. Setup the Canvas (The Visuals)
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    pageWrapper.appendChild(canvas);

    // 3. Setup the Text Layer (The Selectable HTML)
    const textLayerDiv = document.createElement("div");
    textLayerDiv.className = "textLayer";
    // PDF.js uses CSS variables to scale the text to match the canvas
    textLayerDiv.style.setProperty("--scale-factor", renderScale / dpr);
    pageWrapper.appendChild(textLayerDiv);

    // Mount everything to the DOM
    container.appendChild(pageWrapper);

    // 4. Render the Canvas Visuals
    const renderContext = { canvasContext: context, viewport: viewport };
    await page.render(renderContext).promise;

    // 5. Render the Invisible Text Layer over it
    const textContent = await page.getTextContent();
    await pdfjs.renderTextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport: viewport,
      textDivs: [],
    }).promise;

    setCurrentPage(pageNum);

    // LAZY LOAD TEXT: Extract text for AI only when the user visits this page
    setPageTexts((prev) => {
      if (prev[pageNum - 1]) return prev;

      // Since we already awaited textContent for the text layer, we can just use it immediately!
      const text = textContent.items.map((s) => s.str).join(" ");
      const newTexts = [...prev];
      newTexts[pageNum - 1] = text;

      return newTexts;
    });
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          AI
        </button>
      </div>

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
          <>
            {/* Mobile Backdrop for clicking outside to close */}
            {isMobile && (
              <div
                className="fv-ai-backdrop"
                onClick={() => setAiPanelOpen(false)}
                aria-label="Close AI Assistant"
              />
            )}

            <div className="fv-ai-side">
              {/* Mobile: show close button at top of AI panel
              {isMobile && (
                <button
                  className="fv-mobile-ai-close"
                  onClick={() => setAiPanelOpen(false)}
                >
                  ✕ Close AI panel
                </button>
              )} */}
              <AiAssistant
                documentText={docText}
                fileName={file.name}
                selectedText={selectedText}
                onClearSelection={clearSelection}
                currentPage={currentPage}
                pageTexts={pageTexts}
              />
            </div>
          </>
        )}

        {/* Floating explain tooltip - Now visible even when AI is closed! */}
        {selectedText && selectionPos && (
          <div
            className="fv-selection-tooltip"
            style={{ top: selectionPos.top - 44, left: selectionPos.left }}
          >
            <button
              className="fv-tooltip-btn"
              onClick={() => {
                // 1. Force the AI panel to open if it is closed
                if (!aiPanelOpen) setAiPanelOpen(true);

                // 2. Wait a split second for React to mount the AiAssistant DOM,
                //    then virtually click the explain button
                setTimeout(() => {
                  document
                    .querySelector(".ai-quick-actions .highlight")
                    ?.click();
                }, 150);
              }}
            >
              ◈ Explain this
            </button>
            <button className="fv-tooltip-close" onClick={clearSelection}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

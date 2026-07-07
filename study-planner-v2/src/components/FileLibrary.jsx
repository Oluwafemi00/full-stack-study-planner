import { useState, useEffect, useRef } from "react";
import {
  getAllFiles,
  saveFile,
  deleteFile,
  readFileAsArrayBuffer,
  formatFileSize,
} from "../utils/fileStorage";

const ACCEPTED = ".pdf,.docx,.doc";
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export default function FileLibrary({ onOpenFile }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef();

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    try {
      const all = await getAllFiles();
      setFiles(all.sort((a, b) => b.uploadedAt - a.uploadedAt));
    } catch {
      setError("Could not load file library.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    inputRef.current.value = "";

    if (file.size > MAX_SIZE) {
      setError("File too large. Maximum size is 20 MB.");
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const record = {
        id: Date.now(),
        name: file.name,
        type: ext,
        size: file.size,
        uploadedAt: Date.now(),
        data: buffer,
      };
      await saveFile(record);
      setFiles((prev) => [record, ...prev]);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await deleteFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const typeIcon = (type) => (type === "pdf" ? "📄" : "📝");
  const typeColor = (type) => (type === "pdf" ? "var(--red)" : "var(--blue)");

  return (
    <div className="file-library">
      {/* Header */}
      <div className="fl-header">
        <div>
          <h2 className="list-title">Study Library</h2>
          <p className="dashboard-sub">
            Upload notes, ask questions, generate quizzes, and review faster.
          </p>
        </div>
        <button
          className="btn-primary fl-upload-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "+ Upload Note"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleUpload}
          style={{ display: "none" }}
        />
      </div>

      {error && (
        <div className="fl-error">
          <span>{error}</span>
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}

      {/* Search */}
      {files.length > 3 && (
        <div className="fl-search-wrap">
          <input
            className="fl-search"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* File grid */}
      {loading ? (
        <div className="fl-loading">
          <div className="fl-spinner" />
          <span>Loading library…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="fl-empty" onClick={() => inputRef.current?.click()}>
          <div className="fl-empty-icon">📂</div>
          <p>
            {search
              ? "No note match your search."
              : "No note yet — click to upload your first note."}
          </p>
          {!search && (
            <span className="fl-empty-hint">
              Supports PDF and DOCX · Max 20 MB
            </span>
          )}
        </div>
      ) : (
        <div className="fl-grid">
          {filtered.map((file) => (
            <div key={file.id} className="fl-card">
              <div className="fl-card-top" onClick={() => onOpenFile(file)}>
                <span
                  className="fl-type-icon"
                  style={{ color: typeColor(file.type) }}
                >
                  {typeIcon(file.type)}
                </span>
                <span
                  className="fl-type-badge"
                  style={{
                    color: typeColor(file.type),
                    borderColor: typeColor(file.type) + "44",
                    background: typeColor(file.type) + "11",
                  }}
                >
                  {file.type.toUpperCase()}
                </span>
              </div>

              <div className="fl-card-body" onClick={() => onOpenFile(file)}>
                <p className="fl-filename" title={file.name}>
                  {file.name}
                </p>
                <div className="fl-meta">
                  <span>{formatFileSize(file.size)}</span>
                  <span>·</span>
                  <span>
                    {new Date(file.uploadedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div className="fl-card-footer">
                <button
                  className="fl-open-btn"
                  onClick={() => onOpenFile(file)}
                >
                  Study →
                </button>
                <button
                  className="fl-delete-btn"
                  onClick={() => handleDelete(file.id, file.name)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

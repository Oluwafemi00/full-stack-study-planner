import { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import {
  saveFile,
  deleteFile,
  readFileAsArrayBuffer,
  formatFileSize,
} from "../utils/fileStorage";

const ACCEPTED = ".pdf,.docx,.doc";
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export default function FileLibrary() {
  const { state, dispatch } = useApp();
  const { files } = state; // Lightweight array from Context

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef();

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    inputRef.current.value = "";

    if (file.size > MAX_SIZE) {
      setError("File too large. Maximum size is 50 MB.");
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
      const fileId = Date.now();

      // Heavy Record for IndexedDB
      const record = {
        id: fileId,
        name: file.name,
        type: ext,
        size: file.size,
        uploadedAt: Date.now(),
        data: buffer,
      };

      // Light Record for LocalStorage/Context
      const lightMeta = {
        id: fileId,
        name: file.name,
        type: ext,
        size: file.size,
        uploadedAt: Date.now(),
      };

      await saveFile(record);
      dispatch({ type: "ADD_FILE_META", payload: lightMeta });
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await deleteFile(id);
    dispatch({ type: "DELETE_FILE", payload: id });
  }

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const typeIcon = (type) => (type === "pdf" ? "📄" : "📝");
  const typeColor = (type) => (type === "pdf" ? "var(--red)" : "var(--blue)");

  return (
    <div className="file-library">
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

      {filtered.length === 0 ? (
        <div className="fl-empty" onClick={() => inputRef.current?.click()}>
          <div className="fl-empty-icon">📂</div>
          <p>
            {search
              ? "No note match your search."
              : "No note yet — click to upload your first note."}
          </p>
          {!search && (
            <span className="fl-empty-hint">
              Supports PDF and DOCX · Max 50 MB
            </span>
          )}
        </div>
      ) : (
        <div className="fl-grid">
          {filtered.map((file) => (
            <div key={file.id} className="fl-card">
              <div
                className="fl-card-top"
                onClick={() =>
                  dispatch({ type: "OPEN_FILE", payload: file.id })
                }
                style={{ cursor: "pointer" }}
              >
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

              <div
                className="fl-card-body"
                onClick={() =>
                  dispatch({ type: "OPEN_FILE", payload: file.id })
                }
                style={{ cursor: "pointer" }}
              >
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
                  onClick={() =>
                    dispatch({ type: "OPEN_FILE", payload: file.id })
                  }
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

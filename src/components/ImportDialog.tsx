"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { importChatApi, importChatFromFolderApi } from "@/lib/api";
import { isElectron, selectImportFolder } from "@/lib/electron";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function FolderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ImportDialog({ isOpen, onClose, onSuccess }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isElectronApp, setIsElectronApp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isElectron().then(setIsElectronApp);
  }, []);

  const resetForm = useCallback(() => {
    setFile(null);
    setFolderPath(null);
    setName("");
    setDescription("");
    setError(null);
    setLoading(false);
    setIsDragOver(false);
  }, []);

  function handleClose() {
    if (loading) return;
    resetForm();
    onClose();
  }

  const mouseDownOnBackdrop = useRef(false);

  function handleBackdropMouseDown(e: React.MouseEvent) {
    mouseDownOnBackdrop.current = e.target === e.currentTarget;
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
      handleClose();
    }
    mouseDownOnBackdrop.current = false;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setFolderPath(null);
      setError(null);
      if (!name) {
        const baseName = selected.name.replace(/\.(zip|rar)$/i, "");
        setName(baseName);
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    if (folderPath) return;
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (folderPath) return;
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const ext = droppedFile.name.split(".").pop()?.toLowerCase();
      if (ext === "zip" || ext === "rar") {
        setFile(droppedFile);
        setError(null);
        if (!name) {
          const baseName = droppedFile.name.replace(/\.(zip|rar)$/i, "");
          setName(baseName);
        }
      } else {
        setError("Please upload a .zip or .rar file");
      }
    }
  }

  async function handleSelectFolder() {
    const selected = await selectImportFolder();
    if (selected) {
      setFolderPath(selected);
      setFile(null);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!name) {
        const folderName = selected.split(/[/\\]/).pop() || "";
        setName(folderName);
      }
    }
  }

  function clearSource() {
    setFile(null);
    setFolderPath(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const hasSource = !!(file || folderPath);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasSource) {
      setError("Please select a file or folder");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a chat name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (folderPath) {
        await importChatFromFolderApi(folderPath, name.trim(), description.trim());
      } else {
        const formData = new FormData();
        formData.append("archive", file!);
        formData.append("name", name.trim());
        if (description.trim()) {
          formData.append("description", description.trim());
        }
        await importChatApi(formData);
      }
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const archiveDisabled = !!folderPath;
  const folderDisabled = !!file;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Import Chat
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Archive Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !archiveDisabled && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200 ${
              archiveDisabled
                ? "border-[var(--border)] opacity-40 cursor-not-allowed"
                : isDragOver
                ? "border-[var(--text-accent)] bg-[var(--accent)]/10 cursor-pointer"
                : file
                ? "border-[var(--accent)] bg-[var(--bg-tertiary)] cursor-pointer"
                : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.rar"
              onChange={handleFileChange}
              className="hidden"
              disabled={archiveDisabled}
            />

            {file ? (
              <>
                <div className="text-[var(--text-accent)]">
                  <FileIcon />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {file.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSource();
                  }}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
                >
                  Remove file
                </button>
              </>
            ) : (
              <>
                <div className="text-[var(--text-secondary)]">
                  <UploadIcon />
                </div>
                <div className="text-center">
                  <p className="text-sm text-[var(--text-primary)]">
                    Drop your chat archive here, or{" "}
                    <span className="text-[var(--text-accent)] font-medium">browse</span>
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Supports .zip and .rar files
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Folder selection (Electron only) */}
          {isElectronApp && (
            <>
              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span>or</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>

              {folderPath ? (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--bg-tertiary)] px-4 py-3">
                  <div className="text-[var(--text-accent)]">
                    <FolderIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {folderPath.split(/[/\\]/).pop()}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {folderPath}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSource}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={folderDisabled || loading}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors ${
                    folderDisabled
                      ? "border-[var(--border)] text-[var(--text-secondary)] opacity-40 cursor-not-allowed"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
                  }`}
                >
                  <FolderIcon />
                  Select unpacked folder
                </button>
              )}
            </>
          )}

          {/* Name Input */}
          <div>
            <label
              htmlFor="chat-name"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Chat Name <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="chat-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Family Group Chat"
              required
              disabled={loading}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--text-accent)] focus:ring-1 focus:ring-[var(--text-accent)] transition-colors disabled:opacity-50"
            />
          </div>

          {/* Description Input */}
          <div>
            <label
              htmlFor="chat-description"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Description <span className="text-[var(--text-secondary)] text-xs">(optional)</span>
            </label>
            <textarea
              id="chat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short description..."
              rows={3}
              disabled={loading}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--text-accent)] focus:ring-1 focus:ring-[var(--text-accent)] transition-colors resize-none disabled:opacity-50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !hasSource || !name.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

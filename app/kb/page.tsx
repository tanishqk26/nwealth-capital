'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────

type DocStatus = 'processing' | 'embedding' | 'ready' | 'error';

type KBDocument = {
  id: string;
  filename: string;
  file_size: number | null;
  file_type: string | null;
  status: DocStatus;
  chunk_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Helpers ────────────────────────────────────────────────

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fileIcon(type: string | null) {
  if (type?.includes('pdf')) return '📄';
  if (type?.startsWith('text')) return '📝';
  return '📎';
}

// ─── Status badge ────────────────────────────────────────────

const STATUS_CONFIG: Record<DocStatus, { label: string; bg: string; color: string; icon: string }> = {
  processing: { label: 'Processing', bg: '#eff6ff', color: '#1d4ed8', icon: '⏳' },
  embedding:  { label: 'Embedding',  bg: '#f5f3ff', color: '#7c3aed', icon: '🔮' },
  ready:      { label: 'Ready',      bg: '#f0fdf4', color: '#15803d', icon: '✅' },
  error:      { label: 'Error',      bg: '#fef2f2', color: '#b91c1c', icon: '❌' },
};

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.processing;
  const isActive = status === 'processing' || status === 'embedding';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {isActive ? (
        <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
      ) : (
        <span>{cfg.icon}</span>
      )}
      {cfg.label}
    </span>
  );
}

// ─── Upload drop zone ─────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="cursor-pointer rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 transition-colors"
      style={{
        borderColor: dragging ? '#0d3b33' : '#d1d5db',
        backgroundColor: dragging ? '#f0f9f7' : '#fafafa',
      }}
    >
      <div className="text-4xl">📂</div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: '#111' }}>
          Drop files here or <span style={{ color: '#0d3b33', textDecoration: 'underline' }}>browse</span>
        </p>
        <p className="text-xs mt-1" style={{ color: '#888' }}>
          Supported: PDF, TXT · Max 10 MB per file
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.text"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── In-progress upload row ───────────────────────────────────

function UploadingRow({ filename, progress }: { filename: string; progress: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#f3f4f6' }}>
      <span className="text-xl">📤</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#111' }}>{filename}</p>
        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: '#0d3b33' }}
          />
        </div>
      </div>
      <span className="text-xs" style={{ color: '#888' }}>{progress}%</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function KBPage() {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [uploads, setUploads] = useState<{ filename: string; progress: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch documents ─────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    const res = await fetch('/api/kb/documents');
    if (res.ok) {
      setDocuments(await res.json());
      setLoading(false);
    }
  }, []);

  // ── Poll while any document is in-progress ──────────────────
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const hasInProgress = documents.some(
      (d) => d.status === 'processing' || d.status === 'embedding'
    );
    const hasUploads = uploads.length > 0;

    if ((hasInProgress || hasUploads) && !pollRef.current) {
      pollRef.current = setInterval(fetchDocuments, 2000);
    } else if (!hasInProgress && !hasUploads && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [documents, uploads, fetchDocuments]);

  // ── Upload files ────────────────────────────────────────────
  const handleFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        setUploads((prev) => [...prev, { filename: file.name, progress: 10 }]);

        const formData = new FormData();
        formData.append('file', file);

        // Simulate upload progress
        const tick = setInterval(() => {
          setUploads((prev) =>
            prev.map((u) =>
              u.filename === file.name && u.progress < 80
                ? { ...u, progress: u.progress + 10 }
                : u
            )
          );
        }, 200);

        try {
          const res = await fetch('/api/kb/upload', { method: 'POST', body: formData });
          clearInterval(tick);

          if (res.ok) {
            setUploads((prev) => prev.filter((u) => u.filename !== file.name));
            fetchDocuments();
          } else {
            const err = await res.json().catch(() => ({ error: 'Upload failed' }));
            alert(`Upload failed: ${err.error ?? 'Unknown error'}`);
            setUploads((prev) => prev.filter((u) => u.filename !== file.name));
          }
        } catch (err) {
          clearInterval(tick);
          alert(`Upload error: ${String(err)}`);
          setUploads((prev) => prev.filter((u) => u.filename !== file.name));
        }
      }
    },
    [fetchDocuments]
  );

  // ── Delete document ─────────────────────────────────────────
  const handleDelete = useCallback(
    async (id: string, filename: string) => {
      if (!confirm(`Delete "${filename}"? This will also remove its vectors from Pinecone.`)) return;
      setDeletingId(id);
      await fetch(`/api/kb/documents?id=${id}`, { method: 'DELETE' });
      setDeletingId(null);
      fetchDocuments();
    },
    [fetchDocuments]
  );

  // ── Stats ───────────────────────────────────────────────────
  const totalReady = documents.filter((d) => d.status === 'ready').length;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count ?? 0), 0);

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .animate-pulse { animation: pulse 1.5s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen" style={{ backgroundColor: '#f7f3ee', fontFamily: 'Arial, sans-serif' }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div
          className="flex items-center gap-4 px-6"
          style={{ height: 60, backgroundColor: '#0d3b33', position: 'sticky', top: 0, zIndex: 10 }}
        >
          <Link
            href="/chat"
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
          >
            ← Chat
          </Link>
          <div className="w-px h-5" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <div className="flex items-center gap-2">
            <span className="text-lg">📚</span>
            <span className="text-white font-semibold text-sm">Knowledge Base</span>
          </div>
          <div className="ml-auto flex items-center gap-4 text-white/60 text-xs">
            <span>{totalReady} docs ready</span>
            <span>·</span>
            <span>{totalChunks} chunks in Pinecone</span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

          {/* ── Info banner ──────────────────────────────── */}
          <div
            className="rounded-xl px-4 py-3 text-sm flex items-start gap-3"
            style={{ backgroundColor: '#e0f2f1', color: '#065f46' }}
          >
            <span className="text-lg mt-0.5">ℹ️</span>
            <div>
              <p className="font-medium">How this works</p>
              <p className="mt-0.5 text-xs" style={{ color: '#0d7060' }}>
                Upload your FAQs, service docs, or product notes. Each file is split into chunks,
                embedded with Gemini <code>text-embedding-004</code> (768-dim), and stored in
                your Pinecone index <strong>{process.env.NEXT_PUBLIC_PINECONE_INDEX_NAME ?? 'nwealth-faq'}</strong>.
                The AI bot searches this knowledge base before every response.
              </p>
            </div>
          </div>

          {/* ── Drop zone ────────────────────────────────── */}
          <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: '#f3f4f6' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#111' }}>Upload documents</h2>
            </div>
            <div className="p-5">
              <DropZone onFiles={handleFiles} />
            </div>
          </div>

          {/* ── Uploading rows ───────────────────────────── */}
          {uploads.length > 0 && (
            <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: '#fff' }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: '#f3f4f6' }}>
                <p className="text-xs font-medium" style={{ color: '#888' }}>UPLOADING</p>
              </div>
              {uploads.map((u) => (
                <UploadingRow key={u.filename} filename={u.filename} progress={u.progress} />
              ))}
            </div>
          )}

          {/* ── Documents list ───────────────────────────── */}
          <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f3f4f6' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#111' }}>
                Indexed documents
                {documents.length > 0 && (
                  <span className="ml-2 text-xs font-normal" style={{ color: '#888' }}>
                    ({documents.length})
                  </span>
                )}
              </h2>
              <button
                onClick={fetchDocuments}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={{ backgroundColor: '#f3f4f6', color: '#555' }}
              >
                ↻ Refresh
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm" style={{ color: '#aaa' }}>Loading…</div>
            ) : documents.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2">
                <span className="text-4xl">📭</span>
                <p className="text-sm" style={{ color: '#888' }}>No documents yet. Upload your first FAQ above.</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ backgroundColor: '#fafafa' }}>
                    {['Document', 'Size', 'Status', 'Chunks', 'Uploaded', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2.5 text-xs font-medium"
                        style={{ color: '#888', borderBottom: '1px solid #f3f4f6' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid #f9fafb' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                    >
                      {/* Filename */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{fileIcon(doc.file_type)}</span>
                          <div className="min-w-0">
                            <p
                              className="font-medium truncate max-w-[240px]"
                              style={{ color: '#111' }}
                              title={doc.filename}
                            >
                              {doc.filename}
                            </p>
                            {doc.status === 'error' && doc.error_message && (
                              <p className="text-xs mt-0.5 truncate max-w-[240px]" style={{ color: '#b91c1c' }} title={doc.error_message}>
                                {doc.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3 text-xs" style={{ color: '#888', whiteSpace: 'nowrap' }}>
                        {formatBytes(doc.file_size)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>

                      {/* Chunks */}
                      <td className="px-4 py-3 text-xs text-center" style={{ color: '#555' }}>
                        {doc.status === 'ready' ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs"
                            style={{ backgroundColor: '#f0fdf4', color: '#15803d' }}
                          >
                            {doc.chunk_count}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Uploaded */}
                      <td className="px-4 py-3 text-xs" style={{ color: '#888', whiteSpace: 'nowrap' }}>
                        {formatTime(doc.created_at)}
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(doc.id, doc.filename)}
                          disabled={deletingId === doc.id || doc.status === 'processing' || doc.status === 'embedding'}
                          className="text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-30"
                          style={{ color: '#b91c1c', backgroundColor: '#fef2f2' }}
                          title="Delete document and remove vectors from Pinecone"
                        >
                          {deletingId === doc.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Tips ─────────────────────────────────────── */}
          <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#fafafa', border: '1px solid #e5e7eb' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#555' }}>Tips</p>
            <ul className="text-xs space-y-1" style={{ color: '#888' }}>
              <li>· Keep FAQ documents focused — one topic per file gives better retrieval accuracy.</li>
              <li>· PDFs with images/scans won't extract well; convert to text-based PDFs first.</li>
              <li>· After uploading, test in the chat by asking a question from your FAQ.</li>
              <li>· Pinecone index must be <strong>768-dim</strong> (Gemini text-embedding-004).</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

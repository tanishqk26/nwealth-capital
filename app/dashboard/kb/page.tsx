'use client';

// KB management inside the staff dashboard.
// Identical functionality to the old /kb page — standalone header removed
// since the dashboard layout provides navigation.

import { useCallback, useEffect, useRef, useState } from 'react';

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
};

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

const STATUS_CONFIG: Record<DocStatus, { label: string; bg: string; color: string; icon: string }> = {
  processing: { label: 'Processing', bg: '#eff6ff', color: '#1d4ed8', icon: '⏳' },
  embedding:  { label: 'Embedding',  bg: '#f5f3ff', color: '#7c3aed', icon: '🔮' },
  ready:      { label: 'Ready',      bg: '#f0fdf4', color: '#15803d', icon: '✅' },
  error:      { label: 'Error',      bg: '#fef2f2', color: '#b91c1c', icon: '❌' },
};

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status];
  const isActive = status === 'processing' || status === 'embedding';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {isActive
        ? <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ backgroundColor: cfg.color }} />
        : <span>{cfg.icon}</span>}
      {cfg.label}
    </span>
  );
}

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }, [onFiles]);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="cursor-pointer rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 transition-colors"
      style={{ borderColor: dragging ? '#0d3b33' : '#d1d5db', backgroundColor: dragging ? '#f0f9f7' : '#fafafa' }}
    >
      <div className="text-4xl">📂</div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">
          Drop files here or <span style={{ color: '#0d3b33', textDecoration: 'underline' }}>browse</span>
        </p>
        <p className="text-xs mt-1 text-gray-400">Supported: PDF, TXT · Max 10 MB per file</p>
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.txt,.text" className="hidden"
        onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) onFiles(f); e.target.value = ''; }} />
    </div>
  );
}

export default function DashboardKBPage() {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [uploads, setUploads] = useState<{ filename: string; progress: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch('/api/kb/documents');
    if (res.ok) { setDocuments(await res.json()); setLoading(false); }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  useEffect(() => {
    const hasInProgress = documents.some((d) => d.status === 'processing' || d.status === 'embedding');
    const hasUploads = uploads.length > 0;
    if ((hasInProgress || hasUploads) && !pollRef.current) {
      pollRef.current = setInterval(fetchDocuments, 2000);
    } else if (!hasInProgress && !hasUploads && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [documents, uploads, fetchDocuments]);

  const handleFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      setUploads((prev) => [...prev, { filename: file.name, progress: 10 }]);
      const formData = new FormData();
      formData.append('file', file);
      const tick = setInterval(() => {
        setUploads((prev) => prev.map((u) =>
          u.filename === file.name && u.progress < 80 ? { ...u, progress: u.progress + 10 } : u
        ));
      }, 200);
      try {
        const res = await fetch('/api/kb/upload', { method: 'POST', body: formData });
        clearInterval(tick);
        if (res.ok) { setUploads((p) => p.filter((u) => u.filename !== file.name)); fetchDocuments(); }
        else { const e = await res.json().catch(() => ({ error: 'Upload failed' })); alert(`Upload failed: ${e.error}`); setUploads((p) => p.filter((u) => u.filename !== file.name)); }
      } catch (err) { clearInterval(tick); alert(`Upload error: ${String(err)}`); setUploads((p) => p.filter((u) => u.filename !== file.name)); }
    }
  }, [fetchDocuments]);

  const handleDelete = useCallback(async (id: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? Vectors will also be removed from Pinecone.`)) return;
    setDeletingId(id);
    await fetch(`/api/kb/documents?id=${id}`, { method: 'DELETE' });
    setDeletingId(null);
    fetchDocuments();
  }, [fetchDocuments]);

  const totalReady = documents.filter((d) => d.status === 'ready').length;
  const totalChunks = documents.reduce((s, d) => s + (d.chunk_count ?? 0), 0);

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} .animate-pulse{animation:pulse 1.5s ease-in-out infinite}`}</style>
      <div className="p-8">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Knowledge Base</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalReady} doc{totalReady !== 1 ? 's' : ''} ready · {totalChunks} chunks in Pinecone
            </p>
          </div>
        </div>

        <div className="max-w-3xl space-y-5">
          {/* Info banner */}
          <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-3" style={{ backgroundColor: '#e0f2f1', color: '#065f46' }}>
            <span className="text-lg mt-0.5">ℹ️</span>
            <p className="text-xs" style={{ color: '#0d7060' }}>
              Upload FAQs, service docs, or product notes. Files are chunked, embedded with{' '}
              <code>gemini-embedding-2-preview</code> (1024-dim), and stored in Pinecone index{' '}
              <strong>{process.env.NEXT_PUBLIC_PINECONE_INDEX_NAME ?? 'nwealth-faq'}</strong>.
              The AI bot searches this before every response.
            </p>
          </div>

          {/* Upload zone */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Upload documents</h2>
            </div>
            <div className="p-5"><DropZone onFiles={handleFiles} /></div>
          </div>

          {/* Uploading */}
          {uploads.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Uploading</p>
              </div>
              {uploads.map((u) => (
                <div key={u.filename} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
                  <span className="text-xl">📤</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.filename}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${u.progress}%`, backgroundColor: '#0d3b33' }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{u.progress}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Documents table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">
                Indexed documents {documents.length > 0 && <span className="font-normal text-gray-400">({documents.length})</span>}
              </h2>
              <button onClick={fetchDocuments} className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                ↻ Refresh
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : documents.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2">
                <span className="text-4xl">📭</span>
                <p className="text-sm text-gray-400">No documents yet. Upload your first FAQ above.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Document', 'Size', 'Status', 'Chunks', 'Uploaded', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/50" style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{doc.file_type?.includes('pdf') ? '📄' : '📝'}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate max-w-[220px]" title={doc.filename}>{doc.filename}</p>
                            {doc.status === 'error' && doc.error_message && (
                              <p className="text-xs text-red-600 truncate max-w-[220px]" title={doc.error_message}>{doc.error_message}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatBytes(doc.file_size)}</td>
                      <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="px-4 py-3 text-xs text-center text-gray-500">
                        {doc.status === 'ready'
                          ? <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{doc.chunk_count}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatTime(doc.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(doc.id, doc.filename)}
                          disabled={deletingId === doc.id || doc.status === 'processing' || doc.status === 'embedding'}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-30"
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

          {/* Tips */}
          <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-1">Tips</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>· Keep FAQ documents focused — one topic per file gives better retrieval accuracy.</li>
              <li>· PDFs with images/scans won't extract well; convert to text-based PDFs first.</li>
              <li>· After uploading, test in the chat by asking a question from your FAQ.</li>
              <li>· Pinecone index must be <strong>1024-dim</strong> (Gemini gemini-embedding-2-preview).</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

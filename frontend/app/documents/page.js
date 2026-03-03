'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { documentsApi } from '@/lib/api';

// ----- Category & Status badge helper ----------------------------------
function Badge({ value, type }) {
  if (!value) return <span className="badge" style={{ background: 'transparent', color: 'var(--text-muted)' }}>—</span>;
  const map = {
    POLICY: 'badge-policy',
    REPORT: 'badge-report',
    MEMO: 'badge-memo',
    ACTIVE: 'badge-active',
    DRAFT: 'badge-draft',
    DELETED: 'badge-deleted',
  };
  return <span className={`badge ${map[value] || ''}`}>{value}</span>;
}

// ----- Main Page --------------------------------------------------------
export default function DocumentsPage() {
  const [documents, setDocuments]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [page, setPage]             = useState(1);
  const [meta, setMeta]             = useState(null);
  const [category, setCategory]     = useState('');
  const PAGE_SIZE = 10;

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (category) params.category = category;
      const response = await documentsApi.list(params);
      setDocuments(response.data || []);
      setMeta(response.meta || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  async function handleDelete(id) {
    if (!confirm(`Yakin ingin menghapus dokumen #${id}? (Soft-delete)`)) return;
    try {
      await documentsApi.delete(id);
      fetchDocuments();
    } catch (err) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  }

  const totalPages = meta?.total_pages ?? 1;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">📄 Dokumen</h1>
        <p className="page-subtitle">
          Manajemen dokumen — CRUD dengan Oracle Database
        </p>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <select
            id="filter-category"
            className="select-control"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="">Semua Kategori</option>
            <option value="POLICY">POLICY</option>
            <option value="REPORT">REPORT</option>
            <option value="MEMO">MEMO</option>
          </select>
          {meta && (
            <span className="page-info">
              {meta.total} dokumen ditemukan
            </span>
          )}
        </div>
        <div className="toolbar-right">
          <button id="btn-refresh" className="btn btn-secondary" onClick={fetchDocuments}>
            🔄 Refresh
          </button>
          <Link href="/documents/new" className="btn btn-primary" id="btn-new-document">
            + New Document
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error mt-2">
          ⚠️ {error}
          <button
            onClick={fetchDocuments}
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto' }}
            id="btn-retry"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-center">
          <div className="spinner" />
          <span>Memuat data dari Oracle Database…</span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <div className="table-wrapper">
            <table id="documents-table">
              <thead>
                <tr>
                  <th>Kode Dok.</th>
                  <th>Judul</th>
                  <th>Kategori</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <div className="icon">📭</div>
                        <h3>Belum ada dokumen</h3>
                        <p>Buat dokumen pertama Anda dengan klik tombol New Document.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} id={`doc-row-${doc.id}`}>
                      <td className="td-code">{doc.document_code}</td>
                      <td className="td-primary">{doc.title}</td>
                      <td><Badge value={doc.category} /></td>
                      <td><Badge value={doc.status} /></td>
                      <td>
                        {doc.created_at
                          ? new Date(doc.created_at).toLocaleDateString('id-ID', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                          <Link
                            href={`/documents/${doc.id}`}
                            className="btn btn-secondary btn-sm"
                            id={`btn-edit-${doc.id}`}
                          >
                            ✏️ Edit
                          </Link>
                          <button
                            className="btn btn-danger btn-sm"
                            id={`btn-delete-${doc.id}`}
                            onClick={() => handleDelete(doc.id)}
                          >
                            🗑 Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" id="pagination">
              <button
                className="page-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                id="btn-prev-page"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                  id={`btn-page-${p}`}
                >
                  {p}
                </button>
              ))}
              <button
                className="page-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                id="btn-next-page"
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

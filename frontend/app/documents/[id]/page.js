'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { documentsApi } from '@/lib/api';

export default function EditDocumentPage() {
  const router   = useRouter();
  const params   = useParams();
  const docId    = params.id;

  // Two loading states: fetchLoading for initial load, loading for submit
  const [fetchLoading, setFetchLoading] = useState(true);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [formData, setFormData]         = useState({
    title: '', content: '', category: 'REPORT', status: 'ACTIVE',
  });

  // Pre-populate form on mount
  useEffect(() => {
    async function fetchDocument() {
      try {
        const response = await documentsApi.get(docId);
        const doc = response.data || response;
        setFormData({
          title: doc.title || '',
          content: doc.content || '',
          category: doc.category || 'REPORT',
          status: doc.status || 'ACTIVE',
        });
      } catch (err) {
        setError(`Gagal memuat dokumen: ${err.message}`);
      } finally {
        setFetchLoading(false);
      }
    }
    fetchDocument();
  }, [docId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await documentsApi.update(docId, formData);
      router.push('/documents');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Yakin ingin menghapus dokumen #${docId}? (Soft-delete)`)) return;
    try {
      await documentsApi.delete(docId);
      router.push('/documents');
    } catch (err) {
      setError(`Gagal menghapus: ${err.message}`);
    }
  }

  if (fetchLoading) {
    return (
      <div className="page-container form-page">
        <div className="loading-center">
          <div className="spinner" />
          <span>Memuat data dokumen…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container form-page">
      <div className="page-header">
        <Link href="/documents" className="btn btn-secondary btn-sm" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
          ← Kembali
        </Link>
        <h1 className="page-title">✏️ Edit Dokumen #{docId}</h1>
        <p className="page-subtitle">Perbarui informasi dokumen — perubahan disimpan ke Oracle Database</p>
      </div>

      <div className="card">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            ⚠️ {error}
          </div>
        )}

        <form id="edit-document-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Judul *</label>
            <input
              id="title"
              name="title"
              type="text"
              className="form-control"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={200}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="category">Kategori</label>
              <select id="category" name="category" className="form-control" value={formData.category} onChange={handleChange}>
                <option value="POLICY">POLICY</option>
                <option value="REPORT">REPORT</option>
                <option value="MEMO">MEMO</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="status">Status</label>
              <select id="status" name="status" className="form-control" value={formData.status} onChange={handleChange}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="content">Konten</label>
            <textarea
              id="content"
              name="content"
              className="form-control"
              value={formData.content}
              onChange={handleChange}
              rows={6}
            />
          </div>

          <div className="form-actions">
            <button id="btn-submit-edit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Menyimpan…' : '💾 Simpan Perubahan'}
            </button>
            <Link href="/documents" className="btn btn-secondary" id="btn-cancel-edit">
              Batal
            </Link>
            <button
              id="btn-delete-doc"
              type="button"
              className="btn btn-danger"
              style={{ marginLeft: 'auto' }}
              onClick={handleDelete}
            >
              🗑 Hapus Dokumen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

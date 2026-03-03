'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { documentsApi } from '@/lib/api';

const INITIAL_FORM = {
  document_code: '',
  title: '',
  content: '',
  category: 'REPORT',
  status: 'ACTIVE',
};

export default function CreateDocumentPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await documentsApi.create(formData);
      router.push('/documents');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="page-container form-page">
      <div className="page-header">
        <Link href="/documents" className="btn btn-secondary btn-sm" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
          ← Kembali
        </Link>
        <h1 className="page-title">➕ Buat Dokumen Baru</h1>
        <p className="page-subtitle">Formulir pembuatan dokumen — data disimpan ke Oracle Database</p>
      </div>

      <div className="card">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            ⚠️ {error}
          </div>
        )}

        <form id="create-document-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="document_code">Kode Dokumen *</label>
            <input
              id="document_code"
              name="document_code"
              type="text"
              className="form-control"
              placeholder="Contoh: DOC-2026-001"
              value={formData.document_code}
              onChange={handleChange}
              required
              maxLength={50}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="title">Judul *</label>
            <input
              id="title"
              name="title"
              type="text"
              className="form-control"
              placeholder="Judul dokumen"
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
              placeholder="Isi dokumen…"
              value={formData.content}
              onChange={handleChange}
              rows={6}
            />
          </div>

          <div className="form-actions">
            <button
              id="btn-submit-create"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '⏳ Menyimpan…' : '💾 Simpan Dokumen'}
            </button>
            <Link href="/documents" className="btn btn-secondary" id="btn-cancel-create">
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

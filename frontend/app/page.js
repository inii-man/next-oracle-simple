'use client';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="page-container">
      <div className="hero">
        <div className="hero-tag">✨ Hari 3 Pelatihan · FastAPI + Oracle + Next.js</div>
        <h1>
          Integrasi Oracle Database<br />
          &amp; <span>Frontend Next.js</span>
        </h1>
        <p>
          Aplikasi CRUD full-stack yang dibangun dalam pelatihan API &amp; Git
          Engineering — menghubungkan Oracle Database ke UI yang responsif melalui
          FastAPI.
        </p>
        <div className="hero-actions">
          <Link href="/documents" className="btn btn-primary" id="btn-view-documents">
            📄 Lihat Dokumen
          </Link>
          <Link href="/documents/new" className="btn btn-secondary" id="btn-create-doc">
            + Buat Dokumen Baru
          </Link>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="icon">🔌</div>
            <h3>Connection Pooling</h3>
            <p>Reuse koneksi Oracle untuk performa optimal — min 2, max 10 connections.</p>
          </div>
          <div className="feature-card">
            <div className="icon">🔒</div>
            <h3>Parameter Binding</h3>
            <p>Semua query menggunakan named parameters — aman dari SQL injection.</p>
          </div>
          <div className="feature-card">
            <div className="icon">⚡</div>
            <h3>Transaction Management</h3>
            <p>Atomic operations dengan commit &amp; rollback yang eksplisit.</p>
          </div>
          <div className="feature-card">
            <div className="icon">🖥️</div>
            <h3>Next.js App Router</h3>
            <p>Frontend modern dengan loading states, error handling, dan pagination.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

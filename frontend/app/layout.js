import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Gamma Oracle — Pelatihan Hari 3',
  description:
    'Aplikasi CRUD Full-Stack: FastAPI + Oracle Database + Next.js 15 — Pelatihan API & Git Engineering Hari 3',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <nav className="navbar">
          <Link href="/" className="navbar-brand">
            <div className="brand-icon">Γ</div>
            <span>Gamma Oracle</span>
          </Link>
          <ul className="navbar-nav">
            <li>
              <Link href="/documents" className="nav-link" id="nav-documents">
                📄 Documents
              </Link>
            </li>
            <li>
              <Link href="/documents/new" className="btn btn-primary" id="nav-new-doc">
                + New Document
              </Link>
            </li>
          </ul>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';

const links = [
  { href: '/rastreamento', label: 'Visao geral' },
  { href: '/rastreamento/3sat', label: 'Admin 3SAT' },
];

export default function RastreamentoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-green-50 flex flex-col md:flex-row">
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-green-200 bg-white p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-green-800">Rastreamento</h2>
            <p className="text-xs text-green-600">
              Integracoes e ferramentas administrativas
            </p>
          </div>
          <nav className="space-y-1">
            {links.map((link) => {
              const isActive =
                link.href === '/rastreamento'
                  ? pathname === link.href
                  : pathname.startsWith(link.href);
              const classes = isActive
                ? 'bg-green-100 text-green-800'
                : 'text-green-700 hover:bg-green-50';
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${classes}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </ProtectedRoute>
  );
}

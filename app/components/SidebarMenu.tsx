'use client';

import Link from 'next/link';

export default function SidebarMenu() {
  return (
    <aside className="w-64 bg-white shadow-md p-6 fixed h-full" aria-label="Menu de navegação">
      <h2 className="text-xl font-semibold text-green-800 mb-6">Painel de Administração</h2>
      <nav className="space-y-2">
        {[
          { href: '/administracao', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
          { href: '/veiculos', label: 'Veículos', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
          { href: '/gerenciar-agendamentos', label: 'Gerenciar Agendamentos', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
          { href: '/motoristas', label: 'Motoristas', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
          { href: '/relatorios', label: 'Relatórios', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { href: '/historico', label: 'Histórico de Veículos', icon: 'M8 16h8m-4-4v8m8-8a8 8 0 11-16 0 8 8 0 0116 0z' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center space-x-3 p-3 rounded-md hover:bg-green-100 transition-colors duration-200"
            aria-label={item.label}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            <span className="text-green-700 font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarMenuProps {
  className?: string;
  onNavigate?: () => void;
}

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const menuItems = [
  {
    href: '/administracao',
    label: 'Dashboard',
    icon:
      'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-11h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    href: '/resumo-diario',
    label: 'Resumo Diário',
    icon:
      'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    href: '/veiculos',
    label: 'Veículos',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    href: '/gerenciar-agendamentos',
    label: 'Gerenciar Agendamentos',
    icon:
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    href: '/motoristas',
    label: 'Motoristas',
    icon:
      'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    href: '/historico',
    label: 'Histórico de Veículos',
    icon: 'M8 16h8m-4-4v8m8-8a8 8 0 11-16 0 8 8 0 0116 0z',
  },
];

export default function SidebarMenu({ className = '', onNavigate }: SidebarMenuProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cx(
        'flex h-full w-full flex-col border-r border-gray-200 bg-white p-6 shadow-sm md:w-64',
        className,
      )}
      aria-label="Menu de navegação"
    >
      <h2 className="text-xl font-semibold text-green-800 mb-6">Painel de Administração</h2>
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cx(
                'flex items-center space-x-3 rounded-lg px-3 py-2 transition-colors duration-200',
                isActive
                  ? 'bg-green-600 text-white'
                  : 'text-green-700 hover:bg-green-100 focus-visible:bg-green-100 focus-visible:outline-none',
              )}
              aria-label={item.label}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={cx('h-6 w-6', isActive ? 'text-white' : 'text-green-600')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className={cx('font-medium', isActive ? 'text-white' : 'text-green-700')}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

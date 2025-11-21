'use client';

import { useMemo, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import SidebarMenu from '../components/SidebarMenu';

const BASE_URL = 'https://api.uis-agendamentos.com/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ExamplePayload = Record<string, unknown> | Record<string, unknown>[] | string;

type Endpoint = {
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  secured?: boolean;
  queryParams?: string[];
  pathParams?: string[];
  bodyExample?: ExamplePayload;
  responseExample?: ExamplePayload;
  notes?: string;
};

type ApiCategory = {
  id: string;
  name: string;
  summary: string;
  endpoints: Endpoint[];
};

const methodStyles: Record<HttpMethod, string> = {
  GET: 'bg-blue-50 text-blue-700 border-blue-200',
  POST: 'bg-green-50 text-green-700 border-green-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-purple-50 text-purple-700 border-purple-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
};

const apiCatalog: ApiCategory[] = [
  {
    id: 'auth',
    name: 'Autenticação',
    summary: 'Fluxo de login protegido por token e renovação de sessão.',
    endpoints: [
      {
        method: 'POST',
        path: '/auth/login',
        title: 'Login com credenciais',
        description: 'Gera um token JWT a partir do e-mail e senha do usuário administrador.',
        secured: false,
        bodyExample: {
          email: 'admin@uis.com',
          senha: 'admin123',
        },
        responseExample: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'b1292d83-21c8-4c8b-bb0f-06ba7e0d',
          expiraEm: '2024-12-31T23:59:59.000Z',
        },
        notes: 'Utilize o token no header Authorization: Bearer <token> para os demais endpoints.',
      },
      {
        method: 'POST',
        path: '/auth/refresh',
        title: 'Renovar sessão',
        description: 'Traz um novo token JWT antes da expiração, mantendo o usuário conectado.',
        secured: false,
        bodyExample: {
          refreshToken: 'b1292d83-21c8-4c8b-bb0f-06ba7e0d',
        },
        responseExample: {
          token: 'novo-token-jwt',
          expiraEm: '2025-01-31T23:59:59.000Z',
        },
        notes: 'Pode ser chamado em background para evitar logout inesperado.',
      },
      {
        method: 'GET',
        path: '/auth/perfil',
        title: 'Perfil autenticado',
        description: 'Retorna as informações básicas do usuário logado e suas permissões.',
        secured: true,
        responseExample: {
          id: 'u_9812',
          nome: 'Administrador UIS',
          email: 'admin@uis.com',
          permissoes: ['agendamentos:gerenciar', 'veiculos:editar', 'motoristas:visualizar'],
        },
      },
    ],
  },
  {
    id: 'agendamentos',
    name: 'Agendamentos',
    summary: 'CRUD completo de agendamentos com códigos de comprovante e filtros.',
    endpoints: [
      {
        method: 'GET',
        path: '/agendamentos',
        title: 'Listar agendamentos',
        description: 'Lista todos os agendamentos cadastrados com filtros por período, veículo ou status.',
        secured: true,
        queryParams: ['dataSaida', 'dataChegada', 'veiculoId', 'concluido', 'codigo'],
        responseExample: [
          {
            id: 'ag_1321',
            codigo: 'UIS-8391',
            veiculoId: 'v_01',
            destino: 'Cuiabá - MT',
            saida: '2024-09-25T08:00:00.000Z',
            chegada: '2024-09-25T18:00:00.000Z',
            motorista: 'João Silva',
            matricula: '123456',
            telefone: '(65) 99999-9999',
            observacoes: 'Precisa de cadeado extra',
            concluido: false,
          },
        ],
      },
      {
        method: 'POST',
        path: '/agendamentos',
        title: 'Criar agendamento',
        description: 'Registra um novo agendamento e gera o código de comprovante.',
        secured: true,
        bodyExample: {
          veiculoId: 'v_01',
          destino: 'Cuiabá - MT',
          saida: '2024-09-25T08:00:00.000Z',
          chegada: '2024-09-25T18:00:00.000Z',
          motorista: 'João Silva',
          matricula: '123456',
          telefone: '(65) 99999-9999',
          observacoes: 'Precisa de cadeado extra',
          nomeAgendador: 'Maria Lima',
        },
        responseExample: {
          id: 'ag_1321',
          codigo: 'UIS-8391',
          status: 'criado',
        },
        notes: 'O código do comprovante é retornado automaticamente e pode ser consultado depois.',
      },
      {
        method: 'PUT',
        path: '/agendamentos/{id}',
        title: 'Atualizar agendamento',
        description: 'Permite alterar datas, motorista ou marcar o agendamento como concluído.',
        secured: true,
        pathParams: ['id'],
        bodyExample: {
          saida: '2024-09-25T10:00:00.000Z',
          chegada: '2024-09-25T19:30:00.000Z',
          concluido: true,
          observacoes: 'Horário ajustado a pedido do solicitante',
        },
        responseExample: {
          id: 'ag_1321',
          status: 'atualizado',
        },
      },
      {
        method: 'DELETE',
        path: '/agendamentos/{id}',
        title: 'Excluir agendamento',
        description: 'Remove um agendamento e libera o veículo para novas reservas.',
        secured: true,
        pathParams: ['id'],
        responseExample: {
          id: 'ag_1321',
          status: 'removido',
        },
        notes: 'Verifique conflitos antes da exclusão para evitar apagar registros ativos.',
      },
    ],
  },
  {
    id: 'veiculos',
    name: 'Veículos',
    summary: 'Cadastro, disponibilidade e atualização da frota.',
    endpoints: [
      {
        method: 'GET',
        path: '/veiculos',
        title: 'Listar veículos',
        description: 'Retorna todos os veículos com status de disponibilidade em tempo real.',
        secured: true,
        queryParams: ['disponivel', 'placa', 'modelo'],
        responseExample: [
          {
            id: 'v_01',
            placa: 'ABC-1234',
            modelo: 'Fiat Toro',
            disponivel: false,
            indisponivelAte: '2024-09-25T18:00:00.000Z',
          },
        ],
      },
      {
        method: 'POST',
        path: '/veiculos',
        title: 'Cadastrar veículo',
        description: 'Inclui um novo veículo na frota validando placa e modelo.',
        secured: true,
        bodyExample: {
          placa: 'XYZ-4321',
          modelo: 'Chevrolet S10',
          disponivel: true,
        },
        responseExample: {
          id: 'v_09',
          status: 'criado',
        },
      },
      {
        method: 'PATCH',
        path: '/veiculos/{id}',
        title: 'Atualizar status',
        description: 'Altera disponibilidade ou dados básicos sem substituir o registro inteiro.',
        secured: true,
        pathParams: ['id'],
        bodyExample: {
          disponivel: false,
          indisponivelAte: '2024-09-27T23:59:00.000Z',
        },
        responseExample: {
          id: 'v_01',
          status: 'atualizado',
        },
      },
      {
        method: 'DELETE',
        path: '/veiculos/{id}',
        title: 'Remover veículo',
        description: 'Exclui um veículo que não possui agendamentos ativos.',
        secured: true,
        pathParams: ['id'],
        responseExample: {
          id: 'v_09',
          status: 'removido',
        },
        notes: 'O sistema bloqueia a remoção caso haja agendamentos vinculados.',
      },
    ],
  },
  {
    id: 'motoristas',
    name: 'Motoristas',
    summary: 'Gestão de cadastro, atualização e filtros de equipe.',
    endpoints: [
      {
        method: 'GET',
        path: '/motoristas',
        title: 'Listar motoristas',
        description: 'Consulta motoristas com filtros por setor, cargo ou termo livre.',
        secured: true,
        queryParams: ['busca', 'setor', 'cargo'],
        responseExample: [
          {
            id: 'm_01',
            nome: 'João da Silva',
            matricula: '123456',
            setor: 'Logística',
            cargo: 'Motorista',
            telefone: '(65) 99999-9999',
          },
        ],
      },
      {
        method: 'POST',
        path: '/motoristas',
        title: 'Cadastrar motorista',
        description: 'Cria um motorista validando telefone e dados obrigatórios.',
        secured: true,
        bodyExample: {
          nome: 'Maria Souza',
          matricula: '654321',
          setor: 'Operações',
          cargo: 'Condutora',
          telefone: '(65) 98888-0000',
        },
        responseExample: {
          id: 'm_02',
          status: 'criado',
        },
      },
      {
        method: 'PUT',
        path: '/motoristas/{id}',
        title: 'Editar motorista',
        description: 'Permite ajustar dados cadastrais mantendo o histórico de agendamentos.',
        secured: true,
        pathParams: ['id'],
        bodyExample: {
          telefone: '(65) 97777-1111',
          cargo: 'Supervisor de Frota',
        },
        responseExample: {
          id: 'm_01',
          status: 'atualizado',
        },
      },
      {
        method: 'DELETE',
        path: '/motoristas/{id}',
        title: 'Excluir motorista',
        description: 'Remove o motorista após confirmação e bloqueio de registros ativos.',
        secured: true,
        pathParams: ['id'],
        responseExample: {
          id: 'm_02',
          status: 'removido',
        },
      },
    ],
  },
  {
    id: 'relatorios',
    name: 'Relatórios e Insights',
    summary: 'Consultas prontas para painéis e exportações.',
    endpoints: [
      {
        method: 'GET',
        path: '/relatorios/resumo-diario',
        title: 'Resumo diário',
        description: 'Retorna a visão consolidada de agendamentos, veículos e indisponibilidades por dia.',
        secured: true,
        queryParams: ['data'],
        responseExample: {
          data: '2024-09-25',
          veiculosComAgendamento: 6,
          veiculosLivres: 3,
          agendamentos: [
            {
              veiculo: 'Fiat Toro - ABC-1234',
              saida: '08:00',
              chegada: '18:00',
              destino: 'Cuiabá - MT',
              motorista: 'João Silva',
            },
          ],
        },
        notes: 'Usado pelo painel de Resumo Diário para montar cards e cronograma.',
      },
      {
        method: 'GET',
        path: '/relatorios/historico',
        title: 'Histórico de veículos',
        description: 'Retorna o histórico de uso com suporte a exportação para Excel.',
        secured: true,
        queryParams: ['inicio', 'fim', 'veiculoId', 'motorista'],
        responseExample: [
          {
            veiculo: 'Chevrolet S10 - XYZ-4321',
            destino: 'Rondonópolis - MT',
            saida: '2024-09-10T07:30:00.000Z',
            chegada: '2024-09-10T19:45:00.000Z',
            motorista: 'Maria Souza',
            concluido: true,
          },
        ],
        notes: 'A mesma fonte alimenta o botão de exportação em Excel no histórico do sistema.',
      },
    ],
  },
];

const formatJson = (content?: ExamplePayload) => {
  if (!content) return null;
  if (typeof content === 'string') return content;
  return JSON.stringify(content, null, 2);
};

const Pill = ({ label, className = '' }: { label: string; className?: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${className}`}
  >
    {label}
  </span>
);

export default function ApiDocumentationPage() {
  const [methodFilter, setMethodFilter] = useState<HttpMethod | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const totalEndpoints = useMemo(
    () => apiCatalog.reduce((acc, category) => acc + category.endpoints.length, 0),
    [],
  );

  const filteredCatalog = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return apiCatalog
      .map((category) => ({
        ...category,
        endpoints: category.endpoints.filter((endpoint) => {
          const matchesMethod = methodFilter === 'ALL' || endpoint.method === methodFilter;
          const matchesSearch =
            !term ||
            endpoint.title.toLowerCase().includes(term) ||
            endpoint.path.toLowerCase().includes(term) ||
            endpoint.description.toLowerCase().includes(term);

          return matchesMethod && matchesSearch;
        }),
      }))
      .filter((category) => category.endpoints.length > 0);
  }, [methodFilter, searchTerm]);

  const handleCopyBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(BASE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Não foi possível copiar a URL base:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
        <SidebarMenu className="md:min-h-screen" />

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 p-8 shadow-xl text-white">
              <div className="absolute inset-0 opacity-10" aria-hidden>
                <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
                <div className="absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              </div>

              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.2em] text-white/80">Explorador de API</p>
                  <h1 className="text-3xl md:text-4xl font-extrabold">Documentação interativa</h1>
                  <p className="text-white/90 max-w-2xl">
                    Visualize todos os endpoints do sistema em um painel inspirado no Postman, com separação por categorias,
                    exemplos de payload e filtros rápidos.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Pill label={`Base URL`} className="bg-white/15 border-white/30 text-white" />
                    <button
                      type="button"
                      onClick={handleCopyBaseUrl}
                      className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-green-800 shadow hover:bg-white"
                    >
                      <span>{BASE_URL}</span>
                      <span className="text-xs uppercase tracking-wide">{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm bg-white/10 rounded-xl p-4 border border-white/20 backdrop-blur">
                  <div>
                    <p className="text-white/70">Categorias</p>
                    <p className="text-2xl font-bold">{apiCatalog.length}</p>
                  </div>
                  <div>
                    <p className="text-white/70">Endpoints</p>
                    <p className="text-2xl font-bold">{totalEndpoints}</p>
                  </div>
                  <div>
                    <p className="text-white/70">Métodos</p>
                    <p className="text-2xl font-bold">5</p>
                  </div>
                  <div>
                    <p className="text-white/70">Protegidos</p>
                    <p className="text-2xl font-bold">Sim</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 flex flex-wrap gap-3">
                {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setMethodFilter(method as HttpMethod | 'ALL')}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      methodFilter === method
                        ? 'bg-green-600 text-white border-green-600 shadow'
                        : 'border-green-200 text-green-800 hover:bg-green-50'
                    }`}
                  >
                    {method === 'ALL' ? 'Todos' : method}
                  </button>
                ))}
              </div>

              <div className="lg:col-span-1">
                <label className="sr-only" htmlFor="search-endpoint">
                  Buscar endpoints
                </label>
                <div className="relative">
                  <input
                    id="search-endpoint"
                    type="search"
                    placeholder="Buscar por rota, método ou descrição..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-green-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              {filteredCatalog.map((category) => (
                <div key={category.id} className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-green-700">{category.id}</p>
                      <h2 className="text-2xl font-bold text-gray-900">{category.name}</h2>
                      <p className="text-gray-600">{category.summary}</p>
                    </div>
                    <Pill
                      label={`${category.endpoints.length} endpoint${category.endpoints.length > 1 ? 's' : ''}`}
                      className="bg-green-50 text-green-700 border-green-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {category.endpoints.map((endpoint) => (
                      <article
                        key={endpoint.path + endpoint.method}
                        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="absolute right-4 top-4">
                          <Pill label={endpoint.method} className={methodStyles[endpoint.method]} />
                        </div>

                        <div className="space-y-3 pr-16">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-green-700">{endpoint.path}</p>
                            <h3 className="text-lg font-bold text-gray-900">{endpoint.title}</h3>
                            <p className="text-sm text-gray-600">{endpoint.description}</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {endpoint.secured && (
                              <Pill
                                label="Requer Bearer Token"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200"
                              />
                            )}
                            {endpoint.pathParams?.map((param) => (
                              <Pill
                                key={param}
                                label={`Path: ${param}`}
                                className="bg-blue-50 text-blue-700 border-blue-200"
                              />
                            ))}
                            {endpoint.queryParams?.map((param) => (
                              <Pill
                                key={param}
                                label={`Query: ${param}`}
                                className="bg-amber-50 text-amber-700 border-amber-200"
                              />
                            ))}
                          </div>

                          {(endpoint.bodyExample || endpoint.responseExample) && (
                            <div className="grid grid-cols-1 gap-3 text-sm">
                              {endpoint.bodyExample && (
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Payload de Exemplo</p>
                                  <pre className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 overflow-x-auto">
                                    {formatJson(endpoint.bodyExample)}
                                  </pre>
                                </div>
                              )}
                              {endpoint.responseExample && (
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Resposta Esperada</p>
                                  <pre className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 overflow-x-auto">
                                    {formatJson(endpoint.responseExample)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          {endpoint.notes && <p className="text-xs text-gray-500">{endpoint.notes}</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}

              {filteredCatalog.length === 0 && (
                <div className="rounded-2xl border border-dashed border-green-200 bg-white p-10 text-center text-gray-600">
                  Nenhum endpoint encontrado para os filtros aplicados.
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

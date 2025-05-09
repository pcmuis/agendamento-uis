'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import SidebarMenu from '../components/SidebarMenu';
import { listarAgendamentos, listarVeiculosComStatus } from '@/app/lib/veiculos';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'pt-BR': ptBR },
});

interface Agendamento {
  id: string;
  veiculoId: string;
  destino: string;
  saida: string;
  chegada: string;
  motorista?: string;
  matricula?: string;
  telefone?: string;
  observacoes?: string;
  concluido?: boolean;
}

interface Veiculo {
  id: string;
  modelo: string;
  placa: string;
  disponivel: boolean;
  status?: { disponivel: boolean; indisponivelAte?: string };
}

interface RankingItem {
  id: string;
  name: string;
  count: number;
}

export default function AdministracaoPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankingType, setRankingType] = useState<'motoristas' | 'veiculos'>('motoristas');
  const [rankingPeriod, setRankingPeriod] = useState<'semanal' | 'mensal'>('semanal');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'resumo' | 'calendario'>('resumo');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        setLoading(true);
        setError(null);
        const [agendamentosLista, veiculosLista] = await Promise.all([
          listarAgendamentos(),
          listarVeiculosComStatus(new Date().toISOString()),
        ]);
        setAgendamentos(agendamentosLista);
        setVeiculos(veiculosLista);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError('Falha ao carregar dados. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  const getVeiculoNome = (veiculoId: string) => {
    const veiculo = veiculos.find((v) => v.id === veiculoId);
    return veiculo ? `${veiculo.modelo} - ${veiculo.placa}` : 'Veículo não encontrado';
  };

  const hoje = new Date();
  const agendamentosHoje = agendamentos.filter((ag) => {
    const saida = new Date(ag.saida);
    return (
      saida.getDate() === hoje.getDate() &&
      saida.getMonth() === hoje.getMonth() &&
      saida.getFullYear() === hoje.getFullYear() &&
      !ag.concluido
    );
  });

  const getVeiculosDisponiveisHoje = () => {
    const agendamentosHojeNaoConcluidos = agendamentos.filter((ag) => {
      const saida = new Date(ag.saida);
      return (
        saida.getDate() === hoje.getDate() &&
        saida.getMonth() === hoje.getMonth() &&
        saida.getFullYear() === hoje.getFullYear() &&
        !ag.concluido
      );
    });

    const veiculosOcupados = new Set(agendamentosHojeNaoConcluidos.map((ag) => ag.veiculoId));
    const veiculosDisponiveis = veiculos.filter((v) => !veiculosOcupados.has(v.id));
    return veiculosDisponiveis.length;
  };

  const eventosCalendario = agendamentos.map((ag) => ({
    title: `${getVeiculoNome(ag.veiculoId)} - ${ag.destino}`,
    start: new Date(ag.saida),
    end: new Date(ag.chegada),
    allDay: false,
    resource: ag,
  }));

  const getRanking = () => {
    const startDate = rankingPeriod === 'semanal' ? subWeeks(new Date(), 1) : subMonths(new Date(), 1);
    const filteredAgendamentos = agendamentos.filter(
      (ag) => new Date(ag.saida) >= startDate && !ag.concluido
    );

    let ranking: RankingItem[] = [];

    if (rankingType === 'motoristas') {
      const motoristaCounts = filteredAgendamentos.reduce((acc, ag) => {
        const motorista = ag.motorista || 'Desconhecido';
        acc[motorista] = (acc[motorista] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      ranking = Object.entries(motoristaCounts)
        .map(([name, count]) => ({ id: name, name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    } else {
      const veiculoCounts = filteredAgendamentos.reduce((acc, ag) => {
        const veiculoId = ag.veiculoId;
        const veiculoNome = getVeiculoNome(veiculoId);
        acc[veiculoId] = { name: veiculoNome, count: (acc[veiculoId]?.count || 0) + 1 };
        return acc;
      }, {} as Record<string, { name: string; count: number }>);

      ranking = Object.entries(veiculoCounts)
        .map(([id, { name, count }]) => ({ id, name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }

    return ranking;
  };

  const ranking = getRanking();

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setSelectedDate(start);
  };

  const getChartData = () => {
    const period = rankingPeriod === 'semanal' ? 7 : 30;
    const data = [];
    const hoje = new Date();

    for (let i = 0; i < period; i++) {
      const date = new Date(hoje);
      date.setDate(hoje.getDate() + i);

      const agendamentosDia = agendamentos.filter((ag) => {
        const agDate = new Date(ag.saida);
        return (
          agDate.getDate() === date.getDate() &&
          agDate.getMonth() === date.getMonth() &&
          agDate.getFullYear() === date.getFullYear() &&
          !ag.concluido
        );
      }).length;

      data.push({
        name: format(date, 'dd/MM'),
        Agendamentos: agendamentosDia,
      });
    }

    return data;
  };

  const chartData = getChartData();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex flex-col sm:flex-row">
        {/* Botão de Menu para Mobile */}
        <button
          className="sm:hidden fixed top-4 left-4 z-50 p-2 bg-green-600 text-white rounded-lg"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </button>

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } sm:translate-x-0 sm:static sm:inset-auto transition-transform duration-300 ease-in-out`}
        >
          <SidebarMenu />
        </div>

        {/* Overlay para Mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 sm:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 sm:ml-64">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Painel de Administração</h1>
            <div className="flex space-x-2 mt-4 sm:mt-0">
              <button
                onClick={() => setActiveTab('resumo')}
                className={`px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'resumo'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Resumo
              </button>
              <button
                onClick={() => setActiveTab('calendario')}
                className={`px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'calendario'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Calendário
              </button>
            </div>
          </div>

          {error && (
            <div
              className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded"
              role="alert"
            >
              <p className="font-bold">Erro</p>
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : activeTab === 'resumo' ? (
            <div className="space-y-6">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base text-gray-500 font-medium">Agendamentos Hoje</h3>
                    <div className="bg-green-100 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 sm:h-6 sm:w-6 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold mt-4 text-gray-800">
                    {agendamentosHoje.length}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2">Agendamentos para hoje</p>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base text-gray-500 font-medium">Veículos Disponíveis</h3>
                    <div className="bg-blue-100 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold mt-4 text-gray-800">
                    {getVeiculosDisponiveisHoje()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2">De {veiculos.length} veículos</p>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base text-gray-500 font-medium">Motoristas Ativos</h3>
                    <div className="bg-purple-100 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold mt-4 text-gray-800">
                    {[...new Set(agendamentos.filter((ag) => ag.motorista).map((ag) => ag.motorista))].length}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2">Motoristas diferentes</p>
                </div>
              </div>

              {/* Gráfico e Agendamentos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Agendamentos da semana</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Agendamentos" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Agendamentos de Hoje</h2>
                  {agendamentosHoje.length === 0 ? (
                    <div className="text-center py-8">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-10 w-10 mx-auto text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="mt-2 text-gray-600 text-sm">Nenhum agendamento para hoje</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {agendamentosHoje.map((ag) => (
                        <div
                          key={ag.id}
                          className="p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start">
                            <div>
                              <h3 className="font-medium text-gray-900 text-sm sm:text-base">{ag.destino}</h3>
                              <p className="text-xs sm:text-sm text-gray-600">{getVeiculoNome(ag.veiculoId)}</p>
                            </div>
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mt-2 sm:mt-0">
                              {new Date(ag.saida).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {new Date(ag.chegada).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center text-xs sm:text-sm text-gray-500">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            {ag.motorista || 'Motorista não informado'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ranking */}
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                    Ranking de {rankingType === 'motoristas' ? 'Motoristas' : 'Veículos'}
                  </h2>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                    <select
                      value={rankingType}
                      onChange={(e) => setRankingType(e.target.value as 'motoristas' | 'veiculos')}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 w-full"
                      aria-label="Tipo de ranking"
                    >
                      <option value="motoristas">Motoristas</option>
                      <option value="veiculos">Veículos</option>
                    </select>
                    <select
                      value={rankingPeriod}
                      onChange={(e) => setRankingPeriod(e.target.value as 'semanal' | 'mensal')}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 w-full"
                      aria-label="Período do ranking"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                </div>

                {ranking.length === 0 ? (
                  <div className="text-center py-8">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-10 w-10 mx-auto text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <p className="mt-2 text-gray-600 text-sm">Nenhum dado para o período selecionado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            scope="col"
                            className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Posição
                          </th>
                          <th
                            scope="col"
                            className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {rankingType === 'motoristas' ? 'Motorista' : 'Veículo'}
                          </th>
                          <th
                            scope="col"
                            className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Agendamentos
                          </th>
                          <th
                            scope="col"
                            className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Progresso
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {ranking.map((item, index) => (
                          <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {index + 1}º
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.count}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <div className="w-24 sm:w-32 bg-gray-200 rounded-full h-2.5">
                                <div
                                  className="bg-green-600 h-2.5 rounded-full"
                                  style={{ width: `${(item.count / ranking[0].count) * 100}%` }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Calendário de Agendamentos</h2>
              <style jsx global>{`
                .rbc-calendar {
                  font-family: 'Inter', sans-serif;
                  background-color: #ffffff;
                  border-radius: 12px;
                  padding: 12px;
                }
                .rbc-event {
                  background-color: #10b981 !important;
                  border: none !important;
                  border-radius: 6px !important;
                  padding: 4px 8px !important;
                  color: #ffffff !important;
                  font-size: 10px !important;
                  font-weight: 500 !important;
                  cursor: pointer;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                .rbc-event.rbc-selected {
                  background-color: #059669 !important;
                }
                .rbc-today {
                  background-color: #ecfdf5 !important;
                }
                .rbc-toolbar {
                  margin-bottom: 12px !important;
                  font-size: 12px !important;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  flex-wrap: wrap;
                  gap: 8px;
                }
                .rbc-toolbar button {
                  background-color: #10b981 !important;
                  color: #ffffff !important;
                  border: none !important;
                  border-radius: 6px !important;
                  padding: 6px 12px !important;
                  cursor: pointer !important;
                  transition: all 0.2s !important;
                  font-weight: 500;
                  font-size: 12px;
                  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                .rbc-toolbar button:hover {
                  background-color: #059669 !important;
                  transform: translateY(-1px);
                }
                .rbc-toolbar button:active {
                  transform: translateY(0);
                }
                .rbc-toolbar-label {
                  color: #1f2937 !important;
                  font-weight: 600 !important;
                  font-size: 14px !important;
                }
                .rbc-month-view,
                .rbc-week-view,
                .rbc-day-view,
                .rbc-agenda-view {
                  border-radius: 8px !important;
                  overflow: hidden !important;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                .rbc-header {
                  background-color: #f9fafb !important;
                  color: #1f2937 !important;
                  padding: 8px !important;
                  font-weight: 600 !important;
                  border-bottom: 1px solid #e5e7eb !important;
                  font-size: 12px !important;
                }
                .rbc-time-slot {
                  background-color: #ffffff !important;
                  border-top: 1px solid #e5e7eb !important;
                  color: #1f2937 !important;
                  font-size: 10px !important;
                }
                .rbc-time-header {
                  background-color: #f9fafb !important;
                  color: #1f2937 !important;
                }
                .rbc-agenda-view table {
                  width: 100%;
                  border-collapse: collapse;
                }
                .rbc-agenda-view .rbc-agenda-date-cell,
                .rbc-agenda-view .rbc-agenda-time-cell,
                .rbc-agenda-view .rbc-agenda-event-cell {
                  padding: 8px !important;
                  color: #1f2937 !important;
                  font-size: 12px !important;
                  border-bottom: 1px solid #e5e7eb !important;
                }
                .rbc-agenda-view .rbc-agenda-event-cell {
                  font-weight: 500 !important;
                }
                .rbc-agenda-empty {
                  color: #1f2937 !important;
                  padding: 16px !important;
                  text-align: center;
                  font-size: 12px !important;
                }
                .rbc-day-bg {
                  background-color: #ffffff !important;
                  border: 1px solid #e5e7eb !important;
                }
                .rbc-off-range-bg {
                  background-color: #f9fafb !important;
                }
                .rbc-day-bg.rbc-today {
                  background-color: #ecfdf5 !important;
                }
                .rbc-btn-group button {
                  margin-right: 6px !important;
                }
                .rbc-row-segment {
                  padding: 4px !important;
                }
                .rbc-show-more {
                  color: #3b82f6 !important;
                  font-weight: 500 !important;
                  font-size: 12px !important;
                }
                @media (max-width: 640px) {
                  .rbc-calendar {
                    padding: 8px;
                  }
                  .rbc-event {
                    font-size: 8px !important;
                    padding: 2px 4px !important;
                  }
                  .rbc-toolbar {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 12px;
                  }
                  .rbc-toolbar-label {
                    font-size: 12px !important;
                  }
                  .rbc-btn-group {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                  }
                  .rbc-btn-group button {
                    padding: 6px 10px !important;
                    font-size: 10px !important;
                  }
                  .rbc-header {
                    font-size: 10px !important;
                    padding: 6px !important;
                  }
                  .rbc-time-slot {
                    font-size: 8px !important;
                  }
                  .rbc-agenda-view .rbc-agenda-date-cell,
                  .rbc-agenda-view .rbc-agenda-time-cell,
                  .rbc-agenda-view .rbc-agenda-event-cell {
                    font-size: 10px !important;
                    padding: 6px !important;
                  }
                  .rbc-agenda-empty {
                    font-size: 10px !important;
                    padding: 12px !important;
                  }
                  .rbc-show-more {
                    font-size: 10px !important;
                  }
                }
              `}</style>
              <Calendar
                localizer={localizer}
                events={eventosCalendario}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 'auto', minHeight: 500 }}
                defaultView="agenda"
                views={['month', 'week', 'day', 'agenda']}
                onSelectSlot={handleSelectSlot}
                selectable
                date={selectedDate || undefined}
                onNavigate={(date) => setSelectedDate(date)}
                messages={{
                  next: 'Próximo',
                  previous: 'Anterior',
                  today: 'Hoje',
                  month: 'Mês',
                  week: 'Semana',
                  day: 'Dia',
                  agenda: 'Agenda',
                  date: 'Data',
                  time: 'Hora',
                  event: 'Evento',
                  noEventsInRange: 'Nenhum agendamento neste período.',
                  showMore: (total) => `+${total} mais`,
                }}
                className="text-xs sm:text-sm"
                popup
                eventPropGetter={(event) => ({
                  style: {
                    backgroundColor: event.resource.concluido ? '#6B7280' : '#10B981',
                  },
                })}
              />
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
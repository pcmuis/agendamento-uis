'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import SidebarMenu from '../components/SidebarMenu';
import { listarVeiculosComStatus } from '@/app/lib/veiculos';
import { Agendamento, listarAgendamentos } from '@/app/lib/agendamentos';
import { criarAgendamento, atualizarAgendamento, excluirAgendamento } from '@/app/lib/agendamentos';
import { format, isValid } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

export interface Veiculo {
  id: string;
  modelo: string;
  placa: string;
  status?: {
    disponivel: boolean;
  };
}

export default function GerenciarAgendamentosPage() {
  const router = useRouter();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [formAberto, setFormAberto] = useState<'novo' | 'editar' | null>(null);
  const [dadosForm, setDadosForm] = useState<Omit<Agendamento, 'id'> & { id?: string }>({
    saida: '',
    chegada: '',
    veiculoId: '',
    motorista: '',
    matricula: '',
    telefone: '',
    destino: '',
    observacoes: '',
    concluido: false,
  });
  const [erro, setErro] = useState<string>('');
  const [ordenacao, setOrdenacao] = useState<{ coluna: keyof Agendamento; direcao: 'asc' | 'desc' }>({
    coluna: 'saida',
    direcao: 'asc',
  });
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'concluidos'>('ativos');

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      const [agendamentosLista, veiculosLista] = await Promise.all([
        listarAgendamentos(),
        listarVeiculosComStatus(new Date().toISOString()),
      ]);
      setAgendamentos(agendamentosLista.filter(ag => isValid(new Date(ag.saida)) && isValid(new Date(ag.chegada))));
      setVeiculos(veiculosLista);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Falha ao carregar dados. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const validarAgendamento = async (dados: typeof dadosForm, isEdicao: boolean = false) => {
    // Validação de campos obrigatórios
    const camposObrigatorios = [
      { nome: 'Data e Hora de Saída', valor: dados.saida },
      { nome: 'Data e Hora de Chegada', valor: dados.chegada },
      { nome: 'Veículo', valor: dados.veiculoId },
      { nome: 'Motorista', valor: dados.motorista },
      { nome: 'Matrícula', valor: dados.matricula },
      { nome: 'Telefone', valor: dados.telefone },
      { nome: 'Destino', valor: dados.destino },
    ];

    const camposFaltando = camposObrigatorios
      .filter((campo) => !campo.valor)
      .map((campo) => campo.nome);

    if (camposFaltando.length > 0) {
      return `Por favor, preencha os campos obrigatórios: ${camposFaltando.join(', ')}.`;
    }

    // Validação de formato de data
    if (!isValid(new Date(dados.saida)) || !isValid(new Date(dados.chegada))) {
      return 'Datas inválidas. Use o formato correto (DD/MM/AAAA HH:MM).';
    }

    // Validação de telefone
    const telefoneLimpo = dados.telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      return 'O número de telefone deve ter 10 ou 11 dígitos.';
    }

    // Validação de datas
    const saida = new Date(dados.saida);
    const chegada = new Date(dados.chegada);

    if (saida >= chegada) {
      return 'A data de saída deve ser anterior à data de chegada.';
    }

    if (saida < new Date()) {
      return 'A data de saída não pode ser no passado.';
    }

    // Validação de conflitos de agendamento
    try {
      const colAgendamentos = collection(db, 'agendamentos');
      const agendamentosSnap = await getDocs(colAgendamentos);
      const agendamentos = agendamentosSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as { veiculoId: string; saida: string; chegada: string }),
      }));

      const agendamentoConflitante = agendamentos.find((ag) => {
        if (ag.veiculoId !== dados.veiculoId || (isEdicao && ag.id === dados.id)) return false;

        const agSaida = new Date(ag.saida);
        const agChegada = new Date(ag.chegada);

        if (!isValid(agSaida) || !isValid(agChegada)) return false;

        return chegada > agSaida && saida < agChegada;
      });

      if (agendamentoConflitante) {
        const saidaConflito = format(new Date(agendamentoConflitante.saida), 'dd/MM/yyyy HH:mm',);
        return `Conflito: Este veículo já está agendado para ${saidaConflito}.`;
      }
    } catch (error) {
      console.error('Erro ao validar conflitos:', error);
      return 'Erro ao verificar conflitos de agendamento.';
    }

    return '';
  };

  const handleSubmit = async () => {
    try {
      const mensagemErro = await validarAgendamento(dadosForm, formAberto === 'editar');
      if (mensagemErro) {
        setErro(mensagemErro);
        toast.error(mensagemErro);
        return;
      }

      if (formAberto === 'novo') {
        await criarAgendamento(dadosForm);
        toast.success('Agendamento criado com sucesso!');
      } else if (formAberto === 'editar' && dadosForm.id) {
        await atualizarAgendamento(dadosForm.id, dadosForm);
        toast.success('Agendamento atualizado com sucesso!');
      }

      await carregarDados();
      setFormAberto(null);
      resetarFormulario();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      toast.error('Erro ao salvar agendamento. Tente novamente.');
    }
  };

  const resetarFormulario = () => {
    setDadosForm({
      saida: '',
      chegada: '',
      veiculoId: '',
      motorista: '',
      matricula: '',
      telefone: '',
      destino: '',
      observacoes: '',
      concluido: false,
    });
    setErro('');
  };

  const handleConcluir = async (id: string) => {
    if (!confirm('Deseja marcar este agendamento como concluído?')) return;

    try {
      await atualizarAgendamento(id, { concluido: true });
      toast.success('Agendamento marcado como concluído!');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao concluir agendamento:', error);
      toast.error('Erro ao concluir agendamento. Tente novamente.');
    }
  };

  const handleExcluir = async (id: string) => {
    if (!id) {
      toast.error('ID inválido para exclusão.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

    try {
      await excluirAgendamento(id);
      toast.success('Agendamento excluído com sucesso!');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast.error('Erro ao excluir agendamento. Tente novamente.');
    }
  };

  const handleEditar = (agendamento: Agendamento) => {
    setFormAberto('editar');
    setDadosForm({
      id: agendamento.id,
      saida: agendamento.saida,
      chegada: agendamento.chegada,
      veiculoId: agendamento.veiculoId,
      motorista: agendamento.motorista,
      matricula: agendamento.matricula,
      telefone: agendamento.telefone,
      destino: agendamento.destino,
      observacoes: agendamento.observacoes,
      concluido: agendamento.concluido,
    });
    setErro('');
  };

  const getVeiculoNome = (veiculoId: string) => {
    const veiculo = veiculos.find((v) => v.id === veiculoId);
    return veiculo ? `${veiculo.modelo} - ${veiculo.placa}` : 'Veículo não encontrado';
  };

  const getStatusAgendamento = (agendamento: Agendamento) => {
    const agora = new Date();
    const chegada = new Date(agendamento.chegada);
    const saida = new Date(agendamento.saida);

    if (!isValid(saida) || !isValid(chegada)) return 'Inválido';
    if (agendamento.concluido) return 'Concluído';
    if (saida <= agora && chegada >= agora) return 'Em Uso';
    if (chegada < agora) return 'Atrasado';
    return 'Futuro';
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Em Uso':
        return 'bg-blue-100 text-blue-800';
      case 'Atrasado':
        return 'bg-red-100 text-red-800';
      case 'Futuro':
        return 'bg-green-100 text-green-800';
      case 'Concluído':
        return 'bg-gray-100 text-gray-800';
      case 'Inválido':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const agendamentosFiltrados = agendamentos
    .filter((ag) => {
      if (filtroStatus === 'ativos') return !ag.concluido;
      if (filtroStatus === 'concluidos') return ag.concluido;
      return true;
    })
    .sort((a, b) => {
      const valorA = a[ordenacao.coluna] || '';
      const valorB = b[ordenacao.coluna] || '';

      if (ordenacao.coluna === 'saida' || ordenacao.coluna === 'chegada') {
        const dateA = new Date(valorA as string);
        const dateB = new Date(valorB as string);
        return ordenacao.direcao === 'asc'
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      } else if (ordenacao.coluna === 'veiculoId') {
        const nomeA = getVeiculoNome(valorA as string);
        const nomeB = getVeiculoNome(valorB as string);
        return ordenacao.direcao === 'asc'
          ? nomeA.localeCompare(nomeB)
          : nomeB.localeCompare(nomeA);
      }
      return ordenacao.direcao === 'asc'
        ? String(valorA).localeCompare(String(valorB))
        : String(valorB).localeCompare(String(valorA));
    });

  const handleOrdenar = (coluna: keyof Agendamento) => {
    setOrdenacao((prev) => ({
      coluna,
      direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  };

  const exportarParaExcel = () => {
    const dados = agendamentosFiltrados.map((ag) => ({
      'Data Saída': isValid(new Date(ag.saida))
        ? format(new Date(ag.saida), 'dd/MM/yyyy HH:mm',)
        : 'Data Inválida',
      'Data Chegada': isValid(new Date(ag.chegada))
        ? format(new Date(ag.chegada), 'dd/MM/yyyy HH:mm',)
        : 'Data Inválida',
      'Veículo': getVeiculoNome(ag.veiculoId),
      'Motorista': ag.motorista,
      'Matrícula': ag.matricula,
      'Telefone': ag.telefone,
      'Destino': ag.destino,
      'Observações': ag.observacoes || '-',
      'Status': getStatusAgendamento(ag),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Agendamentos');

    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss',);
    XLSX.writeFile(workbook, `agendamentos_${timestamp}.xlsx`);
  };

  const formatarDataHora = (data: string) => {
    if (!data || !isValid(new Date(data))) return 'Data Inválida';
    return format(new Date(data), 'dd/MM/yyyy HH:mm',);
  };

  const formatarTelefone = (telefone: string) => {
    const cleaned = telefone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return telefone;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-gray-50">
        <SidebarMenu />

        <main className="flex-1 ml-64 p-6 overflow-x-hidden">
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar />

          <div className="max-w-7xl mx-auto">
            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Gerenciamento de Agendamentos</h1>
                <p className="text-gray-600 mt-1">
                  {agendamentosFiltrados.length} agendamentos encontrados
                </p>
              </div>

              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <button
                  onClick={() => router.push('/historico')}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Histórico
                </button>

                <button
                  onClick={exportarParaExcel}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar
                </button>

                <button
                  onClick={carregarDados}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar
                </button>

                <button
                  onClick={() => {
                    setFormAberto('novo');
                    resetarFormulario();
                  }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Novo Agendamento
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-full sm:w-auto">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'ativos' | 'concluidos')}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  >
                    <option value="todos">Todos</option>
                    <option value="ativos">Ativos</option>
                    <option value="concluidos">Concluídos</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Formulário */}
            {formAberto && (
              <div className="bg-white p-6 rounded-lg shadow-md border border-green-200 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {formAberto === 'novo' ? 'Novo Agendamento' : 'Editar Agendamento'}
                  </h2>
                  <button
                    onClick={() => setFormAberto(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {erro && (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{erro}</p>
                      <button onClick={() => setErro('')} className="text-red-700 hover:text-red-900">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora de Saída*</label>
                    <input
                      type="datetime-local"
                      value={dadosForm.saida}
                      onChange={(e) => setDadosForm({ ...dadosForm, saida: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      required
                      min={format(new Date(), 'yyyy-MM-dd\'T\'HH:mm')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora de Chegada*</label>
                    <input
                      type="datetime-local"
                      value={dadosForm.chegada}
                      onChange={(e) => setDadosForm({ ...dadosForm, chegada: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      required
                      min={dadosForm.saida || format(new Date(), 'yyyy-MM-dd\'T\'HH:mm')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Veículo*</label>
                    <select
                      value={dadosForm.veiculoId}
                      onChange={(e) => setDadosForm({ ...dadosForm, veiculoId: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      required
                    >
                      <option value="">Selecione um veículo</option>
                      {veiculos
                        .filter(v => v.status?.disponivel)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.modelo} - {v.placa}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motorista*</label>
                    <input
                      type="text"
                      value={dadosForm.motorista}
                      onChange={(e) => setDadosForm({ ...dadosForm, motorista: e.target.value.trim() })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      placeholder="Nome completo"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula*</label>
                    <input
                      type="text"
                      value={dadosForm.matricula}
                      onChange={(e) => setDadosForm({ ...dadosForm, matricula: e.target.value.trim() })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      placeholder="Número da matrícula"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone*</label>
                    <input
                      type="tel"
                      value={dadosForm.telefone}
                      onChange={(e) => setDadosForm({ ...dadosForm, telefone: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      placeholder="(XX) 9XXXX-XXXX"
                      required
                      pattern="\(\d{2}\)\s?\d{4,5}-\d{4}"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destino*</label>
                    <input
                      type="text"
                      value={dadosForm.destino}
                      onChange={(e) => setDadosForm({ ...dadosForm, destino: e.target.value.trim() })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      placeholder="Local de destino"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                      value={dadosForm.observacoes}
                      onChange={(e) => setDadosForm({ ...dadosForm, observacoes: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      placeholder="Observações adicionais (opcional)"
                      rows={4}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setFormAberto(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={carregando}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400 disabled:cursor-not-allowed"
                  >
                    {formAberto === 'novo' ? 'Criar Agendamento' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de Agendamentos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {carregando ? (
                <div className="p-8 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                </div>
              ) : agendamentosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum agendamento encontrado</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filtroStatus === 'todos'
                      ? 'Não há agendamentos cadastrados no sistema.'
                      : filtroStatus === 'ativos'
                      ? 'Não há agendamentos ativos no momento.'
                      : 'Não há agendamentos concluídos.'}
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => {
                        setFormAberto('novo');
                        resetarFormulario();
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Novo Agendamento
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          { nome: 'Status', coluna: undefined },
                          { nome: 'Saída', coluna: 'saida' as keyof Agendamento },
                          { nome: 'Chegada', coluna: 'chegada' as keyof Agendamento },
                          { nome: 'Veículo', coluna: 'veiculoId' as keyof Agendamento },
                          { nome: 'Motorista', coluna: 'motorista' as keyof Agendamento },
                          { nome: 'Matrícula', coluna: 'matricula' as keyof Agendamento },
                          { nome: 'Telefone', coluna: 'telefone' as keyof Agendamento },
                          { nome: 'Destino', coluna: 'destino' as keyof Agendamento },
                          { nome: 'Ações', coluna: undefined },
                        ].map((col) => (
                          <th
                            key={col.coluna || col.nome}
                            onClick={() => col.coluna && handleOrdenar(col.coluna)}
                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                              col.coluna ? 'cursor-pointer hover:bg-gray-100' : ''
                            }`}
                          >
                            <div className="flex items-center">
                              {col.nome}
                              {ordenacao.coluna === col.coluna && (
                                <span className="ml-1">
                                  {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {agendamentosFiltrados.map((ag) => {
                        const status = getStatusAgendamento(ag);
                        return (
                          <tr key={ag.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusStyle(status)}`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarDataHora(ag.saida)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarDataHora(ag.chegada)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {getVeiculoNome(ag.veiculoId)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {ag.motorista}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {ag.matricula}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarTelefone(ag.telefone)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {ag.destino}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditar(ag)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Editar"
                                  disabled={carregando}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                {!ag.concluido && (
                                  <button
                                    onClick={() => handleConcluir(ag.id)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Concluir"
                                    disabled={carregando}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleExcluir(ag.id)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Excluir"
                                  disabled={carregando}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
'use client';

import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
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
import { getDb } from '@/app/lib/firebase';
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
    codigo: '',
    nomeAgendador: '', //
  });
  const [erro, setErro] = useState<string>('');
  const [ordenacao, setOrdenacao] = useState<{ coluna: keyof Agendamento; direcao: 'asc' | 'desc' }>({
    coluna: 'saida',
    direcao: 'asc',
  });
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'concluidos'>('ativos');
  const [codigoFiltro, setCodigoFiltro] = useState<string>('');
  const [linhasExpandidas, setLinhasExpandidas] = useState<Set<string>>(() => new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const checkboxTodosRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    setSelecionados((prev) => {
      const idsDisponiveis = new Set(agendamentos.map((ag) => ag.id));
      const novo = new Set([...prev].filter((id) => idsDisponiveis.has(id)));
      return novo;
    });
  }, [agendamentos]);

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

    // Permitir datas passadas na edição administrativa
    if (formAberto === 'novo' && saida < new Date()) {
      return 'A data de saída não pode ser no passado.';
    }

    // Validação de conflitos de agendamento
    try {
      const colAgendamentos = collection(getDb(), 'agendamentos');
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
      codigo: '',
      nomeAgendador: '',
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
      nomeAgendador: agendamento.nomeAgendador || '',
      saida: agendamento.saida,
      chegada: agendamento.chegada,
      veiculoId: agendamento.veiculoId,
      motorista: agendamento.motorista,
      matricula: agendamento.matricula,
      telefone: agendamento.telefone,
      destino: agendamento.destino,
      observacoes: agendamento.observacoes || '',
      concluido: agendamento.concluido,
      codigo: agendamento.codigo || '',
    });
    setErro('');
  };

  const getVeiculoNome = (veiculoId: string) => {
    const veiculo = veiculos.find((v) => v.id === veiculoId);
    return veiculo ? `${veiculo.modelo} - ${veiculo.placa}` : 'Veículo não encontrado';
  };

  const getVeiculoPlaca = (veiculoId: string) => {
    const veiculo = veiculos.find((v) => v.id === veiculoId);
    return veiculo?.placa || 'Placa não informada';
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
      if (!codigoFiltro) {
        if (filtroStatus === 'ativos') return !ag.concluido;
        if (filtroStatus === 'concluidos') return ag.concluido;
        return true;
      }
      const termo = codigoFiltro.trim().toLowerCase();
      return (
        (ag.codigo && ag.codigo.toLowerCase().includes(termo)) ||
        (ag.motorista && ag.motorista.toLowerCase().includes(termo)) ||
        (ag.nomeAgendador && ag.nomeAgendador.toLowerCase().includes(termo)) ||
        (ag.matricula && ag.matricula.toLowerCase().includes(termo)) ||
        (ag.telefone && ag.telefone.toLowerCase().includes(termo)) ||
        (ag.destino && ag.destino.toLowerCase().includes(termo)) ||
        (ag.veiculoId && getVeiculoNome(ag.veiculoId).toLowerCase().includes(termo)) ||
        (ag.observacoes && ag.observacoes.toLowerCase().includes(termo))
      );
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
      'Comprovante': ag.codigo || '-',
      'Nome Agendador': ag.nomeAgendador || '-',
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
    if (!telefone) return '';
    const cleaned = telefone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return telefone;
  };

  const alternarLinhaExpandida = useCallback((id: string) => {
    setLinhasExpandidas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  }, []);

  const alternarSelecionado = useCallback((id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  }, []);

  const selecionarTodosFiltrados = useCallback((selecionar: boolean, ids: string[]) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (selecionar) {
        ids.forEach((id) => novo.add(id));
      } else {
        ids.forEach((id) => novo.delete(id));
      }
      return novo;
    });
  }, []);

  const copiarTexto = useCallback(async (texto: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const sucesso = document.execCommand('copy');
    document.body.removeChild(textarea);
    return sucesso;
  }, []);

  const montarTextoAgendamento = useCallback((agendamento: Agendamento) => {
    const observacoes = agendamento.observacoes?.trim() ? agendamento.observacoes : 'Sem observações';
    const comprovante = agendamento.codigo || '-';
    const agendador = agendamento.nomeAgendador || agendamento.motorista;
    const telefoneFormatado = formatarTelefone(agendamento.telefone) || agendamento.telefone || '-';
    const matricula = agendamento.matricula || '-';
    const veiculoNome = getVeiculoNome(agendamento.veiculoId);
    const placa = getVeiculoPlaca(agendamento.veiculoId);
    const status = getStatusAgendamento(agendamento);

    return [
      `🚘 Placa: ${placa} | Veículo: ${veiculoNome}`,
      `🧾 Comprovante: ${comprovante}`,
      `👤 Motorista: ${agendamento.motorista}`,
      `🗂️ Resp. Agendamento: ${agendador}`,
      `🕒 Saída: ${formatarDataHora(agendamento.saida)} | Retorno: ${formatarDataHora(agendamento.chegada)} `,
      `📍 Destino: ${agendamento.destino}`,
      `📝 Observações: ${observacoes}`,
    ].join('\n');
  }, [formatarDataHora, formatarTelefone, getStatusAgendamento, getVeiculoNome, getVeiculoPlaca]);

  const handleCopiarAgendamentos = useCallback(async () => {
    const agendamentosSelecionados = agendamentos.filter((ag) => selecionados.has(ag.id));

    if (agendamentosSelecionados.length === 0) {
      toast.info('Selecione ao menos um agendamento para copiar.');
      return;
    }

    const textoFinal = agendamentosSelecionados
      .map(montarTextoAgendamento)
      .join('\n\n------------------------------\n\n');

    try {
      const sucesso = await copiarTexto(textoFinal);
      if (!sucesso) {
        throw new Error('Falha ao copiar');
      }
      toast.success(`Agendamento${agendamentosSelecionados.length > 1 ? 's' : ''} copiado(s)!`);
    } catch (error) {
      console.error('Erro ao copiar agendamentos:', error);
      toast.error('Não foi possível copiar os agendamentos. Tente novamente.');
    }
  }, [agendamentos, copiarTexto, montarTextoAgendamento, selecionados]);

  const idsFiltrados = agendamentosFiltrados.map((ag) => ag.id);
  const totalSelecionados = selecionados.size;
  const todosFiltradosSelecionados =
    idsFiltrados.length > 0 && idsFiltrados.every((id) => selecionados.has(id));
  const algunsFiltradosSelecionados =
    idsFiltrados.some((id) => selecionados.has(id)) && !todosFiltradosSelecionados;

  useEffect(() => {
    if (checkboxTodosRef.current) {
      checkboxTodosRef.current.indeterminate = algunsFiltradosSelecionados;
    }
  }, [algunsFiltradosSelecionados]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
        <SidebarMenu className="md:min-h-screen" />

        <main className="flex-1 p-6 overflow-x-hidden">
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
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Selecionados: {totalSelecionados}</span>
                </div>
                <button
                  onClick={handleCopiarAgendamentos}
                  disabled={totalSelecionados === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    totalSelecionados === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                  title="Copiar agendamentos selecionados"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V6a2 2 0 012-2h7a2 2 0 012 2v7a2 2 0 01-2 2h-1M8 7H6a2 2 0 00-2 2v7a2 2 0 002 2h7a2 2 0 002-2v-1"
                    />
                  </svg>
                  Copiar
                </button>
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

            {/* Campo de pesquisa de agendamento */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-full sm:w-auto flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar e filtrar agendamentos</label>
                <input
                  type="text"
                  value={codigoFiltro}
                  onChange={e => setCodigoFiltro(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  placeholder="Digite o código do comprovante, nome do motorista, matrícula ou telefone"
                />
              </div>
            </div>

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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <label className="flex items-center gap-2">
                            <input
                              ref={checkboxTodosRef}
                              type="checkbox"
                              checked={todosFiltradosSelecionados}
                              onChange={(event) => selecionarTodosFiltrados(event.target.checked, idsFiltrados)}
                              onClick={(event) => event.stopPropagation()}
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              aria-label="Selecionar todos os agendamentos filtrados"
                            />
                            <span>Sel.</span>
                          </label>
                        </th>
                        <th
                          onClick={() => handleOrdenar('veiculoId')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          <div className="flex items-center">
                            Placa
                            {ordenacao.coluna === 'veiculoId' && (
                              <span className="ml-1">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          onClick={() => handleOrdenar('motorista')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          <div className="flex items-center">
                            Motorista
                            {ordenacao.coluna === 'motorista' && (
                              <span className="ml-1">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          onClick={() => handleOrdenar('saida')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          <div className="flex items-center">
                            Saída
                            {ordenacao.coluna === 'saida' && (
                              <span className="ml-1">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          onClick={() => handleOrdenar('chegada')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          <div className="flex items-center">
                            Retorno
                            {ordenacao.coluna === 'chegada' && (
                              <span className="ml-1">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {agendamentosFiltrados.map((ag) => {
                        const status = getStatusAgendamento(ag);
                        const expandido = ag.id ? linhasExpandidas.has(ag.id) : false;
                        const selecionado = ag.id ? selecionados.has(ag.id) : false;
                        return (
                          <Fragment key={ag.id}>
                            <tr
                              role="button"
                              tabIndex={0}
                              onClick={() => ag.id && alternarLinhaExpandida(ag.id)}
                              onKeyDown={(event) => {
                                if (event.target !== event.currentTarget || !ag.id) {
                                  return;
                                }
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  alternarLinhaExpandida(ag.id);
                                }
                              }}
                              aria-expanded={expandido}
                              className={`hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                                expandido || selecionado ? 'bg-gray-50' : ''
                              }`}
                            >
                              <td
                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selecionado}
                                  onChange={() => alternarSelecionado(ag.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  aria-label={`Selecionar agendamento de ${ag.motorista}`}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusStyle(status)}`}
                                  >
                                    {status}
                                  </span>
                                  <span>{getVeiculoPlaca(ag.veiculoId)}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ag.motorista}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatarDataHora(ag.saida)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatarDataHora(ag.chegada)}
                              </td>
                              <td
                                className="px-6 py-4 whitespace-nowrap text-sm font-medium"
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                              >
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditar(ag)}
                                    className="text-green-600 hover:text-green-900"
                                    title="Editar"
                                    disabled={carregando}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                      />
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
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                            <tr className={expandido ? 'bg-gray-50' : 'hidden'}>
                              <td colSpan={6} className="px-6 pb-4">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Motorista</p>
                                      <p className="text-gray-900">{ag.motorista}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Matrícula</p>
                                      <p className="text-gray-900">{ag.matricula || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Saída</p>
                                      <p className="text-gray-900">{formatarDataHora(ag.saida)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Retorno</p>
                                      <p className="text-gray-900">{formatarDataHora(ag.chegada)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Destino</p>
                                      <p className="text-gray-900">{ag.destino}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Telefone</p>
                                      <p className="text-gray-900">{formatarTelefone(ag.telefone)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Veículo</p>
                                      <p className="text-gray-900">{getVeiculoNome(ag.veiculoId)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Placa</p>
                                      <p className="text-gray-900">{getVeiculoPlaca(ag.veiculoId)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Comprovante</p>
                                      <p className="text-gray-900">{ag.codigo || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Agendador</p>
                                      <p className="text-gray-900">{ag.nomeAgendador || ag.motorista}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-gray-500">Status</p>
                                      <span
                                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusStyle(status)}`}
                                      >
                                        {status}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-gray-500">Observações</p>
                                    <p className="text-gray-900">{ag.observacoes?.trim() ? ag.observacoes : 'Sem observações'}</p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {codigoFiltro && agendamentosFiltrados.length === 0 && (
                <div className="p-8 text-center text-blue-600 font-medium">
                  Nenhum agendamento encontrado para o código informado.
                </div>
              )}
            </div>

            {/* Formulário de edição/novo agendamento */}
            {formAberto && (
              <div className="bg-white p-6 rounded-lg shadow-md border border-green-200 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  {formAberto === 'novo' ? 'Novo Agendamento' : 'Editar Agendamento'}
                </h2>

                {erro && (
                  <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded-md">
                    {erro}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Data e Hora de Saída */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Saída</label>
                    <input
                      type="date"
                      value={dadosForm.saida ? dadosForm.saida.split('T')[0] : ''}
                      onChange={e => {
                        const novaData = e.target.value;
                        const hora = dadosForm.saida ? dadosForm.saida.split('T')[1]?.slice(0,5) : '';
                        setDadosForm({
                          ...dadosForm,
                          saida: novaData ? `${novaData}T${hora || '00:00'}` : '',
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Saída</label>
                    <input
                      type="time"
                      value={dadosForm.saida ? dadosForm.saida.split('T')[1]?.slice(0,5) : ''}
                      onChange={e => {
                        const novaHora = e.target.value;
                        const data = dadosForm.saida ? dadosForm.saida.split('T')[0] : '';
                        setDadosForm({
                          ...dadosForm,
                          saida: data ? `${data}T${novaHora}` : '',
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>
                  {/* Data e Hora de Chegada */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Chegada</label>
                    <input
                      type="date"
                      value={dadosForm.chegada ? dadosForm.chegada.split('T')[0] : ''}
                      onChange={e => {
                        const novaData = e.target.value;
                        const hora = dadosForm.chegada ? dadosForm.chegada.split('T')[1]?.slice(0,5) : '';
                        setDadosForm({
                          ...dadosForm,
                          chegada: novaData ? `${novaData}T${hora || '00:00'}` : '',
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Chegada</label>
                    <input
                      type="time"
                      value={dadosForm.chegada ? dadosForm.chegada.split('T')[1]?.slice(0,5) : ''}
                      onChange={e => {
                        const novaHora = e.target.value;
                        const data = dadosForm.chegada ? dadosForm.chegada.split('T')[0] : '';
                        setDadosForm({
                          ...dadosForm,
                          chegada: data ? `${data}T${novaHora}` : '',
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Veículo</label>
                    <select
                      value={dadosForm.veiculoId}
                      onChange={(e) => setDadosForm({ ...dadosForm, veiculoId: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    >
                      <option value="">Selecione um veículo</option>
                      {veiculos.map((veiculo) => (
                        <option key={veiculo.id} value={veiculo.id}>
                          {veiculo.modelo} - {veiculo.placa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motorista</label>
                    <input
                      type="text"
                      value={dadosForm.motorista}
                      onChange={(e) => setDadosForm({ ...dadosForm, motorista: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
                    <input
                      type="text"
                      value={dadosForm.matricula}
                      onChange={(e) => setDadosForm({ ...dadosForm, matricula: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={dadosForm.telefone}
                      onChange={(e) => setDadosForm({ ...dadosForm, telefone: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      placeholder="(XX) XXXXX-XXXX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                    <input
                      type="text"
                      value={dadosForm.destino}
                      onChange={(e) => setDadosForm({ ...dadosForm, destino: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                      value={dadosForm.observacoes}
                      onChange={(e) => setDadosForm({ ...dadosForm, observacoes: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      rows={3}
                      placeholder="Observações adicionais sobre o agendamento"
                    ></textarea>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setFormAberto(null)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                  >
                    {formAberto === 'novo' ? 'Criar Agendamento' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

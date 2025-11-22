'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  buscarAgendamentosPorVeiculoEMatricula,
  atualizarAgendamento,
  Agendamento,
} from '@/app/lib/agendamentos';
import { buscarVeiculoPorId, Veiculo } from '@/app/lib/veiculos';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface ClientProps {
  veiculoId: string;
}

export function AgendamentoVeiculoClient({ veiculoId }: ClientProps) {
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [carregandoVeiculo, setCarregandoVeiculo] = useState(true);
  const [matricula, setMatricula] = useState('');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregandoBusca, setCarregandoBusca] = useState(false);
  const [selecionado, setSelecionado] = useState<string>('');
  const [erro, setErro] = useState('');
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    const carregarVeiculo = async () => {
      setCarregandoVeiculo(true);
      try {
        const encontrado = await buscarVeiculoPorId(veiculoId);
        setVeiculo(encontrado);
        if (!encontrado) {
          setErro('Veículo não encontrado. Verifique se o link está correto.');
        }
      } catch (error) {
        console.error('Erro ao carregar veículo:', error);
        setErro('Não foi possível carregar os dados do veículo.');
      } finally {
        setCarregandoVeiculo(false);
      }
    };

    carregarVeiculo();
  }, [veiculoId]);

  const formatarDataHora = (valor: string) => {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return 'Data inválida';
    return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const agendamentoSelecionado = useMemo(
    () => agendamentos.find((agendamento) => agendamento.id === selecionado),
    [agendamentos, selecionado],
  );

  const getStatusAgendamento = (agendamento: Agendamento) => {
    if (agendamento.cancelado) {
      return { label: 'Cancelado', classe: 'bg-red-100 text-red-800' } as const;
    }
    if (agendamento.concluido) {
      return { label: 'Concluído', classe: 'bg-gray-100 text-gray-700' } as const;
    }
    return { label: 'Em andamento', classe: 'bg-emerald-100 text-emerald-800' } as const;
  };

  const handleBuscar = async (event?: FormEvent) => {
    event?.preventDefault();
    setErro('');

    if (!matricula.trim()) {
      setErro('Informe a matrícula para continuar.');
      return;
    }

    setCarregandoBusca(true);
    try {
      const resultados = await buscarAgendamentosPorVeiculoEMatricula(veiculoId, matricula);
      setAgendamentos(resultados);
      setSelecionado('');

      if (resultados.length === 0) {
        toast.info('Nenhum agendamento encontrado para esta matrícula.');
      }
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setErro('Não foi possível buscar os agendamentos.');
    } finally {
      setCarregandoBusca(false);
    }
  };

  const exigirSelecao = () => {
    if (!agendamentoSelecionado) {
      toast.warn('Selecione um agendamento para continuar.');
      return false;
    }
    return true;
  };

  const handleConfirmarSaida = () => {
    if (!exigirSelecao()) return;
    toast.success('Confirmação registrada! (ação visual por enquanto)');
  };

  const handleCancelarAgendamento = async () => {
    if (!exigirSelecao() || !agendamentoSelecionado) return;

    if (!confirm('Deseja realmente cancelar este agendamento?')) return;

    try {
      setCancelando(true);
      await atualizarAgendamento(agendamentoSelecionado.id, { cancelado: true, concluido: false });
      toast.success('Agendamento cancelado com sucesso.');
      setAgendamentos((lista) => lista.filter((item) => item.id !== agendamentoSelecionado.id));
      setSelecionado('');
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      toast.error('Não foi possível cancelar o agendamento.');
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-green-50 flex items-start justify-center p-4 sm:p-6">
      <ToastContainer position="top-center" theme="colored" />

      <div className="w-full max-w-4xl mt-6 space-y-6">
        <header className="text-center space-y-2">
          <p className="text-sm text-green-700 font-semibold">Acesso ao agendamento</p>
          <h1 className="text-3xl font-bold text-gray-900">Gerencie sua saída</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Confirme sua saída ou cancele seu agendamento informando sua matrícula. Este link é exclusivo do veículo e pode ser
            compartilhado com os motoristas.
          </p>
        </header>

        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
          {carregandoVeiculo ? (
            <div className="flex items-center gap-3 text-gray-600">
              <div className="h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              <span>Carregando dados do veículo...</span>
            </div>
          ) : erro ? (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{erro}</div>
          ) : veiculo ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">Veículo selecionado</p>
                <h2 className="text-xl font-semibold text-gray-900">
                  {veiculo.modelo} <span className="text-gray-500">•</span> {veiculo.placa}
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                  veiculo.disponivel ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {veiculo.disponivel ? 'Disponível' : 'Indisponível'}
              </span>
            </div>
          ) : null}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula do motorista</label>
              <input
                type="text"
                value={matricula}
                onChange={(event) => setMatricula(event.target.value)}
                placeholder="Digite sua matrícula"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200"
              />
              <p className="mt-1 text-xs text-gray-500">Utilize apenas números e letras, sem espaços.</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-600">Buscaremos seus agendamentos ativos para este veículo.</p>
              <button
                onClick={handleBuscar}
                disabled={carregandoBusca}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700 transition disabled:opacity-60"
              >
                {carregandoBusca && <span className="h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />}
                {carregandoBusca ? 'Buscando...' : 'Buscar agendamentos'}
              </button>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </div>
        </section>

        {agendamentos.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Agendamentos encontrados</h3>
                <p className="text-sm text-gray-600">Selecione um agendamento para confirmar a saída ou cancelar.</p>
              </div>
              <span className="text-sm font-medium text-gray-700">{agendamentos.length} resultado(s)</span>
            </div>

            <div className="space-y-3">
              {agendamentos.map((agendamento) => (
                <label
                  key={agendamento.id}
                  className={`flex flex-col gap-3 rounded-lg border p-4 cursor-pointer transition hover:border-green-300 ${
                    selecionado === agendamento.id ? 'border-green-500 ring-2 ring-green-100' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="agendamento"
                        value={agendamento.id}
                        checked={selecionado === agendamento.id}
                        onChange={() => setSelecionado(agendamento.id)}
                        className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500"
                      />
                      <div>
                        <p className="text-sm text-gray-500">Destino</p>
                        <p className="text-lg font-semibold text-gray-900">{agendamento.destino}</p>
                      </div>
                    </div>
                    {(() => {
                      const status = getStatusAgendamento(agendamento);
                      return (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.classe}`}>
                          {status.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-700">
                    <div>
                      <p className="text-gray-500">Saída</p>
                      <p className="font-medium">{formatarDataHora(agendamento.saida)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Chegada prevista</p>
                      <p className="font-medium">{formatarDataHora(agendamento.chegada)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Motorista</p>
                      <p className="font-medium">{agendamento.motorista}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
              <button
                onClick={handleCancelarAgendamento}
                disabled={cancelando}
                className="w-full sm:w-auto rounded-lg border border-red-200 px-4 py-2 text-red-700 font-semibold hover:bg-red-50 transition disabled:opacity-60"
              >
                {cancelando ? 'Cancelando...' : 'Cancelar agendamento'}
              </button>
              <button
                onClick={handleConfirmarSaida}
                className="w-full sm:w-auto rounded-lg bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700 transition"
              >
                Confirmar saída
              </button>
            </div>
            <p className="text-xs text-gray-500">O cancelamento é efetivado no sistema; a confirmação de saída ainda é apenas visual.</p>
          </section>
        )}
      </div>
    </div>
  );
}

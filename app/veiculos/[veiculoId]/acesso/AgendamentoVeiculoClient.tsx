'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { buscarAgendamentosPorVeiculoEMatricula, Agendamento } from '@/app/lib/agendamentos';
import { buscarChecklistPorId, ChecklistModelo } from '@/app/lib/checklists';
import { salvarRespostaChecklist } from '@/app/lib/checklist-respostas';
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
  const [carregandoChecklist, setCarregandoChecklist] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistModelo | null>(null);
  const [exibindoChecklist, setExibindoChecklist] = useState(false);
  const [respostasFormulario, setRespostasFormulario] = useState<Record<string, { valor: string; observacao?: string }>>({});
  const [errosChecklist, setErrosChecklist] = useState<Record<string, string>>({});
  const [salvandoChecklist, setSalvandoChecklist] = useState(false);

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

  const handleConfirmarSaida = async () => {
    if (!exigirSelecao()) return;

    if (!veiculo?.checklistId) {
      toast.error('Este veículo não possui checklist atribuído.');
      return;
    }

    setCarregandoChecklist(true);
    try {
      const encontrado = await buscarChecklistPorId(veiculo.checklistId);
      if (!encontrado) {
        toast.error('Checklist não encontrado para este veículo.');
        return;
      }

      setChecklist(encontrado);
      setRespostasFormulario({});
      setErrosChecklist({});
      setExibindoChecklist(true);
    } catch (error) {
      console.error('Erro ao carregar checklist:', error);
      toast.error('Não foi possível abrir o checklist.');
    } finally {
      setCarregandoChecklist(false);
    }
  };

  const atualizarResposta = (perguntaId: string, campo: 'valor' | 'observacao', valor: string) => {
    setRespostasFormulario((anterior) => ({
      ...anterior,
      [perguntaId]: {
        ...anterior[perguntaId],
        [campo]: valor,
      },
    }));
  };

  const validarChecklist = () => {
    if (!checklist) return false;
    const novosErros: Record<string, string> = {};

    checklist.perguntas.forEach((pergunta) => {
      const resposta = respostasFormulario[pergunta.id]?.valor ?? '';
      if (pergunta.obrigatorio && !resposta) {
        novosErros[pergunta.id] = 'Campo obrigatório';
      }
    });

    setErrosChecklist(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleEnviarChecklist = async () => {
    if (!checklist || !agendamentoSelecionado) return;
    if (!validarChecklist()) {
      toast.error('Preencha as perguntas obrigatórias para continuar.');
      return;
    }

    setSalvandoChecklist(true);
    try {
      await salvarRespostaChecklist({
        veiculoId,
        agendamentoId: agendamentoSelecionado.id,
        checklistId: checklist.id,
        respondidoEm: new Date().toISOString(),
        respondidoPorNome: agendamentoSelecionado.motorista,
        respondidoPorMatricula: matricula.trim(),
        respostas: checklist.perguntas.map((pergunta) => ({
          perguntaId: pergunta.id,
          perguntaTexto: pergunta.texto,
          tipoResposta: pergunta.tipoResposta,
          valor: respostasFormulario[pergunta.id]?.valor ?? '',
          observacao: pergunta.permiteObservacao
            ? respostasFormulario[pergunta.id]?.observacao?.trim() || ''
            : '',
        })),
      });

      toast.success('Checklist enviado! Aguarde a confirmação da saída.');
      setExibindoChecklist(false);
      setChecklist(null);
      setRespostasFormulario({});
      setErrosChecklist({});
      setSelecionado('');
    } catch (error) {
      console.error('Erro ao salvar checklist:', error);
      toast.error('Não foi possível salvar suas respostas. Tente novamente.');
    } finally {
      setSalvandoChecklist(false);
    }
  };

  const handleCancelarAgendamento = () => {
    if (!exigirSelecao()) return;
    toast.info('Cancelamento disponível em breve.');
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
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        agendamento.concluido ? 'bg-gray-100 text-gray-700' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {agendamento.concluido ? 'Concluído' : 'Em andamento'}
                    </span>
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
                className="w-full sm:w-auto rounded-lg border border-red-200 px-4 py-2 text-red-700 font-semibold hover:bg-red-50 transition"
              >
                Cancelar agendamento
              </button>
              <button
                onClick={handleConfirmarSaida}
                disabled={carregandoChecklist}
                className="w-full sm:w-auto rounded-lg bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700 transition disabled:opacity-60"
              >
                {carregandoChecklist ? 'Abrindo checklist...' : 'Confirmar saída'}
              </button>
            </div>
            <p className="text-xs text-gray-500">A saída só será confirmada após o envio do checklist.</p>
          </section>
        )}
      </div>

      {exibindoChecklist && checklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500">Checklist de saída</p>
                <h2 className="text-2xl font-semibold text-gray-900">{checklist.nome}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Motorista: <strong>{agendamentoSelecionado?.motorista || 'Não informado'}</strong> • Matrícula:{' '}
                  <strong>{matricula}</strong>
                </p>
              </div>
              <button
                onClick={() => setExibindoChecklist(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Fechar checklist"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {checklist.perguntas.map((pergunta) => (
                <div key={pergunta.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-600">Pergunta</p>
                      <p className="font-semibold text-gray-900">{pergunta.texto || 'Pergunta sem texto'}</p>
                    </div>
                    {pergunta.obrigatorio && <span className="text-xs text-red-600 font-semibold">Obrigatória</span>}
                  </div>

                  {pergunta.tipoResposta === 'status' ? (
                    <div className="flex flex-wrap gap-3">
                      {[
                        { valor: 'C', rotulo: 'Conforme' },
                        { valor: 'NC', rotulo: 'Não conforme' },
                        { valor: 'NA', rotulo: 'Não se aplica' },
                      ].map((opcao) => (
                        <button
                          key={opcao.valor}
                          type="button"
                          onClick={() => atualizarResposta(pergunta.id, 'valor', opcao.valor)}
                          className={`px-3 py-2 rounded-lg border font-semibold transition ${
                            respostasFormulario[pergunta.id]?.valor === opcao.valor
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-800 border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {opcao.rotulo} ({opcao.valor})
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type={pergunta.tipoResposta === 'numero' ? 'number' : 'text'}
                      value={respostasFormulario[pergunta.id]?.valor ?? ''}
                      onChange={(event) => atualizarResposta(pergunta.id, 'valor', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                      placeholder={pergunta.tipoResposta === 'numero' ? 'Digite um número' : 'Resposta curta'}
                    />
                  )}

                  {pergunta.permiteObservacao && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Observação (opcional)</label>
                      <textarea
                        value={respostasFormulario[pergunta.id]?.observacao ?? ''}
                        onChange={(event) => atualizarResposta(pergunta.id, 'observacao', event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                        rows={2}
                      />
                    </div>
                  )}

                  {errosChecklist[pergunta.id] && (
                    <p className="text-sm text-red-600">{errosChecklist[pergunta.id]}</p>
                  )}
                </div>
              ))}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
                <button
                  onClick={() => setExibindoChecklist(false)}
                  className="w-full sm:w-auto rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-semibold hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEnviarChecklist}
                  disabled={salvandoChecklist}
                  className="w-full sm:w-auto rounded-lg bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700 transition disabled:opacity-60"
                >
                  {salvandoChecklist ? 'Enviando...' : 'Enviar checklist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

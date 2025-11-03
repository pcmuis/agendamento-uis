'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMinutes, endOfDay, format, isAfter, isBefore, isValid, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProtectedRoute from '../components/ProtectedRoute';
import SidebarMenu from '../components/SidebarMenu';
import {
  Agendamento,
  Veiculo,
  listarAgendamentos,
  listarVeiculos,
} from '../lib/veiculos';
import { downloadElementAsPng } from '../utils/exportAsImage';

interface AgendamentoNormalizado extends Agendamento {
  saidaDate: Date | null;
  chegadaDate: Date | null;
}

const hojeString = format(new Date(), 'yyyy-MM-dd');

const formatarHora = (date: Date | null) => {
  if (!date || !isValid(date)) {
    return '-';
  }

  return format(date, 'HH:mm', { locale: ptBR });
};

const ocorreNoDia = (agendamento: AgendamentoNormalizado, dia: Date) => {
  const startDay = startOfDay(dia);
  const endDay = endOfDay(dia);

  const { saidaDate, chegadaDate } = agendamento;
  if (!saidaDate || !chegadaDate) {
    return false;
  }

  const comecaNoDia = !isBefore(saidaDate, startDay) && !isAfter(saidaDate, endDay);
  const terminaNoDia = !isBefore(chegadaDate, startDay) && !isAfter(chegadaDate, endDay);
  const atravessaDia = isBefore(saidaDate, startDay) && isAfter(chegadaDate, startDay);

  return comecaNoDia || terminaNoDia || atravessaDia;
};

const normalizarDatas = (agendamento: Agendamento): AgendamentoNormalizado => {
  const saidaDate = agendamento.saida ? new Date(agendamento.saida) : null;
  const chegadaDate = agendamento.chegada ? new Date(agendamento.chegada) : null;

  return {
    ...agendamento,
    saidaDate: saidaDate && isValid(saidaDate) ? saidaDate : null,
    chegadaDate: chegadaDate && isValid(chegadaDate) ? chegadaDate : null,
  };
};

const MARGEM_MINUTOS_ENTRE_AGENDAMENTOS = 60;

type ContextoHoraDisponibilidade = 'ate' | 'entreInicio' | 'entreFim' | 'apos';

const formatarHoraDisponibilidade = (date: Date, contexto: ContextoHoraDisponibilidade) => {
  const horas = date.getHours();
  const minutos = date.getMinutes();
  const horasSemZero = horas.toString();
  const minutosFormatados = minutos.toString().padStart(2, '0');

  if (minutos === 0) {
    if (contexto === 'ate') {
      return `${horasSemZero}h${minutosFormatados}`;
    }

    if (contexto === 'entreInicio') {
      return horasSemZero;
    }

    return `${horasSemZero}h`;
  }

  return format(date, 'H:mm', { locale: ptBR });
};

const limitarAoDia = (data: Date, inicioDoDia: Date, fimDoDia: Date) => {
  const limiteInferior = Math.max(data.getTime(), inicioDoDia.getTime());
  const limiteSuperior = Math.min(limiteInferior, fimDoDia.getTime());

  return new Date(limiteSuperior);
};

const getDisponibilidadeTexto = (
  agendamentosDoDia: AgendamentoNormalizado[],
  dia: Date,
) => {
  if (agendamentosDoDia.length === 0) {
    return 'Disponível o dia todo';
  }

  const ordenados = [...agendamentosDoDia].sort((a, b) => {
    if (!a.saidaDate || !b.saidaDate) {
      return 0;
    }
    return a.saidaDate.getTime() - b.saidaDate.getTime();
  });

  const startDay = startOfDay(dia);
  const endDay = endOfDay(dia);

  const partes: string[] = [];

  const primeiraSaida = ordenados[0].saidaDate;
  if (primeiraSaida && isAfter(primeiraSaida, startDay)) {
    const primeiraSaidaNoDia = limitarAoDia(primeiraSaida, startDay, endDay);
    partes.push(`Livre até ${formatarHoraDisponibilidade(primeiraSaidaNoDia, 'ate')}`);
  }

  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const atual = ordenados[i];
    const proximo = ordenados[i + 1];

    if (atual.chegadaDate && proximo.saidaDate && isBefore(atual.chegadaDate, proximo.saidaDate)) {
      const inicioLivre = limitarAoDia(atual.chegadaDate, startDay, endDay);
      const fimLivreComMargem = addMinutes(proximo.saidaDate, -MARGEM_MINUTOS_ENTRE_AGENDAMENTOS);
      const fimLivre = limitarAoDia(fimLivreComMargem, startDay, endDay);

      if (isAfter(fimLivre, inicioLivre)) {
        partes.push(
          `Livre entre ${formatarHoraDisponibilidade(inicioLivre, 'entreInicio')} e ${formatarHoraDisponibilidade(
            fimLivre,
            'entreFim',
          )}`,
        );
      }
    }
  }

  const ultimaChegada = ordenados[ordenados.length - 1].chegadaDate;
  if (ultimaChegada && isBefore(ultimaChegada, endDay)) {
    const ultimaChegadaNoDia = limitarAoDia(ultimaChegada, startDay, endDay);
    partes.push(`Livre após ${formatarHoraDisponibilidade(ultimaChegadaNoDia, 'apos')}`);
  }

  if (partes.length === 0) {
    return 'Ocupado durante o expediente';
  }

  return partes.join(', ');
};

const formatarTituloResumo = (dia: Date) =>
  format(dia, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

export default function ResumoDiarioPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoNormalizado[]>([]);
  const [dataSelecionada, setDataSelecionada] = useState<string>(hojeString);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDownload, setErroDownload] = useState<string | null>(null);
  const agendadosRef = useRef<HTMLElement>(null);
  const disponiveisRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        setCarregando(true);
        setErro(null);
        setErroDownload(null);
        const [listaVeiculos, listaAgendamentos] = await Promise.all([
          listarVeiculos(),
          listarAgendamentos(),
        ]);
        setVeiculos(listaVeiculos);
        setAgendamentos(listaAgendamentos.map(normalizarDatas));
      } catch (error) {
        console.error('Erro ao carregar dados do resumo diário:', error);
        setErro('Não foi possível carregar os dados. Tente novamente em instantes.');
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, []);

  const dataBase = useMemo(() => {
    try {
      return parseISO(dataSelecionada);
    } catch (error) {
      return new Date();
    }
  }, [dataSelecionada]);

  const { veiculosAgendados, veiculosDisponiveis } = useMemo(() => {
    if (!isValid(dataBase)) {
      return {
        veiculosAgendados: [],
        veiculosDisponiveis: [],
      };
    }

    const resumo = veiculos.map((veiculo) => {
      const agendamentosDoVeiculo = agendamentos
        .filter((agendamento) => agendamento.veiculoId === veiculo.id)
        .filter((agendamento) => ocorreNoDia(agendamento, dataBase))
        .sort((a, b) => {
          if (!a.saidaDate || !b.saidaDate) {
            return 0;
          }

          return a.saidaDate.getTime() - b.saidaDate.getTime();
        });

      return {
        veiculo,
        agendamentos: agendamentosDoVeiculo,
        disponibilidade: getDisponibilidadeTexto(agendamentosDoVeiculo, dataBase),
      };
    });

    const comAgendamento = resumo
      .filter((item) => item.agendamentos.length > 0)
      .sort((a, b) => a.veiculo.modelo.localeCompare(b.veiculo.modelo));
    const semAgendamento = resumo
      .filter((item) => item.agendamentos.length === 0)
      .sort((a, b) => a.veiculo.modelo.localeCompare(b.veiculo.modelo));

    return {
      veiculosAgendados: comAgendamento,
      veiculosDisponiveis: semAgendamento,
    };
  }, [agendamentos, dataBase, veiculos]);

  const totais = useMemo(() => {
    const totalVeiculos = veiculos.length;
    const totalAgendados = veiculosAgendados.length;
    const totalDisponiveis = totalVeiculos - totalAgendados;

    return {
      totalVeiculos,
      totalAgendados,
      totalDisponiveis,
    };
  }, [veiculos.length, veiculosAgendados.length]);

  const baixarAgendados = useCallback(async () => {
    if (!agendadosRef.current) {
      setErroDownload('Elemento não encontrado. Tente recarregar a página.');
      return;
    }

    try {
      setErroDownload(null);
      
      // Aguarda o próximo frame para garantir que o elemento esteja totalmente renderizado
      await new Promise((resolve) => requestAnimationFrame(resolve));
      
      // Garante que o elemento esteja visível na tela
      agendadosRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      
      // Aguarda um pouco mais para garantir que o scroll seja aplicado
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const dataFormatada = format(dataBase, 'yyyy-MM-dd');
      await downloadElementAsPng(agendadosRef.current, `resumo-agendados-${dataFormatada}.png`, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
    } catch (error) {
      console.error('Erro ao gerar imagem do resumo de agendados:', error);
      setErroDownload('Não foi possível gerar a imagem de agendados. Tente novamente.');
    }
  }, [dataBase]);

  const baixarDisponiveis = useCallback(async () => {
    if (!disponiveisRef.current) {
      setErroDownload('Elemento não encontrado. Tente recarregar a página.');
      return;
    }

    try {
      setErroDownload(null);
      
      // Aguarda o próximo frame para garantir que o elemento esteja totalmente renderizado
      await new Promise((resolve) => requestAnimationFrame(resolve));
      
      // Garante que o elemento esteja visível na tela
      disponiveisRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      
      // Aguarda um pouco mais para garantir que o scroll seja aplicado
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const dataFormatada = format(dataBase, 'yyyy-MM-dd');
      await downloadElementAsPng(disponiveisRef.current, `resumo-disponiveis-${dataFormatada}.png`, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
    } catch (error) {
      console.error('Erro ao gerar imagem do resumo de disponíveis:', error);
      setErroDownload('Não foi possível gerar a imagem de disponíveis. Tente novamente.');
    }
  }, [dataBase]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
        <SidebarMenu className="md:min-h-screen" />

        <main className="flex-1 p-4 sm:p-6">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Resumo diário dos veículos</h1>
              <p className="text-sm text-gray-600">Gere uma visão consolidada para compartilhar com o time.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <label className="text-sm font-medium text-gray-700" htmlFor="data-resumo">
                Selecione a data
              </label>
              <input
                id="data-resumo"
                type="date"
                value={dataSelecionada}
                onChange={(event) => setDataSelecionada(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={baixarAgendados}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700"
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Baixar agendados
                </button>
                <button
                  onClick={baixarDisponiveis}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Baixar disponíveis
                </button>
              </div>
            </div>
          </header>

          {erro && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
              {erro}
            </div>
          )}

          {erroDownload && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700" role="alert">
              {erroDownload}
            </div>
          )}

          {carregando ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
            </div>
          ) : (
            <div className="space-y-8">
              <section 
                ref={agendadosRef} 
                className="mx-auto w-full bg-white p-8"
                style={{ maxWidth: '800px' }}
              >
                {/* Cabeçalho */}
                <div className="mb-8 text-center">
                  <h2 className="mb-2 text-2xl font-bold text-gray-900">
                    {formatarTituloResumo(dataBase)}
                  </h2>
                  <p className="text-sm text-gray-600">RESUMO DIÁRIO DE VEÍCULOS</p>
                </div>

                {/* Estatísticas */}
                <div className="mb-8 grid grid-cols-3 gap-4">
                  <div className="rounded border border-gray-300 bg-white p-4 text-center">
                    <p className="mb-1 text-xs font-semibold uppercase text-gray-600">Total Cadastrados</p>
                    <p className="text-3xl font-bold text-gray-900">{totais.totalVeiculos}</p>
                  </div>
                  <div className="rounded border border-blue-300 bg-blue-50 p-4 text-center">
                    <p className="mb-1 text-xs font-semibold uppercase text-blue-700">Agendados</p>
                    <p className="text-3xl font-bold text-blue-900">{totais.totalAgendados}</p>
                  </div>
                  <div className="rounded border border-green-300 bg-green-50 p-4 text-center">
                    <p className="mb-1 text-xs font-semibold uppercase text-green-700">Disponíveis</p>
                    <p className="text-3xl font-bold text-green-900">{totais.totalDisponiveis}</p>
                  </div>
                </div>

                {/* Veículos Agendados */}
                <div className="mb-8">
                  <h3 className="mb-4 text-xl font-bold text-gray-900">
                    VEÍCULOS AGENDADOS ({veiculosAgendados.length})
                  </h3>
                  
                  {veiculosAgendados.length === 0 ? (
                    <div className="rounded border border-gray-300 bg-gray-50 p-6 text-center">
                      <p className="text-gray-600">Nenhum agendamento encontrado para este dia</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {veiculosAgendados.map(({ veiculo, agendamentos: agendamentosVeiculo, disponibilidade }) => (
                        <div key={veiculo.id} className="rounded border-2 border-gray-300 bg-white p-4">
                          {/* Cabeçalho do Veículo */}
                          <div className="mb-3 border-b border-gray-200 pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-900">{veiculo.modelo}</h4>
                                <p className="text-sm text-gray-700">
                                  <span className="font-semibold">Placa:</span> {veiculo.placa}
                                </p>
                                <p className="mt-1 text-xs text-gray-600 italic">{disponibilidade}</p>
                              </div>
                              <div className="rounded bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                                {agendamentosVeiculo.length} agendamento{agendamentosVeiculo.length > 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>

                          {/* Agendamentos */}
                          <div className="space-y-3">
                            {agendamentosVeiculo.map((agendamento, idx) => (
                              <div key={agendamento.id} className="rounded border border-gray-200 bg-gray-50 p-4">
                                <div className="mb-2 grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-gray-500">Horário</p>
                                    <p className="text-base font-bold text-gray-900">
                                      {formatarHora(agendamento.saidaDate)} – {formatarHora(agendamento.chegadaDate)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-gray-500">Destino</p>
                                    <p className="text-base font-bold text-gray-900">
                                      {agendamento.destino || 'Não informado'}
                                    </p>
                                  </div>
                                </div>
                                
                                {(agendamento.motorista || agendamento.matricula) && (
                                  <div className="mt-3 border-t border-gray-200 pt-3">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      {agendamento.motorista && (
                                        <div>
                                          <span className="font-semibold text-gray-700">Motorista: </span>
                                          <span className="text-gray-900">{agendamento.motorista}</span>
                                        </div>
                                      )}
                                      {agendamento.matricula && (
                                        <div>
                                          <span className="font-semibold text-gray-700">Matrícula: </span>
                                          <span className="font-mono text-gray-900">{agendamento.matricula}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {agendamento.observacoes && (
                                  <div className="mt-3 border-t border-gray-200 pt-3">
                                    <p className="text-sm">
                                      <span className="font-semibold text-gray-700">Observações: </span>
                                      <span className="text-gray-900">{agendamento.observacoes}</span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Veículos Disponíveis */}
              <section 
                ref={disponiveisRef} 
                className="mx-auto w-full rounded border-2 border-dashed border-green-300 bg-white p-8"
                style={{ maxWidth: '800px' }}
              >
                <h3 className="mb-4 text-xl font-bold text-gray-900">
                  VEÍCULOS DISPONÍVEIS ({veiculosDisponiveis.length})
                </h3>
                
                {veiculosDisponiveis.length === 0 ? (
                  <div className="rounded border border-gray-300 bg-gray-50 p-6 text-center">
                    <p className="text-gray-600">Todos os veículos possuem agendamentos para este dia</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {veiculosDisponiveis.map(({ veiculo, disponibilidade }) => (
                      <div key={veiculo.id} className="rounded border border-green-200 bg-green-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div>
                            <h4 className="text-base font-bold text-gray-900">{veiculo.modelo}</h4>
                            <p className="text-xs text-gray-700">
                              <span className="font-semibold">Placa:</span> {veiculo.placa}
                            </p>
                          </div>
                          <span className="rounded bg-green-200 px-2 py-1 text-xs font-bold text-green-900">
                            DISPONÍVEL
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 border-t border-green-200 pt-2 mt-2">
                          {disponibilidade}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

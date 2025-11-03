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
                className="mx-auto w-full max-w-4xl space-y-8 bg-white px-10 py-12 shadow-xl print:shadow-none"
              >
                {/* Cabeçalho do Resumo */}
                <div className="border-b-2 border-gray-200 pb-6">
                  <h2 className="text-center text-3xl font-bold text-gray-900 mb-2">
                    {formatarTituloResumo(dataBase)}
                  </h2>
                  <p className="text-center text-sm text-gray-600 uppercase tracking-wide">
                    Resumo Diário de Veículos
                  </p>
                </div>

                {/* Cards de Estatísticas */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6 text-center shadow-md">
                    <p className="text-xs font-bold uppercase tracking-wider text-green-700 mb-2">
                      Total Cadastrados
                    </p>
                    <p className="text-4xl font-extrabold text-green-900">{totais.totalVeiculos}</p>
                  </div>
                  <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 text-center shadow-md">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">
                      Agendados
                    </p>
                    <p className="text-4xl font-extrabold text-blue-900">{totais.totalAgendados}</p>
                  </div>
                  <div className="rounded-lg border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-6 text-center shadow-md">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                      Disponíveis
                    </p>
                    <p className="text-4xl font-extrabold text-amber-900">{totais.totalDisponiveis}</p>
                  </div>
                </div>

                {/* Seção de Veículos Agendados */}
                <div className="space-y-6">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">
                      Veículos Agendados
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {veiculosAgendados.length} veículo{veiculosAgendados.length !== 1 ? 's' : ''} com agendamento{veiculosAgendados.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {veiculosAgendados.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                      <p className="text-lg font-medium text-gray-600">
                        Nenhum agendamento encontrado para este dia
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {veiculosAgendados.map(({ veiculo, agendamentos: agendamentosVeiculo, disponibilidade }) => (
                        <div
                          key={veiculo.id}
                          className="rounded-xl border-2 border-gray-300 bg-white p-6 shadow-md hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-900 mb-1">
                                {veiculo.modelo}
                              </h3>
                              <p className="text-base font-semibold text-gray-700">
                                Placa: <span className="font-mono text-gray-900">{veiculo.placa}</span>
                              </p>
                              <p className="text-sm text-gray-600 mt-2 italic">
                                {disponibilidade}
                              </p>
                            </div>
                            <span className="ml-4 inline-flex items-center rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800 border-2 border-blue-300">
                              {agendamentosVeiculo.length} agendamento{agendamentosVeiculo.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {agendamentosVeiculo.map((agendamento, index) => (
                              <div
                                key={agendamento.id}
                                className={`rounded-lg border-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white p-5 ${
                                  index < agendamentosVeiculo.length - 1 ? 'mb-3' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center border-2 border-blue-300">
                                      <span className="text-xs font-bold text-blue-900">
                                        {String(index + 1).padStart(2, '0')}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="text-lg font-bold text-gray-900">
                                        {formatarHora(agendamento.saidaDate)} – {formatarHora(agendamento.chegadaDate)}
                                      </div>
                                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        Horário do Agendamento
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-base font-bold text-gray-900 uppercase">
                                      {agendamento.destino || 'Destino não informado'}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">Destino</div>
                                  </div>
                                </div>
                                
                                {(agendamento.motorista || agendamento.matricula) && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
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
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-sm">
                                      <span className="font-semibold text-gray-700">Observações: </span>
                                      <span className="text-gray-900 italic">{agendamento.observacoes}</span>
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

              {/* Seção de Veículos Disponíveis */}
              <section 
                ref={disponiveisRef} 
                className="mx-auto w-full max-w-4xl space-y-6 rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-white px-10 py-12 shadow-xl print:shadow-none"
              >
                <div className="border-l-4 border-emerald-500 pl-4">
                  <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-wide mb-2">
                    Veículos Disponíveis
                  </h2>
                  <p className="text-sm text-gray-600">
                    {veiculosDisponiveis.length} veículo{veiculosDisponiveis.length !== 1 ? 's' : ''} sem agendamentos para este dia
                  </p>
                </div>

                {veiculosDisponiveis.length === 0 ? (
                  <div className="rounded-xl border-2 border-emerald-300 bg-white p-12 text-center shadow-md">
                    <p className="text-lg font-medium text-gray-700">
                      Todos os veículos possuem agendamentos para o dia selecionado
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {veiculosDisponiveis.map(({ veiculo, disponibilidade }) => (
                      <div
                        key={veiculo.id}
                        className="rounded-lg border-2 border-emerald-200 bg-white p-5 shadow-md hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-emerald-900 mb-1">
                              {veiculo.modelo}
                            </h3>
                            <p className="text-sm font-semibold text-gray-700">
                              Placa: <span className="font-mono text-gray-900">{veiculo.placa}</span>
                            </p>
                          </div>
                          <span className="ml-3 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border-2 border-emerald-300 uppercase">
                            Disponível
                          </span>
                        </div>
                        <p className="text-sm text-emerald-700 italic border-t border-emerald-100 pt-3 mt-3">
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

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
            <div className="space-y-6">
              <section ref={agendadosRef} className="space-y-6">
                <div className="rounded-2xl bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-800">{formatarTituloResumo(dataBase)}</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                      <p className="text-xs font-semibold uppercase text-green-600">Veículos cadastrados</p>
                      <p className="mt-2 text-2xl font-bold text-green-900">{totais.totalVeiculos}</p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-xs font-semibold uppercase text-blue-600">Agendados no dia</p>
                      <p className="mt-2 text-2xl font-bold text-blue-900">{totais.totalAgendados}</p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase text-amber-600">Disponíveis</p>
                      <p className="mt-2 text-2xl font-bold text-amber-900">{totais.totalDisponiveis}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Veículos agendados</h2>
                  {veiculosAgendados.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
                      Nenhum agendamento encontrado para o dia.
                    </div>
                  ) : (
                    veiculosAgendados.map(({ veiculo, agendamentos: agendamentosVeiculo, disponibilidade }) => (
                      <div
                        key={veiculo.id}
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {veiculo.modelo} • {veiculo.placa}
                            </h3>
                            <p className="text-sm text-gray-500">{disponibilidade}</p>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                            {`${agendamentosVeiculo.length} agendamento${agendamentosVeiculo.length > 1 ? 's' : ''}`}
                          </span>
                        </div>

                        <ul className="mt-4 space-y-3">
                          {agendamentosVeiculo.map((agendamento) => (
                            <li
                              key={agendamento.id}
                              className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700"
                            >
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="font-semibold text-gray-900">
                                  {formatarHora(agendamento.saidaDate)} – {formatarHora(agendamento.chegadaDate)}
                                </div>
                                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                  {agendamento.destino || 'Destino não informado'}
                                </span>
                              </div>
                              {(agendamento.motorista || agendamento.matricula) && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {agendamento.motorista ? `Motorista: ${agendamento.motorista}` : ''}
                                  {agendamento.motorista && agendamento.matricula ? ' • ' : ''}
                                  {agendamento.matricula ? `Matrícula: ${agendamento.matricula}` : ''}
                                </p>
                              )}
                              {agendamento.observacoes && (
                                <p className="mt-2 text-xs text-gray-500">Obs.: {agendamento.observacoes}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section ref={disponiveisRef} className="space-y-4 rounded-2xl border border-dashed border-emerald-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800">Veículos disponíveis</h2>
                {veiculosDisponiveis.length === 0 ? (
                  <p className="text-sm text-gray-600">Todos os veículos possuem agendamentos para o dia selecionado.</p>
                ) : (
                  <ul className="space-y-3">
                    {veiculosDisponiveis.map(({ veiculo, disponibilidade }) => (
                      <li
                        key={veiculo.id}
                        className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-semibold text-emerald-900">
                            {veiculo.modelo} • {veiculo.placa}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">Disponível</span>
                        </div>
                        <p className="text-xs text-emerald-700">{disponibilidade}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

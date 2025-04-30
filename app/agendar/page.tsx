'use client';

import { useState, useEffect } from 'react';
import { listarVeiculosComStatus } from '@/app/lib/veiculos';
import { criarAgendamento } from '@/app/lib/agendamentos';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useRouter } from 'next/navigation';
import Comprovante from '../confirmacao/comprovante';
import ReactModal from 'react-modal'; // Adicione esta importação para a janela flutuante

type AgendamentoDados = {
  saida: string;
  chegada: string;
  veiculoId: string;
  motorista: string;
  matricula: string;
  telefone: string;
  destino: string;
  observacoes: string;
};

type Motorista = {
  id: string;
  nome: string;
  matricula: string;
  setor: string;
  cargo: string;
  telefone: string;
};

export default function AgendarPage() {
  const router = useRouter();
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [dados, setDados] = useState<AgendamentoDados>({
    saida: '',
    chegada: '',
    veiculoId: '',
    motorista: '',
    matricula: '',
    telefone: '',
    destino: '',
    observacoes: '',
  });
  const [erro, setErro] = useState<string>('');
  const [erroMatricula, setErroMatricula] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(false);
  const [mostrarDisponiveis, setMostrarDisponiveis] = useState<boolean>(true);
  const [datasMaximas, setDatasMaximas] = useState<{ [key: string]: string }>({});
  const [mostrarComprovante, setMostrarComprovante] = useState<boolean>(false);
  const [dadosComprovante, setDadosComprovante] = useState<any>(null);
  const [mostrarAgendamentos, setMostrarAgendamentos] = useState<boolean>(false);
  const [dataSelecionada, setDataSelecionada] = useState<string>(new Date().toISOString().slice(0, 10));
  const [agendamentosDia, setAgendamentosDia] = useState<any[]>([]);

  useEffect(() => {
    const carregarMotoristas = async () => {
      try {
        const colMotoristas = collection(db, 'motoristas');
        const snapshot = await getDocs(colMotoristas);
        const lista = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Motorista));
        setMotoristas(lista);
      } catch (error) {
        console.error('Erro ao carregar motoristas:', error);
      }
    };
    carregarMotoristas();
  }, []);

  useEffect(() => {
    const carregarVeiculos = async () => {
      if (!dados.saida) {
        setVeiculos([]);
        setDados((prev) => ({ ...prev, veiculoId: '' }));
        return;
      }

      setCarregando(true);
      try {
        const lista = await listarVeiculosComStatus(dados.saida);
        setVeiculos(lista);
      } catch (error) {
        setErro('Erro ao carregar veículos. Tente novamente.');
        console.error('Erro ao carregar veículos:', error);
      } finally {
        setCarregando(false);
      }
    };
    carregarVeiculos();
  }, [dados.saida]);

  useEffect(() => {
    const carregarDatasMaximas = async () => {
      const colAgendamentos = collection(db, 'agendamentos');
      const agendamentosSnap = await getDocs(colAgendamentos);
      const agendamentos = agendamentosSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as { veiculoId: string; saida: string; chegada: string; concluido: boolean }),
      }));

      const novasDatasMaximas: { [key: string]: string } = {};
      veiculos.forEach((veiculo) => {
        const agendamentosVeiculo = agendamentos
          .filter(
            (ag) =>
              ag.veiculoId === veiculo.id &&
              !ag.concluido &&
              new Date(ag.saida) >= new Date(dados.saida)
          )
          .sort((a, b) => new Date(a.saida).getTime() - new Date(b.saida).getTime());

        if (agendamentosVeiculo.length > 0) {
          const proximoAgendamento = agendamentosVeiculo[0];
          const saidaProxima = new Date(proximoAgendamento.saida);
          novasDatasMaximas[veiculo.id] = saidaProxima.toLocaleString('pt-BR');
        } else {
          novasDatasMaximas[veiculo.id] = veiculo.status?.disponivel
            ? 'Disponível sem restrições'
            : 'Indisponível no momento';
        }
      });

      setDatasMaximas(novasDatasMaximas);
    };

    if (veiculos.length > 0 && dados.saida) {
      carregarDatasMaximas();
    }
  }, [veiculos, dados.saida]);

  useEffect(() => {
    const carregarAgendamentosComPlacas = async () => {
      try {
        const colVeiculos = collection(db, 'veiculos');
        const veiculosSnap = await getDocs(colVeiculos);
        const veiculosMap = veiculosSnap.docs.reduce((map, doc) => {
          const data = doc.data();
          map[doc.id] = data.placa;
          return map;
        }, {} as Record<string, string>);

        const colAgendamentos = collection(db, 'agendamentos');
        const snapshot = await getDocs(colAgendamentos);
        const agendamentos = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as { veiculoId: string; saida: string; chegada: string }),
          }))
          .filter(
            (ag) =>
              new Date(ag.saida).toISOString().slice(0, 10) === dataSelecionada
          )
          .map((ag) => ({
            ...ag,
            placa: veiculosMap[ag.veiculoId] || 'Placa não encontrada',
          }))
          .sort((a, b) => new Date(a.saida).getTime() - new Date(b.saida).getTime()); // Ordena pela data de saída

        setAgendamentosDia(agendamentos);
      } catch (error) {
        console.error('Erro ao carregar agendamentos com placas:', error);
      }
    };

    if (mostrarAgendamentos) {
      carregarAgendamentosComPlacas();
    }
  }, [mostrarAgendamentos, dataSelecionada]);

  const handleMatriculaChange = (matricula: string) => {
    setDados((prev) => ({ ...prev, matricula }));
    setErro('');
    setErroMatricula('');

    const motoristaEncontrado = motoristas.find((m) => m.matricula === matricula);

    if (motoristaEncontrado) {
      setDados((prev) => ({
        ...prev,
        motorista: motoristaEncontrado.nome,
        telefone: motoristaEncontrado.telefone || prev.telefone,
      }));
    } else {
      setDados((prev) => ({ ...prev, motorista: '', telefone: '' }));
      if (matricula) {
        setErroMatricula('Matrícula não autorizada para dirigir.');
      }
    }
  };

  const formatarTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 2) return apenasNumeros;
    if (apenasNumeros.length <= 7) return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2)}`;
    if (apenasNumeros.length <= 11)
      return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7)}`;
    return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7, 11)}`;
  };

  const validarAgendamento = async () => {
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

    const agora = new Date();
    const saida = new Date(dados.saida);
    const chegada = new Date(dados.chegada);
    if (saida < agora) {
      return 'A data de saída não pode ser anterior à data atual.';
    }
    if (chegada <= saida) {
      return 'A data de chegada deve ser posterior à data de saída.';
    }

    const telefoneLimpo = dados.telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      return 'O número de telefone deve ter 10 ou 11 dígitos.';
    }

    const motoristaEncontrado = motoristas.find((m) => m.matricula === dados.matricula);
    if (!motoristaEncontrado) {
      return 'Matrícula não autorizada. Verifique ou cadastre o motorista.';
    }

    const colAgendamentos = collection(db, 'agendamentos');
    const agendamentosSnap = await getDocs(colAgendamentos);
    const agendamentos = agendamentosSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as { veiculoId: string; saida: string; chegada: string; concluido: boolean }),
    }));

    const agendamentoConflitante = agendamentos.find((ag) => {
      if (ag.veiculoId !== dados.veiculoId || ag.concluido) return false;
      const novaSaida = new Date(dados.saida);
      const novaChegada = new Date(dados.chegada);
      const agSaida = new Date(ag.saida);
      const agChegada = new Date(ag.chegada);

      const horaMinimaEntrega = new Date(agSaida.getTime() - 60 * 60 * 1000);
      return novaChegada > horaMinimaEntrega && novaSaida < agChegada;
    });

    if (agendamentoConflitante) {
      const saidaConflito = new Date(agendamentoConflitante.saida).toLocaleString('pt-BR');
      const horaMinimaEntrega = new Date(
        new Date(agendamentoConflitante.saida).getTime() - 60 * 60 * 1000
      ).toLocaleString('pt-BR');
      return `Conflito: Este veículo está agendado com saída em ${saidaConflito}. A entrega deve ser até ${horaMinimaEntrega}.`;
    }

    const veiculoSelecionado = veiculos.find((v) => v.id === dados.veiculoId);
    if (!veiculoSelecionado || !veiculoSelecionado.status?.disponivel) {
      return 'O veículo selecionado não está disponível para o horário escolhido.';
    }

    return '';
  };

  const handleSubmit = async () => {
    setErro('');
    setCarregando(true);
    try {
      const mensagemErro = await validarAgendamento();
      if (mensagemErro) {
        setErro(mensagemErro);
        setCarregando(false);
        return;
      }

      await criarAgendamento(dados);
      setDadosComprovante({
        motorista: dados.motorista,
        matricula: dados.matricula,
        telefone: dados.telefone,
        destino: dados.destino,
        observacoes: dados.observacoes,
        veiculo: veiculos.find((v) => v.id === dados.veiculoId)?.modelo || 'Desconhecido',
        placa: veiculos.find((v) => v.id === dados.veiculoId)?.placa || 'Não informada',
        saida: dados.saida,
        chegada: dados.chegada,
      });
      setMostrarComprovante(true);
      setDados({
        saida: '',
        chegada: '',
        veiculoId: '',
        motorista: '',
        matricula: '',
        telefone: '',
        destino: '',
        observacoes: '',
      });
    } catch (error) {
      setErro('Erro ao criar agendamento. Tente novamente.');
      console.error('Erro ao criar agendamento:', error);
    } finally {
      setCarregando(false);
    }
  };

  const veiculosFiltrados = mostrarDisponiveis
    ? veiculos.filter((v) => v.status?.disponivel)
    : veiculos;

  const getMinDate = () => {
    if (typeof window === 'undefined') return '';
    return new Date().toISOString().slice(0, 16);
  };

  return (
    <>
      <main className="min-h-screen bg-green-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-green-900 mb-6 sm:mb-8">
            Solicitação de Agendamento
          </h1>

          {erro && (
            <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-6 text-sm sm:text-base flex justify-between items-center shadow-sm">
              {erro}
              <button
                onClick={() => setErro('')}
                className="text-red-800 hover:text-red-900"
              >
                ✕
              </button>
            </div>
          )}

          <div className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-green-800 mb-4">Seleção de Veículo</h2>
            <div className="flex items-center mb-4">
              <label className="mr-3 text-sm sm:text-base font-medium text-green-700">
                Mostrar apenas disponíveis
              </label>
              <input
                type="checkbox"
                checked={mostrarDisponiveis}
                onChange={() => setMostrarDisponiveis(!mostrarDisponiveis)}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-green-300 rounded"
              />
            </div>
            {carregando ? (
              <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
              </div>
            ) : veiculosFiltrados.length === 0 ? (
              <p className="text-green-600 text-sm sm:text-base">
                {mostrarDisponiveis
                  ? 'Nenhum veículo disponível para a data selecionada.'
                  : 'Nenhum veículo encontrado.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {veiculosFiltrados.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => v.status.disponivel && setDados({ ...dados, veiculoId: v.id })}
                    className={`p-4 rounded-lg shadow-md cursor-pointer transition-all duration-200 ${
                      v.status.disponivel
                        ? dados.veiculoId === v.id
                          ? 'bg-green-200 border-green-400'
                          : 'bg-white border-green-200 hover:bg-green-100'
                        : 'bg-gray-100 border-gray-200 cursor-not-allowed'
                    } border`}
                  >
                    <p className="font-semibold text-green-900 text-sm sm:text-base">{v.modelo}</p>
                    <p className="text-xs sm:text-sm text-green-600">{v.placa}</p>
                    <p className="text-xs sm:text-sm text-green-500 mt-1">
                      {v.status.disponivel
                        ? `Disponível até: ${datasMaximas[v.id] || 'Carregando...'}`
                        : `Indisponível até: ${v.status.indisponivelAte ? new Date(v.status.indisponivelAte).toLocaleString('pt-BR') : 'Carregando...'}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-lg border border-green-200 mb-20 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-green-800 mb-4 sm:mb-6">Detalhes do Agendamento</h2>
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">
                  Data e Hora de Saída
                </label>
                <input
                  type="datetime-local"
                  value={dados.saida}
                  onChange={(e) => setDados({ ...dados, saida: e.target.value })}
                  min={getMinDate()}
                  className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">
                  Data e Hora de Chegada
                </label>
                <input
                  type="datetime-local"
                  value={dados.chegada}
                  onChange={(e) => setDados({ ...dados, chegada: e.target.value })}
                  min={dados.saida || getMinDate()}
                  className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                  required
                />
              </div>
              <div className="relative">
                <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">
                  Matrícula
                </label>
                <input
                  type="text"
                  value={dados.matricula}
                  onChange={(e) => handleMatriculaChange(e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all ${
                    erroMatricula ? 'border-red-300' : 'border-green-300'
                  }`}
                  placeholder="Digite a matrícula"
                  required
                />
                {erroMatricula && (
                  <p className="mt-1 text-xs text-red-600 font-medium animate-fade-in">
                    {erroMatricula}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">
                  Motorista
                </label>
                <input
                  type="text"
                  value={dados.motorista}
                  readOnly
                  className="w-full p-3 border border-green-300 rounded-lg bg-gray-100 text-gray-900 text-sm sm:text-base placeholder-gray-500 transition-all"
                  placeholder="Nome será preenchido automaticamente"
                  required
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">
                  Telefone do motorista
                </label>
                <input
                  type="tel"
                  value={dados.telefone}
                  onChange={(e) => setDados({ ...dados, telefone: formatarTelefone(e.target.value) })}
                  className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                  placeholder="(XX) 9XXXX-XXXX"
                  required
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">
                  Destino
                </label>
                <input
                  type="text"
                  value={dados.destino}
                  onChange={(e) => setDados({ ...dados, destino: e.target.value })}
                  className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                  placeholder="Digite o destino"
                  required
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={dados.observacoes}
                  onChange={(e) => setDados({ ...dados, observacoes: e.target.value })}
                  className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                  placeholder="Notas ou informações adicionais"
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-green-50 sm:static sm:p-0 sm:bg-transparent sm:flex sm:space-x-4">
            <button
              onClick={handleSubmit}
              disabled={carregando || !!erroMatricula}
              className={`w-full sm:w-auto bg-green-600 text-white py-3 px-6 rounded-lg transition-colors duration-200 text-sm sm:text-base font-medium ${
                carregando || erroMatricula ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'
              }`}
            >
              {carregando ? 'Processando...' : 'Solicitar Agendamento'}
            </button>
          </div>
        </div>
      </main>
      {mostrarComprovante && dadosComprovante && (
        <Comprovante
          agendamento={dadosComprovante}
          onClose={() => setMostrarComprovante(false)}
        />
      )}
      <div className="fixed top-4 left-4 right-4 sm:right-0 sm:left-auto flex justify-center sm:justify-end z-50">
        <div className="w-full sm:w-80">
          <button
            onClick={() => setMostrarAgendamentos(!mostrarAgendamentos)}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg shadow-lg hover:bg-blue-700 transition-all w-full"
          >
            {mostrarAgendamentos ? 'Fechar Agendamentos' : 'Ver Agendamentos'}
          </button>

          {mostrarAgendamentos && (
            <div className="mt-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">Agendamentos</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={dataSelecionada}
                  onChange={(e) => setDataSelecionada(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              {agendamentosDia.length === 0 ? (
                <p className="text-gray-500 text-center">Nenhum agendamento encontrado para esta data.</p>
              ) : (
                <ul className="space-y-2">
                  {agendamentosDia.map((agendamento) => (
                    <li
                      key={agendamento.id}
                      className="p-3 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition"
                    >
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">Veículo:</span> {agendamento.placa}
                      </p>
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">Saída:</span> {new Date(agendamento.saida).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">Chegada:</span> {new Date(agendamento.chegada).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">Destino:</span> {agendamento.destino}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { listarVeiculosComStatus } from '@/app/lib/veiculos';
import { criarAgendamento } from '@/app/lib/agendamentos';
import { collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/app/lib/firebase';
import { useRouter } from 'next/navigation';
import Comprovante from '../confirmacao/comprovante';
import { FiCalendar, FiClock, FiUser, FiHash, FiPhone, FiMapPin, FiEdit, FiX, FiCheck, FiPlus, FiTruck, FiArrowRight, FiArrowLeft } from 'react-icons/fi';

type AgendamentoDados = {
  saida: string;
  chegada: string;
  veiculoId: string;
  motorista: string;
  matricula: string;
  telefone: string;
  destino: string;
  observacoes: string;
  codigo?: string;
  nomeAgendador?: string; // Novo campo opcional
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
  const [etapaAtual, setEtapaAtual] = useState<'veiculo' | 'detalhes'>('veiculo');

  // Estados para data e hora separadas
  const [saidaData, setSaidaData] = useState<string>('');
  const [saidaHora, setSaidaHora] = useState<string>('');
  const [chegadaData, setChegadaData] = useState<string>('');
  const [chegadaHora, setChegadaHora] = useState<string>('');

  // Novo estado para controlar se o agendamento é para o próprio motorista
  const [agendandoParaMim, setAgendandoParaMim] = useState<boolean>(true);

  useEffect(() => {
    const carregarMotoristas = async () => {
      try {
        const database = getDb();
        const colMotoristas = collection(database, 'motoristas');
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
      if (!saidaData || !saidaHora) {
        setVeiculos([]);
        setDados((prev) => ({ ...prev, veiculoId: '' }));
        return;
      }

      const saidaCompleta = `${saidaData}T${saidaHora}`;
      setDados((prev) => ({ ...prev, saida: saidaCompleta }));

      setCarregando(true);
      try {
        const lista = await listarVeiculosComStatus(saidaCompleta);
        setVeiculos(lista);
      } catch (error) {
        setErro('Erro ao carregar veículos. Tente novamente.');
        console.error('Erro ao carregar veículos:', error);
      } finally {
        setCarregando(false);
      }
    };
    carregarVeiculos();
  }, [saidaData, saidaHora]);

  // Novo useEffect para atualizar dados.chegada
  useEffect(() => {
    if (chegadaData && chegadaHora) {
      const chegadaCompleta = `${chegadaData}T${chegadaHora}`;
      setDados((prev) => ({ ...prev, chegada: chegadaCompleta }));
    } else {
      setDados((prev) => ({ ...prev, chegada: '' }));
    }
  }, [chegadaData, chegadaHora]);

  useEffect(() => {
    const carregarDatasMaximas = async () => {
      const database = getDb();
      const colAgendamentos = collection(database, 'agendamentos');
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
        const database = getDb();
        const colVeiculos = collection(database, 'veiculos');
        const veiculosSnap = await getDocs(colVeiculos);
        const veiculosMap = veiculosSnap.docs.reduce((map, doc) => {
          const data = doc.data();
          map[doc.id] = data.placa;
          return map;
        }, {} as Record<string, string>);

        const colAgendamentos = collection(database, 'agendamentos');
        const snapshot = await getDocs(colAgendamentos);
        const agendamentos = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as { veiculoId: string; saida: string; chegada: string; destino: string }),
          }))
          .filter(
            (ag) =>
              new Date(ag.saida).toISOString().slice(0, 10) === dataSelecionada
          )
          .map((ag) => ({
            ...ag,
            placa: veiculosMap[ag.veiculoId] || 'Placa não encontrada',
          }))
          .sort((a, b) => new Date(a.saida).getTime() - new Date(b.saida).getTime());

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
      { nome: 'Data de Saída', valor: saidaData },
      { nome: 'Hora de Saída', valor: saidaHora },
      { nome: 'Data de Chegada', valor: chegadaData },
      { nome: 'Hora de Chegada', valor: chegadaHora },
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
    const saida = new Date(`${saidaData}T${saidaHora}`);
    const chegada = new Date(`${chegadaData}T${chegadaHora}`);
    if (saida < agora) {
      return 'A data e hora de saída não podem ser anteriores ao momento atual.';
    }
    if (chegada <= saida) {
      return 'A data e hora de chegada devem ser posteriores à data e hora de saída.';
    }

    const telefoneLimpo = dados.telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      return 'O número de telefone deve ter 10 ou 11 dígitos.';
    }

    const motoristaEncontrado = motoristas.find((m) => m.matricula === dados.matricula);
    if (!motoristaEncontrado) {
      return 'Matrícula não autorizada. Verifique ou cadastre o motorista.';
    }

    const colAgendamentos = collection(getDb(), 'agendamentos');
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

    // Validação do nome do agendador
    if (!agendandoParaMim && !dados.nomeAgendador) {
      return 'Por favor, informe o nome de quem está agendando.';
    }

    return '';
  };

  const handleSubmit = async () => {
    setErro('');
    setCarregando(true);
    try {
      // Garantir que saida e chegada estão atualizados
      const saidaCompleta = `${saidaData}T${saidaHora}`;
      const chegadaCompleta = `${chegadaData}T${chegadaHora}`;
      setDados((prev) => ({
        ...prev,
        saida: saidaCompleta,
        chegada: chegadaCompleta,
      }));

      const mensagemErro = await validarAgendamento();
      if (mensagemErro) {
        setErro(mensagemErro);
        setCarregando(false);
        return;
      }

      // Gerar código aleatório de 5 dígitos
      const codigo = Math.floor(10000 + Math.random() * 90000).toString();

      // Usar os valores atualizados para criar o agendamento
      const agendamentoDados = {
        ...dados,
        saida: saidaCompleta,
        chegada: chegadaCompleta,
        codigo, // Adiciona o código
        nomeAgendador: agendandoParaMim ? undefined : dados.nomeAgendador,
      };
      await criarAgendamento(agendamentoDados);

      // Atualizar dadosComprovante com valores válidos e o código
      setDadosComprovante({
        motorista: dados.motorista,
        matricula: dados.matricula,
        telefone: dados.telefone,
        destino: dados.destino,
        observacoes: dados.observacoes,
        veiculo: veiculos.find((v) => v.id === dados.veiculoId)?.modelo || 'Desconhecido',
        placa: veiculos.find((v) => v.id === dados.veiculoId)?.placa || 'Não informada',
        saida: saidaCompleta,
        chegada: chegadaCompleta,
        codigo,
        nomeAgendador: agendandoParaMim ? undefined : dados.nomeAgendador, // Corrigido para passar o nome correto
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
        nomeAgendador: '',
      });
      setSaidaData('');
      setSaidaHora('');
      setChegadaData('');
      setChegadaHora('');
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
    return new Date().toISOString().slice(0, 10);
  };

  const getMinTime = () => {
    const agora = new Date();
    return `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Agendamento de Veículo</h1>
            <p className="text-gray-600 mb-6">Preencha os dados para solicitar um veículo</p>
            
            {/* Navegação por etapas */}
            <div className="flex mb-8">
              <button
                onClick={() => setEtapaAtual('veiculo')}
                className={`flex-1 py-2 font-medium border-b-2 ${etapaAtual === 'veiculo' ? 'border-green-600 text-green-600' : 'border-gray-200 text-gray-500'}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FiTruck className="text-lg" />
                  Veículo
                </div>
              </button>
              <button
                onClick={() => dados.veiculoId && setEtapaAtual('detalhes')}
                className={`flex-1 py-2 font-medium border-b-2 ${etapaAtual === 'detalhes' ? 'border-green-600 text-green-600' : 'border-gray-200 text-gray-500'} ${!dados.veiculoId ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FiUser className="text-lg" />
                  Detalhes
                </div>
              </button>
            </div>

            {erro && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6">
                <div className="flex justify-between items-center">
                  <p className="font-bold">Erro</p>
                  <button onClick={() => setErro('')} className="text-red-700 hover:text-red-900">
                    <FiX />
                  </button>
                </div>
                <p>{erro}</p>
              </div>
            )}

            {etapaAtual === 'veiculo' ? (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Selecione o Veículo</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Saída *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiCalendar className="text-gray-400" />
                      </div>
                      <input
                        type="date"
                        value={saidaData}
                        onChange={(e) => setSaidaData(e.target.value)}
                        min={getMinDate()}
                        className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hora de Saída *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiClock className="text-gray-400" />
                      </div>
                      <input
                        type="time"
                        value={saidaHora}
                        onChange={(e) => setSaidaHora(e.target.value)}
                        min={saidaData === getMinDate() ? getMinTime() : undefined}
                        step="60"
                        className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Chegada *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiCalendar className="text-gray-400" />
                      </div>
                      <input
                        type="date"
                        value={chegadaData}
                        onChange={(e) => setChegadaData(e.target.value)}
                        min={saidaData || getMinDate()}
                        className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hora de Chegada *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiClock className="text-gray-400" />
                      </div>
                      <input
                        type="time"
                        value={chegadaHora}
                        onChange={(e) => setChegadaHora(e.target.value)}
                        min={chegadaData === saidaData ? saidaHora : undefined}
                        step="60"
                        className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center mb-6">
                  <input
                    type="checkbox"
                    checked={mostrarDisponiveis}
                    onChange={() => setMostrarDisponiveis(!mostrarDisponiveis)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Mostrar apenas veículos disponíveis
                  </label>
                </div>

                {carregando ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                  </div>
                ) : veiculosFiltrados.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <FiTruck className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900">
                      {mostrarDisponiveis ? 'Nenhum veículo disponível' : 'Nenhum veículo encontrado'}
                    </h3>
                    <p className="mt-1 text-gray-500">
                      {mostrarDisponiveis 
                        ? 'Não há veículos disponíveis para a data selecionada.'
                        : 'Não há veículos cadastrados no sistema.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {veiculosFiltrados.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => v.status.disponivel && setDados({ ...dados, veiculoId: v.id })}
                        className={`p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                          v.status.disponivel
                            ? dados.veiculoId === v.id
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                            : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-gray-900">{v.modelo}</h3>
                            <p className="text-sm text-gray-600">{v.placa}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            v.status.disponivel ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {v.status.disponivel ? 'Disponível' : 'Indisponível'}
                          </span>
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                          {v.status.disponivel
                            ? datasMaximas[v.id] === 'Disponível sem restrições'
                              ? 'Disponível sem restrições'
                              : `Disponível até: ${datasMaximas[v.id] || 'Carregando...'}`
                            : `Indisponível até: ${v.status.indisponivelAte ? new Date(v.status.indisponivelAte).toLocaleString('pt-BR') : 'Carregando...'}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {dados.veiculoId && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setEtapaAtual('detalhes')}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      Próximo
                      <FiArrowRight className="text-lg" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Detalhes do Agendamento</h2>
                  <button
                    onClick={() => setEtapaAtual('veiculo')}
                    className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
                  >
                    <FiArrowLeft className="text-sm" />
                    Voltar
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Veículo Selecionado</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-900">
                          {veiculos.find(v => v.id === dados.veiculoId)?.modelo || 'Não selecionado'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {veiculos.find(v => v.id === dados.veiculoId)?.placa || '---'}
                        </p>
                      </div>
                      <button
                        onClick={() => setEtapaAtual('veiculo')}
                        className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1"
                      >
                        <FiEdit className="text-sm" />
                        Alterar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Matrícula *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiHash className="text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={dados.matricula}
                          onChange={(e) => handleMatriculaChange(e.target.value)}
                          className={`w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                            erroMatricula ? 'border-red-300' : 'border-gray-300'
                          } text-black`}
                          placeholder="Digite sua matrícula"
                          required
                        />
                      </div>
                      {erroMatricula && (
                        <p className="mt-1 text-xs text-red-600 font-medium">
                          {erroMatricula}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Motorista *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiUser className="text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={dados.motorista}
                          readOnly
                          className="w-full pl-10 p-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
                          placeholder="Preenchido automaticamente"
                        />
                      </div>
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="agendandoParaMim"
                          checked={agendandoParaMim}
                          onChange={() => setAgendandoParaMim(!agendandoParaMim)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor="agendandoParaMim" className="ml-2 text-sm text-gray-700 select-none">
                          Estou agendando para mim (sou o motorista)
                        </label>
                      </div>
                      {!agendandoParaMim && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Autor do agendamento *</label>
                          <input
                            type="text"
                            value={dados.nomeAgendador || ''}
                            onChange={e => setDados({ ...dados, nomeAgendador: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                            placeholder="Digite o seu nome."
                            required
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiPhone className="text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          value={dados.telefone}
                          onChange={(e) => setDados({ ...dados, telefone: formatarTelefone(e.target.value) })}
                          className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                          placeholder="(XX) 9XXXX-XXXX"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Destino *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMapPin className="text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={dados.destino}
                          onChange={(e) => setDados({ ...dados, destino: e.target.value })}
                          className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                          placeholder="Digite o destino"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                    <textarea
                      value={dados.observacoes}
                      onChange={(e) => setDados({ ...dados, observacoes: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                      placeholder="Informações adicionais sobre o agendamento"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setEtapaAtual('veiculo')}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={carregando || !!erroMatricula}
                      className={`bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors ${
                        carregando || erroMatricula ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'
                      }`}
                    >
                      {carregando ? 'Enviando...' : 'Confirmar Agendamento'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Botão flutuante para ver agendamentos */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setMostrarAgendamentos(!mostrarAgendamentos)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all flex items-center justify-center"
        >
          {mostrarAgendamentos ? <FiX size={20} /> : <FiCalendar size={20} />}
        </button>

        {mostrarAgendamentos && (
          <div className="absolute bottom-16 right-0 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Agendamentos do Dia</h3>
            </div>
            <div className="p-4">
              <input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {agendamentosDia.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  Nenhum agendamento para esta data
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {agendamentosDia.map((agendamento) => (
                    <div key={agendamento.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{agendamento.placa}</p>
                          <p className="text-xs text-gray-600">
                            {new Date(agendamento.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {agendamento.chegada
                              ? new Date(agendamento.chegada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                              : 'Data inválida'}
                          </p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {agendamento.destino}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {mostrarComprovante && dadosComprovante && (
        <Comprovante
          agendamento={dadosComprovante}
          onClose={() => setMostrarComprovante(false)}
        />
      )}
    </>
  );
}
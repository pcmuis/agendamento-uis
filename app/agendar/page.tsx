'use client';

import { useState, useEffect } from 'react';
import { listarVeiculos, listarVeiculosComStatus } from '@/app/lib/veiculos';
import { criarAgendamento } from '@/app/lib/agendamentos';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useRouter } from 'next/navigation';
import Comprovante from '../confirmacao/comprovante';

type AgendamentoDados = {
  saida: string;
  chegada: string;
  veiculoId: string;
  motorista: string;
  matricula: string;
  telefone: string;
  destino: string;
  vagas: number;
  observacoes: string;
};

export default function AgendarPage() {
  const router = useRouter();
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [dados, setDados] = useState<AgendamentoDados>({
    saida: '',
    chegada: '',
    veiculoId: '',
    motorista: '',
    matricula: '',
    telefone: '',
    destino: '',
    vagas: 1,
    observacoes: '',
  });
  const [erro, setErro] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(false);
  const [mostrarDisponiveis, setMostrarDisponiveis] = useState<boolean>(true);
  const [datasMaximas, setDatasMaximas] = useState<{ [key: string]: string }>({});
  const [mostrarComprovante, setMostrarComprovante] = useState<boolean>(false);
  const [dadosComprovante, setDadosComprovante] = useState<any>(null);

  // Carregar veículos com base na data de saída
  useEffect(() => {
    if (dados.saida) {
      const carregar = async () => {
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
      carregar();
    } else {
      setVeiculos([]);
    }
  }, [dados.saida]);

  // Calcular datas máximas de devolução
  useEffect(() => {
    const carregarDatasMaximas = async () => {
      const colAgendamentos = collection(db, 'agendamentos');
      const agendamentosSnap = await getDocs(colAgendamentos);
      const agendamentos = agendamentosSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as { veiculoId: string; saida: string; chegada: string }),
      }));

      const novasDatasMaximas: { [key: string]: string } = {};
      veiculos.forEach((veiculo) => {
        const agendamentosVeiculo = agendamentos
          .filter(
            (ag) =>
              ag.veiculoId === veiculo.id &&
              new Date(ag.saida) > new Date(dados.saida)
          )
          .sort((a, b) => new Date(a.saida).getTime() - new Date(b.saida).getTime());

        if (agendamentosVeiculo.length > 0) {
          const proximoAgendamento = agendamentosVeiculo[0];
          const saidaProxima = new Date(proximoAgendamento.saida);
          const maxDevolucao = new Date(saidaProxima.getTime() - 60 * 60 * 1000);
          novasDatasMaximas[veiculo.id] = maxDevolucao.toLocaleString('pt-BR');
        } else {
          novasDatasMaximas[veiculo.id] = 'Sem agendamentos futuros';
        }
      });

      setDatasMaximas(novasDatasMaximas);
    };

    if (veiculos.length > 0) {
      carregarDatasMaximas();
    }
  }, [veiculos, dados.saida]);

  // Máscara para o telefone
  const formatarTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 2) return apenasNumeros;
    if (apenasNumeros.length <= 7)
      return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2)}`;
    if (apenasNumeros.length <= 11)
      return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7)}`;
    return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7, 11)}`;
  };

  // Validação do agendamento
  const validarAgendamento = async () => {
    const camposObrigatorios = [
      { nome: 'Data e Hora de Saída', valor: dados.saida },
      { nome: 'Data e Hora de Chegada', valor: dados.chegada },
      { nome: 'Veículo', valor: dados.veiculoId },
      { nome: 'Motorista', valor: dados.motorista },
      { nome: 'Matrícula', valor: dados.matricula },
      { nome: 'Telefone', valor: dados.telefone },
      { nome: 'Destino', valor: dados.destino },
      { nome: 'Vagas Necessárias', valor: dados.vagas > 0 },
    ];

    const camposFaltando = camposObrigatorios
      .filter((campo) => !campo.valor)
      .map((campo) => campo.nome);

    if (camposFaltando.length > 0) {
      return `Preencha os campos obrigatórios: ${camposFaltando.join(', ')}`;
    }

    // Validação de datas
    const agora = new Date();
    const saida = new Date(dados.saida);
    const chegada = new Date(dados.chegada);
    if (saida < agora) {
      return 'A data de saída não pode ser anterior à data atual';
    }
    if (chegada <= saida) {
      return 'A data de chegada deve ser posterior à data de saída';
    }

    // Validação do telefone
    const telefoneLimpo = dados.telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      return 'O número de telefone deve ter 10 ou 11 dígitos';
    }

    // Validação de conflitos de agendamento
    const colAgendamentos = collection(db, 'agendamentos');
    const agendamentosSnap = await getDocs(colAgendamentos);
    const agendamentos = agendamentosSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as { veiculoId: string; saida: string; chegada: string }),
    }));

    const agendamentoConflitante = agendamentos.find((ag) => {
      if (ag.veiculoId !== dados.veiculoId) return false;
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
      return `Este veículo já está agendado com saída em ${saidaConflito}. A entrega deve ser pelo menos 1 hora antes, até ${horaMinimaEntrega}.`;
    }

    return '';
  };

  // Submissão do formulário
  const handleSubmit = async () => {
    const mensagemErro = await validarAgendamento();
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    try {
      await criarAgendamento(dados);
      setErro('');
      setDadosComprovante({
        motorista: dados.motorista,
        matricula: dados.matricula,
        telefone: dados.telefone,
        destino: dados.destino,
        observacoes: dados.observacoes,
        veiculo: veiculos.find((v) => v.id === dados.veiculoId)?.modelo || 'Desconhecido',
        saida: dados.saida,
        chegada: dados.chegada,
        vagas: dados.vagas,
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
        vagas: 1,
        observacoes: '',
      });
    } catch (error) {
      setErro('Erro ao criar agendamento. Tente novamente.');
      console.error('Erro ao criar agendamento:', error);
    }
  };

  // Filtro de veículos
  const veiculosFiltrados = mostrarDisponiveis
    ? veiculos.filter((v) => v.status.disponivel)
    : veiculos;

  return (
    <>
      <main className="min-h-screen bg-green-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-semibold text-green-800 mb-6 sm:mb-8">
            Solicitação de Agendamento
          </h1>

          {erro && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-6 text-sm">
              {erro}
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-lg font-medium text-green-700 mb-3">Seleção de Veículo</h2>
            <div className="flex items-center mb-4">
              <label className="mr-3 text-sm font-medium text-green-700">
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
              <p className="text-green-600 text-sm">
                {mostrarDisponiveis
                  ? 'Nenhum veículo disponível.'
                  : 'Nenhum veículo encontrado.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <p className="text-xs text-green-500 mt-1">
                      {v.status.disponivel
                        ? `Devolver até: ${datasMaximas[v.id] || 'Carregando...'}`
                        : `Disponível após: ${new Date(v.status.retorno).toLocaleString('pt-BR')}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-green-200 mb-20 sm:mb-8">
            <h2 className="text-lg font-medium text-green-700 mb-4">Detalhes do Agendamento</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Data e Hora de Saída
                </label>
                <input
                  type="datetime-local"
                  value={dados.saida}
                  onChange={(e) => setDados({ ...dados, saida: e.target.value })}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Data e Hora de Chegada
                </label>
                <input
                  type="datetime-local"
                  value={dados.chegada}
                  onChange={(e) => setDados({ ...dados, chegada: e.target.value })}
                  min={dados.saida || new Date().toISOString().slice(0, 16)}
                  className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Motorista
                </label>
                <input
                  type="text"
                  value={dados.motorista}
                  onChange={(e) => setDados({ ...dados, motorista: e.target.value })}
                  className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                  placeholder="Nome do motorista"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Matrícula
                </label>
                <input
                  type="text"
                  value={dados.matricula}
                  onChange={(e) => setDados({ ...dados, matricula: e.target.value })}
                  className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                  placeholder="Matrícula"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={dados.telefone}
                  onChange={(e) => setDados({ ...dados, telefone: formatarTelefone(e.target.value) })}
                  className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                  placeholder="(XX) 9XXXX-XXXX"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Destino
                </label>
                <input
                  type="text"
                  value={dados.destino}
                  onChange={(e) => setDados({ ...dados, destino: e.target.value })}
                  className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                  placeholder="Destino"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Vagas Necessárias
                </label>
                <input
                  type="number"
                  min={1}
                  value={dados.vagas}
                  onChange={(e) => setDados({ ...dados, vagas: parseInt(e.target.value) || 1 })}
                  className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                  placeholder="Vagas necessárias"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={dados.observacoes}
                  onChange={(e) => setDados({ ...dados, observacoes: e.target.value })}
                  className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                  placeholder="Notas ou informações adicionais"
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-green-50 sm:static sm:p-0 sm:bg-transparent sm:flex sm:space-x-4">
            <button
              onClick={handleSubmit}
              className="w-full sm:w-auto bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm sm:text-base"
            >
              Solicitar Agendamento
            </button>
            <button
              onClick={() => router.push('/veiculos')}
              className="w-full sm:w-auto bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors duration-200 text-sm sm:text-base mt-2 sm:mt-0"
            >
              Cancelar
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
    </>
  );
}
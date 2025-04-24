'use client';

import { useState, useEffect } from 'react';
import { listarVeiculos, listarVeiculosComStatus } from '@/app/lib/veiculos';
import { criarAgendamento } from '@/app/lib/agendamentos';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export default function AgendarPage() {
    const [veiculos, setVeiculos] = useState<any[]>([]);
    const [dados, setDados] = useState({
        saida: '',
        chegada: '',
        veiculoId: '',
        motorista: '',
        matricula: '',
        telefone: '',
        destino: '',
        vagas: 1,
    });
    const [erro, setErro] = useState<string>('');
    const [mostrarDisponiveis, setMostrarDisponiveis] = useState(true);
    const [datasMaximas, setDatasMaximas] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (dados.saida) {
            const carregar = async () => {
                const lista = await listarVeiculosComStatus(dados.saida);
                setVeiculos(lista);
            };
            carregar();
        }
    }, [dados.saida]);

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

        // Validação do formato do telefone (básico: 10 ou 11 dígitos)
        const telefoneLimpo = dados.telefone.replace(/\D/g, '');
        if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
            return 'O número de telefone deve ter 10 ou 11 dígitos';
        }

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

    const handleSubmit = async () => {
        const mensagemErro = await validarAgendamento();
        if (mensagemErro) {
            setErro(mensagemErro);
            return;
        }

        await criarAgendamento(dados);
        setErro('');
        alert('Agendamento criado com sucesso!');
        setDados({
            saida: '',
            chegada: '',
            veiculoId: '',
            motorista: '',
            matricula: '',
            telefone: '',
            destino: '',
            vagas: 1,
        });
    };

    const veiculosDisponiveis = veiculos.filter((v) => v.status.disponivel);
    const veiculosIndisponiveis = veiculos.filter((v) => !v.status.disponivel);

    return (
        <main className="min-h-screen bg-green-50 p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-semibold text-green-800 mb-6 sm:mb-8">
                    Solicitação de Agendamento
                </h1>

                {erro && (
                    <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
                        {erro}
                    </div>
                )}

                <div className="mb-6">
                    <h2 className="text-lg font-medium text-green-700 mb-3">Veículos Disponíveis</h2>
                    <div className="space-y-2">
                        {veiculosDisponiveis.length > 0 ? (
                            veiculosDisponiveis.map((v) => (
                                <div
                                    key={v.id}
                                    onClick={() => setDados({ ...dados, veiculoId: v.id })}
                                    className={`p-3 sm:p-4 rounded-lg shadow-sm cursor-pointer transition-all duration-200 ${
                                        dados.veiculoId === v.id
                                            ? 'bg-green-200 border-green-400'
                                            : 'bg-white border-green-200 hover:bg-green-100'
                                    } border`}
                                >
                                    <p className="font-semibold text-green-900 text-sm sm:text-base">
                                        {v.modelo}
                                    </p>
                                    <p className="text-xs sm:text-sm text-green-600">{v.placa}</p>
                                    <p className="text-xs text-green-500 mt-1">
                                        Devolver até: {datasMaximas[v.id] || 'Carregando...'}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-green-600 text-sm">Nenhum veículo disponível.</p>
                        )}
                    </div>
                </div>

                <div className="mb-6">
                    <h2 className="text-lg font-medium text-green-700 mb-3">Veículos Indisponíveis</h2>
                    <div className="space-y-2">
                        {veiculosIndisponiveis.length > 0 ? (
                            veiculosIndisponiveis.map((v) => (
                                <div
                                    key={v.id}
                                    className="p-3 sm:p-4 rounded-lg bg-gray-100 border border-gray-200 shadow-sm"
                                >
                                    <p className="font-semibold text-gray-700 text-sm sm:text-base">
                                        {v.modelo}
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-500">{v.placa}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Disponível após: {new Date(v.status.retorno).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm">Nenhum veículo indisponível.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-green-200 mb-20 sm:mb-0">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-green-700 mb-1">
                                Data e Hora de Saída
                            </label>
                            <input
                                type="datetime-local"
                                value={dados.saida}
                                onChange={(e) => setDados({ ...dados, saida: e.target.value })}
                                className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                    dados.saida ? 'text-gray-900' : 'text-gray-500'
                                }`}
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
                                className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                    dados.motorista ? 'text-gray-900' : 'text-gray-500'
                                }`}
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
                                className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                    dados.matricula ? 'text-gray-900' : 'text-gray-500'
                                }`}
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
                                onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                                className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                    dados.telefone ? 'text-gray-900' : 'text-gray-500'
                                }`}
                                placeholder="(XX) 9XXXX-XXXX"
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
                                className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                    dados.chegada ? 'text-gray-900' : 'text-gray-500'
                                }`}
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
                                className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                    dados.destino ? 'text-gray-900' : 'text-gray-500'
                                }`}
                                placeholder="Destino"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-green-700 mb-1">
                                Vagas Disponíveis
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={dados.vagas}
                                onChange={(e) =>
                                    setDados({ ...dados, vagas: parseInt(e.target.value) || 1 })
                                }
                                className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                    dados.vagas > 0 ? 'text-gray-900' : 'text-gray-500'
                                }`}
                                placeholder="Vagas necessárias"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-green-50 sm:static sm:p-0 sm:bg-transparent">
                    <button
                        onClick={handleSubmit}
                        className="w-full sm:w-auto bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm sm:text-base"
                    >
                        Solicitar Agendamento
                    </button>
                </div>
            </div>
        </main>
    );
}
'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { listarAgendamentos, excluirAgendamento } from '@/app/lib/agendamentos';
import { listarVeiculos } from '@/app/lib/veiculos';

export default function HistoricoPage() {
    const [historico, setHistorico] = useState<any[]>([]);
    const [veiculos, setVeiculos] = useState<any[]>([]);
    const [carregando, setCarregando] = useState<boolean>(true);
    const [erro, setErro] = useState<string>('');
    const [ordenacao, setOrdenacao] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({
        coluna: 'saida',
        direcao: 'asc',
    });

    useEffect(() => {
        const carregarDados = async () => {
            setCarregando(true);
            try {
                const agendamentos = await listarAgendamentos();
                const veiculosLista = await listarVeiculos();
                setHistorico(agendamentos);
                setVeiculos(veiculosLista);
            } catch (error) {
                setErro('Erro ao carregar histórico. Tente novamente.');
                console.error('Erro ao carregar histórico:', error);
            } finally {
                setCarregando(false);
            }
        };
        carregarDados();
    }, []);

    const handleExcluir = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este registro do histórico?')) {
            try {
                await excluirAgendamento(id);
                setHistorico(historico.filter((item) => item.id !== id));
                alert('Registro excluído com sucesso!');
            } catch (error) {
                setErro('Erro ao excluir registro. Tente novamente.');
                console.error('Erro ao excluir registro:', error);
            }
        }
    };

    const handleOrdenar = (coluna: string) => {
        const novaDirecao = ordenacao.coluna === coluna && ordenacao.direcao === 'asc' ? 'desc' : 'asc';
        setOrdenacao({ coluna, direcao: novaDirecao });

        const historicoOrdenado = [...historico].sort((a, b) => {
            const valorA = a[coluna] || '';
            const valorB = b[coluna] || '';
            if (coluna === 'saida' || coluna === 'chegada') {
                return novaDirecao === 'asc'
                    ? new Date(valorA).getTime() - new Date(valorB).getTime()
                    : new Date(valorB).getTime() - new Date(valorA).getTime();
            }
            return novaDirecao === 'asc'
                ? valorA.localeCompare(valorB)
                : valorB.localeCompare(valorA);
        });

        setHistorico(historicoOrdenado);
    };

    const getVeiculoNome = (veiculoId: string) => {
        const veiculo = veiculos.find((v) => v.id === veiculoId);
        return veiculo ? `${veiculo.modelo} - ${veiculo.placa}` : 'Veículo não encontrado';
    };

    return (
        <ProtectedRoute>
            <main className="min-h-screen bg-green-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-green-800 mb-6">
                        Histórico de Uso dos Veículos
                    </h1>

                    {erro && (
                        <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
                            {erro}
                        </div>
                    )}

                    <div className="bg-white rounded-lg shadow-md border border-green-200 overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-green-100">
                                    {[
                                        { nome: 'Saída', coluna: 'saida' },
                                        { nome: 'Chegada', coluna: 'chegada' },
                                        { nome: 'Veículo', coluna: 'veiculoId' },
                                        { nome: 'Motorista', coluna: 'motorista' },
                                        { nome: 'Destino', coluna: 'destino' },
                                        { nome: 'Ações', coluna: '' },
                                    ].map((col) => (
                                        <th
                                            key={col.coluna || col.nome}
                                            onClick={() => col.coluna && handleOrdenar(col.coluna)}
                                            className={`p-3 text-left text-sm font-medium text-green-700 cursor-pointer ${
                                                col.coluna ? 'hover:bg-green-200' : ''
                                            }`}
                                        >
                                            {col.nome}
                                            {ordenacao.coluna === col.coluna &&
                                                (ordenacao.direcao === 'asc' ? ' ▲' : ' ▼')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {carregando ? (
                                    <tr>
                                        <td colSpan={6} className="p-3 text-sm text-gray-500 text-center">
                                            Carregando histórico...
                                        </td>
                                    </tr>
                                ) : historico.length > 0 ? (
                                    historico.map((item) => (
                                        <tr key={item.id} className="border-t border-green-200">
                                            <td className="p-3 text-sm text-gray-900">
                                                {new Date(item.saida).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="p-3 text-sm text-gray-900">
                                                {new Date(item.chegada).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="p-3 text-sm text-gray-900">
                                                {getVeiculoNome(item.veiculoId)}
                                            </td>
                                            <td className="p-3 text-sm text-gray-900">{item.motorista}</td>
                                            <td className="p-3 text-sm text-gray-900">{item.destino}</td>
                                            <td className="p-3 text-sm">
                                                <button
                                                    onClick={() => handleExcluir(item.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    Excluir
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="p-3 text-sm text-gray-500 text-center">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </ProtectedRoute>
    );
}
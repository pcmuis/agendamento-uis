'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { listarVeiculos, listarVeiculosComStatus } from '@/app/lib/veiculos';
import { criarAgendamento, listarAgendamentos, atualizarAgendamento, excluirAgendamento } from '@/app/lib/agendamentos';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import * as XLSX from 'xlsx';

export default function GerenciarAgendamentosPage() {
    const [agendamentos, setAgendamentos] = useState<any[]>([]);
    const [veiculos, setVeiculos] = useState<any[]>([]);
    const [formAberto, setFormAberto] = useState<'novo' | 'editar' | null>(null);
    const [dadosForm, setDadosForm] = useState({
        id: '',
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
    const [ordenacao, setOrdenacao] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({
        coluna: 'saida',
        direcao: 'asc',
    });

    useEffect(() => {
        const carregarDados = async () => {
            const agendamentosLista = await listarAgendamentos();
            setAgendamentos(agendamentosLista);
            const veiculosLista = await listarVeiculos();
            setVeiculos(veiculosLista);
        };
        carregarDados();
    }, []);

    const validarAgendamento = async (dados: typeof dadosForm, isEdicao: boolean = false) => {
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
            if (ag.veiculoId !== dados.veiculoId || (isEdicao && ag.id === dados.id)) return false;
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
        const mensagemErro = await validarAgendamento(dadosForm, formAberto === 'editar');
        if (mensagemErro) {
            setErro(mensagemErro);
            return;
        }

        if (formAberto === 'novo') {
            await criarAgendamento(dadosForm);
            alert('Agendamento criado com sucesso!');
        } else if (formAberto === 'editar') {
            await atualizarAgendamento(dadosForm.id, dadosForm);
            alert('Agendamento atualizado com sucesso!');
        }

        const agendamentosLista = await listarAgendamentos();
        setAgendamentos(agendamentosLista);
        setFormAberto(null);
        setDadosForm({
            id: '',
            saida: '',
            chegada: '',
            veiculoId: '',
            motorista: '',
            matricula: '',
            telefone: '',
            destino: '',
            vagas: 1,
        });
        setErro('');
    };

    const handleExcluir = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este agendamento?')) {
            await excluirAgendamento(id);
            const agendamentosLista = await listarAgendamentos();
            setAgendamentos(agendamentosLista);
            alert('Agendamento excluído com sucesso!');
        }
    };

    const handleEditar = (agendamento: any) => {
        setDadosForm({
            id: agendamento.id,
            saida: new Date(agendamento.saida).toISOString().slice(0, 16),
            chegada: new Date(agendamento.chegada).toISOString().slice(0, 16),
            veiculoId: agendamento.veiculoId,
            motorista: agendamento.motorista,
            matricula: agendamento.matricula,
            telefone: agendamento.telefone,
            destino: agendamento.destino,
            vagas: agendamento.vagas,
        });
        setFormAberto('editar');
    };

    const handleOrdenar = (coluna: string) => {
        const novaDirecao = ordenacao.coluna === coluna && ordenacao.direcao === 'asc' ? 'desc' : 'asc';
        setOrdenacao({ coluna, direcao: novaDirecao });

        const agendamentosOrdenados = [...agendamentos].sort((a, b) => {
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

        setAgendamentos(agendamentosOrdenados);
    };

    const getVeiculoNome = (veiculoId: string) => {
        const veiculo = veiculos.find((v) => v.id === veiculoId);
        return veiculo ? `${veiculo.modelo} - ${veiculo.placa}` : 'Veículo não encontrado';
    };

    const exportarParaExcel = () => {
        const dadosFormatados = agendamentos.map(ag => ({
            'Data/Hora Saída': new Date(ag.saida).toLocaleString('pt-BR'),
            'Data/Hora Chegada': new Date(ag.chegada).toLocaleString('pt-BR'),
            'Veículo': getVeiculoNome(ag.veiculoId),
            'Motorista': ag.motorista,
            'Matrícula': ag.matricula,
            'Telefone': ag.telefone,
            'Destino': ag.destino,
            'Vagas': ag.vagas
        }));

        const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Agendamentos");
        XLSX.writeFile(workbook, `Agendamentos_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    return (
        <ProtectedRoute>
            <main className="min-h-screen bg-green-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                        <h1 className="text-2xl sm:text-3xl font-semibold text-green-800 mb-4 sm:mb-0">
                            Gerenciamento de Agendamentos
                        </h1>
                        
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <button
                                onClick={exportarParaExcel}
                                className="flex items-center justify-center bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Exportar para Excel
                            </button>
                            
                            <button
                                onClick={() => {
                                    setFormAberto('novo');
                                    setDadosForm({
                                        id: '',
                                        saida: '',
                                        chegada: '',
                                        veiculoId: '',
                                        motorista: '',
                                        matricula: '',
                                        telefone: '',
                                        destino: '',
                                        vagas: 1,
                                    });
                                    setErro('');
                                }}
                                className="flex items-center justify-center bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Novo Agendamento
                            </button>
                        </div>
                    </div>

                    {formAberto && (
                        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-green-200 mb-6">
                            <h2 className="text-lg font-medium text-green-700 mb-4">
                                {formAberto === 'novo' ? 'Novo Agendamento' : 'Editar Agendamento'}
                            </h2>
                            {erro && (
                                <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
                                    {erro}
                                </div>
                            )}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-green-700 mb-1">
                                        Data e Hora de Saída
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={dadosForm.saida}
                                        onChange={(e) => setDadosForm({ ...dadosForm, saida: e.target.value })}
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.saida ? 'text-gray-900' : 'text-gray-500'
                                        }`}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-green-700 mb-1">
                                        Veículo
                                    </label>
                                    <select
                                        value={dadosForm.veiculoId}
                                        onChange={(e) => setDadosForm({ ...dadosForm, veiculoId: e.target.value })}
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.veiculoId ? 'text-gray-900' : 'text-gray-500'
                                        }`}
                                        required
                                    >
                                        <option value="">Selecione um veículo</option>
                                        {veiculos.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.modelo} - {v.placa}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-green-700 mb-1">
                                        Motorista
                                    </label>
                                    <input
                                        type="text"
                                        value={dadosForm.motorista}
                                        onChange={(e) => setDadosForm({ ...dadosForm, motorista: e.target.value })}
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.motorista ? 'text-gray-900' : 'text-gray-500'
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
                                        value={dadosForm.matricula}
                                        onChange={(e) => setDadosForm({ ...dadosForm, matricula: e.target.value })}
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.matricula ? 'text-gray-900' : 'text-gray-500'
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
                                        value={dadosForm.telefone}
                                        onChange={(e) => setDadosForm({ ...dadosForm, telefone: e.target.value })}
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.telefone ? 'text-gray-900' : 'text-gray-500'
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
                                        value={dadosForm.chegada}
                                        onChange={(e) => setDadosForm({ ...dadosForm, chegada: e.target.value })}
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.chegada ? 'text-gray-900' : 'text-gray-500'
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
                                        value={dadosForm.destino}
                                        onChange={(e) => setDadosForm({ ...dadosForm, destino: e.target.value })}
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.destino ? 'text-gray-900' : 'text-gray-500'
                                        }`}
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
                                        value={dadosForm.vagas}
                                        onChange={(e) =>
                                            setDadosForm({ ...dadosForm, vagas: parseInt(e.target.value) || 1 })
                                        }
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.vagas > 0 ? 'text-gray-900' : 'text-gray-500'
                                        }`}
                                        placeholder="Vagas necessárias"
                                        required
                                    />
                                </div>
                                <div className="flex space-x-4">
                                    <button
                                        onClick={handleSubmit}
                                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm"
                                    >
                                        {formAberto === 'novo' ? 'Criar' : 'Salvar'}
                                    </button>
                                    <button
                                        onClick={() => setFormAberto(null)}
                                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors duration-200 text-sm"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
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
                                        { nome: 'Matrícula', coluna: 'matricula' },
                                        { nome: 'Telefone', coluna: 'telefone' },
                                        { nome: 'Destino', coluna: 'destino' },
                                        { nome: 'Vagas', coluna: 'vagas' },
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
                                {agendamentos.length > 0 ? (
                                    agendamentos.map((ag) => (
                                        <tr key={ag.id} className="border-t border-green-200">
                                            <td className="p-3 text-sm text-gray-900">
                                                {new Date(ag.saida).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="p-3 text-sm text-gray-900">
                                                {new Date(ag.chegada).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="p-3 text-sm text-gray-900">
                                                {getVeiculoNome(ag.veiculoId)}
                                            </td>
                                            <td className="p-3 text-sm text-gray-900">{ag.motorista}</td>
                                            <td className="p-3 text-sm text-gray-900">{ag.matricula}</td>
                                            <td className="p-3 text-sm text-gray-900">{ag.telefone}</td>
                                            <td className="p-3 text-sm text-gray-900">{ag.destino}</td>
                                            <td className="p-3 text-sm text-gray-900">{ag.vagas}</td>
                                            <td className="p-3 text-sm">
                                                <button
                                                    onClick={() => handleEditar(ag)}
                                                    className="text-green-600 hover:text-green-800 mr-2"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleExcluir(ag.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    Excluir
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-3 text-sm text-gray-500 text-center">
                                            Nenhum agendamento encontrado.
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
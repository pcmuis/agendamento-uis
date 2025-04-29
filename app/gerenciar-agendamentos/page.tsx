'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { listarVeiculos, listarVeiculosComStatus } from '@/app/lib/veiculos';
import { criarAgendamento, listarAgendamentos, atualizarAgendamento, excluirAgendamento } from '@/app/lib/agendamentos';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import * as XLSX from 'xlsx';
import { atualizarVeiculo } from '@/app/lib/veiculos';

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
        observacoes: '',
        concluido: false, // Removed 'vagas'
    });
    const [erro, setErro] = useState<string>('');
    const [ordenacao, setOrdenacao] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({
        coluna: 'saida',
        direcao: 'asc',
    });

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        const agendamentosLista = await listarAgendamentos();
        setAgendamentos(agendamentosLista);
        const veiculosLista = await listarVeiculosComStatus(new Date().toISOString());
        setVeiculos(veiculosLista);
    };

    const validarAgendamento = async (dados: typeof dadosForm, isEdicao: boolean = false) => {
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

        const telefoneLimpo = dados.telefone.replace(/\D/g, '');
        if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
            return 'O número de telefone deve ter 10 ou 11 dígitos.';
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
            return `Conflito: Este veículo está agendado com saída em ${saidaConflito}. A entrega deve ser até ${horaMinimaEntrega}.`;
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

        await carregarDados();
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
            observacoes: '',
            concluido: false,
        });
        setErro('');
    };

    const handleConcluir = async (id: string, veiculoId: string) => {
        if (confirm('Deseja marcar este agendamento como concluído?')) {
            try {
                await atualizarAgendamento(id, { concluido: true });
                await carregarDados();
            } catch (error) {
                console.error('Erro ao concluir agendamento:', error);
                alert('Erro ao concluir agendamento. Tente novamente.');
            }
        }
    };

    const handleExcluir = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este agendamento?')) {
            try {
                await atualizarAgendamento(id, { concluido: true }); // Marca como concluído ao excluir
                await carregarDados();
            } catch (error) {
                console.error('Erro ao excluir agendamento:', error);
                alert('Erro ao excluir agendamento. Tente novamente.');
            }
        }
    };

    const handleEditar = (agendamento: any) => {
        setFormAberto('editar');
        setDadosForm({
            id: agendamento.id,
            saida: agendamento.saida,
            chegada: agendamento.chegada,
            veiculoId: agendamento.veiculoId,
            motorista: agendamento.motorista,
            matricula: agendamento.matricula,
            telefone: agendamento.telefone,
            destino: agendamento.destino,
            observacoes: agendamento.observacoes,
            concluido: agendamento.concluido,
        });
        setErro('');
    };

    const getVeiculoNome = (veiculoId: string) => {
        const veiculo = veiculos.find((v) => v.id === veiculoId);
        return veiculo ? `${veiculo.modelo} - ${veiculo.placa}` : 'Veículo não encontrado';
    };

    const isVeiculoOcupado = (veiculoId: string) => {
        const veiculo = veiculos.find((v) => v.id === veiculoId);
        return veiculo?.status?.disponivel === false;
    };

    const isAgendamentoPassadoOuConcluido = (agendamento: any) => {
        return agendamento.concluido;
    };

    const getStatusAgendamento = (agendamento: any) => {
        const agora = new Date();
        const chegada = new Date(agendamento.chegada);
        const saida = new Date(agendamento.saida);

        if (agendamento.concluido) return 'Concluído';
        if (saida <= agora && chegada >= agora) return 'Em Uso';
        if (chegada < agora) return 'Atrasado';
        return 'Futuro';
    };

    // Categorizar agendamentos
    const agendamentosEmUso = agendamentos.filter(
        (ag) => getStatusAgendamento(ag) === 'Em Uso'
    );
    const agendamentosAtrasados = agendamentos.filter(
        (ag) => getStatusAgendamento(ag) === 'Atrasado'
    );
    const agendamentosFuturos = agendamentos.filter(
        (ag) => getStatusAgendamento(ag) === 'Futuro'
    );

    // Separate and sort agendamentos
    const agendamentosAtivos = agendamentos
        .filter((ag) => !isAgendamentoPassadoOuConcluido(ag))
        .sort((a, b) => {
            const valorA = a[ordenacao.coluna] || '';
            const valorB = b[ordenacao.coluna] || '';
            if (ordenacao.coluna === 'saida' || ordenacao.coluna === 'chegada') {
                return ordenacao.direcao === 'asc'
                    ? new Date(valorA).getTime() - new Date(valorB).getTime()
                    : new Date(valorB).getTime() - new Date(valorA).getTime();
            } else if (ordenacao.coluna === 'veiculoId') {
                const nomeA = getVeiculoNome(valorA);
                const nomeB = getVeiculoNome(valorB);
                return ordenacao.direcao === 'asc'
                    ? nomeA.localeCompare(nomeB)
                    : nomeB.localeCompare(nomeA);
            }
            return ordenacao.direcao === 'asc'
                ? valorA.localeCompare(valorB)
                : valorB.localeCompare(valorA);
        });

    const agendamentosPassadosOuConcluidos = agendamentos
        .filter((ag) => isAgendamentoPassadoOuConcluido(ag))
        .sort((a, b) => new Date(b.chegada).getTime() - new Date(a.chegada).getTime());

    const handleOrdenar = (coluna: string) => {
        setOrdenacao((prevOrdenacao) => ({
            coluna,
            direcao: prevOrdenacao.coluna === coluna && prevOrdenacao.direcao === 'asc' ? 'desc' : 'asc',
        }));
    };

    const exportarParaExcel = () => {
        const colunas = [
            { header: 'Data e Hora de Saída', key: 'saida', width: 20 },
            { header: 'Data e Hora de Chegada', key: 'chegada', width: 20 },
            { header: 'Veículo', key: 'veiculo', width: 25 },
            { header: 'Motorista', key: 'motorista', width: 20 },
            { header: 'Matrícula', key: 'matricula', width: 15 },
            { header: 'Telefone', key: 'telefone', width: 15 },
            { header: 'Destino', key: 'destino', width: 30 },
            { header: 'Observações', key: 'observacoes', width: 40 },
            { header: 'Status', key: 'status', width: 15 },
        ]; // Removed 'Vagas'

        const dados = agendamentos.map((ag) => ({
            saida: new Date(ag.saida).toLocaleString('pt-BR'),
            chegada: new Date(ag.chegada).toLocaleString('pt-BR'),
            veiculo: getVeiculoNome(ag.veiculoId),
            motorista: ag.motorista || '',
            matricula: ag.matricula || '',
            telefone: ag.telefone || '',
            destino: ag.destino || '',
            observacoes: ag.observacoes || '',
            status: getStatusAgendamento(ag),
        }));

        const worksheet = XLSX.utils.aoa_to_sheet([
            colunas.map(col => col.header),
            ...dados.map(row => colunas.map(col => row[col.key as keyof typeof row])),
        ]);

        const headerStyle = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '4CAF50' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
            },
        };

        colunas.forEach((_, index) => {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
            if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: colunas[index].header };
            worksheet[cellAddress].s = headerStyle;
        });

        const dataStyle = {
            border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
            },
            alignment: { horizontal: 'left', vertical: 'center' },
        };

        for (let r = 1; r <= dados.length; r++) {
            colunas.forEach((_, c) => {
                const cellAddress = XLSX.utils.encode_cell({ r, c });
                if (worksheet[cellAddress]) {
                    worksheet[cellAddress].s = dataStyle;
                }
            });
        }

        worksheet['!cols'] = colunas.map(col => ({ wch: col.width }));
        worksheet['!rows'] = [{ hpt: 25 }];
        for (let i = 1; i <= dados.length; i++) {
            worksheet['!rows'][i] = { hpt: 20 };
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Agendamentos');

        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        XLSX.writeFile(workbook, `agendamentos-${timestamp}.xlsx`);
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
                                onClick={() => window.location.href = '/historico'}
                                className="flex items-center justify-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm"
                            >
                                Histórico de Veículos
                            </button>
                            <button
                                onClick={exportarParaExcel}
                                className="flex items-center justify-center bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 mr-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                Exportar para Excel
                            </button>
                            <button
                                onClick={carregarDados}
                                className="flex items-center justify-center bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors duration-200 text-sm"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 mr-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                                Atualizar
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
                                        observacoes: '',
                                        concluido: false,
                                    });
                                    setErro('');
                                }}
                                className="flex items-center justify-center bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 mr-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4v16m8-8H4"
                                    />
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
                                <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm flex justify-between items-center">
                                    {erro}
                                    <button
                                        onClick={() => setErro('')}
                                        className="text-red-700 hover:text-red-900"
                                    >
                                        ✕
                                    </button>
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
                                        Observações
                                    </label>
                                    <textarea
                                        value={dadosForm.observacoes}
                                        onChange={(e) => setDadosForm({ ...dadosForm, observacoes: e.target.value })}
                                        className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                                            dadosForm.observacoes ? 'text-gray-900' : 'text-gray-500'
                                        }`}
                                        placeholder="Observações (opcional)"
                                        rows={4}
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
                                        { nome: 'Status', coluna: '' },
                                        { nome: 'Saída', coluna: 'saida' },
                                        { nome: 'Chegada', coluna: 'chegada' },
                                        { nome: 'Veículo', coluna: 'veiculoId' },
                                        { nome: 'Motorista', coluna: 'motorista' },
                                        { nome: 'Matrícula', coluna: 'matricula' },
                                        { nome: 'Telefone', coluna: 'telefone' },
                                        { nome: 'Destino', coluna: 'destino' },
                                        { nome: 'Observações', coluna: 'observacoes' },
                                        { nome: 'Ações', coluna: '' },
                                    ].map((col) => (
                                        <th
                                            key={col.coluna || col.nome}
                                            onClick={() => col.coluna && handleOrdenar(col.coluna)}
                                            className={`p-3 text-left text-sm font-medium text-green-700 ${
                                                col.coluna ? 'cursor-pointer hover:bg-green-200' : ''
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
                                {agendamentos.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="p-3 text-sm text-gray-500 text-center">
                                            Nenhum agendamento encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {/* Agendamentos em uso */}
                                        {agendamentosEmUso.length > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={10} className="bg-gray-100 text-gray-800 font-semibold p-3">
                                                        Veículos em Uso
                                                    </td>
                                                </tr>
                                                {agendamentosEmUso.map((ag) => (
                                                    <tr key={ag.id}>
                                                        <td className="p-3 text-sm">
                                                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-800">
                                                                Em Uso
                                                            </span>
                                                        </td>
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
                                                        <td className="p-3 text-sm text-gray-900">
                                                            {ag.observacoes || '-'}
                                                        </td>
                                                        <td className="p-3 text-sm flex space-x-2">
                                                            {/* Botões de ação */}
                                                            <button
                                                                onClick={() => handleEditar(ag)}
                                                                className="text-green-600 hover:text-green-800"
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
                                                ))}
                                            </>
                                        )}

                                        {/* Agendamentos atrasados */}
                                        {agendamentosAtrasados.length > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={10} className="bg-red-100 text-red-800 font-semibold p-3">
                                                        Veículos Atrasados
                                                    </td>
                                                </tr>
                                                {agendamentosAtrasados.map((ag) => (
                                                    <tr key={ag.id}>
                                                        <td className="p-3 text-sm">
                                                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-200 text-red-800">
                                                                Atrasado
                                                            </span>
                                                        </td>
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
                                                        <td className="p-3 text-sm text-gray-900">
                                                            {ag.observacoes || '-'}
                                                        </td>
                                                        <td className="p-3 text-sm flex space-x-2">
                                                            {/* Botões de ação */}
                                                            <button
                                                                onClick={() => handleEditar(ag)}
                                                                className="text-green-600 hover:text-green-800"
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
                                                ))}
                                            </>
                                        )}

                                        {/* Agendamentos futuros */}
                                        {agendamentosFuturos.length > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={10} className="bg-green-100 text-green-800 font-semibold p-3">
                                                        Veículos Agendados para o Futuro
                                                    </td>
                                                </tr>
                                                {agendamentosFuturos.map((ag) => (
                                                    <tr key={ag.id}>
                                                        <td className="p-3 text-sm">
                                                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                                                                Futuro
                                                            </span>
                                                        </td>
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
                                                        <td className="p-3 text-sm text-gray-900">
                                                            {ag.observacoes || '-'}
                                                        </td>
                                                        <td className="p-3 text-sm flex space-x-2">
                                                            {/* Botões de ação */}
                                                            <button
                                                                onClick={() => handleEditar(ag)}
                                                                className="text-green-600 hover:text-green-800"
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
                                                ))}
                                            </>
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </ProtectedRoute>
    );
}
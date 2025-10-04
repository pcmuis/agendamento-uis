'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import SidebarMenu from '../components/SidebarMenu';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';

type Motorista = {
  id?: string;
  nome: string;
  matricula: string;
  setor: string;
  cargo: string;
  telefone: string;
};

export default function MotoristasPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [dadosForm, setDadosForm] = useState<Motorista>({
    nome: '',
    matricula: '',
    setor: '',
    cargo: '',
    telefone: '',
  });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [termoPesquisa, setTermoPesquisa] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(true);
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'por-setor' | 'por-cargo'>('todos');
  const [filtroValor, setFiltroValor] = useState<string>('');

  const colMotoristas = collection(db, 'motoristas');

  const carregarMotoristas = useCallback(async () => {
    setCarregando(true);
    try {
      const snapshot = await getDocs(colMotoristas);
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Motorista));
      setMotoristas(lista);
    } catch (error) {
      toast.error('Erro ao carregar motoristas. Tente novamente.');
      console.error('Erro ao carregar motoristas:', error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarMotoristas();
  }, [carregarMotoristas]);

  const formatarTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 2) return apenasNumeros;
    if (apenasNumeros.length <= 7) return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2)}`;
    if (apenasNumeros.length <= 11)
      return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7)}`;
    return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7, 11)}`;
  };

  const validarTelefone = (telefone: string) => {
    const telefoneLimpo = telefone.replace(/\D/g, '');
    return telefoneLimpo.length === 10 || telefoneLimpo.length === 11;
  };

  const handleSubmit = async () => {
    if (!dadosForm.nome || !dadosForm.matricula || !dadosForm.setor || !dadosForm.cargo || !dadosForm.telefone) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!validarTelefone(dadosForm.telefone)) {
      toast.error('O número de telefone deve ter 10 ou 11 dígitos.');
      return;
    }

    try {
      if (editandoId) {
        const docRef = doc(db, 'motoristas', editandoId);
        await updateDoc(docRef, dadosForm);
        toast.success('Motorista atualizado com sucesso!');
      } else {
        await addDoc(colMotoristas, dadosForm);
        toast.success('Motorista cadastrado com sucesso!');
      }
      resetarFormulario();
      carregarMotoristas();
    } catch (error) {
      toast.error(editandoId ? 'Erro ao atualizar motorista.' : 'Erro ao cadastrar motorista.');
      console.error('Erro:', error);
    }
  };

  const resetarFormulario = () => {
    setDadosForm({ nome: '', matricula: '', setor: '', cargo: '', telefone: '' });
    setEditandoId(null);
  };

  const handleEditar = (motorista: Motorista) => {
    setDadosForm(motorista);
    setEditandoId(motorista.id || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluir = async (id: string) => {
    if (confirm('Deseja realmente excluir este motorista?')) {
      try {
        const docRef = doc(db, 'motoristas', id);
        await deleteDoc(docRef);
        toast.success('Motorista excluído com sucesso!');
        carregarMotoristas();
      } catch (error) {
        toast.error('Erro ao excluir motorista.');
        console.error('Erro ao excluir:', error);
      }
    }
  };

  const exportarParaExcel = () => {
    const dados = motoristasFiltrados.map((motorista) => ({
      'Nome': motorista.nome,
      'Matrícula': motorista.matricula,
      'Setor': motorista.setor,
      'Cargo': motorista.cargo,
      'Telefone': motorista.telefone,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Motoristas');

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    XLSX.writeFile(workbook, `motoristas-${timestamp}.xlsx`);
  };

  const motoristasFiltrados = motoristas.filter((motorista) => {
    // Filtro por termo de pesquisa
    const pesquisaMatch = Object.values(motorista).some((valor) =>
      valor.toString().toLowerCase().includes(termoPesquisa.toLowerCase())
    );

    // Filtros adicionais
    if (filtroAtivo === 'todos') return pesquisaMatch;
    if (filtroAtivo === 'por-setor') {
      return pesquisaMatch && motorista.setor.toLowerCase().includes(filtroValor.toLowerCase());
    }
    if (filtroAtivo === 'por-cargo') {
      return pesquisaMatch && motorista.cargo.toLowerCase().includes(filtroValor.toLowerCase());
    }
    return pesquisaMatch;
  });

  // Opções para filtros
  const setoresUnicos = [...new Set(motoristas.map(m => m.setor))];
  const cargosUnicos = [...new Set(motoristas.map(m => m.cargo))];

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
        <SidebarMenu className="md:min-h-screen" />
        <main className="flex-1 p-6 overflow-x-hidden">
          <ToastContainer position="top-right" autoClose={5000} />
          
          <div className="max-w-7xl mx-auto">
            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Gerenciamento de Motoristas</h1>
                <p className="text-gray-600 mt-1">
                  {motoristasFiltrados.length} motoristas encontrados
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <button
                  onClick={exportarParaExcel}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar
                </button>
                
                <button
                  onClick={carregarMotoristas}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar
                </button>
              </div>
            </div>

            {/* Formulário */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  {editandoId ? 'Editar Motorista' : 'Cadastrar Novo Motorista'}
                </h2>
                {editandoId && (
                  <button
                    onClick={resetarFormulario}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo*</label>
                  <input
                    type="text"
                    value={dadosForm.nome}
                    onChange={(e) => setDadosForm({ ...dadosForm, nome: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    placeholder="Digite o nome completo"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula*</label>
                  <input
                    type="text"
                    value={dadosForm.matricula}
                    onChange={(e) => setDadosForm({ ...dadosForm, matricula: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    placeholder="Digite a matrícula"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Setor*</label>
                  <input
                    type="text"
                    value={dadosForm.setor}
                    onChange={(e) => setDadosForm({ ...dadosForm, setor: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    placeholder="Digite o setor"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo*</label>
                  <input
                    type="text"
                    value={dadosForm.cargo}
                    onChange={(e) => setDadosForm({ ...dadosForm, cargo: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    placeholder="Digite o cargo"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone*</label>
                  <input
                    type="tel"
                    value={dadosForm.telefone}
                    onChange={(e) => setDadosForm({ ...dadosForm, telefone: formatarTelefone(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    placeholder="(XX) 9XXXX-XXXX"
                    required
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  {editandoId ? 'Salvar Alterações' : 'Cadastrar Motorista'}
                </button>
              </div>
            </div>

            {/* Filtros e Pesquisa */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar</label>
                  <input
                    type="text"
                    value={termoPesquisa}
                    onChange={(e) => setTermoPesquisa(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    placeholder="Pesquisar por nome, matrícula, etc."
                  />
                </div>
                
                <div className="w-full sm:w-auto">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por</label>
                  <select
                    value={filtroAtivo}
                    onChange={(e) => {
                      setFiltroAtivo(e.target.value as any);
                      setFiltroValor('');
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  >
                    <option value="todos">Todos</option>
                    <option value="por-setor">Setor</option>
                    <option value="por-cargo">Cargo</option>
                  </select>
                </div>
                
                {filtroAtivo === 'por-setor' && (
                  <div className="w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                    <select
                      value={filtroValor}
                      onChange={(e) => setFiltroValor(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    >
                      <option value="">Todos os setores</option>
                      {setoresUnicos.map((setor) => (
                        <option key={setor} value={setor}>{setor}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {filtroAtivo === 'por-cargo' && (
                  <div className="w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <select
                      value={filtroValor}
                      onChange={(e) => setFiltroValor(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    >
                      <option value="">Todos os cargos</option>
                      {cargosUnicos.map((cargo) => (
                        <option key={cargo} value={cargo}>{cargo}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Tabela de Motoristas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {carregando ? (
                <div className="p-8 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                </div>
              ) : motoristasFiltrados.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum motorista encontrado</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {termoPesquisa 
                      ? 'Nenhum motorista corresponde à sua pesquisa.'
                      : 'Não há motoristas cadastrados no sistema.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matrícula</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {motoristasFiltrados.map((motorista) => (
                        <tr key={motorista.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{motorista.nome}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{motorista.matricula}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{motorista.setor}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{motorista.cargo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{motorista.telefone}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditar(motorista)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Editar"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleExcluir(motorista.id!)}
                                className="text-red-600 hover:text-red-900"
                                title="Excluir"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
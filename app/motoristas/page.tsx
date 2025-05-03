'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import SidebarMenu from '../components/SidebarMenu'; // Importando o SidebarMenu
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

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
  const [erro, setErro] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(true);

  const colMotoristas = collection(db, 'motoristas');

  const carregarMotoristas = async () => {
    setCarregando(true);
    try {
      const snapshot = await getDocs(colMotoristas);
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Motorista));
      setMotoristas(lista);
    } catch (error) {
      setErro('Erro ao carregar motoristas. Tente novamente.');
      console.error('Erro ao carregar motoristas:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarMotoristas();
  }, []);

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
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!validarTelefone(dadosForm.telefone)) {
      setErro('O número de telefone deve ter 10 ou 11 dígitos.');
      return;
    }

    try {
      if (editandoId) {
        const docRef = doc(db, 'motoristas', editandoId);
        await updateDoc(docRef, dadosForm);
        alert('Motorista atualizado com sucesso!');
      } else {
        await addDoc(colMotoristas, dadosForm);
        alert('Motorista cadastrado com sucesso!');
      }
      setDadosForm({ nome: '', matricula: '', setor: '', cargo: '', telefone: '' });
      setEditandoId(null);
      carregarMotoristas();
    } catch (error) {
      setErro(editandoId ? 'Erro ao atualizar motorista.' : 'Erro ao cadastrar motorista.');
      console.error('Erro:', error);
    }
  };

  const handleEditar = (motorista: Motorista) => {
    setDadosForm(motorista);
    setEditandoId(motorista.id || null);
  };

  const handleExcluir = async (id: string) => {
    if (confirm('Deseja realmente excluir este motorista?')) {
      try {
        const docRef = doc(db, 'motoristas', id);
        await deleteDoc(docRef);
        alert('Motorista excluído com sucesso!');
        carregarMotoristas();
      } catch (error) {
        setErro('Erro ao excluir motorista.');
        console.error('Erro ao excluir:', error);
      }
    }
  };

  const motoristasFiltrados = motoristas.filter((motorista) =>
    Object.values(motorista).some((valor) =>
      valor.toString().toLowerCase().includes(termoPesquisa.toLowerCase())
    )
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-green-50">
        <SidebarMenu /> {/* Adicionando o SidebarMenu */}
        <main className="flex-1 ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-green-900 mb-6 sm:mb-8">
              Gerenciamento de Motoristas Autorizados
            </h1>

            {erro && (
              <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-6 shadow-sm text-sm sm:text-base flex justify-between items-center">
                {erro}
                <button
                  onClick={() => setErro('')}
                  className="text-red-800 hover:text-red-900"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-lg border border-green-200 mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-semibold text-green-800 mb-4 sm:mb-6">
                {editandoId ? 'Editar Motorista' : 'Novo Motorista'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">Nome Completo</label>
                  <input
                    type="text"
                    value={dadosForm.nome}
                    onChange={(e) => setDadosForm({ ...dadosForm, nome: e.target.value })}
                    className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                    required
                    placeholder="Digite o nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">Matrícula</label>
                  <input
                    type="text"
                    value={dadosForm.matricula}
                    onChange={(e) => setDadosForm({ ...dadosForm, matricula: e.target.value })}
                    className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                    required
                    placeholder="Digite a matrícula"
                  />
                </div>
                <div>
                  <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">Setor</label>
                  <input
                    type="text"
                    value={dadosForm.setor}
                    onChange={(e) => setDadosForm({ ...dadosForm, setor: e.target.value })}
                    className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                    required
                    placeholder="Digite o setor"
                  />
                </div>
                <div>
                  <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">Cargo</label>
                  <input
                    type="text"
                    value={dadosForm.cargo}
                    onChange={(e) => setDadosForm({ ...dadosForm, cargo: e.target.value })}
                    className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                    required
                    placeholder="Digite o cargo"
                  />
                </div>
                <div>
                  <label className="block text-sm sm:text-base font-medium text-green-700 mb-2">Telefone</label>
                  <input
                    type="tel"
                    value={dadosForm.telefone}
                    onChange={(e) => setDadosForm({ ...dadosForm, telefone: formatarTelefone(e.target.value) })}
                    className="w-full p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                    required
                    placeholder="(XX) 9XXXX-XXXX"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm sm:text-base font-medium"
                >
                  {editandoId ? 'Atualizar Motorista' : 'Cadastrar Motorista'}
                </button>
                {editandoId && (
                  <button
                    onClick={() => {
                      setDadosForm({ nome: '', matricula: '', setor: '', cargo: '', telefone: '' });
                      setEditandoId(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-sm sm:text-base font-medium"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-lg border border-green-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-green-800">Lista de Motoristas</h2>
                <input
                  type="text"
                  placeholder="Pesquisar motoristas..."
                  value={termoPesquisa}
                  onChange={(e) => setTermoPesquisa(e.target.value)}
                  className="w-full sm:w-64 p-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 text-sm sm:text-base bg-white placeholder-gray-500 transition-all"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-green-100">
                      <th className="p-3 sm:p-4 text-left text-sm sm:text-base font-semibold text-green-800">Nome</th>
                      <th className="p-3 sm:p-4 text-left text-sm sm:text-base font-semibold text-green-800">Matrícula</th>
                      <th className="p-3 sm:p-4 text-left text-sm sm:text-base font-semibold text-green-800">Setor</th>
                      <th className="p-3 sm:p-4 text-left text-sm sm:text-base font-semibold text-green-800">Cargo</th>
                      <th className="p-3 sm:p-4 text-left text-sm sm:text-base font-semibold text-green-800">Telefone</th>
                      <th className="p-3 sm:p-4 text-left text-sm sm:text-base font-semibold text-green-800">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carregando ? (
                      <tr>
                        <td colSpan={6} className="p-3 sm:p-4 text-sm sm:text-base text-gray-500 text-center">
                          Carregando motoristas...
                        </td>
                      </tr>
                    ) : motoristasFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-3 sm:p-4 text-sm sm:text-base text-gray-500 text-center">
                          Nenhum motorista encontrado.
                        </td>
                      </tr>
                    ) : (
                      motoristasFiltrados.map((motorista) => (
                        <tr key={motorista.id} className="border-t border-green-200 hover:bg-green-50">
                          <td className="p-3 sm:p-4 text-sm sm:text-base text-gray-900">{motorista.nome}</td>
                          <td className="p-3 sm:p-4 text-sm sm:text-base text-gray-900">{motorista.matricula}</td>
                          <td className="p-3 sm:p-4 text-sm sm:text-base text-gray-900">{motorista.setor}</td>
                          <td className="p-3 sm:p-4 text-sm sm:text-base text-gray-900">{motorista.cargo}</td>
                          <td className="p-3 sm:p-4 text-sm sm:text-base text-gray-900">{motorista.telefone}</td>
                          <td className="p-3 sm:p-4 text-sm sm:text-base">
                            <button
                              onClick={() => handleEditar(motorista)}
                              className="text-blue-600 hover:text-blue-800 mr-3 sm:mr-4"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleExcluir(motorista.id!)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
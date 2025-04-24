'use client';

import { useEffect, useState } from 'react';
import { listarVeiculos, criarVeiculo, removerVeiculo, atualizarVeiculo, Veiculo } from '@/app/lib/veiculos';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import ProtectedRoute from '../components/ProtectedRoute';

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [formAberto, setFormAberto] = useState<'novo' | 'editar' | null>(null);
  const [dadosForm, setDadosForm] = useState<Omit<Veiculo, 'id'> & { id?: string }>({
    placa: '',
    modelo: '',
    disponivel: true,
  });
  const [erro, setErro] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(true);
  const [ordenacao, setOrdenacao] = useState<{ coluna: keyof Veiculo; direcao: 'asc' | 'desc' }>({
    coluna: 'placa',
    direcao: 'asc',
  });

  const colAgendamentos = collection(db, 'agendamentos');

  const carregarVeiculos = async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await listarVeiculos();
      setVeiculos(dados);
    } catch (error) {
      setErro('Erro ao carregar veículos. Tente novamente.');
      console.error('Erro ao carregar veículos:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarVeiculos();
  }, []);

  const validarEntrada = (dados: Omit<Veiculo, 'id'>) => {
    if (!dados.placa || !dados.modelo) {
      return 'Preencha os campos obrigatórios: Placa e Modelo';
    }
    const placaLimpa = dados.placa.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z0-9]{7}$/.test(placaLimpa)) {
      return 'A placa deve ter 7 caracteres alfanuméricos (ex: ABC1234)';
    }
    return '';
  };

  const handleSubmit = async () => {
    const mensagemErro = validarEntrada(dadosForm);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setErro('');
    try {
      if (formAberto === 'novo') {
        await criarVeiculo({
          placa: dadosForm.placa.toUpperCase(),
          modelo: dadosForm.modelo,
          disponivel: dadosForm.disponivel
        });
        alert('Veículo adicionado com sucesso!');
      } else if (formAberto === 'editar' && dadosForm.id) {
        await atualizarVeiculo(dadosForm.id, {
          placa: dadosForm.placa.toUpperCase(),
          modelo: dadosForm.modelo,
          disponivel: dadosForm.disponivel
        });
        alert('Veículo atualizado com sucesso!');
      }
      await carregarVeiculos();
      setFormAberto(null);
      setDadosForm({ placa: '', modelo: '', disponivel: true });
    } catch (error) {
      setErro(`Erro ao ${formAberto === 'novo' ? 'adicionar' : 'atualizar'} veículo. Tente novamente.`);
      console.error('Erro ao submeter:', error);
    }
  };

  const verificarAgendamentos = async (veiculoId: string) => {
    try {
      const agendamentosSnap = await getDocs(colAgendamentos);
      return agendamentosSnap.docs.some((doc) => {
        const ag = doc.data();
        return ag.veiculoId === veiculoId && new Date(ag.chegada) > new Date();
      });
    } catch (error) {
      console.error('Erro ao verificar agendamentos:', error);
      return true; // Por segurança, assume que tem agendamento se houver erro
    }
  };

  const handleExcluir = async (id: string, modelo: string) => {
    if (!id) {
      setErro(`Não foi possível excluir o veículo "${modelo}" porque ele não possui um ID válido.`);
      console.error('Tentativa de excluir veículo sem ID:', { modelo, id });
      return;
    }

    if (!confirm(`Tem certeza que deseja remover o veículo ${modelo}?`)) return;

    try {
      const temAgendamentos = await verificarAgendamentos(id);
      if (temAgendamentos) {
        setErro('Não é possível excluir o veículo porque ele possui agendamentos ativos.');
        return;
      }

      await removerVeiculo(id);
      await carregarVeiculos();
      alert('Veículo removido com sucesso!');
    } catch (error) {
      setErro('Erro ao remover veículo. Verifique se o veículo existe ou tente novamente.');
      console.error('Erro ao excluir veículo:', error);
    }
  };

  const handleEditar = (veiculo: Veiculo) => {
    if (!veiculo.id) {
      setErro('ID do veículo inválido. Não é possível editar.');
      return;
    }
    setDadosForm({
      id: veiculo.id,
      placa: veiculo.placa,
      modelo: veiculo.modelo,
      disponivel: veiculo.disponivel,
    });
    setFormAberto('editar');
    setErro('');
  };

  const handleOrdenar = (coluna: keyof Veiculo) => {
    const novaDirecao = ordenacao.coluna === coluna && ordenacao.direcao === 'asc' ? 'desc' : 'asc';
    setOrdenacao({ coluna, direcao: novaDirecao });

    const veiculosOrdenados = [...veiculos].sort((a, b) => {
      const valorA = a[coluna] ?? '';
      const valorB = b[coluna] ?? '';
      
      if (coluna === 'disponivel') {
        return novaDirecao === 'asc'
          ? Number(valorA) - Number(valorB)
          : Number(valorB) - Number(valorA);
      }
      
      return novaDirecao === 'asc'
        ? String(valorA).localeCompare(String(valorB))
        : String(valorB).localeCompare(String(valorA));
    });

    setVeiculos(veiculosOrdenados);
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-green-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-semibold text-green-800 mb-6 sm:mb-8">
            Gerenciamento de Veículos
          </h1>

          <button
            onClick={() => {
              setFormAberto('novo');
              setDadosForm({ placa: '', modelo: '', disponivel: true });
              setErro('');
            }}
            className="mb-6 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm sm:text-base"
          >
            Novo Veículo
          </button>

          {formAberto && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-green-200 mb-6">
              <h2 className="text-lg font-medium text-green-700 mb-4">
                {formAberto === 'novo' ? 'Novo Veículo' : 'Editar Veículo'}
              </h2>
              {erro && (
                <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
                  {erro}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1">Placa</label>
                  <input
                    type="text"
                    placeholder="Ex: ABC1234"
                    className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                      dadosForm.placa ? 'text-gray-900' : 'text-gray-500'
                    }`}
                    value={dadosForm.placa}
                    onChange={(e) => setDadosForm({ ...dadosForm, placa: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    placeholder="Ex: Fiat Uno"
                    className={`w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                      dadosForm.modelo ? 'text-gray-900' : 'text-gray-500'
                    }`}
                    value={dadosForm.modelo}
                    onChange={(e) => setDadosForm({ ...dadosForm, modelo: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="disponivel"
                    checked={dadosForm.disponivel}
                    onChange={(e) => setDadosForm({ ...dadosForm, disponivel: e.target.checked })}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-green-300 rounded"
                  />
                  <label htmlFor="disponivel" className="ml-2 block text-sm font-medium text-green-700">
                    Disponível
                  </label>
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
                    { nome: 'Placa', coluna: 'placa' as keyof Veiculo },
                    { nome: 'Modelo', coluna: 'modelo' as keyof Veiculo },
                    { nome: 'Disponível', coluna: 'disponivel' as keyof Veiculo },
                    { nome: 'Ações', coluna: '' },
                  ].map((col) => (
                    <th
                      key={col.coluna || col.nome}
                      onClick={() => col.coluna !== '' && handleOrdenar(col.coluna as keyof Veiculo)}
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
                    <td colSpan={4} className="p-3 text-sm text-gray-500 text-center">
                      Carregando veículos...
                    </td>
                  </tr>
                ) : veiculos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-sm text-gray-500 text-center">
                      Nenhum veículo cadastrado.
                    </td>
                  </tr>
                ) : (
                  veiculos.map((v) => (
                    <tr key={v.id} className="border-t border-green-200">
                      <td className="p-3 text-sm text-gray-900">{v.placa}</td>
                      <td className="p-3 text-sm text-gray-900">{v.modelo}</td>
                      <td className="p-3 text-sm text-gray-900">
                        {v.disponivel ? 'Sim' : 'Não'}
                      </td>
                      <td className="p-3 text-sm">
                        <button
                          onClick={() => handleEditar(v)}
                          className="text-green-600 hover:text-green-800 mr-2"
                        >
                          Editar
                        </button>
                        {v.id && (
                          <button
                            onClick={() => handleExcluir(v.id ?? '', v.modelo)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
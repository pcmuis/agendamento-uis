'use client';

import { useEffect, useState } from 'react';
import { listarVeiculos, criarVeiculo, removerVeiculo, atualizarVeiculo, Veiculo } from '@/app/lib/veiculos';
import { listarChecklists, ChecklistModelo } from '@/app/lib/checklists';
import { listarRespostasPorVeiculo, ChecklistResposta, marcarSaidaConfirmada } from '@/app/lib/checklist-respostas';
import { atualizarAgendamento } from '@/app/lib/agendamentos';
import { collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/app/lib/firebase';
import ProtectedRoute from '../components/ProtectedRoute';
import SidebarMenu from '../components/SidebarMenu';
import { FiEdit2, FiTrash2, FiPlus, FiCheck, FiX, FiArrowUp, FiArrowDown, FiCopy, FiEye } from 'react-icons/fi';

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [checklists, setChecklists] = useState<ChecklistModelo[]>([]);
  const [formAberto, setFormAberto] = useState<'novo' | 'editar' | null>(null);
  const [dadosForm, setDadosForm] = useState<Omit<Veiculo, 'id'> & { id?: string }>({
    placa: '',
    modelo: '',
    disponivel: true,
    checklistId: '',
  });
  const [erro, setErro] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(true);
  const [ordenacao, setOrdenacao] = useState<{ coluna: keyof Veiculo; direcao: 'asc' | 'desc' }>({
    coluna: 'placa',
    direcao: 'asc',
  });
  const [baseUrl, setBaseUrl] = useState('');
  const [respostasChecklist, setRespostasChecklist] = useState<ChecklistResposta[]>([]);
  const [veiculoEmAnalise, setVeiculoEmAnalise] = useState<Veiculo | null>(null);
  const [carregandoRespostas, setCarregandoRespostas] = useState(false);
  const [erroRespostas, setErroRespostas] = useState('');
  const [confirmandoSaida, setConfirmandoSaida] = useState<string | null>(null);

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

  const carregarChecklists = async () => {
    try {
      const lista = await listarChecklists();
      setChecklists(lista);
    } catch (error) {
      console.error('Erro ao carregar checklists:', error);
    }
  };

  useEffect(() => {
    carregarVeiculos();
    carregarChecklists();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const gerarLinkAcesso = (veiculoId: string) => {
    const origem = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!origem) return '';
    return `${origem}/veiculos/${veiculoId}/acesso`;
  };

  const formatarDataHora = (valor: string) => {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return 'Data inválida';
    return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const handleCopiarLink = async (veiculoId: string) => {
    const link = gerarLinkAcesso(veiculoId);
    if (!link) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        alert('Link copiado para a área de transferência!');
      } else {
        window.prompt('Copie o link de acesso do veículo', link);
      }
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      setErro('Não foi possível copiar o link. Tente novamente.');
    }
  };

  const abrirRespostasChecklist = async (veiculo: Veiculo) => {
    if (!veiculo.id) return;
    setVeiculoEmAnalise(veiculo);
    setCarregandoRespostas(true);
    setErroRespostas('');

    try {
      const respostas = await listarRespostasPorVeiculo(veiculo.id);
      setRespostasChecklist(respostas);
    } catch (error) {
      console.error('Erro ao carregar respostas do checklist:', error);
      setErroRespostas('Não foi possível carregar as respostas deste veículo.');
    } finally {
      setCarregandoRespostas(false);
    }
  };

  const fecharModalRespostas = () => {
    setVeiculoEmAnalise(null);
    setRespostasChecklist([]);
    setErroRespostas('');
  };

  const confirmarSaidaChecklist = async (resposta: ChecklistResposta) => {
    if (!resposta.agendamentoId) {
      setErroRespostas('Agendamento inválido para confirmação.');
      return;
    }

    setConfirmandoSaida(resposta.id);
    try {
      await atualizarAgendamento(resposta.agendamentoId, { concluido: true });
      await marcarSaidaConfirmada(resposta.id);
      setRespostasChecklist((atuais) =>
        atuais.map((item) => (item.id === resposta.id ? { ...item, saidaConfirmada: true } : item)),
      );
      alert('Saída confirmada com base no checklist preenchido.');
    } catch (error) {
      console.error('Erro ao confirmar saída via checklist:', error);
      setErroRespostas('Erro ao confirmar a saída. Tente novamente.');
    } finally {
      setConfirmandoSaida(null);
    }
  };

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
          disponivel: dadosForm.disponivel,
          checklistId: dadosForm.checklistId,
        });
        alert('Veículo adicionado com sucesso!');
      } else if (formAberto === 'editar' && dadosForm.id) {
        await atualizarVeiculo(dadosForm.id, {
          placa: dadosForm.placa.toUpperCase(),
          modelo: dadosForm.modelo,
          disponivel: dadosForm.disponivel,
          checklistId: dadosForm.checklistId,
        });
        alert('Veículo atualizado com sucesso!');
      }
      setDadosForm({ placa: '', modelo: '', disponivel: true, checklistId: '' });
      setFormAberto(null);
      await carregarVeiculos();
    } catch (error) {
      setErro(`Erro ao ${formAberto === 'novo' ? 'adicionar' : 'atualizar'} veículo. Tente novamente.`);
      console.error('Erro ao submeter:', error);
    }
  };

  const verificarAgendamentos = async (veiculoId: string) => {
    try {
      const agendamentosSnap = await getDocs(collection(getDb(), 'agendamentos'));
      return agendamentosSnap.docs.some((doc) => {
        const ag = doc.data();
        return ag.veiculoId === veiculoId && new Date(ag.chegada) > new Date();
      });
    } catch (error) {
      console.error('Erro ao verificar agendamentos:', error);
      return true;
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
      checklistId: veiculo.checklistId || '',
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

  const obterNomeChecklist = (checklistId?: string) =>
    checklists.find((c) => c.id === checklistId)?.nome || '—';

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
        <SidebarMenu className="md:min-h-screen" />

        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Gerenciamento de Veículos</h1>
            <button
              onClick={() => {
                setFormAberto('novo');
                setDadosForm({ placa: '', modelo: '', disponivel: true, checklistId: '' });
                setErro('');
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <FiPlus className="text-lg" />
              Novo Veículo
            </button>
          </div>

          {formAberto && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  {formAberto === 'novo' ? 'Adicionar Veículo' : 'Editar Veículo'}
                </h2>
                <button 
                  onClick={() => setFormAberto(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX className="text-xl" />
                </button>
              </div>
              
              {erro && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
                  <p className="font-bold">Erro</p>
                  <p>{erro}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placa *</label>
                  <input
                    type="text"
                    placeholder="Ex: ABC1234"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={dadosForm.placa}
                    onChange={(e) => setDadosForm({ ...dadosForm, placa: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
                  <input
                    type="text"
                    placeholder="Ex: Fiat Uno"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={dadosForm.modelo}
                    onChange={(e) => setDadosForm({ ...dadosForm, modelo: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Checklist atribuído</label>
                  <select
                    value={dadosForm.checklistId}
                    onChange={(e) => setDadosForm({ ...dadosForm, checklistId: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Nenhum checklist</option>
                    {checklists.map((checklist) => (
                      <option key={checklist.id} value={checklist.id}>
                        {checklist.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Selecione o modelo aplicado a este veículo.</p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="disponivel"
                    checked={dadosForm.disponivel}
                    onChange={(e) => setDadosForm({ ...dadosForm, disponivel: e.target.checked })}
                    className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="disponivel" className="ml-2 block text-sm font-medium text-gray-700">
                    Disponível
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setFormAberto(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <FiCheck className="text-lg" />
                  {formAberto === 'novo' ? 'Cadastrar' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          {erro && !formAberto && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
              <p className="font-bold">Erro</p>
              <p>{erro}</p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {carregando ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : veiculos.length === 0 ? (
              <div className="text-center p-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">Nenhum veículo cadastrado</h3>
                <p className="mt-1 text-gray-500">Clique em "Novo Veículo" para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { nome: 'Placa', coluna: 'placa' as keyof Veiculo },
                        { nome: 'Modelo', coluna: 'modelo' as keyof Veiculo },
                        { nome: 'Checklist', coluna: '' },
                        { nome: 'Disponível', coluna: 'disponivel' as keyof Veiculo },
                        { nome: 'Link de acesso', coluna: '' },
                        { nome: 'Ações', coluna: '' },
                      ].map((col) => (
                        <th
                          key={col.coluna || col.nome}
                          onClick={() => col.coluna && handleOrdenar(col.coluna as keyof Veiculo)}
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                            col.coluna ? 'cursor-pointer hover:bg-gray-100' : ''
                          }`}
                        >
                          <div className="flex items-center">
                            {col.nome}
                            {ordenacao.coluna === col.coluna && (
                              <span className="ml-1">
                                {ordenacao.direcao === 'asc' ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {veiculos.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {v.placa}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {v.modelo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {obterNomeChecklist(v.checklistId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            v.disponivel ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {v.disponivel ? 'Disponível' : 'Indisponível'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => v.id && handleCopiarLink(v.id)}
                              className="inline-flex items-center gap-2 text-green-700 hover:text-green-900 font-medium"
                              title="Copiar link de acesso do motorista"
                            >
                              <FiCopy size={16} />
                              Copiar link
                            </button>
                            <span className="text-xs text-gray-500">Link público para confirmar ou cancelar</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-3">
                            <button
                              onClick={() => abrirRespostasChecklist(v)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Verificar respostas do checklist"
                            >
                              <FiEye size={18} />
                            </button>
                            <button
                              onClick={() => handleEditar(v)}
                              className="text-green-600 hover:text-green-900"
                              title="Editar"
                            >
                              <FiEdit2 size={18} />
                            </button>
                            {v.id && (
                              <button
                                onClick={() => handleExcluir(v.id ?? '', v.modelo)}
                                className="text-red-600 hover:text-red-900"
                                title="Excluir"
                              >
                                <FiTrash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {veiculoEmAnalise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500">Respostas do checklist</p>
                <h2 className="text-2xl font-semibold text-gray-900">{veiculoEmAnalise.modelo}</h2>
                <p className="text-sm text-gray-600">Placa {veiculoEmAnalise.placa}</p>
              </div>
              <button
                onClick={fecharModalRespostas}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Fechar respostas do checklist"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {erroRespostas && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{erroRespostas}</div>
              )}

              {carregandoRespostas ? (
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  <span>Carregando respostas...</span>
                </div>
              ) : respostasChecklist.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhum checklist foi preenchido para este veículo.</p>
              ) : (
                <div className="space-y-4">
                  {respostasChecklist.map((resposta) => (
                    <div key={resposta.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Respondido em {formatarDataHora(resposta.respondidoEm)}</p>
                          <p className="font-semibold text-gray-900">
                            {resposta.respondidoPorNome || 'Motorista não informado'} — Matrícula{' '}
                            {resposta.respondidoPorMatricula || 'N/D'}
                          </p>
                          <p className="text-xs text-gray-500">Agendamento #{resposta.agendamentoId}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            resposta.saidaConfirmada ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {resposta.saidaConfirmada ? 'Saída confirmada' : 'Aguardando confirmação'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {resposta.respostas.map((pergunta) => (
                          <div key={`${resposta.id}-${pergunta.perguntaId}`} className="bg-gray-50 rounded-lg p-3 space-y-1">
                            <p className="text-sm font-semibold text-gray-800">{pergunta.perguntaTexto}</p>
                            <p className="text-sm text-gray-700">Resposta: {pergunta.valor}</p>
                            {pergunta.observacao && (
                              <p className="text-xs text-gray-600">Observação: {pergunta.observacao}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {!resposta.saidaConfirmada && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => confirmarSaidaChecklist(resposta)}
                            disabled={confirmandoSaida === resposta.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700 transition disabled:opacity-60"
                          >
                            {confirmandoSaida === resposta.id ? 'Confirmando...' : 'Confirmar saída'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
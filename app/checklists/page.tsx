'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChecklistModelo,
  ChecklistQuestion,
  atualizarChecklist,
  criarChecklist,
  listarChecklists,
  removerChecklist,
} from '@/app/lib/checklists';
import ProtectedRoute from '../components/ProtectedRoute';
import SidebarMenu from '../components/SidebarMenu';
import { FiArrowDown, FiArrowUp, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';

type ChecklistFormState = Omit<ChecklistModelo, 'id' | 'atualizadoEm'> & { id?: string };

const criarPerguntaVazia = (): ChecklistQuestion => ({
  id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  texto: '',
  obrigatorio: false,
  tipoResposta: 'texto',
  permiteObservacao: false,
});

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistModelo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [checklistSelecionado, setChecklistSelecionado] = useState<ChecklistFormState | null>(null);

  const checklistVazio: ChecklistFormState = useMemo(
    () => ({
      nome: '',
      descricao: '',
      perguntas: [criarPerguntaVazia()],
    }),
    [],
  );

  const carregarChecklists = async () => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarChecklists();
      setChecklists(lista);
    } catch (error) {
      console.error('Erro ao carregar checklists', error);
      setErro('Não foi possível carregar os checklists. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarChecklists();
  }, []);

  const iniciarCriacao = () => {
    setChecklistSelecionado(checklistVazio);
  };

  const editarChecklist = (checklist: ChecklistModelo) => {
    setChecklistSelecionado({
      id: checklist.id,
      nome: checklist.nome,
      descricao: checklist.descricao ?? '',
      perguntas: checklist.perguntas.length > 0 ? checklist.perguntas : [criarPerguntaVazia()],
    });
  };

  const atualizarCampo = (campo: keyof ChecklistFormState, valor: string) => {
    setChecklistSelecionado((anterior) => (anterior ? { ...anterior, [campo]: valor } : anterior));
  };

  const atualizarPergunta = (id: string, campo: keyof ChecklistQuestion, valor: string | boolean) => {
    setChecklistSelecionado((anterior) => {
      if (!anterior) return anterior;
      return {
        ...anterior,
        perguntas: anterior.perguntas.map((pergunta) =>
          pergunta.id === id ? { ...pergunta, [campo]: valor } : pergunta,
        ),
      };
    });
  };

  const moverPergunta = (id: string, direcao: 'up' | 'down') => {
    setChecklistSelecionado((anterior) => {
      if (!anterior) return anterior;
      const indice = anterior.perguntas.findIndex((p) => p.id === id);
      if (indice === -1) return anterior;

      const novaPosicao = direcao === 'up' ? indice - 1 : indice + 1;
      if (novaPosicao < 0 || novaPosicao >= anterior.perguntas.length) return anterior;

      const perguntas = [...anterior.perguntas];
      const [selecionada] = perguntas.splice(indice, 1);
      perguntas.splice(novaPosicao, 0, selecionada);

      return { ...anterior, perguntas };
    });
  };

  const adicionarPergunta = () => {
    setChecklistSelecionado((anterior) =>
      anterior
        ? {
            ...anterior,
            perguntas: [...anterior.perguntas, criarPerguntaVazia()],
          }
        : anterior,
    );
  };

  const removerPergunta = (id: string) => {
    setChecklistSelecionado((anterior) => {
      if (!anterior) return anterior;
      const filtradas = anterior.perguntas.filter((p) => p.id !== id);
      return { ...anterior, perguntas: filtradas.length > 0 ? filtradas : [criarPerguntaVazia()] };
    });
  };

  const validarFormulario = (dados: ChecklistFormState): string => {
    if (!dados.nome.trim()) return 'Informe um nome para o checklist.';
    if (dados.perguntas.some((p) => !p.texto.trim())) return 'Todas as perguntas devem ter um enunciado.';
    return '';
  };

  const salvarChecklist = async () => {
    if (!checklistSelecionado) return;
    const mensagemErro = validarFormulario(checklistSelecionado);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setErro('');
    try {
      if (checklistSelecionado.id) {
        await atualizarChecklist(checklistSelecionado.id, {
          nome: checklistSelecionado.nome,
          descricao: checklistSelecionado.descricao,
          perguntas: checklistSelecionado.perguntas,
        });
      } else {
        await criarChecklist({
          nome: checklistSelecionado.nome,
          descricao: checklistSelecionado.descricao,
          perguntas: checklistSelecionado.perguntas,
        });
      }
      setChecklistSelecionado(null);
      await carregarChecklists();
    } catch (error) {
      console.error('Erro ao salvar checklist', error);
      setErro('Não foi possível salvar o checklist. Confira os dados e tente novamente.');
    }
  };

  const excluirChecklist = async (checklist: ChecklistModelo) => {
    if (!confirm(`Deseja remover o checklist "${checklist.nome}"?`)) return;
    try {
      await removerChecklist(checklist.id);
      if (checklistSelecionado?.id === checklist.id) setChecklistSelecionado(null);
      await carregarChecklists();
    } catch (error) {
      console.error('Erro ao remover checklist', error);
      setErro('Não foi possível remover o checklist. Tente novamente.');
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
        <SidebarMenu className="md:min-h-screen" />

        <main className="flex-1 p-6 space-y-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Modelos de Checklist</h1>
              <p className="text-gray-600">Cadastre e organize perguntas para aplicar aos veículos.</p>
            </div>
            <button
              onClick={iniciarCriacao}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white shadow hover:bg-green-700"
            >
              <FiPlus /> Novo checklist
            </button>
          </header>

          {erro && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{erro}</div>}

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="rounded-lg bg-white shadow border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-800">Checklists cadastrados</h2>
                  {carregando && <span className="text-sm text-gray-500">Carregando...</span>}
                </div>
                {checklists.length === 0 && !carregando ? (
                  <p className="text-gray-600">Nenhum checklist cadastrado até o momento.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {checklists.map((checklist) => (
                      <li key={checklist.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{checklist.nome}</p>
                          <p className="text-xs text-gray-500">
                            {checklist.perguntas.length} pergunta{checklist.perguntas.length === 1 ? '' : 's'} • Atualizado em{' '}
                            {checklist.atualizadoEm
                              ? new Date(checklist.atualizadoEm).toLocaleString('pt-BR')
                              : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <button
                            onClick={() => editarChecklist(checklist)}
                            className="inline-flex items-center gap-1 text-green-700 hover:text-green-900"
                          >
                            <FiEdit2 /> Editar
                          </button>
                          <button
                            onClick={() => excluirChecklist(checklist)}
                            className="inline-flex items-center gap-1 text-red-700 hover:text-red-900"
                          >
                            <FiTrash2 /> Remover
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <div className="rounded-lg bg-white shadow border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {checklistSelecionado?.id ? 'Editar checklist' : 'Novo checklist'}
                  </h2>
                  {checklistSelecionado && (
                    <button
                      onClick={() => setChecklistSelecionado(null)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                {!checklistSelecionado ? (
                  <p className="text-gray-600">Selecione um checklist existente ou clique em "Novo checklist".</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nome</label>
                      <input
                        value={checklistSelecionado.nome}
                        onChange={(e) => atualizarCampo('nome', e.target.value)}
                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        placeholder="Checklist de entrega"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Descrição</label>
                      <textarea
                        value={checklistSelecionado.descricao}
                        onChange={(e) => atualizarCampo('descricao', e.target.value)}
                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        placeholder="Orientações gerais ou observações"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Perguntas</label>
                        <button
                          onClick={adicionarPergunta}
                          className="inline-flex items-center gap-1 text-green-700 hover:text-green-900 text-sm"
                        >
                          <FiPlus /> Adicionar pergunta
                        </button>
                      </div>

                      <div className="space-y-3">
                        {checklistSelecionado.perguntas.map((pergunta, index) => (
                          <div key={pergunta.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>Pergunta {index + 1}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => moverPergunta(pergunta.id, 'up')}
                                  className="p-1 rounded hover:bg-gray-200"
                                  disabled={index === 0}
                                  title="Mover para cima"
                                >
                                  <FiArrowUp />
                                </button>
                                <button
                                  onClick={() => moverPergunta(pergunta.id, 'down')}
                                  className="p-1 rounded hover:bg-gray-200"
                                  disabled={index === checklistSelecionado.perguntas.length - 1}
                                  title="Mover para baixo"
                                >
                                  <FiArrowDown />
                                </button>
                              </div>
                            </div>

                            <input
                              value={pergunta.texto}
                              onChange={(e) => atualizarPergunta(pergunta.id, 'texto', e.target.value)}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                              placeholder="Descreva a pergunta"
                            />

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Tipo de resposta</label>
                                <select
                                  value={pergunta.tipoResposta}
                                  onChange={(e) =>
                                    atualizarPergunta(
                                      pergunta.id,
                                      'tipoResposta',
                                      e.target.value as ChecklistQuestion['tipoResposta'],
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                >
                                  <option value="texto">Resposta curta</option>
                                  <option value="numero">Número</option>
                                  <option value="status">Menu de conformidade (C / NC / NA)</option>
                                </select>
                              </div>

                              <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                                <span>Permitir observação</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(pergunta.permiteObservacao)}
                                  onChange={(e) =>
                                    atualizarPergunta(pergunta.id, 'permiteObservacao', e.target.checked)
                                  }
                                  className="rounded text-green-600 focus:ring-green-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <label className="inline-flex items-center gap-2 text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={pergunta.obrigatorio}
                                  onChange={(e) => atualizarPergunta(pergunta.id, 'obrigatorio', e.target.checked)}
                                  className="rounded text-green-600 focus:ring-green-500"
                                />
                                Obrigatória
                              </label>
                              <button
                                onClick={() => removerPergunta(pergunta.id)}
                                className="inline-flex items-center gap-1 text-red-700 hover:text-red-900"
                              >
                                <FiTrash2 /> Remover
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setChecklistSelecionado(null)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={salvarChecklist}
                        className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 shadow"
                      >
                        Salvar checklist
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

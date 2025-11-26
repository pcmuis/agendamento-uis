import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { getDb } from './firebase';

export interface RespostaPerguntaChecklist {
  perguntaId: string;
  perguntaTexto: string;
  tipoResposta: 'texto' | 'numero' | 'status';
  valor: string;
  observacao?: string;
}

export interface ChecklistResposta {
  id: string;
  veiculoId: string;
  agendamentoId: string;
  checklistId: string;
  respondidoPorNome?: string;
  respondidoPorMatricula?: string;
  respondidoEm: string;
  saidaConfirmada?: boolean;
  respostas: RespostaPerguntaChecklist[];
}

const getChecklistsRespostasCollection = () => collection(getDb(), 'checklistRespostas');

export async function salvarRespostaChecklist(
  dados: Omit<ChecklistResposta, 'id' | 'saidaConfirmada'> & { saidaConfirmada?: boolean },
): Promise<string> {
  const docRef = await addDoc(getChecklistsRespostasCollection(), {
    ...dados,
    saidaConfirmada: dados.saidaConfirmada ?? false,
  });

  return docRef.id;
}

export async function buscarRespostaMaisRecentePorAgendamento(
  agendamentoId: string,
): Promise<ChecklistResposta | null> {
  if (!agendamentoId) return null;

  const filtro = query(getChecklistsRespostasCollection(), where('agendamentoId', '==', agendamentoId));
  const snapshot = await getDocs(filtro);
  if (snapshot.empty) return null;

  const respostas = snapshot.docs.map((registro) => {
    const data = registro.data();
    return {
      id: registro.id,
      veiculoId: data.veiculoId,
      agendamentoId: data.agendamentoId,
      checklistId: data.checklistId,
      respondidoPorNome: data.respondidoPorNome,
      respondidoPorMatricula: data.respondidoPorMatricula,
      respondidoEm: data.respondidoEm,
      saidaConfirmada: data.saidaConfirmada ?? false,
      respostas: Array.isArray(data.respostas)
        ? data.respostas.map((resposta: any) => ({
            perguntaId: resposta.perguntaId ?? '',
            perguntaTexto: resposta.perguntaTexto ?? '',
            tipoResposta: resposta.tipoResposta ?? 'texto',
            valor: resposta.valor ?? '',
            observacao: resposta.observacao ?? '',
          }))
        : [],
    } as ChecklistResposta;
  });

  return respostas.sort((a, b) => new Date(b.respondidoEm).getTime() - new Date(a.respondidoEm).getTime())[0] || null;
}

export async function listarRespostasPorVeiculo(veiculoId: string): Promise<ChecklistResposta[]> {
  if (!veiculoId) return [];

  const filtro = query(getChecklistsRespostasCollection(), where('veiculoId', '==', veiculoId));
  const snapshot = await getDocs(filtro);

  const respostas = snapshot.docs.map((registro) => {
    const data = registro.data();
    return {
      id: registro.id,
      veiculoId: data.veiculoId,
      agendamentoId: data.agendamentoId,
      checklistId: data.checklistId,
      respondidoPorNome: data.respondidoPorNome,
      respondidoPorMatricula: data.respondidoPorMatricula,
      respondidoEm: data.respondidoEm,
      saidaConfirmada: data.saidaConfirmada ?? false,
      respostas: Array.isArray(data.respostas)
        ? data.respostas.map((resposta: any) => ({
            perguntaId: resposta.perguntaId ?? '',
            perguntaTexto: resposta.perguntaTexto ?? '',
            tipoResposta: resposta.tipoResposta ?? 'texto',
            valor: resposta.valor ?? '',
            observacao: resposta.observacao ?? '',
          }))
        : [],
    } as ChecklistResposta;
  });

  return respostas.sort((a, b) => new Date(b.respondidoEm).getTime() - new Date(a.respondidoEm).getTime());
}

export async function marcarSaidaConfirmada(respostaId: string): Promise<void> {
  if (!respostaId) return;
  const docRef = doc(getDb(), 'checklistRespostas', respostaId);
  await updateDoc(docRef, { saidaConfirmada: true });
}

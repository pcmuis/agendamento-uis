import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { getDb } from './firebase';

export interface ChecklistQuestion {
  id: string;
  texto: string;
  obrigatorio: boolean;
  tipoResposta: 'texto' | 'numero' | 'status';
  permiteObservacao?: boolean;
}

export interface ChecklistModelo {
  id: string;
  nome: string;
  descricao?: string;
  perguntas: ChecklistQuestion[];
  atualizadoEm: string;
}

const getChecklistsCollection = () => collection(getDb(), 'checklists');

export async function listarChecklists(): Promise<ChecklistModelo[]> {
  const snapshot = await getDocs(getChecklistsCollection());

  return snapshot.docs.map((registro) => {
    const data = registro.data();

    return {
      id: registro.id,
      nome: data.nome ?? 'Checklist sem nome',
      descricao: data.descricao ?? '',
      perguntas: Array.isArray(data.perguntas)
        ? data.perguntas.map((pergunta: any, index: number) => ({
            id: pergunta.id ?? String(index),
            texto: pergunta.texto ?? '',
            obrigatorio: pergunta.obrigatorio ?? false,
            tipoResposta: pergunta.tipoResposta ?? 'texto',
            permiteObservacao: pergunta.permiteObservacao ?? false,
          }))
        : [],
      atualizadoEm: data.atualizadoEm ?? '',
    };
  });
}

export async function criarChecklist(
  dados: Omit<ChecklistModelo, 'id' | 'atualizadoEm'>,
): Promise<string> {
  const docRef = await addDoc(getChecklistsCollection(), {
    ...dados,
    atualizadoEm: new Date().toISOString(),
  });

  return docRef.id;
}

export async function atualizarChecklist(
  id: string,
  dados: Partial<Omit<ChecklistModelo, 'id'>>,
): Promise<void> {
  const docRef = doc(getDb(), 'checklists', id);
  await updateDoc(docRef, {
    ...dados,
    atualizadoEm: new Date().toISOString(),
  });
}

export async function removerChecklist(id: string): Promise<void> {
  const docRef = doc(getDb(), 'checklists', id);
  await deleteDoc(docRef);
}

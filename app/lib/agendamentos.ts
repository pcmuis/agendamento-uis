import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { getDb } from '@/app/lib/firebase';

export interface Agendamento {
  id: string;
  saida: string;
  chegada: string;
  veiculoId: string;
  motorista: string;
  matricula: string;
  telefone: string;
  destino: string;
  observacoes: string;
  concluido: boolean;
  codigo?: string; // Número do comprovante
  nomeAgendador?: string; // Novo campo para responsável pelo agendamento
}

const getAgendamentosCollection = () => collection(getDb(), 'agendamentos');

export async function criarAgendamento(dados: any) {
  const dadosParaSalvar = { ...dados };
  if (!dadosParaSalvar.nomeAgendador) {
    delete dadosParaSalvar.nomeAgendador;
  }
  await addDoc(getAgendamentosCollection(), dadosParaSalvar);
}

export async function listarAgendamentos(): Promise<Agendamento[]> {
  try {
    const snapshot = await getDocs(getAgendamentosCollection());
    return snapshot.docs.map((registro) => ({
      id: registro.id,
      ...registro.data(),
    })) as Agendamento[];
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    throw new Error('Falha ao buscar agendamentos no Firebase');
  }
}

export async function buscarAgendamentosPorVeiculoEMatricula(
  veiculoId: string,
  matricula: string,
): Promise<Agendamento[]> {
  const matriculaNormalizada = matricula.trim();

  if (!veiculoId || !matriculaNormalizada) {
    return [];
  }

  const filtro = query(
    getAgendamentosCollection(),
    where('veiculoId', '==', veiculoId),
    where('matricula', '==', matriculaNormalizada),
    where('concluido', '==', false),
  );

  const snapshot = await getDocs(filtro);

  return snapshot.docs.map((registro) => ({
    id: registro.id,
    ...registro.data(),
  })) as Agendamento[];
}

export async function atualizarAgendamento(id: string, dados: any) {
  const docRef = doc(getDb(), 'agendamentos', id);
  const dadosLimpos: Record<string, unknown> = {};
  Object.keys(dados).forEach((key) => {
    if (dados[key] !== undefined) {
      dadosLimpos[key] = dados[key];
    }
  });
  await updateDoc(docRef, dadosLimpos as Partial<Agendamento>);
}

export async function excluirAgendamento(id: string) {
  const docRef = doc(getDb(), 'agendamentos', id);
  await deleteDoc(docRef);
}

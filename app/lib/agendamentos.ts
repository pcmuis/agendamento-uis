import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

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

const colecao = collection(db, "agendamentos");

export async function criarAgendamento(dados: any) {
  // Só inclui nomeAgendador se estiver definido e não vazio
  const dadosParaSalvar = { ...dados };
  if (!dadosParaSalvar.nomeAgendador) {
    delete dadosParaSalvar.nomeAgendador;
  }
  await addDoc(colecao, dadosParaSalvar);
}

export async function listarAgendamentos(): Promise<Agendamento[]> {
  try {
    const snapshot = await getDocs(colecao);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Agendamento[];
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    throw new Error("Falha ao buscar agendamentos no Firebase");
  }
}

export async function atualizarAgendamento(id: string, dados: any) {
  const docRef = doc(db, "agendamentos", id);
  // Remove campos undefined para evitar erro do Firebase
  const dadosLimpos: any = {};
  Object.keys(dados).forEach((key) => {
    if (dados[key] !== undefined) {
      dadosLimpos[key] = dados[key];
    }
  });
  await updateDoc(docRef, dadosLimpos);
}

export async function excluirAgendamento(id: string) {
  const docRef = doc(db, "agendamentos", id);
  await deleteDoc(docRef);
}
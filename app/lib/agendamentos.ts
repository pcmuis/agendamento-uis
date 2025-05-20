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
}

const colecao = collection(db, "agendamentos");

export async function criarAgendamento(dados: any) {
  await addDoc(colecao, dados);
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
  await updateDoc(docRef, dados);
}

export async function excluirAgendamento(id: string) {
  const docRef = doc(db, "agendamentos", id);
  await deleteDoc(docRef);
}
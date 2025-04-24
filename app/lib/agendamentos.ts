import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

const colecao = collection(db, "agendamentos");

export async function criarAgendamento(dados: any) {
  await addDoc(colecao, dados);
}

export async function listarAgendamentos() {
  const snapshot = await getDocs(colecao);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function atualizarAgendamento(id: string, dados: any) {
  const docRef = doc(db, "agendamentos", id);
  await updateDoc(docRef, dados);
}

export async function excluirAgendamento(id: string) {
  const docRef = doc(db, "agendamentos", id);
  await deleteDoc(docRef);
}
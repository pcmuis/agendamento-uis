import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Veiculo {
  status: any;
  id: string;
  placa: string;
  modelo: string;
  disponivel: boolean;
}

export interface Agendamento {
  id: string;
  veiculoId: string;
  destino: string;
  saida: string;
  chegada: string;
  motorista?: string;
  matricula?: string;
  telefone?: string;
  observacoes?: string;
  concluido?: boolean;
}

const colVeiculos = collection(db, 'veiculos');
const colAgendamentos = collection(db, 'agendamentos');

export async function listarVeiculos(): Promise<Veiculo[]> {
  try {
    const snapshot = await getDocs(colVeiculos);
    const veiculos = snapshot.docs
      .map((doc) => {
        if (!doc.exists()) {
          console.warn('Documento não encontrado');
          return null;
        }
        const data = doc.data();
        return {
          id: doc.id,
          placa: data.placa || '',
          modelo: data.modelo || '',
          disponivel: data.disponivel !== false,
        } as Veiculo;
      })
      .filter((v): v is Veiculo => v !== null);

    return veiculos;
  } catch (error) {
    console.error('Erro ao listar veículos:', error);
    throw new Error('Falha ao carregar veículos');
  }
}

export async function listarAgendamentos(): Promise<Agendamento[]> {
  try {
    const snapshot = await getDocs(colAgendamentos);
    const agendamentos = snapshot.docs
      .map((doc) => {
        if (!doc.exists()) {
          console.warn('Documento de agendamento não encontrado');
          return null;
        }
        const data = doc.data();
        return {
          id: doc.id,
          veiculoId: data.veiculoId || '',
          destino: data.destino || '',
          saida: data.saida || '',
          chegada: data.chegada || '',
          motorista: data.motorista || '',
          matricula: data.matricula || '',
          telefone: data.telefone || '',
          observacoes: data.observacoes || '',
          concluido: data.concluido || false,
        } as Agendamento;
      })
      .filter((a): a is Agendamento => a !== null);

    return agendamentos;
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    throw new Error('Falha ao carregar agendamentos');
  }
}

export async function criarVeiculo(dados: Omit<Veiculo, 'id'>): Promise<string> {
  try {
    if (!dados.placa || !dados.modelo) {
      throw new Error('Placa e modelo são obrigatórios');
    }

    const docRef = await addDoc(colVeiculos, {
      placa: dados.placa.toUpperCase(),
      modelo: dados.modelo,
      disponivel: dados.disponivel !== false,
    });

    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar veículo:', error);
    throw error;
  }
}

export async function removerVeiculo(id: string): Promise<void> {
  try {
    if (!id) {
      throw new Error('ID do veículo é obrigatório');
    }

    const ref = doc(db, 'veiculos', id);
    await deleteDoc(ref);
  } catch (error) {
    console.error(`Erro ao remover veículo ${id}:`, error);
    throw error;
  }
}

export async function atualizarVeiculo(id: string, dados: Partial<Veiculo>): Promise<void> {
  try {
    const docRef = doc(db, 'veiculos', id);
    await updateDoc(docRef, dados);
  } catch (error) {
    console.error(`Erro ao atualizar veículo ${id}:`, error);
    throw error;
  }
}

export async function listarVeiculosComStatus(dataSaida: string): Promise<(Veiculo & {
  status: { disponivel: boolean; indisponivelAte?: string };
})[]> {
  try {
    const [veiculos, agendamentos] = await Promise.all([
      listarVeiculos(),
      listarAgendamentos(),
    ]);

    return veiculos.map((veiculo) => {
      const agendamentoAtivo = agendamentos.find(
        (ag) =>
          ag.veiculoId === veiculo.id &&
          new Date(dataSaida) >= new Date(ag.saida) &&
          new Date(dataSaida) <= new Date(ag.chegada) &&
          !ag.concluido
      );

      return {
        ...veiculo,
        status: agendamentoAtivo
          ? {
              disponivel: false,
              indisponivelAte: agendamentoAtivo.chegada,
            }
          : {
              disponivel: true,
            },
      };
    });
  } catch (error) {
    console.error('Erro ao listar veículos com status:', error);
    throw error;
  }
}
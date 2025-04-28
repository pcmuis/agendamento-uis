import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

// Definindo o tipo Veiculo para ser usado em todas as funções
export interface Veiculo {
  id?: string;
  placa: string;
  modelo: string;
  disponivel: boolean;
  retorno?: string; // Add this property if needed
}

type Agendamento = {
  id: string;
  veiculoId: string;
  saida: string;
  chegada: string;
};

const colVeiculos = collection(db, 'veiculos');
const colAgendamentos = collection(db, 'agendamentos');

export async function listarVeiculos(): Promise<Veiculo[]> {
  try {
    const snapshot = await getDocs(colVeiculos);
    const veiculos = snapshot.docs.map((doc) => {
      if (!doc.exists()) {
        console.warn('Documento não encontrado');
        return null;
      }
      
      const data = doc.data();
      const veiculo: Veiculo = {
        id: doc.id,
        placa: data.placa || '',
        modelo: data.modelo || '',
        disponivel: data.disponivel !== false, // default true
      };

      if (!doc.id) {
        console.error('Documento sem ID encontrado:', data);
        throw new Error('Documento sem ID');
      }

      return veiculo;
    }).filter((v): v is Veiculo => v !== null);

    console.log('Veículos retornados:', veiculos);
    return veiculos;
  } catch (error) {
    console.error('Erro ao listar veículos:', error);
    throw new Error('Falha ao carregar veículos');
  }
}

export async function criarVeiculo(dados: Omit<Veiculo, 'id'>): Promise<string> {
  try {
    // Validação básica dos dados
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

export async function atualizarVeiculo(id: string, dados: Partial<Veiculo>) {
    const docRef = doc(db, 'veiculos', id);
    await updateDoc(docRef, dados);
}

export async function listarVeiculosComStatus(dataSaida: string): Promise<(Veiculo & {
  status: { disponivel: boolean; indisponivelAte?: string };
})[]> {
  try {
    const [veiculos, agendamentosSnap] = await Promise.all([
      listarVeiculos(),
      getDocs(colAgendamentos),
    ]);

    const agendamentos: Agendamento[] = agendamentosSnap.docs.map((doc) => ({
      id: doc.id,
      veiculoId: doc.data().veiculoId,
      saida: doc.data().saida,
      chegada: doc.data().chegada,
    }));

    return veiculos.map((veiculo) => {
      const agendamentoAtivo = agendamentos.find((ag) => (
        ag.veiculoId === veiculo.id &&
        new Date(dataSaida) >= new Date(ag.saida) &&
        new Date(dataSaida) <= new Date(ag.chegada)
      ));

      return {
        ...veiculo,
        status: agendamentoAtivo ? {
          disponivel: false,
          indisponivelAte: agendamentoAtivo.chegada,
        } : {
          disponivel: true,
        },
      };
    });
  } catch (error) {
    console.error('Erro ao listar veículos com status:', error);
    throw error;
  }
}
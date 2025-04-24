// types.ts
export type Usuario = {
  id: string;
  nome: string;
  setor: string;
};

export type Veiculo = {
  id: string;
  placa: string;
  modelo: string;
  disponivel: boolean;
};

export type Agendamento = {
  id: string;
  usuarioId: string;
  veiculoId: string;
  dataInicio: string; // ISO format
  dataFim: string;
};

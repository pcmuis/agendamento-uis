import { AgendamentoVeiculoClient } from './AgendamentoVeiculoClient';

interface PageProps {
  params: Promise<{ veiculoId: string }>;
}

export default async function AcessoAgendamentoVeiculoPage({ params }: PageProps) {
  const { veiculoId } = await params;

  return <AgendamentoVeiculoClient veiculoId={veiculoId} />;
}

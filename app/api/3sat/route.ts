import { NextResponse } from 'next/server';

type ProxyRequestBody = {
  endpoint?: string;
  payload?: Record<string, unknown>;
  token?: string;
};

const API_BASE_URL = 'https://api.3sat.com.br/api/';
const ALLOWED_ENDPOINTS = new Set(['position/last', 'position/period']);

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/^\/+/, '');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProxyRequestBody;
    const endpoint = body.endpoint ? normalizeEndpoint(body.endpoint) : '';
    const token = body.token?.trim();

    if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
      return NextResponse.json(
        { error: 'Endpoint não permitido para o proxy 3SAT.' },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Credencial da 3SAT é obrigatória.' },
        { status: 400 }
      );
    }

    const payload =
      body.payload && typeof body.payload === 'object' ? body.payload : {};

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, Token: token }),
    });

    const rawText = await response.text();
    let data: unknown = rawText;

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        console.warn('Resposta da 3SAT não era JSON válido.', error);
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Falha ao consultar a API da 3SAT.',
          details: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Erro no proxy 3SAT:', error);
    return NextResponse.json(
      { error: 'Erro interno ao consultar a API da 3SAT.' },
      { status: 500 }
    );
  }
}

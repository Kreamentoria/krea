import axios from 'axios';
import {
  ApiResponse,
  CurrentRates,
  InstrumentoRendaFixa,
  RateRecord,
  SimulacaoInput,
  SimulacaoResult,
  TaxasMercado,
} from './types';

const client = axios.create({ baseURL: '/api' });

export async function fetchCurrentRates(): Promise<CurrentRates> {
  const { data } = await client.get<ApiResponse<CurrentRates>>('/rates');
  if (!data.success) throw new Error(data.error ?? 'Failed to fetch rates');
  return data.data;
}

export async function fetchHistory(): Promise<RateRecord[]> {
  const { data } = await client.get<ApiResponse<RateRecord[]>>('/history');
  if (!data.success) throw new Error(data.error ?? 'Failed to fetch history');
  return data.data;
}

export async function refreshRates(): Promise<CurrentRates> {
  const { data } = await client.post<ApiResponse<CurrentRates>>('/rates/refresh');
  if (!data.success) throw new Error(data.error ?? 'Failed to refresh rates');
  return data.data;
}

export async function fetchInstrumentos(params?: {
  tipo?: string;
  moeda?: string;
  prazoMin?: number;
  prazoMax?: number;
}): Promise<InstrumentoRendaFixa[]> {
  const { data } = await client.get<ApiResponse<InstrumentoRendaFixa[]>>('/instrumentos', {
    params,
  });
  if (!data.success) throw new Error(data.error ?? 'Failed to fetch instrumentos');
  return data.data;
}

export async function fetchTaxasMercado(): Promise<TaxasMercado> {
  const { data } = await client.get<ApiResponse<TaxasMercado>>('/taxas-mercado');
  if (!data.success) throw new Error(data.error ?? 'Failed to fetch taxas');
  return data.data;
}

export async function simular(input: SimulacaoInput): Promise<SimulacaoResult> {
  const { data } = await client.post<ApiResponse<SimulacaoResult>>('/simular', input);
  if (!data.success) throw new Error(data.error ?? 'Erro na simulação');
  return data.data;
}

export async function comparar(payload: {
  instrumentoIds: string[];
  valorInicial: number;
  prazo: number;
}): Promise<SimulacaoResult[]> {
  const { data } = await client.post<ApiResponse<SimulacaoResult[]>>('/comparar', payload);
  if (!data.success) throw new Error(data.error ?? 'Erro na comparação');
  return data.data;
}

export interface InstrumentoRendaFixa {
  id: string;
  nome: string;
  tipo: 'plazo_fijo' | 'lebad' | 'lecap' | 'bono_CER' | 'bono_dolar_linked' | 'fci';
  moeda: 'ARS' | 'USD' | 'UVA';
  taxaAnual: number;
  taxaEfetiva?: number;
  prazoMinimo: number;
  prazoMaximo?: number;
  monteMinimoARS?: number;
  banco?: string;
  atualizadoEm: Date;
  fonte: string;
}

export interface SimulacaoInput {
  instrumentoId: string;
  valorInicial: number;
  prazo: number;
  reinvestirJuros: boolean;
}

export interface SimulacaoResult {
  instrumento: InstrumentoRendaFixa;
  valorInicial: number;
  valorFinal: number;
  rendimentoBruto: number;
  rendimentoLiquido: number;
  impostoRetido: number;
  inflacaoEstimada?: number;
  rendimentoRealEstimado?: number;
  evolucaoMensal: Array<{ mes: number; valor: number }>;
  comparativoUSD?: number;
}

export interface TaxasMercado {
  inflacaoMensalUltima: number;
  inflacaoAnualAcumulada: number;
  tipoCambioOficial: number;
  tipoCambioBlue: number;
  tipoCambioCCL: number;
  tasaPoliticaMonetaria: number;
  atualizadoEm: Date;
}

export interface RateRecord {
  date: string;
  leliq: number | null;
  plazoFijo: number | null;
  badlar: number | null;
  inflacion: number | null;
}

export interface CurrentRates {
  leliq: number | null;
  plazoFijo: number | null;
  badlar: number | null;
  inflacion: number | null;
  lastUpdated: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

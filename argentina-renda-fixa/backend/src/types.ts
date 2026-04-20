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

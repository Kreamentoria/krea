import axios from 'axios';
import * as cheerio from 'cheerio';
import { InstrumentoRendaFixa, TaxasMercado } from '../types';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data;
}

function cacheSet<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function invalidarCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const http = axios.create({
  timeout: 12_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ArgentinaRendaFixa/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/json',
  },
});

// ---------------------------------------------------------------------------
// Fallback values (realistic for April 2025)
// ---------------------------------------------------------------------------

const FALLBACK_TASA_POLITICA = 29.0;   // % TNA — tasa de política monetaria BCRA
const FALLBACK_OFICIAL = 1085.0;
const FALLBACK_BLUE = 1280.0;
const FALLBACK_CCL = 1310.0;
const FALLBACK_INFLACAO_MENSAL = 4.0;  // %

// ---------------------------------------------------------------------------
// 1. buscarTaxasPlazoFijo — tasa de política monetaria via BCRA HTML
// ---------------------------------------------------------------------------

export async function buscarTaxasPlazoFijo(): Promise<number> {
  const KEY = 'bcra:tasaPolitica';
  const cached = cacheGet<number>(KEY);
  if (cached !== null) return cached;

  try {
    const { data: html } = await http.get<string>(
      'https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp'
    );
    const $ = cheerio.load(html);

    // The BCRA page renders a table where each row has a "variable" label and
    // a value. We look for the row whose text contains "Tasa de política
    // monetaria" and grab the adjacent value cell.
    let tasa: number | null = null;

    $('table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      const label = $(cells[0]).text().toLowerCase();
      if (label.includes('pol') && label.includes('monetaria')) {
        const raw = $(cells[cells.length - 1])
          .text()
          .trim()
          .replace(',', '.');
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) tasa = parsed;
      }
    });

    const result = tasa ?? FALLBACK_TASA_POLITICA;
    cacheSet(KEY, result);
    return result;
  } catch (err) {
    console.warn('[taxasService] buscarTaxasPlazoFijo fallback:', (err as Error).message);
    return FALLBACK_TASA_POLITICA;
  }
}

// ---------------------------------------------------------------------------
// 2. buscarTipoCambio — Bluelytics public API
// ---------------------------------------------------------------------------

interface BluelyticsResponse {
  oficial: { value_avg: number };
  blue: { value_avg: number };
  blue_euro?: { value_avg: number };
}

export interface TipoCambio {
  oficial: number;
  blue: number;
  ccl: number;
}

export async function buscarTipoCambio(): Promise<TipoCambio> {
  const KEY = 'bluelytics:cambio';
  const cached = cacheGet<TipoCambio>(KEY);
  if (cached !== null) return cached;

  try {
    const { data } = await http.get<BluelyticsResponse>(
      'https://api.bluelytics.com.ar/v2/latest'
    );

    // CCL is not directly in Bluelytics — estimate as blue * 1.02 (typical spread)
    const result: TipoCambio = {
      oficial: data.oficial.value_avg,
      blue: data.blue.value_avg,
      ccl: Math.round(data.blue.value_avg * 1.02 * 100) / 100,
    };

    cacheSet(KEY, result);
    return result;
  } catch (err) {
    console.warn('[taxasService] buscarTipoCambio fallback:', (err as Error).message);
    return { oficial: FALLBACK_OFICIAL, blue: FALLBACK_BLUE, ccl: FALLBACK_CCL };
  }
}

// ---------------------------------------------------------------------------
// 3. buscarInflacao — INDEC via datos.gob.ar series API
// ---------------------------------------------------------------------------

interface DatosGobArResponse {
  data: Array<[string, number]>; // [date, value]
  meta: Array<{ frequency: string }>;
}

export interface DadosInflacao {
  mensalUltima: number;
  anualAcumulada: number;
  serie: Array<{ data: string; valor: number }>;
}

export async function buscarInflacao(): Promise<DadosInflacao> {
  const KEY = 'indec:inflacao';
  const cached = cacheGet<DadosInflacao>(KEY);
  if (cached !== null) return cached;

  try {
    const { data } = await http.get<DatosGobArResponse>(
      'https://apis.datos.gob.ar/series/api/series/',
      {
        params: {
          ids: '148.3_INIVELNAL_DICI_M_26',
          limit: 13,
          sort: 'desc',
          format: 'json',
        },
      }
    );

    const serie = data.data.map(([fecha, valor]) => ({ data: fecha, valor }));
    const mensalUltima = serie[0]?.valor ?? FALLBACK_INFLACAO_MENSAL;

    // Compound last 12 months to get annual accumulated
    const last12 = serie.slice(0, 12).map((s) => s.valor / 100);
    const anualAcumulada =
      last12.length > 0
        ? (last12.reduce((acc, m) => acc * (1 + m), 1) - 1) * 100
        : mensalUltima * 12;

    const result: DadosInflacao = {
      mensalUltima,
      anualAcumulada: Math.round(anualAcumulada * 100) / 100,
      serie: serie.slice(0, 12),
    };

    cacheSet(KEY, result);
    return result;
  } catch (err) {
    console.warn('[taxasService] buscarInflacao fallback:', (err as Error).message);
    const fallbackMensal = FALLBACK_INFLACAO_MENSAL;
    return {
      mensalUltima: fallbackMensal,
      anualAcumulada: Math.round(((1 + fallbackMensal / 100) ** 12 - 1) * 10000) / 100,
      serie: [],
    };
  }
}

// ---------------------------------------------------------------------------
// 4. buscarTaxasBancosTop — mock realista (abril 2025)
// ---------------------------------------------------------------------------

interface BancoTaxa {
  banco: string;
  tna: number;   // % ao ano
  tea: number;   // % ao ano
  prazoMinimo: number;
  prazoMaximo: number;
  monteMinimo: number;
}

export function buscarTaxasBancosTop(): BancoTaxa[] {
  // TNA ~37-40% vigente em abril 2025 para plazo fijo tradicional 30 dias
  // TEA = (1 + TNA/365)^365 - 1
  const calcTEA = (tna: number) =>
    Math.round(((1 + tna / 100 / 365) ** 365 - 1) * 10000) / 100;

  return [
    {
      banco: 'Banco de la Nación Argentina',
      tna: 37.0,
      tea: calcTEA(37.0),
      prazoMinimo: 30,
      prazoMaximo: 365,
      monteMinimo: 1_000,
    },
    {
      banco: 'Banco Galicia',
      tna: 38.5,
      tea: calcTEA(38.5),
      prazoMinimo: 30,
      prazoMaximo: 180,
      monteMinimo: 1_000,
    },
    {
      banco: 'Santander Argentina',
      tna: 37.5,
      tea: calcTEA(37.5),
      prazoMinimo: 30,
      prazoMaximo: 180,
      monteMinimo: 5_000,
    },
    {
      banco: 'BBVA Argentina',
      tna: 38.0,
      tea: calcTEA(38.0),
      prazoMinimo: 30,
      prazoMaximo: 180,
      monteMinimo: 1_000,
    },
    {
      banco: 'Banco Macro',
      tna: 39.5,
      tea: calcTEA(39.5),
      prazoMinimo: 30,
      prazoMaximo: 365,
      monteMinimo: 1_000,
    },
  ];
}

// ---------------------------------------------------------------------------
// 5. montarCatalogoInstrumentos — combina todas as fontes
// ---------------------------------------------------------------------------

export async function montarCatalogoInstrumentos(): Promise<InstrumentoRendaFixa[]> {
  const KEY = 'catalogo:instrumentos';
  const cached = cacheGet<InstrumentoRendaFixa[]>(KEY);
  if (cached !== null) return cached;

  const [tasaPolitica, bancos] = await Promise.all([
    buscarTaxasPlazoFijo(),
    Promise.resolve(buscarTaxasBancosTop()),
  ]);

  const agora = new Date();

  // Plazo fijo por banco
  const plazosFijo: InstrumentoRendaFixa[] = bancos.map((b, i) => ({
    id: `plazo_fijo_${i + 1}`,
    nome: `Plazo Fijo — ${b.banco}`,
    tipo: 'plazo_fijo',
    moeda: 'ARS',
    taxaAnual: b.tna,
    taxaEfetiva: b.tea,
    prazoMinimo: b.prazoMinimo,
    prazoMaximo: b.prazoMaximo,
    monteMinimoARS: b.monteMinimo,
    banco: b.banco,
    atualizadoEm: agora,
    fonte: 'Mock — banco (dados de referência abril/2025)',
  }));

  // LECAP (Letras Capitalizables del Tesoro) — leilão secundário
  const lecap: InstrumentoRendaFixa = {
    id: 'lecap_1',
    nome: 'LECAP — Letra Capitalizable del Tesoro',
    tipo: 'lecap',
    moeda: 'ARS',
    taxaAnual: 42.0,
    taxaEfetiva: Math.round(((1 + 0.42 / 365) ** 365 - 1) * 10000) / 100,
    prazoMinimo: 28,
    prazoMaximo: 180,
    monteMinimoARS: 1_000,
    atualizadoEm: agora,
    fonte: 'Tesoro Nacional — referência abril/2025',
  };

  // Bono CER (ajustável por inflação)
  const bonoCER: InstrumentoRendaFixa = {
    id: 'bono_cer_1',
    nome: 'Bono CER — TX26',
    tipo: 'bono_CER',
    moeda: 'UVA',
    taxaAnual: tasaPolitica + 2.5, // spread sobre tasa politica
    prazoMinimo: 90,
    prazoMaximo: 730,
    monteMinimoARS: 10_000,
    atualizadoEm: agora,
    fonte: 'BCRA / Mercado secundário',
  };

  // Bono dólar linked
  const bonoDolarLinked: InstrumentoRendaFixa = {
    id: 'bono_dolar_linked_1',
    nome: 'Bono Dólar Linked — TV25',
    tipo: 'bono_dolar_linked',
    moeda: 'USD',
    taxaAnual: 2.5, // rendimento em USD
    prazoMinimo: 90,
    prazoMaximo: 365,
    monteMinimoARS: 50_000,
    atualizadoEm: agora,
    fonte: 'Mercado secundário (BYMA)',
  };

  // FCI renda fixa
  const fci: InstrumentoRendaFixa = {
    id: 'fci_rf_1',
    nome: 'FCI Renta en Pesos — Mercado de Dinero',
    tipo: 'fci',
    moeda: 'ARS',
    taxaAnual: tasaPolitica + 1.0,
    prazoMinimo: 1,
    monteMinimoARS: 100,
    atualizadoEm: agora,
    fonte: 'Cafci / BYMA',
  };

  const catalogo: InstrumentoRendaFixa[] = [
    ...plazosFijo,
    lecap,
    bonoCER,
    bonoDolarLinked,
    fci,
  ];

  cacheSet(KEY, catalogo);
  return catalogo;
}

// ---------------------------------------------------------------------------
// Exporta snapshot consolidado de TaxasMercado
// ---------------------------------------------------------------------------

export async function buscarTaxasMercado(): Promise<TaxasMercado> {
  const KEY = 'mercado:taxas';
  const cached = cacheGet<TaxasMercado>(KEY);
  if (cached !== null) return cached;

  const [tasaPolitica, cambio, inflacao] = await Promise.all([
    buscarTaxasPlazoFijo(),
    buscarTipoCambio(),
    buscarInflacao(),
  ]);

  const result: TaxasMercado = {
    inflacaoMensalUltima: inflacao.mensalUltima,
    inflacaoAnualAcumulada: inflacao.anualAcumulada,
    tipoCambioOficial: cambio.oficial,
    tipoCambioBlue: cambio.blue,
    tipoCambioCCL: cambio.ccl,
    tasaPoliticaMonetaria: tasaPolitica,
    atualizadoEm: new Date(),
  };

  cacheSet(KEY, result);
  return result;
}

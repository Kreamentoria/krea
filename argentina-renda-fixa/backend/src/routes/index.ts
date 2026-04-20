import { Router, Request, Response, NextFunction } from 'express';
import {
  montarCatalogoInstrumentos,
  buscarTaxasMercado,
} from '../services/taxasService';
import {
  calcularSimulacao,
  compararInstrumentos,
} from '../services/simulacaoService';
import {
  ApiResponse,
  InstrumentoRendaFixa,
  SimulacaoInput,
  SimulacaoResult,
  TaxasMercado,
} from '../types';

const router = Router();

// Wraps async route handlers so thrown errors reach the error middleware
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

function err400(res: Response, message: string): void {
  const body: ApiResponse<null> = { success: false, data: null, error: message };
  res.status(400).json(body);
}

// ---------------------------------------------------------------------------
// GET /api/instrumentos
// Query params: tipo, moeda, prazoMin, prazoMax
// ---------------------------------------------------------------------------
router.get(
  '/instrumentos',
  asyncHandler(async (req, res) => {
    const { tipo, moeda, prazoMin, prazoMax } = req.query;

    let lista = await montarCatalogoInstrumentos();

    if (typeof tipo === 'string') {
      lista = lista.filter((i) => i.tipo === tipo);
    }
    if (typeof moeda === 'string') {
      lista = lista.filter((i) => i.moeda === moeda);
    }
    if (typeof prazoMin === 'string') {
      const min = parseInt(prazoMin, 10);
      if (!isNaN(min)) lista = lista.filter((i) => i.prazoMinimo >= min);
    }
    if (typeof prazoMax === 'string') {
      const max = parseInt(prazoMax, 10);
      if (!isNaN(max)) {
        lista = lista.filter((i) => i.prazoMaximo === undefined || i.prazoMaximo <= max);
      }
    }

    const response: ApiResponse<InstrumentoRendaFixa[]> = { success: true, data: lista };
    res.json(response);
  })
);

// ---------------------------------------------------------------------------
// GET /api/instrumentos/:id
// ---------------------------------------------------------------------------
router.get(
  '/instrumentos/:id',
  asyncHandler(async (req, res) => {
    const lista = await montarCatalogoInstrumentos();
    const instrumento = lista.find((i) => i.id === req.params.id);

    if (!instrumento) {
      const body: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Instrumento "${req.params.id}" não encontrado`,
      };
      res.status(404).json(body);
      return;
    }

    const response: ApiResponse<InstrumentoRendaFixa> = { success: true, data: instrumento };
    res.json(response);
  })
);

// ---------------------------------------------------------------------------
// GET /api/taxas-mercado
// ---------------------------------------------------------------------------
router.get(
  '/taxas-mercado',
  asyncHandler(async (_req, res) => {
    const data = await buscarTaxasMercado();
    const response: ApiResponse<TaxasMercado> = { success: true, data };
    res.json(response);
  })
);

// ---------------------------------------------------------------------------
// POST /api/simular
// Body: SimulacaoInput
// ---------------------------------------------------------------------------
router.post(
  '/simular',
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<SimulacaoInput>;

    if (!body.instrumentoId) return void err400(res, 'instrumentoId é obrigatório');
    if (body.valorInicial === undefined) return void err400(res, 'valorInicial é obrigatório');
    if (body.prazo === undefined) return void err400(res, 'prazo é obrigatório');

    const valorInicial = Number(body.valorInicial);
    const prazo = Number(body.prazo);

    if (isNaN(valorInicial) || valorInicial <= 0)
      return void err400(res, 'valorInicial deve ser um número positivo');
    if (isNaN(prazo) || prazo <= 0)
      return void err400(res, 'prazo deve ser um número positivo (em dias)');

    const input: SimulacaoInput = {
      instrumentoId: body.instrumentoId,
      valorInicial,
      prazo,
      reinvestirJuros: body.reinvestirJuros ?? false,
    };

    const [instrumentos, taxasMercado] = await Promise.all([
      montarCatalogoInstrumentos(),
      buscarTaxasMercado(),
    ]);

    const resultado = calcularSimulacao(input, instrumentos, taxasMercado);
    const response: ApiResponse<SimulacaoResult> = { success: true, data: resultado };
    res.json(response);
  })
);

// ---------------------------------------------------------------------------
// POST /api/comparar
// Body: { instrumentoIds: string[], valorInicial: number, prazo: number }
// ---------------------------------------------------------------------------
router.post(
  '/comparar',
  asyncHandler(async (req, res) => {
    const { instrumentoIds, valorInicial, prazo } = req.body as {
      instrumentoIds?: unknown;
      valorInicial?: unknown;
      prazo?: unknown;
    };

    if (!Array.isArray(instrumentoIds) || instrumentoIds.length === 0)
      return void err400(res, 'instrumentoIds deve ser um array não-vazio');
    if (valorInicial === undefined)
      return void err400(res, 'valorInicial é obrigatório');
    if (prazo === undefined)
      return void err400(res, 'prazo é obrigatório');

    const valorInicialNum = Number(valorInicial);
    const prazoNum = Number(prazo);

    if (isNaN(valorInicialNum) || valorInicialNum <= 0)
      return void err400(res, 'valorInicial deve ser um número positivo');
    if (isNaN(prazoNum) || prazoNum <= 0)
      return void err400(res, 'prazo deve ser um número positivo (em dias)');

    const ids = instrumentoIds.filter((id): id is string => typeof id === 'string');
    if (ids.length === 0)
      return void err400(res, 'instrumentoIds deve conter strings');

    const [instrumentos, taxasMercado] = await Promise.all([
      montarCatalogoInstrumentos(),
      buscarTaxasMercado(),
    ]);

    const resultados = compararInstrumentos(ids, valorInicialNum, prazoNum, instrumentos, taxasMercado);
    const response: ApiResponse<SimulacaoResult[]> = { success: true, data: resultados };
    res.json(response);
  })
);

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const taxas = await buscarTaxasMercado();
    res.json({
      status: 'ok',
      version: '1.0.0',
      lastUpdated: taxas.atualizadoEm,
      timestamp: new Date().toISOString(),
    });
  })
);

// ---------------------------------------------------------------------------
// Error middleware — catches anything forwarded via next(err)
// ---------------------------------------------------------------------------
router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[router] Unhandled error:', err.message);
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: err.message || 'Erro interno do servidor',
  };
  res.status(500).json(body);
});

export default router;

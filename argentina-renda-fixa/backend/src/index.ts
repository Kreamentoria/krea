import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import router from './routes/index';
import {
  buscarTaxasMercado,
  montarCatalogoInstrumentos,
  invalidarCache,
} from './services/taxasService';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '0 * * * *';

const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);
app.use(express.json());
app.use('/api', router);

// ---------------------------------------------------------------------------
// Cache warm-up: pre-fetches rates and catalog on startup
// ---------------------------------------------------------------------------
async function warmCache(): Promise<void> {
  console.log('[init] Warming cache...');
  try {
    const [taxas, catalogo] = await Promise.all([
      buscarTaxasMercado(),
      montarCatalogoInstrumentos(),
    ]);
    console.log(
      `[init] Cache warm — tasa política: ${taxas.tasaPoliticaMonetaria}% | ` +
        `blue: $${taxas.tipoCambioBlue} | instrumentos: ${catalogo.length}`
    );
  } catch (err) {
    console.error('[init] Cache warm failed (fallbacks active):', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Cron: invalidate cache every hour then re-fetch to keep data fresh
// ---------------------------------------------------------------------------
cron.schedule(CRON_SCHEDULE, async () => {
  console.log('[cron] Refreshing rates...');
  try {
    invalidarCache();
    const [taxas, catalogo] = await Promise.all([
      buscarTaxasMercado(),
      montarCatalogoInstrumentos(),
    ]);
    console.log(
      `[cron] Rates updated at ${taxas.atualizadoEm.toISOString()} | ` +
        `instrumentos: ${catalogo.length}`
    );
  } catch (err) {
    console.error('[cron] Refresh failed:', (err as Error).message);
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await warmCache();
});

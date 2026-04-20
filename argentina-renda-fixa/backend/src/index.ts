import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import router from './routes';
import { scrapeCurrentRates } from './scraper';
import { setCurrentRates } from './store';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '0 * * * *';

app.use(cors());
app.use(express.json());
app.use('/api', router);

async function initRates(): Promise<void> {
  console.log('[init] Fetching initial rates...');
  try {
    const rates = await scrapeCurrentRates();
    setCurrentRates(rates);
    console.log('[init] Rates loaded:', rates);
  } catch (err) {
    console.error('[init] Failed to fetch initial rates:', err);
  }
}

cron.schedule(CRON_SCHEDULE, async () => {
  console.log('[cron] Updating rates...');
  try {
    const rates = await scrapeCurrentRates();
    setCurrentRates(rates);
    console.log('[cron] Rates updated at', rates.lastUpdated);
  } catch (err) {
    console.error('[cron] Update failed:', err);
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initRates();
});

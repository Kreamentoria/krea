import { Router, Request, Response } from 'express';
import { getCurrentRates, getHistory } from './store';
import { scrapeCurrentRates } from './scraper';
import { setCurrentRates } from './store';
import { ApiResponse, CurrentRates, RateRecord } from './types';

const router = Router();

router.get('/rates', (_req: Request, res: Response) => {
  const data = getCurrentRates();
  const response: ApiResponse<CurrentRates> = { success: true, data };
  res.json(response);
});

router.get('/history', (_req: Request, res: Response) => {
  const data = getHistory();
  const response: ApiResponse<RateRecord[]> = { success: true, data };
  res.json(response);
});

router.post('/rates/refresh', async (_req: Request, res: Response) => {
  try {
    const rates = await scrapeCurrentRates();
    setCurrentRates(rates);
    const response: ApiResponse<CurrentRates> = { success: true, data: rates };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;

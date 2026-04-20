import axios from 'axios';
import * as cheerio from 'cheerio';
import { CurrentRates } from './types';

const BCRA_BASE_URL = 'https://www.bcra.gob.ar';

async function fetchBCRARate(path: string, selector: string): Promise<number | null> {
  try {
    const { data } = await axios.get(`${BCRA_BASE_URL}${path}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArgentinaRendaFixa/1.0)' },
    });
    const $ = cheerio.load(data);
    const text = $(selector).first().text().trim().replace(',', '.');
    const value = parseFloat(text);
    return isNaN(value) ? null : value;
  } catch {
    return null;
  }
}

export async function scrapeCurrentRates(): Promise<CurrentRates> {
  const [leliq, plazoFijo, badlar] = await Promise.all([
    fetchBCRARate('/publicaciones/PGfinme.asp', '.tasa-leliq'),
    fetchBCRARate('/publicaciones/PGfinme.asp', '.tasa-plazo-fijo'),
    fetchBCRARate('/publicaciones/PGfinme.asp', '.tasa-badlar'),
  ]);

  // Inflation from INDEC — fallback to static if scraping fails
  let inflacion: number | null = null;
  try {
    const { data } = await axios.get('https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31', {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArgentinaRendaFixa/1.0)' },
    });
    const $ = cheerio.load(data);
    const text = $('table td').filter((_, el) => /^\d+,\d+%?$/.test($(el).text().trim())).first().text().trim();
    const cleaned = text.replace('%', '').replace(',', '.');
    const val = parseFloat(cleaned);
    inflacion = isNaN(val) ? null : val;
  } catch {
    inflacion = null;
  }

  return {
    leliq,
    plazoFijo,
    badlar,
    inflacion,
    lastUpdated: new Date().toISOString(),
  };
}

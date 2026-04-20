import { CurrentRates, RateRecord } from './types';

let currentRates: CurrentRates = {
  leliq: null,
  plazoFijo: null,
  badlar: null,
  inflacion: null,
  lastUpdated: new Date().toISOString(),
};

const history: RateRecord[] = [];

export function setCurrentRates(rates: CurrentRates): void {
  currentRates = rates;
  history.push({
    date: rates.lastUpdated,
    leliq: rates.leliq,
    plazoFijo: rates.plazoFijo,
    badlar: rates.badlar,
    inflacion: rates.inflacion,
  });
  // Keep last 365 entries
  if (history.length > 365) history.shift();
}

export function getCurrentRates(): CurrentRates {
  return currentRates;
}

export function getHistory(): RateRecord[] {
  return [...history];
}

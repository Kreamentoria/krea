import { useEffect, useState, useCallback } from 'react';
import { fetchCurrentRates, fetchHistory, refreshRates } from './api';
import { CurrentRates, RateRecord } from './types';
import { RateCard } from './components/RateCard';
import { RatesChart } from './components/RatesChart';

export default function App() {
  const [rates, setRates] = useState<CurrentRates | null>(null);
  const [history, setHistory] = useState<RateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [r, h] = await Promise.all([fetchCurrentRates(), fetchHistory()]);
      setRates(r);
      setHistory(h);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const r = await refreshRates();
      setRates(r);
      const h = await fetchHistory();
      setHistory(h);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Argentina Renda Fixa</h1>
            <p className="text-sm text-gray-500 mt-0.5">Monitoramento de taxas de juros argentinas</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-argentina-blue text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando taxas...</div>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-700">Taxas Atuais (% a.a.)</h2>
                {rates?.lastUpdated && (
                  <span className="text-xs text-gray-400">
                    Atualizado: {new Date(rates.lastUpdated).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <RateCard
                  label="LELIQ"
                  value={rates?.leliq ?? null}
                  description="Letras de Liquidez do Banco Central"
                  color="border-argentina-blue"
                />
                <RateCard
                  label="Prazo Fixo"
                  value={rates?.plazoFijo ?? null}
                  description="Depósito a prazo (30 dias)"
                  color="border-blue-500"
                />
                <RateCard
                  label="BADLAR"
                  value={rates?.badlar ?? null}
                  description="Taxa para grandes depósitos"
                  color="border-purple-500"
                />
                <RateCard
                  label="Inflação"
                  value={rates?.inflacion ?? null}
                  description="Variação mensal (INDEC)"
                  color="border-red-400"
                />
              </div>
            </section>

            <RatesChart history={history} />
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 pb-8">
        Dados obtidos via BCRA e INDEC. Apenas informativo.
      </footer>
    </div>
  );
}

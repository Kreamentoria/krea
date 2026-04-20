import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { RateRecord } from '../types';

interface RatesChartProps {
  history: RateRecord[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', day: '2-digit' });
}

export function RatesChart({ history }: RatesChartProps) {
  const data = history.map((r) => ({
    date: formatDate(r.date),
    'LELIQ': r.leliq,
    'Prazo Fixo': r.plazoFijo,
    'BADLAR': r.badlar,
    'Inflação': r.inflacion,
  }));

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Histórico de Taxas (%)</h2>
      {data.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-12">Nenhum histórico disponível ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v?.toFixed(2)}%`} />
            <Legend />
            <Line type="monotone" dataKey="LELIQ" stroke="#74ACDF" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Prazo Fixo" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="BADLAR" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Inflação" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

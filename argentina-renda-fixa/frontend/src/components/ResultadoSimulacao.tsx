import { useState } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { SimulacaoResult } from '../types';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtARS(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number, showSign = false): string {
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2).replace('.', ',')}%`;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

// ---------------------------------------------------------------------------
// Chart data builder
// ---------------------------------------------------------------------------

interface ChartPoint {
  label: string;
  investimento: number;
  inflacao: number | null;
  usd: number | null;
}

function buildChartData(result: SimulacaoResult): ChartPoint[] {
  const { valorInicial, evolucaoMensal, inflacaoEstimada, comparativoUSD } = result;
  const totalMeses = evolucaoMensal.length;

  const inflacaoMensalRate =
    inflacaoEstimada !== undefined && totalMeses > 0
      ? Math.pow(1 + inflacaoEstimada / 100, 1 / totalMeses) - 1
      : null;

  const usdMensalRate =
    comparativoUSD !== undefined && totalMeses > 0
      ? Math.pow(1 + comparativoUSD / 100, 1 / totalMeses) - 1
      : null;

  const initial: ChartPoint = {
    label: 'Início',
    investimento: valorInicial,
    inflacao: inflacaoMensalRate !== null ? valorInicial : null,
    usd: usdMensalRate !== null ? valorInicial : null,
  };

  const monthly: ChartPoint[] = evolucaoMensal.map((entry, i) => ({
    label: `Mês ${entry.mes}`,
    investimento: Math.round(entry.valor * 100) / 100,
    inflacao:
      inflacaoMensalRate !== null
        ? Math.round(valorInicial * Math.pow(1 + inflacaoMensalRate, i + 1) * 100) / 100
        : null,
    usd:
      usdMensalRate !== null
        ? Math.round(valorInicial * Math.pow(1 + usdMensalRate, i + 1) * 100) / 100
        : null,
  }));

  return [initial, ...monthly];
}

// ---------------------------------------------------------------------------
// Table row type
// ---------------------------------------------------------------------------

interface TabelaRow {
  mes: number;
  valor: number;
  rendMes: number;
  pctAcum: number;
}

function buildTabela(result: SimulacaoResult): TabelaRow[] {
  return result.evolucaoMensal.map((entry, i) => {
    const anterior = i === 0 ? result.valorInicial : result.evolucaoMensal[i - 1].valor;
    return {
      mes: entry.mes,
      valor: entry.valor,
      rendMes: entry.valor - anterior,
      pctAcum: ((entry.valor / result.valorInicial) - 1) * 100,
    };
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
      {children}
    </p>
  );
}

function DataRow({
  label,
  value,
  sub,
  valueClass = 'text-gray-800',
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
        {sub && <span className="text-xs text-gray-400 ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

function BigMetric({
  label,
  value,
  valueClass = 'text-gray-800',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom chart tooltip
// ---------------------------------------------------------------------------

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs space-y-1.5 min-w-[220px]">
      <p className="font-bold text-gray-700 border-b border-gray-100 pb-1.5 mb-1.5">
        {label}
      </p>
      {payload.map((entry) =>
        entry.value != null ? (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: entry.color }}
              />
              <span className="text-gray-500">{entry.name}</span>
            </div>
            <span className="font-semibold text-gray-800 font-mono">
              $ {fmtARS(entry.value)}
            </span>
          </div>
        ) : null
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ResultadoSimulacaoProps {
  result: SimulacaoResult;
}

export function ResultadoSimulacao({ result }: ResultadoSimulacaoProps) {
  const [showTabela, setShowTabela] = useState(false);

  const {
    valorInicial,
    valorFinal,
    rendimentoBruto,
    rendimentoLiquido,
    impostoRetido,
    inflacaoEstimada,
    rendimentoRealEstimado,
    comparativoUSD,
    evolucaoMensal,
  } = result;

  const pctBruta = (rendimentoBruto / valorInicial) * 100;
  const pctLiquida = (rendimentoLiquido / valorInicial) * 100;
  const realPositivo = rendimentoRealEstimado !== undefined && rendimentoRealEstimado >= 0;
  const abaixoInflacao = rendimentoRealEstimado !== undefined && rendimentoRealEstimado < 0;
  const hasInflacao = inflacaoEstimada !== undefined;
  const hasUSD = comparativoUSD !== undefined;

  const chartData = buildChartData(result);
  const tabelaRows = buildTabela(result);
  const hasInflacaoChart = chartData.some((d) => d.inflacao !== null);
  const hasUSDChart = chartData.some((d) => d.usd !== null);

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* Row 1: 3 summary cards                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-md p-6 border-t-4 border-argentina-blue">
          <SectionTitle>Resultado final</SectionTitle>

          <p className="text-4xl font-black text-gray-900 leading-none tracking-tight">
            $ {fmtARS(valorFinal)}
          </p>
          <p className="text-xs text-gray-400 mt-1 mb-5">ARS líquido (após Ganancias)</p>

          <div className="space-y-3 pt-4 border-t border-gray-100">
            <DataRow
              label="Rendimento bruto"
              value={`$ ${fmtARS(rendimentoBruto)}`}
              sub={fmtPct(pctBruta, true)}
              valueClass="text-gray-700"
            />
            <DataRow
              label="Imposto retido (5% Ganancias)"
              value={`− $ ${fmtARS(impostoRetido)}`}
              valueClass="text-red-500"
            />
            <div className="pt-2 border-t border-gray-100">
              <DataRow
                label="Rendimento líquido"
                value={`$ ${fmtARS(rendimentoLiquido)}`}
                sub={fmtPct(pctLiquida, true)}
                valueClass="text-argentina-blue"
              />
            </div>
          </div>
        </div>

        {/* Card inflação vs rendimento real */}
        <div
          className={`bg-white rounded-2xl shadow-md p-6 border-t-4 ${
            abaixoInflacao ? 'border-red-400' : 'border-green-400'
          }`}
        >
          <SectionTitle>Inflação vs. Rendimento Real</SectionTitle>

          {abaixoInflacao && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-3 py-2 mb-4">
              <span className="text-base leading-none">⚠️</span>
              <span className="font-semibold">Rendimento abaixo da inflação</span>
            </div>
          )}

          <div className="space-y-4">
            {hasInflacao && (
              <BigMetric
                label="Inflação estimada no período"
                value={fmtPct(inflacaoEstimada!)}
                valueClass="text-gray-600"
              />
            )}
            {rendimentoRealEstimado !== undefined && (
              <BigMetric
                label="Rendimento real (acima da inflação)"
                value={fmtPct(rendimentoRealEstimado, true)}
                valueClass={realPositivo ? 'text-green-600' : 'text-red-500'}
              />
            )}
            <BigMetric
              label="Rendimento nominal líquido"
              value={fmtPct(pctLiquida, true)}
              valueClass="text-argentina-blue"
            />
          </div>

          <p className="text-xs text-gray-400 mt-5 pt-3 border-t border-gray-100">
            Inflação: projeção INDEC com base no último dado disponível
          </p>
        </div>

        {/* Card câmbio */}
        <div className="bg-white rounded-2xl shadow-md p-6 border-t-4 border-emerald-400">
          <SectionTitle>Comparativo em Dólares</SectionTitle>

          {hasUSD ? (
            <>
              <div className="space-y-4">
                <BigMetric
                  label="Retorno equiv. dólar blue"
                  value={fmtPct(comparativoUSD!, true)}
                  valueClass={comparativoUSD! >= 0 ? 'text-green-600' : 'text-red-500'}
                />
                <BigMetric
                  label="Rendimento nominal em ARS"
                  value={fmtPct(pctLiquida, true)}
                  valueClass="text-argentina-blue"
                />
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                <DataRow
                  label="Diferença ARS − USD"
                  value={fmtPct(pctLiquida - comparativoUSD!, true)}
                  valueClass={
                    pctLiquida - comparativoUSD! >= 0 ? 'text-green-600' : 'text-red-500'
                  }
                />
              </div>

              <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                Baseado na cotação dólar blue no momento da simulação
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Dado não disponível para este instrumento.</p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AreaChart — evolução mensal                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-gray-700">Evolução do investimento (ARS)</h3>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[#74ACDF] inline-block rounded" />
              Investimento
            </span>
            {hasInflacaoChart && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-gray-400 inline-block rounded border-dashed border-b border-gray-400" />
                Break-even inflação
              </span>
            )}
            {hasUSDChart && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" />
                Equiv. USD blue
              </span>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradInvest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#74ACDF" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#74ACDF" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradInflac" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtCompact}
              width={72}
            />

            <Tooltip
              content={({ active, payload, label }) => (
                <ChartTooltip
                  active={active}
                  label={typeof label === 'string' ? label : String(label ?? '')}
                  payload={payload?.map((p) => ({
                    dataKey: String(p.dataKey ?? ''),
                    name: String(p.name ?? ''),
                    value: typeof p.value === 'number' ? p.value : 0,
                    color: p.color ?? '#9ca3af',
                  }))}
                />
              )}
            />

            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              iconType="circle"
              iconSize={8}
            />

            {/* Inflation break-even — rendered first (behind) */}
            {hasInflacaoChart && (
              <Area
                type="monotone"
                dataKey="inflacao"
                name="Break-even inflação"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                fill="url(#gradInflac)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                connectNulls
              />
            )}

            {/* Main investment area */}
            <Area
              type="monotone"
              dataKey="investimento"
              name="Investimento líquido"
              stroke="#74ACDF"
              strokeWidth={2.5}
              fill="url(#gradInvest)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />

            {/* USD blue equivalent — dashed line */}
            {hasUSDChart && (
              <Line
                type="monotone"
                dataKey="usd"
                name="Equiv. USD blue"
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tabela mensal — collapsible                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTabela((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              Evolução mensal detalhada
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {evolucaoMensal.length} meses
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              showTabela ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showTabela && (
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-semibold">Mês</th>
                  <th className="px-5 py-3 text-right font-semibold">Valor acumulado</th>
                  <th className="px-5 py-3 text-right font-semibold">Rendimento do mês</th>
                  <th className="px-5 py-3 text-right font-semibold">% Acumulada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabelaRows.map((row) => (
                  <tr
                    key={row.mes}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-600">Mês {row.mes}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-mono font-medium text-gray-800">
                        $ {fmtARS(row.valor)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-mono text-green-600">
                        + $ {fmtARS(row.rendMes)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`font-mono font-semibold ${
                          row.pctAcum >= 0 ? 'text-argentina-blue' : 'text-red-500'
                        }`}
                      >
                        {fmtPct(row.pctAcum, true)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-blue-50 to-white border-t-2 border-argentina-blue/20">
                  <td className="px-5 py-4 font-bold text-gray-700">Total</td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-gray-900">
                    $ {fmtARS(valorFinal)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-green-600">
                    + $ {fmtARS(rendimentoLiquido)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-argentina-blue">
                    {fmtPct(pctLiquida, true)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { InstrumentoRendaFixa, SimulacaoInput, SimulacaoResult } from '../types';
import { fetchInstrumentos, simular } from '../api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRUPOS: Array<{ label: string; tipos: Array<InstrumentoRendaFixa['tipo']> }> = [
  { label: 'Plazo Fijo', tipos: ['plazo_fijo'] },
  { label: 'Letras del Tesoro', tipos: ['lecap', 'lebad'] },
  { label: 'Bonos', tipos: ['bono_CER', 'bono_dolar_linked'] },
  { label: 'FCI', tipos: ['fci'] },
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const fmtARS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

function formatARS(n: number): string {
  return fmtARS.format(Math.round(n));
}

function parsearARS(str: string): number {
  // Remove anything that isn't a digit and parse
  return parseInt(str.replace(/[^\d]/g, ''), 10) || 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tipoLabel(tipo: InstrumentoRendaFixa['tipo']): string {
  const map: Record<InstrumentoRendaFixa['tipo'], string> = {
    plazo_fijo: 'Plazo Fijo',
    lecap: 'LECAP',
    lebad: 'LEBAD',
    bono_CER: 'Bono CER',
    bono_dolar_linked: 'Dólar Linked',
    fci: 'FCI',
  };
  return map[tipo];
}

function tipoBorderColor(tipo: InstrumentoRendaFixa['tipo']): string {
  const map: Record<InstrumentoRendaFixa['tipo'], string> = {
    plazo_fijo: 'border-argentina-blue',
    lecap: 'border-purple-400',
    lebad: 'border-purple-400',
    bono_CER: 'border-orange-400',
    bono_dolar_linked: 'border-green-500',
    fci: 'border-teal-400',
  };
  return map[tipo];
}

function moedaClasses(moeda: InstrumentoRendaFixa['moeda']): string {
  const map: Record<InstrumentoRendaFixa['moeda'], string> = {
    ARS: 'bg-blue-100 text-blue-700',
    USD: 'bg-green-100 text-green-700',
    UVA: 'bg-orange-100 text-orange-700',
  };
  return map[moeda];
}

// ---------------------------------------------------------------------------
// Sub-component: Instrumento info card
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-argentina-blue' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

function InstrumentoCard({ instrumento }: { instrumento: InstrumentoRendaFixa }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md p-6 border-l-4 ${tipoBorderColor(instrumento.tipo)} flex flex-col gap-4 h-full`}
    >
      {/* Header */}
      <div>
        <h3 className="font-semibold text-gray-800 text-sm leading-snug">{instrumento.nome}</h3>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${moedaClasses(instrumento.moeda)}`}>
            {instrumento.moeda}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
            {tipoLabel(instrumento.tipo)}
          </span>
        </div>
      </div>

      {/* TNA destaque */}
      <div className="bg-blue-50 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-0.5">Taxa Nominal Anual</p>
        <p className="text-3xl font-bold text-argentina-blue">
          {instrumento.taxaAnual.toFixed(2)}%
        </p>
        {instrumento.taxaEfetiva !== undefined && (
          <p className="text-xs text-gray-400 mt-1">
            TEA: {instrumento.taxaEfetiva.toFixed(2)}%
          </p>
        )}
      </div>

      {/* Detalhes */}
      <div className="flex-1">
        <InfoRow label="Prazo mínimo" value={`${instrumento.prazoMinimo} dias`} />
        {instrumento.prazoMaximo !== undefined && (
          <InfoRow label="Prazo máximo" value={`${instrumento.prazoMaximo} dias`} />
        )}
        {instrumento.monteMinimoARS !== undefined && (
          <InfoRow label="Mínimo ARS" value={`$ ${formatARS(instrumento.monteMinimoARS)}`} accent />
        )}
        {instrumento.banco && (
          <InfoRow label="Banco / Emissor" value={instrumento.banco} />
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-gray-100 space-y-0.5">
        <p className="text-xs text-gray-400 truncate" title={instrumento.fonte}>
          Fonte: {instrumento.fonte}
        </p>
        <p className="text-xs text-gray-400">
          Atualizado:{' '}
          {new Date(instrumento.atualizadoEm).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation errors type
// ---------------------------------------------------------------------------

type FormErrors = Partial<Record<'instrumento' | 'valor' | 'prazo', string>>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SimuladorFormProps {
  onResult: (result: SimulacaoResult) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SimuladorForm({ onResult }: SimuladorFormProps) {
  const [instrumentos, setInstrumentos] = useState<InstrumentoRendaFixa[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);

  const [selectedId, setSelectedId] = useState('');
  const [instrumento, setInstrumento] = useState<InstrumentoRendaFixa | null>(null);

  // Valor investido — valorStr is the formatted display string
  const [valorStr, setValorStr] = useState('');
  const valorStrRef = useRef(valorStr);
  valorStrRef.current = valorStr;

  // Prazo — two states: clamped numeric value + raw input string (to allow mid-typing)
  const [prazo, setPrazo] = useState(30);
  const [prazoStr, setPrazoStr] = useState('30');

  const [reinvestir, setReinvestir] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [simulando, setSimulando] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Derived limits from selected instrument
  const prazoMin = instrumento?.prazoMinimo ?? 1;
  const prazoMax = instrumento?.prazoMaximo ?? 365;
  const meses = (prazo / 30).toFixed(1).replace('.', ',');

  // -------------------------------------------------------------------------
  // Fetch instrument list
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchInstrumentos()
      .then(setInstrumentos)
      .catch(() => undefined)
      .finally(() => setLoadingLista(false));
  }, []);

  // -------------------------------------------------------------------------
  // When instrument changes — resolve object, clamp prazo
  // -------------------------------------------------------------------------
  useEffect(() => {
    const found = instrumentos.find((i) => i.id === selectedId) ?? null;
    setInstrumento(found);
  }, [selectedId, instrumentos]);

  useEffect(() => {
    if (!instrumento) return;
    const min = instrumento.prazoMinimo;
    const max = instrumento.prazoMaximo ?? 365;
    const clamped = Math.min(Math.max(prazo, min), max);
    setPrazo(clamped);
    setPrazoStr(String(clamped));
  }, [instrumento]); // intentionally omit prazo to avoid loop

  // Enforce minimum valor when instrument changes
  useEffect(() => {
    if (!instrumento?.monteMinimoARS) return;
    const min = instrumento.monteMinimoARS;
    const current = parsearARS(valorStrRef.current);
    if (current > 0 && current < min) {
      setValorStr(formatARS(min));
    }
  }, [instrumento]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  function handleValorChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^\d]/g, '');
    setValorStr(digits === '' ? '' : formatARS(parseInt(digits, 10)));
  }

  function handleSliderChange(e: ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    setPrazo(v);
    setPrazoStr(String(v));
  }

  function handlePrazoInputChange(e: ChangeEvent<HTMLInputElement>) {
    setPrazoStr(e.target.value);
  }

  function handlePrazoInputBlur() {
    const v = parseInt(prazoStr, 10);
    const clamped = isNaN(v) ? prazo : Math.min(Math.max(v, prazoMin), prazoMax);
    setPrazo(clamped);
    setPrazoStr(String(clamped));
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
  function validate(): boolean {
    const errs: FormErrors = {};

    if (!selectedId) {
      errs.instrumento = 'Selecione um instrumento';
    }

    const valor = parsearARS(valorStr);
    if (valor <= 0) {
      errs.valor = 'Informe o valor a investir';
    } else if (instrumento?.monteMinimoARS && valor < instrumento.monteMinimoARS) {
      errs.valor = `Mínimo: ARS $ ${formatARS(instrumento.monteMinimoARS)}`;
    }

    if (prazo < prazoMin) {
      errs.prazo = `Prazo mínimo: ${prazoMin} dias`;
    } else if (prazo > prazoMax) {
      errs.prazo = `Prazo máximo: ${prazoMax} dias`;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSimulando(true);
    setApiError(null);
    try {
      const input: SimulacaoInput = {
        instrumentoId: selectedId,
        valorInicial: parsearARS(valorStr),
        prazo,
        reinvestirJuros: reinvestir,
      };
      const result = await simular(input);
      onResult(result);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erro na simulação');
    } finally {
      setSimulando(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Form — 2/3 width on desktop                                        */}
      {/* ------------------------------------------------------------------ */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="lg:col-span-2 bg-white rounded-2xl shadow-md p-6 space-y-6"
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-argentina-blue rounded-full" />
          <h2 className="text-lg font-semibold text-gray-800">Simular investimento</h2>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Instrument selector                                              */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Instrumento
          </label>
          {loadingLista ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-argentina-blue transition-colors ${
                errors.instrumento ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            >
              <option value="">Selecione um instrumento...</option>
              {GRUPOS.map((grupo) => {
                const items = instrumentos.filter((i) => grupo.tipos.includes(i.tipo));
                if (items.length === 0) return null;
                return (
                  <optgroup key={grupo.label} label={`── ${grupo.label}`}>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          )}
          {errors.instrumento && (
            <p className="text-xs text-red-500 mt-1">{errors.instrumento}</p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Valor                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Valor a investir
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none pointer-events-none">
              ARS $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={valorStr}
              onChange={handleValorChange}
              placeholder={
                instrumento?.monteMinimoARS
                  ? formatARS(instrumento.monteMinimoARS)
                  : '100.000'
              }
              className={`w-full rounded-lg border pl-14 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-argentina-blue transition-colors ${
                errors.valor ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            {instrumento?.monteMinimoARS ? (
              <p className="text-xs text-gray-400">
                Mínimo: ARS $ {formatARS(instrumento.monteMinimoARS)}
              </p>
            ) : (
              <span />
            )}
            {errors.valor && <p className="text-xs text-red-500">{errors.valor}</p>}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Prazo                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Prazo</label>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              ≈ {meses} meses
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={prazoMin}
              max={prazoMax}
              value={prazo}
              onChange={handleSliderChange}
              className="flex-1 h-2 accent-argentina-blue cursor-pointer"
            />
            <div className="relative flex-shrink-0 w-28">
              <input
                type="number"
                min={prazoMin}
                max={prazoMax}
                value={prazoStr}
                onChange={handlePrazoInputChange}
                onBlur={handlePrazoInputBlur}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-argentina-blue transition-colors ${
                  errors.prazo ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                dias
              </span>
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
            <span>{prazoMin} dias</span>
            <span>{prazoMax} dias</span>
          </div>
          {errors.prazo && <p className="text-xs text-red-500 mt-1">{errors.prazo}</p>}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Reinvestir toggle                                                */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl cursor-pointer"
          onClick={() => setReinvestir((v) => !v)}
        >
          <div>
            <p className="text-sm font-medium text-gray-800">Reinvestir juros</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Capitalización mensual — juros são incorporados ao principal
            </p>
          </div>
          <button
            type="button"
            aria-pressed={reinvestir}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-argentina-blue focus:ring-offset-2 ${
              reinvestir ? 'bg-argentina-blue' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                reinvestir ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* API error                                                        */}
        {/* ---------------------------------------------------------------- */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {apiError}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Submit                                                           */}
        {/* ---------------------------------------------------------------- */}
        <button
          type="submit"
          disabled={simulando || loadingLista}
          className="w-full py-3 bg-argentina-blue text-white font-semibold rounded-xl hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50 transition-all text-sm tracking-wide"
        >
          {simulando ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Calculando...
            </span>
          ) : (
            'Simular rendimento'
          )}
        </button>
      </form>

      {/* ------------------------------------------------------------------ */}
      {/* Instrument info card — 1/3 width on desktop                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="lg:col-span-1">
        {instrumento ? (
          <InstrumentoCard instrumento={instrumento} />
        ) : (
          <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center justify-center text-center min-h-[280px] border-2 border-dashed border-gray-200">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #74ACDF 0%, #fff 100%)' }}
            >
              <svg className="w-6 h-6 text-argentina-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Detalhes do instrumento</p>
            <p className="text-xs text-gray-400 mt-1">
              Selecione um instrumento ao lado para ver TNA, prazos e informações
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

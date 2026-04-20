import {
  InstrumentoRendaFixa,
  SimulacaoInput,
  SimulacaoResult,
  TaxasMercado,
} from '../types';

const ALIQUOTA_IR = 0.05; // Ganancias — 5% para Pessoa Física

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arredondar(n: number, casas = 2): number {
  return Math.round(n * 10 ** casas) / 10 ** casas;
}

/** Gera array de valor mês a mês a partir de uma função de crescimento */
function gerarEvolucaoMensal(
  principal: number,
  prazo: number,
  valorNaData: (diaFinal: number) => number
): Array<{ mes: number; valor: number }> {
  const totalMeses = Math.ceil(prazo / 30);
  const evolucao: Array<{ mes: number; valor: number }> = [];
  for (let mes = 1; mes <= totalMeses; mes++) {
    const dia = Math.min(mes * 30, prazo);
    evolucao.push({ mes, valor: arredondar(valorNaData(dia)) });
  }
  // Garante que o último ponto é exatamente o prazo solicitado
  if (evolucao.length === 0 || evolucao[evolucao.length - 1].mes * 30 < prazo) {
    evolucao.push({ mes: totalMeses, valor: arredondar(valorNaData(prazo)) });
  }
  return evolucao;
}

/** Rendimento real descontando inflação composta */
function calcularRendimentoReal(
  rendimentoBruto: number,
  valorInicial: number,
  inflacaoMensal: number,
  prazo: number
): number {
  const meses = prazo / 30;
  const inflacaoAcumulada = (1 + inflacaoMensal / 100) ** meses - 1;
  const totalComInflacao = valorInicial * (1 + inflacaoAcumulada);
  const rendimentoRealARS = valorInicial + rendimentoBruto - totalComInflacao;
  return arredondar((rendimentoRealARS / valorInicial) * 100);
}

// ---------------------------------------------------------------------------
// Calculadores por tipo de instrumento
// ---------------------------------------------------------------------------

function calcularPlazoFijo(
  principal: number,
  tna: number,
  prazo: number,
  reinvestir: boolean
): { valorFinal: number; evolucao: (dia: number) => number } {
  if (reinvestir && prazo > 30) {
    // Capitalização mensal: principal × (1 + TNA/12/100)^meses
    const taxaMensal = tna / 12 / 100;
    const valorNaData = (dia: number) => principal * (1 + taxaMensal) ** (dia / 30);
    return { valorFinal: valorNaData(prazo), evolucao: valorNaData };
  }

  // Juros simples: principal × (1 + TNA/365 × dias)
  const valorNaData = (dia: number) => principal * (1 + (tna / 100 / 365) * dia);
  return { valorFinal: valorNaData(prazo), evolucao: valorNaData };
}

function calcularLecapLebad(
  principal: number,
  tna: number,
  prazo: number
): { valorFinal: number; evolucao: (dia: number) => number } {
  // Letras operam com desconto: investidor compra abaixo do VN.
  // A TNA já representa o rendimento de desconto (taxa over).
  // ValorFinal = Principal × (1 + TNA/365 × dias)
  // (igual a juros simples — o "desconto" é embutido na TNA da letra)
  const valorNaData = (dia: number) => principal * (1 + (tna / 100 / 365) * dia);
  return { valorFinal: valorNaData(prazo), evolucao: valorNaData };
}

function calcularBonoCER(
  principal: number,
  tna: number,
  prazo: number,
  inflacaoMensal: number
): { valorFinal: number; evolucao: (dia: number) => number } {
  // CER diário estimado a partir da inflação mensal
  const cerDiario = inflacaoMensal / 30 / 100;
  // Taxa real (spread sobre CER) embutida na TNA do instrumento
  const taxaRealDiaria = tna / 100 / 365;

  const valorNaData = (dia: number) => {
    const cerAcumulado = (1 + cerDiario) ** dia;
    const spreadAcumulado = (1 + taxaRealDiaria) ** dia;
    return principal * cerAcumulado * spreadAcumulado;
  };

  return { valorFinal: valorNaData(prazo), evolucao: valorNaData };
}

function calcularBonoDolarLinked(
  principal: number,
  tna: number,
  prazo: number,
  tipoCambioOficial: number
): { valorFinal: number; evolucao: (dia: number) => number } {
  // Variação cambial estimada: 2% ao mês (crawling peg vigente em abril 2025)
  const variacaoCambialMensal = 0.02;
  const variacaoCambialDiaria = variacaoCambialMensal / 30;
  const taxaRealDiaria = tna / 100 / 365;

  const valorNaData = (dia: number) => {
    const correcaoCambial = (1 + variacaoCambialDiaria) ** dia;
    const taxaReal = (1 + taxaRealDiaria) ** dia;
    return principal * correcaoCambial * taxaReal;
  };

  // Referência cambial para exibição — não altera o cálculo em ARS
  void tipoCambioOficial;

  return { valorFinal: valorNaData(prazo), evolucao: valorNaData };
}

function calcularFCI(
  principal: number,
  tna: number,
  prazo: number
): { valorFinal: number; evolucao: (dia: number) => number } {
  // FCI de mercado de dinero: capitalização diária (como conta remunerada)
  const taxaDiaria = tna / 100 / 365;
  const valorNaData = (dia: number) => principal * (1 + taxaDiaria) ** dia;
  return { valorFinal: valorNaData(prazo), evolucao: valorNaData };
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

export function calcularSimulacao(
  input: SimulacaoInput,
  instrumentos: InstrumentoRendaFixa[],
  taxasMercado: TaxasMercado
): SimulacaoResult {
  const instrumento = instrumentos.find((i) => i.id === input.instrumentoId);
  if (!instrumento) {
    throw new Error(`Instrumento "${input.instrumentoId}" não encontrado no catálogo.`);
  }

  if (input.valorInicial <= 0) throw new Error('valorInicial deve ser positivo.');
  if (input.prazo <= 0) throw new Error('prazo deve ser positivo.');

  const { valorInicial, prazo, reinvestirJuros } = input;
  const { taxaAnual, tipo } = instrumento;
  const { inflacaoMensalUltima, tipoCambioOficial, tipoCambioBlue } = taxasMercado;

  let valorFinal: number;
  let evolucaoFn: (dia: number) => number;

  switch (tipo) {
    case 'plazo_fijo': {
      const r = calcularPlazoFijo(valorInicial, taxaAnual, prazo, reinvestirJuros);
      valorFinal = r.valorFinal;
      evolucaoFn = r.evolucao;
      break;
    }
    case 'lecap':
    case 'lebad': {
      const r = calcularLecapLebad(valorInicial, taxaAnual, prazo);
      valorFinal = r.valorFinal;
      evolucaoFn = r.evolucao;
      break;
    }
    case 'bono_CER': {
      const r = calcularBonoCER(valorInicial, taxaAnual, prazo, inflacaoMensalUltima);
      valorFinal = r.valorFinal;
      evolucaoFn = r.evolucao;
      break;
    }
    case 'bono_dolar_linked': {
      const r = calcularBonoDolarLinked(valorInicial, taxaAnual, prazo, tipoCambioOficial);
      valorFinal = r.valorFinal;
      evolucaoFn = r.evolucao;
      break;
    }
    case 'fci': {
      const r = calcularFCI(valorInicial, taxaAnual, prazo);
      valorFinal = r.valorFinal;
      evolucaoFn = r.evolucao;
      break;
    }
    default: {
      // Fallback genérico: juros simples
      evolucaoFn = (dia) => valorInicial * (1 + (taxaAnual / 100 / 365) * dia);
      valorFinal = evolucaoFn(prazo);
    }
  }

  const rendimentoBruto = arredondar(valorFinal - valorInicial);
  const impostoRetido = arredondar(rendimentoBruto * ALIQUOTA_IR);
  const rendimentoLiquido = arredondar(rendimentoBruto - impostoRetido);
  const valorFinalLiquido = arredondar(valorInicial + rendimentoLiquido);

  const inflacaoEstimada = arredondar(
    ((1 + inflacaoMensalUltima / 100) ** (prazo / 30) - 1) * 100
  );

  const rendimentoRealEstimado = calcularRendimentoReal(
    rendimentoLiquido,
    valorInicial,
    inflacaoMensalUltima,
    prazo
  );

  // Equivalente em USD (usando câmbio blue como referência de mercado)
  const valorInicialUSD = valorInicial / tipoCambioBlue;
  const valorFinalUSD = valorFinalLiquido / tipoCambioBlue;
  const comparativoUSD = arredondar(((valorFinalUSD - valorInicialUSD) / valorInicialUSD) * 100);

  const evolucaoMensal = gerarEvolucaoMensal(valorInicial, prazo, (dia) => {
    const bruto = evolucaoFn(dia);
    const rendimento = bruto - valorInicial;
    const ir = rendimento * ALIQUOTA_IR;
    return bruto - ir;
  });

  return {
    instrumento,
    valorInicial,
    valorFinal: valorFinalLiquido,
    rendimentoBruto,
    rendimentoLiquido,
    impostoRetido,
    inflacaoEstimada,
    rendimentoRealEstimado,
    evolucaoMensal,
    comparativoUSD,
  };
}

// ---------------------------------------------------------------------------
// Comparador entre múltiplos instrumentos
// ---------------------------------------------------------------------------

export function compararInstrumentos(
  instrumentoIds: string[],
  valorInicial: number,
  prazo: number,
  instrumentos: InstrumentoRendaFixa[],
  taxasMercado: TaxasMercado
): SimulacaoResult[] {
  return instrumentoIds
    .map((id) => {
      try {
        return calcularSimulacao(
          { instrumentoId: id, valorInicial, prazo, reinvestirJuros: true },
          instrumentos,
          taxasMercado
        );
      } catch (err) {
        console.warn(`[simulacaoService] compararInstrumentos skip "${id}":`, (err as Error).message);
        return null;
      }
    })
    .filter((r): r is SimulacaoResult => r !== null)
    .sort((a, b) => b.rendimentoLiquido - a.rendimentoLiquido);
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type ExemploErro = {
  explanation: string;
  excerpt: string | null;
  severity: "low" | "medium" | "high";
};

export type ErroAgrupado = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  quantidade: number;
  quantidadeAlta: number;
  quantidadeMedia: number;
  quantidadeBaixa: number;
  exemplos: ExemploErro[];
};

type RespostaBanco = {
  id: number;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
};

type ErroCorrecaoBanco = {
  id: number;
  correction_id: number;
  error_type_id: number;
  severity: "low" | "medium" | "high";
  explanation: string;
  excerpt: string | null;
  created_at: string;
};

type TipoErroBanco = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
};

export async function buscarErrosRecorrentes(
  supabase: SupabaseClient,
  userId: string
): Promise<ErroAgrupado[]> {
  const { data: respostasData, error: respostasError } = await supabase
    .from("user_answers")
    .select("id")
    .eq("user_id", userId);

  if (respostasError) {
    throw new Error(
      `Erro ao buscar respostas: ${respostasError.message}`
    );
  }

  const respostas = (respostasData ?? []) as RespostaBanco[];

  if (respostas.length === 0) {
    return [];
  }

  const answerIds = respostas.map((resposta) => resposta.id);

  const { data: correcoesData, error: correcoesError } = await supabase
    .from("corrections")
    .select(`
      id,
      answer_id
    `)
    .in("answer_id", answerIds);

  if (correcoesError) {
    throw new Error(
      `Erro ao buscar correções: ${correcoesError.message}`
    );
  }

  const correcoes = (correcoesData ?? []) as CorrecaoBanco[];

  if (correcoes.length === 0) {
    return [];
  }

  const correctionIds = correcoes.map((correcao) => correcao.id);

  const { data: errosData, error: errosError } = await supabase
    .from("correction_errors")
    .select(`
      id,
      correction_id,
      error_type_id,
      severity,
      explanation,
      excerpt,
      created_at
    `)
    .in("correction_id", correctionIds)
    .order("created_at", { ascending: false });

  if (errosError) {
    throw new Error(
      `Erro ao buscar erros identificados: ${errosError.message}`
    );
  }

  const erros = (errosData ?? []) as ErroCorrecaoBanco[];

  if (erros.length === 0) {
    return [];
  }

  const errorTypeIds = [
    ...new Set(erros.map((erro) => erro.error_type_id)),
  ];

  const { data: tiposData, error: tiposError } = await supabase
    .from("error_types")
    .select(`
      id,
      code,
      name,
      description,
      category
    `)
    .in("id", errorTypeIds);

  if (tiposError) {
    throw new Error(
      `Erro ao buscar tipos de erro: ${tiposError.message}`
    );
  }

  const tipos = (tiposData ?? []) as TipoErroBanco[];

  const agrupados: ErroAgrupado[] = tipos.map((tipo) => {
    const ocorrencias = erros.filter(
      (erro) => erro.error_type_id === tipo.id
    );

    return {
      id: tipo.id,
      code: tipo.code,
      name: tipo.name,
      description: tipo.description,
      category: tipo.category,
      quantidade: ocorrencias.length,
      quantidadeAlta: ocorrencias.filter(
        (erro) => erro.severity === "high"
      ).length,
      quantidadeMedia: ocorrencias.filter(
        (erro) => erro.severity === "medium"
      ).length,
      quantidadeBaixa: ocorrencias.filter(
        (erro) => erro.severity === "low"
      ).length,
      exemplos: ocorrencias.slice(0, 3).map((erro) => ({
        explanation: erro.explanation,
        excerpt: erro.excerpt,
        severity: erro.severity,
      })),
    };
  });

  return agrupados.sort((a, b) => {
    if (b.quantidade !== a.quantidade) {
      return b.quantidade - a.quantidade;
    }

    return b.quantidadeAlta - a.quantidadeAlta;
  });
}
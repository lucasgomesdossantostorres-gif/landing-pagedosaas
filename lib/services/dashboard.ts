import type { SupabaseClient } from "@supabase/supabase-js";

export type RespostaDashboard = {
  id: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
  question_id: number;
  question_title: string;
  maximum_score: number;
  correction_id: number | null;
  total_score: number | null;
};

export type ErroFrequente = {
  id: number;
  name: string;
  category: string;
  quantidade: number;
};

type RespostaBanco = {
  id: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
  question_id: number;
};

type QuestaoBanco = {
  id: number;
  title: string;
  maximum_score: number;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
  total_score: number | null;
};

type ErroBanco = {
  error_type_id: number;
};

type TipoErroBanco = {
  id: number;
  name: string;
  category: string;
};

export async function buscarDadosDashboard(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  respostas: RespostaDashboard[];
  errosFrequentes: ErroFrequente[];
}> {
  /*
   * 1. Buscar as respostas do usuário
   */
  const { data: respostasData, error: respostasError } = await supabase
    .from("user_answers")
    .select(`
      id,
      status,
      submitted_at,
      created_at,
      question_id
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (respostasError) {
    throw new Error(
      `Erro ao buscar respostas: ${respostasError.message}`
    );
  }

  const respostasBanco = (respostasData ?? []) as RespostaBanco[];

  if (respostasBanco.length === 0) {
    return {
      respostas: [],
      errosFrequentes: [],
    };
  }

  /*
   * 2. Buscar as questões relacionadas
   */
  const questionIds = [
    ...new Set(
      respostasBanco.map((resposta) => resposta.question_id)
    ),
  ];

  const { data: questoesData, error: questoesError } = await supabase
    .from("questions")
    .select(`
      id,
      title,
      maximum_score
    `)
    .in("id", questionIds);

  if (questoesError) {
    throw new Error(
      `Erro ao buscar questões: ${questoesError.message}`
    );
  }

  const questoes = (questoesData ?? []) as QuestaoBanco[];

  /*
   * 3. Buscar as correções relacionadas
   */
  const answerIds = respostasBanco.map((resposta) => resposta.id);

  const { data: correcoesData, error: correcoesError } = await supabase
    .from("corrections")
    .select(`
      id,
      answer_id,
      total_score
    `)
    .in("answer_id", answerIds);

  if (correcoesError) {
    throw new Error(
      `Erro ao buscar correções: ${correcoesError.message}`
    );
  }

  const correcoes = (correcoesData ?? []) as CorrecaoBanco[];

  /*
   * 4. Montar uma estrutura padronizada
   */
  const respostas: RespostaDashboard[] = respostasBanco.map(
    (resposta) => {
      const questao = questoes.find(
        (item) => item.id === resposta.question_id
      );

      const correcao = correcoes.find(
        (item) => item.answer_id === resposta.id
      );

      return {
        id: resposta.id,
        status: resposta.status,
        submitted_at: resposta.submitted_at,
        created_at: resposta.created_at,
        question_id: resposta.question_id,
        question_title: questao?.title ?? "Questão",
        maximum_score: Number(questao?.maximum_score ?? 0),
        correction_id: correcao?.id ?? null,
        total_score:
          correcao?.total_score === null ||
          correcao?.total_score === undefined
            ? null
            : Number(correcao.total_score),
      };
    }
  );

  /*
   * 5. Buscar erros recorrentes
   */
  const correctionIds = correcoes.map((correcao) => correcao.id);

  if (correctionIds.length === 0) {
    return {
      respostas,
      errosFrequentes: [],
    };
  }

  const { data: errosData, error: errosError } = await supabase
    .from("correction_errors")
    .select("error_type_id")
    .in("correction_id", correctionIds);

  if (errosError) {
    throw new Error(
      `Erro ao buscar erros recorrentes: ${errosError.message}`
    );
  }

  const erros = (errosData ?? []) as ErroBanco[];

  if (erros.length === 0) {
    return {
      respostas,
      errosFrequentes: [],
    };
  }

  /*
   * 6. Buscar nomes e categorias dos erros
   */
  const errorTypeIds = [
    ...new Set(erros.map((erro) => erro.error_type_id)),
  ];

  const { data: tiposData, error: tiposError } = await supabase
    .from("error_types")
    .select(`
      id,
      name,
      category
    `)
    .in("id", errorTypeIds);

  if (tiposError) {
    throw new Error(
      `Erro ao buscar tipos de erro: ${tiposError.message}`
    );
  }

  const tipos = (tiposData ?? []) as TipoErroBanco[];

  const errosFrequentes: ErroFrequente[] = tipos
    .map((tipo) => ({
      id: tipo.id,
      name: tipo.name,
      category: tipo.category,
      quantidade: erros.filter(
        (erro) => erro.error_type_id === tipo.id
      ).length,
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 3);

  return {
    respostas,
    errosFrequentes,
  };
}
import type { SupabaseClient } from "@supabase/supabase-js";

export type DesempenhoCriterio = {
  criterion_id: number;
  title: string;
  description: string;
  quantidade_avaliacoes: number;
  pontos_obtidos: number;
  pontos_possiveis: number;
  media_pontos: number;
  media_maxima: number;
  percentual: number;
};

type RespostaBanco = {
  id: number;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
};

type ItemCorrecaoBanco = {
  correction_id: number;
  criterion_id: number;
  score: number;
};

type CriterioBanco = {
  id: number;
  title: string;
  description: string;
  maximum_score: number;
};

export async function buscarDesempenhoPorCriterio(
  supabase: SupabaseClient,
  userId: string
): Promise<DesempenhoCriterio[]> {
  /*
   * 1. Buscar respostas do usuário
   */
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

  /*
   * 2. Buscar correções relacionadas
   */
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

  /*
   * 3. Buscar notas por critério
   */
  const correctionIds = correcoes.map((correcao) => correcao.id);

  const { data: itensData, error: itensError } = await supabase
    .from("correction_items")
    .select(`
      correction_id,
      criterion_id,
      score
    `)
    .in("correction_id", correctionIds);

  if (itensError) {
    throw new Error(
      `Erro ao buscar avaliações por critério: ${itensError.message}`
    );
  }

  const itens = (itensData ?? []) as ItemCorrecaoBanco[];

  if (itens.length === 0) {
    return [];
  }

  /*
   * 4. Buscar dados dos critérios
   */
  const criterionIds = [
    ...new Set(itens.map((item) => item.criterion_id)),
  ];

  const { data: criteriosData, error: criteriosError } = await supabase
    .from("evaluation_criteria")
    .select(`
      id,
      title,
      description,
      maximum_score
    `)
    .in("id", criterionIds);

  if (criteriosError) {
    throw new Error(
      `Erro ao buscar critérios: ${criteriosError.message}`
    );
  }

  const criterios = (criteriosData ?? []) as CriterioBanco[];

  /*
   * 5. Agrupar os resultados
   */
  const desempenho = criterios.map((criterio) => {
    const avaliacoes = itens.filter(
      (item) => item.criterion_id === criterio.id
    );

    const quantidadeAvaliacoes = avaliacoes.length;

    const pontosObtidos = avaliacoes.reduce(
      (total, item) => total + Number(item.score),
      0
    );

    const maximumScore = Number(criterio.maximum_score);

    const pontosPossiveis =
      quantidadeAvaliacoes * maximumScore;

    const mediaPontos =
      quantidadeAvaliacoes > 0
        ? pontosObtidos / quantidadeAvaliacoes
        : 0;

    const percentual =
      pontosPossiveis > 0
        ? Math.min(
            Math.max(
              (pontosObtidos / pontosPossiveis) * 100,
              0
            ),
            100
          )
        : 0;

    return {
      criterion_id: criterio.id,
      title: criterio.title,
      description: criterio.description,
      quantidade_avaliacoes: quantidadeAvaliacoes,
      pontos_obtidos: pontosObtidos,
      pontos_possiveis: pontosPossiveis,
      media_pontos: mediaPontos,
      media_maxima: maximumScore,
      percentual,
    };
  });

  return desempenho.sort(
    (a, b) => a.percentual - b.percentual
  );
}
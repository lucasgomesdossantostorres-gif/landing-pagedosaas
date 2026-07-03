import type { SupabaseClient } from "@supabase/supabase-js";

export type PontoEvolucao = {
  answer_id: number;
  correction_id: number;
  question_title: string;
  subject: string | null;
  total_score: number;
  maximum_score: number;
  percentage: number;
  corrected_at: string;
};

type RespostaBanco = {
  id: number;
  question_id: number;
};

type QuestaoBanco = {
  id: number;
  title: string;
  subject: string | null;
  maximum_score: number;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
  total_score: number | null;
  created_at: string;
};

export async function buscarEvolucaoDoUsuario(
  supabase: SupabaseClient,
  userId: string
): Promise<PontoEvolucao[]> {
  /*
   * 1. Buscar as respostas do usuário
   */
  const { data: respostasData, error: respostasError } = await supabase
    .from("user_answers")
    .select(`
      id,
      question_id
    `)
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
   * 2. Buscar as correções
   */
  const answerIds = respostas.map((resposta) => resposta.id);

  const { data: correcoesData, error: correcoesError } = await supabase
    .from("corrections")
    .select(`
      id,
      answer_id,
      total_score,
      created_at
    `)
    .in("answer_id", answerIds)
    .order("created_at", { ascending: true });

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
   * 3. Buscar as questões relacionadas
   */
  const questionIds = [
    ...new Set(
      respostas.map((resposta) => resposta.question_id)
    ),
  ];

  const { data: questoesData, error: questoesError } = await supabase
    .from("questions")
    .select(`
      id,
      title,
      subject,
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
   * 4. Padronizar os dados
   */
  return correcoes
    .map((correcao) => {
      const resposta = respostas.find(
        (item) => item.id === correcao.answer_id
      );

      if (!resposta) {
        return null;
      }

      const questao = questoes.find(
        (item) => item.id === resposta.question_id
      );

      const totalScore = Number(correcao.total_score ?? 0);
      const maximumScore = Number(questao?.maximum_score ?? 0);

      const percentage =
        maximumScore > 0
          ? Math.min(
              Math.max((totalScore / maximumScore) * 100, 0),
              100
            )
          : 0;

      return {
        answer_id: resposta.id,
        correction_id: correcao.id,
        question_title: questao?.title ?? "Questão",
        subject: questao?.subject ?? null,
        total_score: totalScore,
        maximum_score: maximumScore,
        percentage,
        corrected_at: correcao.created_at,
      };
    })
    .filter(
      (item): item is PontoEvolucao => item !== null
    );
}
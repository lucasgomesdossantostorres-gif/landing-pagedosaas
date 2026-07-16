import type { SupabaseClient } from "@supabase/supabase-js";

export type RespostaHistorico = {
  id: number;
  status: string;
  submitted_at: string | null;
  created_at: string;

  question_id: number;
  selected_question: number | null;

  question_title: string;
  subject: string | null;
  examining_board: string | null;
  maximum_score: number;

  correction_id: number | null;
  total_score: number | null;
};

type RespostaBanco = {
  id: number;
  status: string;
  submitted_at: string | null;
  created_at: string;

  question_id: number;
  selected_question: number | null;
};

type QuestaoBanco = {
  id: number;
  title: string;
  subject: string | null;
  examining_board: string | null;
  maximum_score: number | string | null;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
  total_score: number | string | null;
};

export async function buscarHistoricoDoUsuario(
  supabase: SupabaseClient,
  userId: string,
): Promise<RespostaHistorico[]> {
  /*
   * 1. Busca as respostas do usuário.
   *
   * selected_question identifica qual das quatro
   * questões da prova foi respondida.
   */
  const {
    data: respostasData,
    error: respostasError,
  } = await supabase
    .from("user_answers")
    .select(`
      id,
      status,
      submitted_at,
      created_at,
      question_id,
      selected_question
    `)
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (respostasError) {
    throw new Error(
      `Erro ao buscar respostas: ${respostasError.message}`,
    );
  }

  const respostas =
    (respostasData ?? []) as RespostaBanco[];

  if (respostas.length === 0) {
    return [];
  }

  /*
   * 2. Busca as provas relacionadas.
   */
  const questionIds = [
    ...new Set(
      respostas.map(
        (resposta) => resposta.question_id,
      ),
    ),
  ];

  const {
    data: questoesData,
    error: questoesError,
  } = await supabase
    .from("questions")
    .select(`
      id,
      title,
      subject,
      examining_board,
      maximum_score
    `)
    .in("id", questionIds);

  if (questoesError) {
    throw new Error(
      `Erro ao buscar questões: ${questoesError.message}`,
    );
  }

  const questoes =
    (questoesData ?? []) as QuestaoBanco[];

  /*
   * 3. Busca as correções relacionadas.
   */
  const answerIds = respostas.map(
    (resposta) => resposta.id,
  );

  const {
    data: correcoesData,
    error: correcoesError,
  } = await supabase
    .from("corrections")
    .select(`
      id,
      answer_id,
      total_score
    `)
    .in("answer_id", answerIds);

  if (correcoesError) {
    throw new Error(
      `Erro ao buscar correções: ${correcoesError.message}`,
    );
  }

  const correcoes =
    (correcoesData ?? []) as CorrecaoBanco[];

  /*
   * 4. Padroniza os dados para o histórico.
   */
  return respostas.map((resposta) => {
    const questao = questoes.find(
      (item) =>
        item.id === resposta.question_id,
    );

    const correcao = correcoes.find(
      (item) =>
        item.answer_id === resposta.id,
    );

    const selectedQuestion =
      Number(resposta.selected_question);

    const numeroQuestaoValido =
      Number.isInteger(selectedQuestion) &&
      selectedQuestion >= 1 &&
      selectedQuestion <= 4
        ? selectedQuestion
        : 1;

    return {
      id: resposta.id,
      status: resposta.status,
      submitted_at:
        resposta.submitted_at,
      created_at:
        resposta.created_at,

      question_id:
        resposta.question_id,

      selected_question:
        numeroQuestaoValido,

      question_title:
        questao?.title ??
        "Prova discursiva",

      subject:
        questao?.subject ?? null,

      examining_board:
        questao?.examining_board ?? null,

      maximum_score:
        Number(
          questao?.maximum_score ?? 0,
        ),

      correction_id:
        correcao?.id ?? null,

      total_score:
        correcao?.total_score === null ||
        correcao?.total_score === undefined
          ? null
          : Number(
              correcao.total_score,
            ),
    };
  });
}
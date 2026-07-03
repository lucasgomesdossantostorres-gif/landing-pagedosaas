"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type RespostaBanco = {
  id: number;
  user_id: string;
  question_id: number;
  answer_text: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
};

type QuestaoBanco = {
  id: number;
  title: string | null;
  statement: string | null;
  examining_board: string | null;
  exam_name: string | null;
  exam_year: number | null;
  maximum_score: number | null;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
  total_score: number | null;
  summary_feedback: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvement_suggestions: string | null;
  improved_answer: string | null;
  validation_status: string | null;
  validation_feedback: string | null;
  validation_confidence: number | null;
  content_score: number | null;
  content_maximum_score: number | null;
  content_feedback: string | null;
  language_error_count: number | null;
  effective_line_count: number | null;
  language_discount: number | null;
  language_feedback: string | null;
  calculation_details: unknown;
  model_used: string | null;
  prompt_version: string | null;
  processing_time_ms: number | null;
  created_at: string;
};

type ErroLinguagemBanco = {
  id: number;
  correction_id: number;
  criterion_code: string;
  criterion_name: string;
  excerpt: string;
  explanation: string;
  suggested_correction: string | null;
  occurrence_order: number;
};

type CalculoDetalhes = {
  content_score?: number;
  content_maximum_score?: number;
  language_error_count?: number;
  fixed_penalty_per_error?: number;
  language_discount?: number;
  raw_final_score?: number;
  final_score?: number;
  question_maximum_score?: number;
  formula?: string;
};

function formatarData(data: string | null) {
  if (!data) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function formatarNumero(valor: number | null | undefined, casas = 2) {
  return Number(valor ?? 0).toFixed(casas);
}

function traduzirStatus(status: string) {
  const traducoes: Record<string, string> = {
    draft: "Rascunho",
    submitted: "Aguardando correção",
    processing: "Correção em andamento",
    correcting: "Correção em andamento",
    corrected: "Corrigida",
    failed: "Falha na correção",
  };

  return traducoes[status] ?? status;
}

function classeStatus(status: string) {
  const classes: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    submitted: "bg-amber-50 text-amber-800",
    processing: "bg-blue-50 text-blue-700",
    correcting: "bg-blue-50 text-blue-700",
    corrected: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
  };

  return classes[status] ?? "bg-slate-100 text-slate-700";
}

function normalizarCalculo(value: unknown): CalculoDetalhes {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as CalculoDetalhes;
}

function SecaoTexto(props: {
  titulo: string;
  texto: string | null;
  vazio?: string;
}) {
  if (!props.texto) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900">
        {props.titulo}
      </h2>

      <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-700">
        {props.texto || props.vazio}
      </p>
    </section>
  );
}

export default function RespostaPage() {
  const params = useParams();
  const router = useRouter();
  const respostaId = Number(params.id);

  const [resposta, setResposta] = useState<RespostaBanco | null>(null);
  const [questao, setQuestao] = useState<QuestaoBanco | null>(null);
  const [correcao, setCorrecao] = useState<CorrecaoBanco | null>(null);
  const [errosLinguagem, setErrosLinguagem] = useState<
    ErroLinguagemBanco[]
  >([]);
  const [carregando, setCarregando] = useState(true);
  const [corrigindo, setCorrigindo] = useState(false);
  const [corrigindoLinguagem, setCorrigindoLinguagem] = useState(false);
  const [calculandoNota, setCalculandoNota] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const carregarDados = useCallback(async () => {
    if (!Number.isInteger(respostaId) || respostaId <= 0) {
      setErro("Identificador da resposta inválido.");
      setCarregando(false);
      return;
    }

    try {
      setErro("");

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data: respostaData, error: respostaError } = await supabase
        .from("user_answers")
        .select(`
          id,
          user_id,
          question_id,
          answer_text,
          status,
          created_at,
          submitted_at
        `)
        .eq("id", respostaId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (respostaError) {
        throw new Error(
          `Erro ao buscar resposta: ${respostaError.message}`,
        );
      }

      if (!respostaData) {
        throw new Error("Resposta não encontrada.");
      }

      const respostaCarregada = respostaData as RespostaBanco;
      setResposta(respostaCarregada);

      const { data: questaoData, error: questaoError } = await supabase
        .from("questions")
        .select(`
          id,
          title,
          statement,
          examining_board,
          exam_name,
          exam_year,
          maximum_score
        `)
        .eq("id", respostaCarregada.question_id)
        .maybeSingle();

      if (questaoError) {
        throw new Error(
          `Erro ao buscar questão: ${questaoError.message}`,
        );
      }

      if (!questaoData) {
        throw new Error("Questão vinculada não encontrada.");
      }

      setQuestao(questaoData as QuestaoBanco);

      const { data: correcaoData, error: correcaoError } = await supabase
        .from("corrections")
        .select(`
          id,
          answer_id,
          total_score,
          summary_feedback,
          strengths,
          weaknesses,
          improvement_suggestions,
          improved_answer,
          validation_status,
          validation_feedback,
          validation_confidence,
          content_score,
          content_maximum_score,
          content_feedback,
          language_error_count,
          effective_line_count,
          language_discount,
          language_feedback,
          calculation_details,
          model_used,
          prompt_version,
          processing_time_ms,
          created_at
        `)
        .eq("answer_id", respostaId)
        .maybeSingle();

      if (correcaoError) {
        throw new Error(
          `Erro ao buscar correção: ${correcaoError.message}`,
        );
      }

      if (!correcaoData) {
        setCorrecao(null);
        setErrosLinguagem([]);
        return;
      }

      const correcaoCarregada = correcaoData as CorrecaoBanco;
      setCorrecao(correcaoCarregada);

      const {
        data: errosLinguagemData,
        error: errosLinguagemError,
      } = await supabase
        .from("language_errors")
        .select(`
          id,
          correction_id,
          criterion_code,
          criterion_name,
          excerpt,
          explanation,
          suggested_correction,
          occurrence_order
        `)
        .eq("correction_id", correcaoCarregada.id)
        .order("occurrence_order", { ascending: true });

      if (errosLinguagemError) {
        throw new Error(
          `Erro ao buscar erros linguísticos: ${errosLinguagemError.message}`,
        );
      }

      setErrosLinguagem(
        (errosLinguagemData ?? []) as ErroLinguagemBanco[],
      );
    } catch (errorCarregamento) {
      setErro(
        errorCarregamento instanceof Error
          ? errorCarregamento.message
          : "Erro desconhecido ao carregar a resposta.",
      );
    } finally {
      setCarregando(false);
    }
  }, [respostaId, router]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const calculo = useMemo(
    () => normalizarCalculo(correcao?.calculation_details),
    [correcao],
  );

  const percentualFinal = useMemo(() => {
    const notaMaxima = Number(
      correcao?.content_maximum_score ?? questao?.maximum_score ?? 0,
    );

    if (!correcao || notaMaxima <= 0) {
      return 0;
    }

    return Math.min(
      Math.max((Number(correcao.total_score ?? 0) / notaMaxima) * 100, 0),
      100,
    );
  }, [correcao, questao]);

  async function executarEtapa(paramsExecucao: {
    endpoint: string;
    iniciar: (value: boolean) => void;
    mensagemNova: string;
    mensagemCache: string;
    erroPadrao: string;
  }) {
    if (!resposta) {
      return;
    }

    try {
      paramsExecucao.iniciar(true);
      setMensagem("");
      setErro("");

      const response = await fetch(paramsExecucao.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer_id: resposta.id,
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.error ?? paramsExecucao.erroPadrao);
      }

      setMensagem(
        resultado.cached
          ? paramsExecucao.mensagemCache
          : paramsExecucao.mensagemNova,
      );

      setCarregando(true);
      await carregarDados();
    } catch (erroExecucao) {
      setErro(
        erroExecucao instanceof Error
          ? erroExecucao.message
          : paramsExecucao.erroPadrao,
      );

      setCarregando(true);
      await carregarDados();
    } finally {
      paramsExecucao.iniciar(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Carregando resposta...</p>
      </main>
    );
  }

  if (erro && !resposta) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <section className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Não foi possível abrir a resposta
          </h1>

          <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
            {erro}
          </p>

          <Link
            href="/historico"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
          >
            Voltar ao histórico
          </Link>
        </section>
      </main>
    );
  }

  if (!resposta || !questao) {
    return null;
  }

  const podeCorrigir =
    resposta.status === "submitted" || resposta.status === "failed";

  const nivel2Concluido = Boolean(
    correcao?.content_feedback && correcao.content_score !== null,
  );

  const nivel3Concluido =
    correcao?.language_error_count !== null &&
    correcao?.language_error_count !== undefined;

  const nivel4Concluido = Boolean(correcao?.calculation_details);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap gap-5">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-600"
          >
            Voltar ao dashboard
          </Link>

          <Link
            href="/historico"
            className="text-sm font-semibold text-blue-600"
          >
            Ver histórico
          </Link>

          <Link
            href="/questoes"
            className="text-sm font-semibold text-blue-600"
          >
            Ver questões
          </Link>
        </nav>

        <header className="mt-6 rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Resposta discursiva
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {questao.title ||
                  questao.exam_name ||
                  "Questão discursiva"}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
                {questao.examining_board && (
                  <span>{questao.examining_board}</span>
                )}
                {questao.exam_year && <span>• {questao.exam_year}</span>}
                {questao.exam_name && <span>• {questao.exam_name}</span>}
              </div>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold ${classeStatus(
                resposta.status,
              )}`}
            >
              {traduzirStatus(resposta.status)}
            </span>
          </div>
        </header>

        {mensagem && (
          <p className="mt-6 rounded-lg bg-green-50 p-4 text-green-700">
            {mensagem}
          </p>
        )}

        {erro && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {erro}
          </p>
        )}

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Enunciado</h2>

          <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-700">
            {questao.statement}
          </p>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-slate-900">
              Sua resposta
            </h2>

            <span className="text-sm text-slate-500">
              Enviada em{" "}
              {formatarData(
                resposta.submitted_at ?? resposta.created_at,
              )}
            </span>
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-6">
            <p className="whitespace-pre-wrap leading-8 text-slate-700">
              {resposta.answer_text}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Etapas da correção
          </h2>

          <p className="mt-3 leading-7 text-slate-600">
            O conteúdo é avaliado diretamente pelo gabarito oficial. Não há
            critérios artificiais ou notas por critério.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() =>
                executarEtapa({
                  endpoint: "/api/corrigir/nivel-2",
                  iniciar: setCorrigindo,
                  mensagemNova: "Nível 2 concluído com sucesso.",
                  mensagemCache:
                    "O Nível 2 já havia sido executado. O resultado foi carregado.",
                  erroPadrao:
                    "Não foi possível realizar a correção de conteúdo.",
                })
              }
              disabled={corrigindo || (!podeCorrigir && !correcao)}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {corrigindo
                ? "Corrigindo conteúdo..."
                : nivel2Concluido
                  ? "Recarregar Nível 2"
                  : "Executar Nível 2"}
            </button>

            <button
              type="button"
              onClick={() =>
                executarEtapa({
                  endpoint: "/api/corrigir/nivel-3",
                  iniciar: setCorrigindoLinguagem,
                  mensagemNova: "Nível 3 concluído com sucesso.",
                  mensagemCache:
                    "O Nível 3 já havia sido executado. O resultado foi carregado.",
                  erroPadrao:
                    "Não foi possível realizar a análise linguística.",
                })
              }
              disabled={corrigindoLinguagem || !nivel2Concluido}
              className="rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {corrigindoLinguagem
                ? "Analisando linguagem..."
                : nivel3Concluido
                  ? "Recarregar Nível 3"
                  : "Executar Nível 3"}
            </button>

            <button
              type="button"
              onClick={() =>
                executarEtapa({
                  endpoint: "/api/corrigir/nivel-4",
                  iniciar: setCalculandoNota,
                  mensagemNova:
                    "Nível 4 concluído. A nota final foi calculada.",
                  mensagemCache:
                    "O Nível 4 já havia sido executado. O resultado foi carregado.",
                  erroPadrao: "Não foi possível calcular a nota final.",
                })
              }
              disabled={calculandoNota || !nivel3Concluido}
              className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {calculandoNota
                ? "Calculando nota..."
                : nivel4Concluido
                  ? "Recarregar Nível 4"
                  : "Executar Nível 4"}
            </button>
          </div>
        </section>

        {correcao && (
          <>
            <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-8">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                    {nivel4Concluido ? "Resultado final" : "Resultado parcial"}
                  </p>

                  <h2 className="mt-2 text-3xl font-bold text-slate-900">
                    {nivel4Concluido
                      ? "Correção concluída"
                      : "Correção em andamento"}
                  </h2>

                  <p className="mt-3 text-sm text-slate-500">
                    Registrada em {formatarData(correcao.created_at)}
                  </p>

                  {correcao.summary_feedback && (
                    <p className="mt-6 whitespace-pre-wrap leading-7 text-slate-700">
                      {correcao.summary_feedback}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-blue-50 px-8 py-6 text-center">
                  <p className="text-sm font-medium text-blue-700">
                    {nivel4Concluido ? "Nota final" : "Nota de conteúdo"}
                  </p>

                  <p className="mt-1 text-5xl font-bold text-blue-800">
                    {formatarNumero(
                      nivel4Concluido
                        ? correcao.total_score
                        : correcao.content_score,
                    )}
                  </p>

                  <p className="mt-2 text-sm text-blue-700">
                    de{" "}
                    {formatarNumero(
                      correcao.content_maximum_score ??
                        questao.maximum_score,
                    )}
                  </p>

                  {nivel4Concluido && (
                    <p className="mt-2 font-semibold text-blue-800">
                      {percentualFinal.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-5 md:grid-cols-3">
              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Nota de conteúdo
                </p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {formatarNumero(
                    correcao.content_score ?? calculo.content_score,
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  de{" "}
                  {formatarNumero(
                    correcao.content_maximum_score ??
                      calculo.content_maximum_score ??
                      questao.maximum_score,
                  )}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Erros linguísticos
                </p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {correcao.language_error_count ?? 0}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Desconto linguístico
                </p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {formatarNumero(correcao.language_discount)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  0,10 por ocorrência válida
                </p>
              </article>
            </section>

            <div className="mt-8 grid gap-8">
              <SecaoTexto
                titulo="Avaliação do conteúdo pelo gabarito"
                texto={correcao.content_feedback}
              />

              <SecaoTexto
                titulo="Pontos fortes"
                texto={correcao.strengths}
              />

              <SecaoTexto
                titulo="Pontos a melhorar"
                texto={correcao.weaknesses}
              />

              <SecaoTexto
                titulo="Sugestões de melhoria"
                texto={correcao.improvement_suggestions}
              />

              <SecaoTexto
                titulo="Avaliação linguística"
                texto={correcao.language_feedback}
              />
            </div>

            {errosLinguagem.length > 0 && (
              <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">
                  Ocorrências linguísticas
                </h2>

                <div className="mt-6 grid gap-4">
                  {errosLinguagem.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-200 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                          {item.criterion_code}
                        </span>
                        <strong className="text-slate-900">
                          {item.criterion_name}
                        </strong>
                      </div>

                      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-slate-700">
                        “{item.excerpt}”
                      </p>

                      <p className="mt-3 leading-7 text-slate-700">
                        {item.explanation}
                      </p>

                      {item.suggested_correction && (
                        <p className="mt-3 text-sm text-emerald-700">
                          Sugestão: {item.suggested_correction}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {nivel4Concluido && (
              <section className="mt-8 rounded-2xl bg-slate-900 p-8 text-white shadow-sm">
                <h2 className="text-2xl font-bold">Cálculo final</h2>
                <p className="mt-4 leading-8 text-slate-200">
                  Nota de conteúdo: {formatarNumero(calculo.content_score)}
                  <br />
                  Erros linguísticos: {calculo.language_error_count ?? 0}
                  <br />
                  Desconto: {formatarNumero(calculo.language_discount)}
                  <br />
                  Nota final: {formatarNumero(calculo.final_score)}
                </p>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

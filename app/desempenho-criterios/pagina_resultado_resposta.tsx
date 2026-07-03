"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  title: string;
  statement: string;
  examining_board: string | null;
  exam_name: string | null;
  exam_year: number | null;
  subject: string | null;
  topic: string | null;
  maximum_score: number;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
  total_score: number;
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

type ItemCorrecaoBanco = {
  id: number;
  correction_id: number;
  criterion_id: number;
  score: number;
  feedback: string;
};

type CriterioBanco = {
  id: number;
  title: string;
  description: string | null;
  maximum_score: number;
  display_order: number;
};

type ErroConteudoBanco = {
  id: number;
  correction_id: number;
  error_type_id: number;
  severity: "low" | "medium" | "high";
  explanation: string;
  excerpt: string | null;
};

type TipoErroBanco = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
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

type ItemCorrecaoCompleto = ItemCorrecaoBanco & {
  criterion_title: string;
  criterion_description: string | null;
  maximum_score: number;
  display_order: number;
};

type ErroConteudoCompleto = ErroConteudoBanco & {
  code: string;
  name: string;
  description: string | null;
  category: string;
};

type CalculoDetalhes = {
  content_score?: number;
  content_maximum_score?: number;
  language_error_count?: number;
  effective_line_count?: number;
  language_error_factor?: number;
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
    corrected: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
  };

  return classes[status] ?? "bg-slate-100 text-slate-700";
}

function traduzirGravidade(severity: string) {
  const traducoes: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
  };

  return traducoes[severity] ?? severity;
}

function classeGravidade(severity: string) {
  const classes: Record<string, string> = {
    low: "bg-green-50 text-green-700",
    medium: "bg-amber-50 text-amber-700",
    high: "bg-red-50 text-red-700",
  };

  return classes[severity] ?? "bg-slate-100 text-slate-700";
}

function traduzirCategoria(category: string) {
  const traducoes: Record<string, string> = {
    content: "Conteúdo",
    structure: "Estrutura",
    language: "Linguagem",
    argumentation: "Argumentação",
    adherence: "Aderência ao tema",
  };

  return traducoes[category] ?? category;
}

function traduzirValidacao(status: string | null) {
  const traducoes: Record<string, string> = {
    adequate: "Material adequado para correção",
    adequate_with_observations: "Adequado, com observações",
    insufficient_question: "Questão insuficiente",
    insufficient_reference: "Gabarito insuficiente",
    insufficient_answer: "Resposta insuficiente",
  };

  return status ? traducoes[status] ?? status : "Não informada";
}

function normalizarCalculo(value: unknown): CalculoDetalhes {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return value as CalculoDetalhes;
}

export default function RespostaPage() {
  const params = useParams();
  const router = useRouter();
  const respostaId = Number(params.id);

  const [resposta, setResposta] = useState<RespostaBanco | null>(null);
  const [questao, setQuestao] = useState<QuestaoBanco | null>(null);
  const [correcao, setCorrecao] = useState<CorrecaoBanco | null>(null);
  const [itens, setItens] = useState<ItemCorrecaoCompleto[]>([]);
  const [errosConteudo, setErrosConteudo] = useState<ErroConteudoCompleto[]>([]);
  const [errosLinguagem, setErrosLinguagem] = useState<ErroLinguagemBanco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [corrigindo, setCorrigindo] = useState(false);
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
        throw new Error(`Erro ao buscar resposta: ${respostaError.message}`);
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
          subject,
          topic,
          maximum_score
        `)
        .eq("id", respostaCarregada.question_id)
        .maybeSingle();

      if (questaoError) {
        throw new Error(`Erro ao buscar questão: ${questaoError.message}`);
      }

      if (!questaoData) {
        throw new Error("Questão vinculada não encontrada.");
      }

      setQuestao(questaoData as QuestaoBanco);

      const { data: criteriosData, error: criteriosError } = await supabase
        .from("evaluation_criteria")
        .select(`
          id,
          title,
          description,
          maximum_score,
          display_order
        `)
        .eq("question_id", respostaCarregada.question_id)
        .order("display_order", { ascending: true });

      if (criteriosError) {
        throw new Error(`Erro ao buscar critérios: ${criteriosError.message}`);
      }

      const criterios = (criteriosData ?? []) as CriterioBanco[];

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
        throw new Error(`Erro ao buscar correção: ${correcaoError.message}`);
      }

      if (!correcaoData) {
        setCorrecao(null);
        setItens([]);
        setErrosConteudo([]);
        setErrosLinguagem([]);
        return;
      }

      const correcaoCarregada = correcaoData as CorrecaoBanco;
      setCorrecao(correcaoCarregada);

      const { data: itensData, error: itensError } = await supabase
        .from("correction_items")
        .select(`
          id,
          correction_id,
          criterion_id,
          score,
          feedback
        `)
        .eq("correction_id", correcaoCarregada.id);

      if (itensError) {
        throw new Error(`Erro ao buscar itens da correção: ${itensError.message}`);
      }

      const itensBanco = (itensData ?? []) as ItemCorrecaoBanco[];

      const itensCompletos: ItemCorrecaoCompleto[] = itensBanco
        .map((item) => {
          const criterio = criterios.find(
            (registro) => registro.id === item.criterion_id
          );

          return {
            ...item,
            criterion_title: criterio?.title ?? "Critério",
            criterion_description: criterio?.description ?? null,
            maximum_score: Number(criterio?.maximum_score ?? 0),
            display_order: criterio?.display_order ?? 999,
          };
        })
        .sort((a, b) => a.display_order - b.display_order);

      setItens(itensCompletos);

      const { data: errosConteudoData, error: errosConteudoError } =
        await supabase
          .from("correction_errors")
          .select(`
            id,
            correction_id,
            error_type_id,
            severity,
            explanation,
            excerpt
          `)
          .eq("correction_id", correcaoCarregada.id);

      if (errosConteudoError) {
        throw new Error(
          `Erro ao buscar erros de conteúdo: ${errosConteudoError.message}`
        );
      }

      const errosBanco = (errosConteudoData ?? []) as ErroConteudoBanco[];

      if (errosBanco.length > 0) {
        const errorTypeIds = [
          ...new Set(errosBanco.map((item) => item.error_type_id)),
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

        const errosCompletos: ErroConteudoCompleto[] = errosBanco.map(
          (item) => {
            const tipo = tipos.find(
              (registro) => registro.id === item.error_type_id
            );

            return {
              ...item,
              code: tipo?.code ?? "UNKNOWN",
              name: tipo?.name ?? "Erro identificado",
              description: tipo?.description ?? null,
              category: tipo?.category ?? "content",
            };
          }
        );

        setErrosConteudo(errosCompletos);
      } else {
        setErrosConteudo([]);
      }

      const { data: errosLinguagemData, error: errosLinguagemError } =
        await supabase
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
          `Erro ao buscar erros linguísticos: ${errosLinguagemError.message}`
        );
      }

      setErrosLinguagem(
        (errosLinguagemData ?? []) as ErroLinguagemBanco[]
      );
    } catch (errorCarregamento) {
      setErro(
        errorCarregamento instanceof Error
          ? errorCarregamento.message
          : "Erro desconhecido ao carregar a resposta."
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
    [correcao]
  );

  const percentualFinal = useMemo(() => {
    if (!correcao || !questao || Number(questao.maximum_score) <= 0) {
      return 0;
    }

    return Math.min(
      Math.max(
        (Number(correcao.total_score) / Number(questao.maximum_score)) * 100,
        0
      ),
      100
    );
  }, [correcao, questao]);

  async function corrigirResposta() {
    if (!resposta) {
      return;
    }

    try {
      setCorrigindo(true);
      setMensagem("");
      setErro("");

      const response = await fetch("/api/corrigir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answerId: resposta.id,
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado.error ?? "Não foi possível realizar a correção."
        );
      }

      setMensagem(
        resultado.alreadyCorrected
          ? "Esta resposta já possuía correção. O resultado foi carregado."
          : "Correção concluída com sucesso."
      );

      setCarregando(true);
      await carregarDados();
    } catch (erroCorrecao) {
      setErro(
        erroCorrecao instanceof Error
          ? erroCorrecao.message
          : "Erro desconhecido durante a correção."
      );

      setCarregando(true);
      await carregarDados();
    } finally {
      setCorrigindo(false);
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
                {questao.title}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
                {questao.subject && <span>{questao.subject}</span>}
                {questao.topic && <span>• {questao.topic}</span>}
                {questao.examining_board && (
                  <span>• {questao.examining_board}</span>
                )}
                {questao.exam_name && <span>• {questao.exam_name}</span>}
                {questao.exam_year && <span>• {questao.exam_year}</span>}
              </div>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold ${classeStatus(
                resposta.status
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
              {formatarData(resposta.submitted_at ?? resposta.created_at)}
            </span>
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-6">
            <p className="whitespace-pre-wrap leading-8 text-slate-700">
              {resposta.answer_text}
            </p>
          </div>
        </section>

        {!correcao && (
          <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
            {resposta.status === "processing" ? (
              <>
                <h2 className="text-2xl font-bold text-slate-900">
                  Correção em andamento
                </h2>

                <p className="mt-3 leading-7 text-slate-600">
                  A resposta está passando pelos quatro níveis de análise.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setCarregando(true);
                    carregarDados();
                  }}
                  className="mt-6 rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700"
                >
                  Atualizar resultado
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-900">
                  {resposta.status === "failed"
                    ? "Tentar correção novamente"
                    : "Correção por inteligência artificial"}
                </h2>

                <p className="mt-3 leading-7 text-slate-600">
                  O sistema analisará a consistência do material, o conteúdo,
                  a linguagem e aplicará a fórmula de cálculo configurada.
                </p>

                {podeCorrigir && (
                  <button
                    type="button"
                    onClick={corrigirResposta}
                    disabled={corrigindo}
                    className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {corrigindo
                      ? "Corrigindo..."
                      : resposta.status === "failed"
                        ? "Tentar novamente"
                        : "Corrigir com IA"}
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {correcao && (
          <>
            <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-8">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                    Resultado final
                  </p>

                  <h2 className="mt-2 text-3xl font-bold text-slate-900">
                    Correção concluída
                  </h2>

                  <p className="mt-3 text-sm text-slate-500">
                    Corrigida em {formatarData(correcao.created_at)}
                  </p>

                  {correcao.summary_feedback && (
                    <p className="mt-6 whitespace-pre-wrap leading-7 text-slate-700">
                      {correcao.summary_feedback}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-blue-50 px-8 py-6 text-center">
                  <p className="text-sm font-medium text-blue-700">
                    Nota final
                  </p>

                  <p className="mt-1 text-5xl font-bold text-blue-800">
                    {formatarNumero(correcao.total_score)}
                  </p>

                  <p className="mt-2 text-sm text-blue-700">
                    de {formatarNumero(questao.maximum_score)}
                  </p>

                  <p className="mt-2 font-semibold text-blue-800">
                    {percentualFinal.toFixed(1)}%
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Nota de conteúdo
                </p>

                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {formatarNumero(
                    correcao.content_score ?? calculo.content_score
                  )}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  de{" "}
                  {formatarNumero(
                    correcao.content_maximum_score ??
                      calculo.content_maximum_score ??
                      questao.maximum_score
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
                  Linhas consideradas
                </p>

                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {correcao.effective_line_count ?? 0}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Desconto linguístico
                </p>

                <p className="mt-3 text-3xl font-bold text-red-700">
                  -{formatarNumero(correcao.language_discount)}
                </p>
              </article>
            </section>

            <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Nível 1 — Validação do material
              </h2>

              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  {traduzirValidacao(correcao.validation_status)}
                </span>

                {correcao.validation_confidence !== null && (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                    Confiança:{" "}
                    {(Number(correcao.validation_confidence) * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {correcao.validation_feedback && (
                <p className="mt-5 whitespace-pre-wrap leading-7 text-slate-700">
                  {correcao.validation_feedback}
                </p>
              )}
            </section>

            {itens.length > 0 && (
              <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">
                  Nível 2 — Correção de conteúdo
                </h2>

                <div className="mt-6 space-y-5">
                  {itens.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-200 p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-3xl">
                          <h3 className="text-lg font-bold text-slate-900">
                            {item.criterion_title}
                          </h3>

                          {item.criterion_description && (
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              {item.criterion_description}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-700">
                            {formatarNumero(item.score)}
                          </p>

                          <p className="text-sm text-slate-500">
                            de {formatarNumero(item.maximum_score)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-5 whitespace-pre-wrap leading-7 text-slate-700">
                        {item.feedback}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8 grid gap-6 md:grid-cols-2">
              <article className="rounded-2xl bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-green-700">
                  Pontos fortes
                </h2>

                <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
                  {correcao.strengths ||
                    "Nenhum ponto forte específico foi registrado."}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-red-700">
                  Pontos a melhorar
                </h2>

                <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
                  {correcao.weaknesses ||
                    "Nenhum ponto fraco específico foi registrado."}
                </p>
              </article>
            </section>

            {errosConteudo.length > 0 && (
              <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">
                  Problemas de conteúdo identificados
                </h2>

                <div className="mt-6 space-y-5">
                  {errosConteudo.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-200 p-6"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${classeGravidade(
                            item.severity
                          )}`}
                        >
                          Gravidade {traduzirGravidade(item.severity)}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                          {traduzirCategoria(item.category)}
                        </span>
                      </div>

                      <h3 className="mt-4 text-lg font-bold text-slate-900">
                        {item.name}
                      </h3>

                      <p className="mt-3 leading-7 text-slate-700">
                        {item.explanation}
                      </p>

                      {item.excerpt && (
                        <blockquote className="mt-4 border-l-4 border-slate-300 pl-4 italic text-slate-600">
                          “{item.excerpt}”
                        </blockquote>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Nível 3 — Linguagem e gramática
              </h2>

              <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
                {correcao.language_feedback ||
                  "Nenhum feedback linguístico foi registrado."}
              </p>

              {errosLinguagem.length === 0 ? (
                <div className="mt-6 rounded-xl bg-green-50 p-5 text-green-800">
                  Nenhuma ocorrência linguística foi registrada.
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  {errosLinguagem.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-200 p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-900">
                          {item.criterion_name}
                        </h3>

                        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                          {item.criterion_code}
                        </span>
                      </div>

                      <blockquote className="mt-4 border-l-4 border-slate-300 pl-4 italic text-slate-600">
                        “{item.excerpt}”
                      </blockquote>

                      <p className="mt-4 leading-7 text-slate-700">
                        {item.explanation}
                      </p>

                      {item.suggested_correction && (
                        <div className="mt-4 rounded-lg bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">
                            Correção sugerida
                          </p>

                          <p className="mt-2 text-slate-700">
                            {item.suggested_correction}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Nível 4 — Cálculo da nota
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Conteúdo</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {formatarNumero(
                      calculo.content_score ?? correcao.content_score
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Erros linguísticos</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {calculo.language_error_count ??
                      correcao.language_error_count ??
                      0}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Desconto</p>
                  <p className="mt-2 text-xl font-bold text-red-700">
                    -{formatarNumero(
                      calculo.language_discount ??
                        correcao.language_discount
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 p-5">
                  <p className="text-sm text-blue-700">Nota final</p>
                  <p className="mt-2 text-xl font-bold text-blue-800">
                    {formatarNumero(
                      calculo.final_score ?? correcao.total_score
                    )}
                  </p>
                </div>
              </div>

              {calculo.formula && (
                <p className="mt-5 text-sm text-slate-500">
                  Fórmula aplicada: {calculo.formula}
                </p>
              )}
            </section>

            {correcao.improvement_suggestions && (
              <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">
                  Como melhorar
                </h2>

                <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
                  {correcao.improvement_suggestions}
                </p>
              </section>
            )}

            {correcao.improved_answer && (
              <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">
                  Exemplo de resposta aprimorada
                </h2>

                <div className="mt-5 rounded-xl bg-slate-50 p-6">
                  <p className="whitespace-pre-wrap leading-8 text-slate-700">
                    {correcao.improved_answer}
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

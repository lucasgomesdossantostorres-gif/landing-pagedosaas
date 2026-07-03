"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Questao = {
  id: number;
  title: string;
  statement: string;
  examining_board: string | null;
  exam_name: string | null;
  exam_year: number | null;
};

type EstadoValidacao =
  | "idle"
  | "validating"
  | "approved"
  | "rejected"
  | "error";

type ResultadoValidacao = {
  success: boolean;
  status: "processing" | "approved" | "rejected" | "error";
  approved: boolean;
  cached?: boolean;
  confidence?: number;
  feedback?: string;
  inconsistencies?: string[];
  validated_at?: string;
  error?: string;
};

type ResultadoSalvarResposta = {
  success: boolean;
  answer_id?: number;
  error?: string;
};

export default function QuestaoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const questionId = useMemo(() => Number(params.id), [params.id]);

  const [questao, setQuestao] = useState<Questao | null>(null);
  const [resposta, setResposta] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [estadoValidacao, setEstadoValidacao] =
    useState<EstadoValidacao>("idle");
  const [feedbackValidacao, setFeedbackValidacao] = useState("");
  const [inconsistenciasValidacao, setInconsistenciasValidacao] =
    useState<string[]>([]);
  const [confiancaValidacao, setConfiancaValidacao] =
    useState<number | null>(null);
  const [resultadoEmCache, setResultadoEmCache] = useState(false);

  const escritaLiberada = estadoValidacao === "approved";

  const validarQuestao = useCallback(async () => {
    setEstadoValidacao("validating");
    setFeedbackValidacao(
      "Estamos verificando a compatibilidade entre a questão, o gabarito e os critérios.",
    );
    setInconsistenciasValidacao([]);
    setConfiancaValidacao(null);
    setResultadoEmCache(false);
    setMensagem("");

    try {
      const response = await fetch(
        `/api/questoes/${questionId}/validar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      );

      const resultado =
        (await response.json()) as ResultadoValidacao;

      if (!response.ok || resultado.success !== true) {
        setEstadoValidacao("error");
        setFeedbackValidacao(
          resultado.error ??
            "Não foi possível validar a questão.",
        );
        return;
      }

      setConfiancaValidacao(
        typeof resultado.confidence === "number"
          ? resultado.confidence
          : null,
      );

      setResultadoEmCache(resultado.cached === true);

      setInconsistenciasValidacao(
        Array.isArray(resultado.inconsistencies)
          ? resultado.inconsistencies
          : [],
      );

      if (
        resultado.status === "approved" &&
        resultado.approved === true
      ) {
        setEstadoValidacao("approved");
        setFeedbackValidacao(
          resultado.feedback ??
            "A questão foi validada e está disponível para resposta.",
        );
        return;
      }

      setEstadoValidacao("rejected");
      setFeedbackValidacao(
        resultado.feedback ??
          "A questão apresentou incompatibilidades e não está disponível.",
      );
    } catch (error) {
      const mensagemErro =
        error instanceof Error
          ? error.message
          : "Erro inesperado.";

      setEstadoValidacao("error");
      setFeedbackValidacao(
        `Não foi possível validar a questão: ${mensagemErro}`,
      );
    }
  }, [questionId]);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarQuestao() {
      setCarregando(true);
      setMensagem("");
      setQuestao(null);

      if (!Number.isInteger(questionId) || questionId <= 0) {
        if (componenteAtivo) {
          setMensagem("Identificador da questão inválido.");
          setCarregando(false);
        }
        return;
      }

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!componenteAtivo) {
        return;
      }

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const {
        data: questaoData,
        error: questaoError,
      } = await supabase
        .from("questions")
        .select(`
  id,
  title,
  statement,
  examining_board,
  exam_name,
  exam_year
`)
        .eq("id", questionId)
        .single();

      if (!componenteAtivo) {
        return;
      }

      if (questaoError || !questaoData) {
        setMensagem("Questão não encontrada.");
        setCarregando(false);
        return;
      }

      setQuestao(questaoData as Questao);
      setCarregando(false);

      await validarQuestao();
    }

    carregarQuestao();

    return () => {
      componenteAtivo = false;
    };
  }, [questionId, router, validarQuestao]);

  async function enviarResposta(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (enviando) {
      return;
    }

    if (estadoValidacao !== "approved") {
      setMensagem(
        "A resposta só pode ser enviada depois da aprovação da questão.",
      );
      return;
    }

    const respostaLimpa = resposta.trim();

    if (respostaLimpa.length < 30) {
      setMensagem(
        "Sua resposta precisa ter pelo menos 30 caracteres.",
      );
      return;
    }

    setMensagem("");
    setEnviando(true);

    try {
      const response = await fetch("/api/respostas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_id: questionId,
          answer_text: respostaLimpa,
        }),
      });

      const resultado =
        (await response.json()) as ResultadoSalvarResposta;

      if (
        !response.ok ||
        resultado.success !== true ||
        !resultado.answer_id
      ) {
        setMensagem(
          resultado.error ??
            "Não foi possível salvar a resposta.",
        );
        return;
      }

      router.push(`/respostas/${resultado.answer_id}`);
    } catch (error) {
      const mensagemErro =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao salvar a resposta.";

      setMensagem(`Erro: ${mensagemErro}`);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <section className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-slate-600">
              Carregando questão...
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!questao) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <section className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-red-700">
            {mensagem || "Questão não encontrada."}
          </p>

          <Link
            href="/questoes"
            className="mt-6 inline-block font-semibold text-blue-600 hover:text-blue-700"
          >
            Voltar para as questões
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-4xl">
        <Link
          href="/questoes"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          Voltar para as questões
        </Link>

        <article className="mt-6 rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {questao.examining_board && <span>{questao.examining_board}</span>}
            {questao.examining_board && questao.exam_year && <span>•</span>}
            {questao.exam_year && <span>{questao.exam_year}</span>}
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">
            {questao.title ||
              "Questão discursiva"}
          </h1>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Enunciado
            </h2>

            <p className="mt-4 whitespace-pre-line leading-8 text-slate-800">
              {questao.statement}
            </p>
          </div>
        </article>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Validação da questão
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            O campo de resposta só é liberado depois que a
            inteligência artificial confirma a compatibilidade entre
            a questão, o gabarito e os critérios.
          </p>

          {estadoValidacao === "validating" && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="font-semibold text-blue-800">
                Validando questão...
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-700">
                {feedbackValidacao}
              </p>
            </div>
          )}

          {estadoValidacao === "approved" && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-800">
                Questão validada
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-700">
                {feedbackValidacao}
              </p>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-emerald-700">
                {confiancaValidacao !== null && (
                  <span>
                    Confiança:{" "}
                    {(confiancaValidacao * 100).toFixed(0)}%
                  </span>
                )}

                {resultadoEmCache && (
                  <span>Validação já realizada</span>
                )}
              </div>
            </div>
          )}

          {estadoValidacao === "rejected" && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-800">
                Questão indisponível
              </p>

              <p className="mt-2 text-sm leading-6 text-red-700">
                {feedbackValidacao}
              </p>

              {inconsistenciasValidacao.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-red-800">
                    Inconsistências identificadas:
                  </p>

                  <ul className="mt-2 space-y-2 text-sm text-red-700">
                    {inconsistenciasValidacao.map(
                      (item, index) => (
                        <li key={`${index}-${item}`}>• {item}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {estadoValidacao === "error" && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-800">
                Não foi possível validar
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-700">
                {feedbackValidacao}
              </p>

              <button
                type="button"
                onClick={validarQuestao}
                className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Sua resposta
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {escritaLiberada
              ? "A questão foi validada. Você já pode escrever."
              : "O campo permanecerá bloqueado até a conclusão da validação."}
          </p>

          <form onSubmit={enviarResposta} className="mt-6">
            <textarea
              value={resposta}
              onChange={(event) =>
                setResposta(event.target.value)
              }
              required
              rows={30}
              disabled={enviando || !escritaLiberada}
              placeholder={
                escritaLiberada
                  ? "Digite aqui sua resposta discursiva..."
                  : "Aguarde a validação da questão."
              }
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 leading-7 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            />

            <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-slate-500">
              <span>Espaço visual de 30 linhas</span>
              <span>{resposta.length} caracteres</span>
            </div>

            {mensagem && (
              <div className="mt-5 rounded-lg bg-slate-100 p-4">
                <p className="text-sm text-slate-700">
                  {mensagem}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || !escritaLiberada}
              className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando
                ? "Salvando resposta..."
                : escritaLiberada
                  ? "Enviar para correção"
                  : "Aguardando validação"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buscarDesempenhoPorCriterio,
  type DesempenhoCriterio,
} from "@/lib/services/criteria-performance";

function obterPrioridade(percentual: number) {
  if (percentual < 50) {
    return {
      texto: "Prioridade alta",
      classe: "bg-red-50 text-red-700",
    };
  }

  if (percentual < 75) {
    return {
      texto: "Prioridade média",
      classe: "bg-amber-50 text-amber-700",
    };
  }

  return {
    texto: "Bom desempenho",
    classe: "bg-green-50 text-green-700",
  };
}

export default function DesempenhoCriteriosPage() {
  const router = useRouter();

  const [criterios, setCriterios] = useState<
    DesempenhoCriterio[]
  >([]);

  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDesempenho() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const resultado =
          await buscarDesempenhoPorCriterio(
            supabase,
            user.id
          );

        setCriterios(resultado);
      } catch (error) {
        const mensagemErro =
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar o desempenho.";

        setMensagem(mensagemErro);
      } finally {
        setCarregando(false);
      }
    }

    carregarDesempenho();
  }, [router]);

  const estatisticas = useMemo(() => {
    if (criterios.length === 0) {
      return {
        mediaGeral: 0,
        melhorCriterio: null,
        piorCriterio: null,
        totalAvaliacoes: 0,
      };
    }

    const totalAvaliacoes = criterios.reduce(
      (total, criterio) =>
        total + criterio.quantidade_avaliacoes,
      0
    );

    const mediaGeral =
      criterios.reduce(
        (total, criterio) =>
          total + criterio.percentual,
        0
      ) / criterios.length;

    const ordenados = [...criterios].sort(
      (a, b) => b.percentual - a.percentual
    );

    return {
      mediaGeral,
      melhorCriterio: ordenados[0],
      piorCriterio: ordenados[ordenados.length - 1],
      totalAvaliacoes,
    };
  }, [criterios]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Carregando desempenho por critério...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap gap-5">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-600"
          >
            Voltar ao dashboard
          </Link>

          <Link
            href="/evolucao"
            className="text-sm font-semibold text-blue-600"
          >
            Ver evolução
          </Link>

          <Link
            href="/erros-recorrentes"
            className="text-sm font-semibold text-blue-600"
          >
            Ver erros recorrentes
          </Link>
        </div>

        <header className="mt-6 rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Análise de desempenho
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Desempenho por critério
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Descubra em quais critérios você apresenta melhor
            desempenho e quais pontos devem receber maior atenção.
          </p>
        </header>

        {mensagem && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {mensagem}
          </p>
        )}

        {criterios.length === 0 ? (
          <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Ainda não existem dados suficientes
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Faça novas correções para que o sistema possa analisar
              seu desempenho em cada critério.
            </p>

            <Link
              href="/questoes"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
            >
              Responder uma questão
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Critérios analisados
                </p>

                <p className="mt-3 text-4xl font-bold text-slate-900">
                  {criterios.length}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Avaliações realizadas
                </p>

                <p className="mt-3 text-4xl font-bold text-slate-900">
                  {estatisticas.totalAvaliacoes}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Aproveitamento médio
                </p>

                <p className="mt-3 text-4xl font-bold text-blue-700">
                  {estatisticas.mediaGeral.toFixed(1)}%
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Principal prioridade
                </p>

                <p className="mt-3 text-xl font-bold text-red-700">
                  {estatisticas.piorCriterio?.title ??
                    "Não identificada"}
                </p>
              </article>
            </section>

            <section className="mt-8 grid gap-6 md:grid-cols-2">
              <article className="rounded-2xl bg-white p-8 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
                  Melhor desempenho
                </p>

                <h2 className="mt-3 text-2xl font-bold text-slate-900">
                  {estatisticas.melhorCriterio?.title}
                </h2>

                <p className="mt-4 text-4xl font-bold text-green-700">
                  {estatisticas.melhorCriterio?.percentual.toFixed(
                    1
                  )}
                  %
                </p>

                <p className="mt-4 leading-7 text-slate-600">
                  {estatisticas.melhorCriterio?.description}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-8 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
                  Maior prioridade de estudo
                </p>

                <h2 className="mt-3 text-2xl font-bold text-slate-900">
                  {estatisticas.piorCriterio?.title}
                </h2>

                <p className="mt-4 text-4xl font-bold text-red-700">
                  {estatisticas.piorCriterio?.percentual.toFixed(
                    1
                  )}
                  %
                </p>

                <p className="mt-4 leading-7 text-slate-600">
                  {estatisticas.piorCriterio?.description}
                </p>
              </article>
            </section>

            <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Todos os critérios
              </h2>

              <p className="mt-2 text-slate-600">
                Os critérios abaixo estão ordenados do menor para o
                maior aproveitamento.
              </p>

              <div className="mt-8 space-y-6">
                {criterios.map((criterio, indice) => {
                  const prioridade = obterPrioridade(
                    criterio.percentual
                  );

                  return (
                    <article
                      key={criterio.criterion_id}
                      className="rounded-xl border border-slate-200 p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-3xl">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                              #{indice + 1}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${prioridade.classe}`}
                            >
                              {prioridade.texto}
                            </span>
                          </div>

                          <h3 className="mt-4 text-xl font-bold text-slate-900">
                            {criterio.title}
                          </h3>

                          <p className="mt-3 leading-7 text-slate-600">
                            {criterio.description}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-4xl font-bold text-blue-700">
                            {criterio.percentual.toFixed(1)}%
                          </p>

                          <p className="mt-2 text-sm text-slate-500">
                            {criterio.quantidade_avaliacoes}{" "}
                            {criterio.quantidade_avaliacoes === 1
                              ? "avaliação"
                              : "avaliações"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{
                              width: `${criterio.percentual}%`,
                            }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap justify-between gap-4 text-sm text-slate-500">
                          <span>
                            Média:{" "}
                            {criterio.media_pontos.toFixed(1)} de{" "}
                            {criterio.media_maxima.toFixed(1)}
                          </span>

                          <span>
                            Total:{" "}
                            {criterio.pontos_obtidos.toFixed(1)} de{" "}
                            {criterio.pontos_possiveis.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
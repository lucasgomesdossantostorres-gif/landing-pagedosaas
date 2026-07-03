"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buscarEvolucaoDoUsuario,
  type PontoEvolucao,
} from "@/lib/services/evolution";

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(data));
}

export default function EvolucaoPage() {
  const router = useRouter();

  const [pontos, setPontos] = useState<PontoEvolucao[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarEvolucao() {
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

        const resultado = await buscarEvolucaoDoUsuario(
          supabase,
          user.id
        );

        setPontos(resultado);
      } catch (error) {
        const mensagemErro =
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar a evolução.";

        setMensagem(mensagemErro);
      } finally {
        setCarregando(false);
      }
    }

    carregarEvolucao();
  }, [router]);

  const estatisticas = useMemo(() => {
    if (pontos.length === 0) {
      return {
        media: 0,
        primeiraNota: 0,
        ultimaNota: 0,
        diferenca: 0,
      };
    }

    const percentuais = pontos.map(
      (ponto) => ponto.percentage
    );

    const media =
      percentuais.reduce(
        (total, percentual) => total + percentual,
        0
      ) / percentuais.length;

    const primeiraNota = percentuais[0];
    const ultimaNota = percentuais[percentuais.length - 1];

    return {
      media,
      primeiraNota,
      ultimaNota,
      diferenca: ultimaNota - primeiraNota,
    };
  }, [pontos]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Carregando evolução...
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
            href="/historico"
            className="text-sm font-semibold text-blue-600"
          >
            Ver histórico
          </Link>
        </div>

        <header className="mt-6 rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Desempenho
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Evolução das notas
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Acompanhe a evolução do seu aproveitamento ao longo das
            correções realizadas.
          </p>
        </header>

        {mensagem && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {mensagem}
          </p>
        )}

        {pontos.length === 0 ? (
          <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Ainda não há dados suficientes
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Faça pelo menos uma correção para começar a acompanhar
              sua evolução.
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
                  Correções analisadas
                </p>

                <p className="mt-3 text-4xl font-bold text-slate-900">
                  {pontos.length}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Aproveitamento médio
                </p>

                <p className="mt-3 text-4xl font-bold text-blue-700">
                  {estatisticas.media.toFixed(1)}%
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Último resultado
                </p>

                <p className="mt-3 text-4xl font-bold text-blue-700">
                  {estatisticas.ultimaNota.toFixed(1)}%
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Variação
                </p>

                <p
                  className={`mt-3 text-4xl font-bold ${
                    estatisticas.diferenca >= 0
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {estatisticas.diferenca >= 0 ? "+" : ""}
                  {estatisticas.diferenca.toFixed(1)}%
                </p>
              </article>
            </section>

            <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Gráfico de evolução
                </h2>

                <p className="mt-2 text-slate-600">
                  Cada coluna representa o percentual obtido em uma
                  correção.
                </p>
              </div>

              <div className="mt-10 overflow-x-auto">
                <div
                  className="flex min-w-max items-end gap-5 border-b border-slate-300 px-3 pb-3"
                  style={{ height: "320px" }}
                >
                  {pontos.map((ponto, indice) => (
                    <div
                      key={ponto.correction_id}
                      className="flex w-24 flex-col items-center justify-end"
                      style={{ height: "100%" }}
                    >
                      <span className="mb-2 text-sm font-bold text-blue-700">
                        {ponto.percentage.toFixed(1)}%
                      </span>

                      <div
                        className="w-14 rounded-t-lg bg-blue-600"
                        style={{
                          height: `${Math.max(
                            ponto.percentage * 2.2,
                            8
                          )}px`,
                        }}
                        title={`${ponto.question_title}: ${ponto.percentage.toFixed(
                          1
                        )}%`}
                      />

                      <span className="mt-3 text-center text-xs text-slate-500">
                        {formatarData(ponto.corrected_at)}
                      </span>

                      <span className="mt-1 text-center text-xs font-semibold text-slate-700">
                        #{indice + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Resultados detalhados
              </h2>

              <div className="mt-6 divide-y divide-slate-200">
                {pontos
                  .slice()
                  .reverse()
                  .map((ponto) => (
                    <article
                      key={ponto.correction_id}
                      className="flex flex-wrap items-center justify-between gap-5 py-5 first:pt-0 last:pb-0"
                    >
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {ponto.question_title}
                        </h3>

                        {ponto.subject && (
                          <p className="mt-1 text-sm text-slate-500">
                            {ponto.subject}
                          </p>
                        )}

                        <p className="mt-2 text-sm text-slate-500">
                          Corrigida em{" "}
                          {formatarData(ponto.corrected_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-slate-500">
                            Nota
                          </p>

                          <p className="text-xl font-bold text-slate-900">
                            {ponto.total_score.toFixed(1)} de{" "}
                            {ponto.maximum_score.toFixed(1)}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-blue-700">
                            {ponto.percentage.toFixed(1)}%
                          </p>
                        </div>

                        <Link
                          href={`/respostas/${ponto.answer_id}`}
                          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                        >
                          Abrir
                        </Link>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
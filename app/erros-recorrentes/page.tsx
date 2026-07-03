"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buscarErrosRecorrentes,
  type ErroAgrupado,
} from "@/lib/services/errors";

function traduzirCategoria(category: string) {
  const categorias: Record<string, string> = {
    content: "Conteúdo",
    structure: "Estrutura",
    language: "Linguagem",
    argumentation: "Argumentação",
    adherence: "Aderência ao tema",
  };

  return categorias[category] ?? category;
}

function traduzirGravidade(severity: string) {
  const gravidades: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
  };

  return gravidades[severity] ?? severity;
}

export default function ErrosRecorrentesPage() {
  const router = useRouter();

  const [erros, setErros] = useState<ErroAgrupado[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarErros() {
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

        const resultado = await buscarErrosRecorrentes(
          supabase,
          user.id
        );

        setErros(resultado);
      } catch (error) {
        const mensagemErro =
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar os erros recorrentes.";

        setMensagem(mensagemErro);
      } finally {
        setCarregando(false);
      }
    }

    carregarErros();
  }, [router]);

  const estatisticas = useMemo(() => {
    const totalOcorrencias = erros.reduce(
      (total, erro) => total + erro.quantidade,
      0
    );

    const totalTipos = erros.length;

    const errosGraves = erros.reduce(
      (total, erro) => total + erro.quantidadeAlta,
      0
    );

    return {
      totalOcorrencias,
      totalTipos,
      errosGraves,
    };
  }, [erros]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Carregando erros recorrentes...
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
            Análise de desempenho
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Erros recorrentes
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Veja quais problemas aparecem com mais frequência nas suas
            respostas e quais pontos merecem maior atenção nos estudos.
          </p>
        </header>

        {mensagem && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {mensagem}
          </p>
        )}

        <section className="mt-8 grid gap-5 sm:grid-cols-3">
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Ocorrências identificadas
            </p>

            <p className="mt-3 text-4xl font-bold text-slate-900">
              {estatisticas.totalOcorrencias}
            </p>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Tipos diferentes de erro
            </p>

            <p className="mt-3 text-4xl font-bold text-slate-900">
              {estatisticas.totalTipos}
            </p>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Erros de gravidade alta
            </p>

            <p className="mt-3 text-4xl font-bold text-red-700">
              {estatisticas.errosGraves}
            </p>
          </article>
        </section>

        {erros.length === 0 ? (
          <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Ainda não há erros registrados
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Envie uma nova resposta e faça uma nova correção para
              gerar os primeiros registros.
            </p>

            <Link
              href="/questoes"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
            >
              Responder nova questão
            </Link>
          </section>
        ) : (
          <section className="mt-8 space-y-6">
            {erros.map((erro, indice) => (
              <article
                key={erro.id}
                className="rounded-2xl bg-white p-8 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                        #{indice + 1}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                        {traduzirCategoria(erro.category)}
                      </span>
                    </div>

                    <h2 className="mt-4 text-2xl font-bold text-slate-900">
                      {erro.name}
                    </h2>

                    {erro.description && (
                      <p className="mt-3 leading-7 text-slate-600">
                        {erro.description}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-6 py-4 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      Ocorrências
                    </p>

                    <p className="mt-1 text-4xl font-bold text-slate-900">
                      {erro.quantidade}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-lg bg-red-50 px-3 py-2 font-medium text-red-700">
                    Alta: {erro.quantidadeAlta}
                  </span>

                  <span className="rounded-lg bg-amber-50 px-3 py-2 font-medium text-amber-700">
                    Média: {erro.quantidadeMedia}
                  </span>

                  <span className="rounded-lg bg-green-50 px-3 py-2 font-medium text-green-700">
                    Baixa: {erro.quantidadeBaixa}
                  </span>
                </div>

                {erro.exemplos.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-bold text-slate-900">
                      Exemplos recentes
                    </h3>

                    <div className="mt-4 space-y-4">
                      {erro.exemplos.map((exemplo, exemploIndice) => (
                        <div
                          key={`${erro.id}-${exemploIndice}`}
                          className="rounded-xl border border-slate-200 p-5"
                        >
                          <span className="text-sm font-semibold text-slate-500">
                            Gravidade:{" "}
                            {traduzirGravidade(exemplo.severity)}
                          </span>

                          <p className="mt-3 leading-7 text-slate-700">
                            {exemplo.explanation}
                          </p>

                          {exemplo.excerpt && (
                            <blockquote className="mt-4 border-l-4 border-slate-300 pl-4 italic text-slate-600">
                              “{exemplo.excerpt}”
                            </blockquote>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
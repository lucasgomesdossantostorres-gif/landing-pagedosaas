"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Questao = {
  id: number;
  title: string;
  statement: string;
  examining_board: string | null;
  exam_name: string | null;
  exam_year: number | null;
};

export default function QuestoesPage() {
  const router = useRouter();

  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");

  const [orgaoSelecionado, setOrgaoSelecionado] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState("");
  const [concursoSelecionado, setConcursoSelecionado] = useState("");

  useEffect(() => {
    async function buscarQuestoes() {
      setCarregando(true);
      setMensagem("");

      const supabase = createClient();

      const {
        data: { user },
        error: erroUsuario,
      } = await supabase.auth.getUser();

      if (erroUsuario) {
        setMensagem(`Erro ao verificar usuário: ${erroUsuario.message}`);
        setCarregando(false);
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
  .from("questions")
  .select(`
    id,
    title,
    statement,
    examining_board,
    exam_name,
    exam_year
  `)
  .eq("status", "published")
  .not("examining_board", "is", null)
  .not("exam_year", "is", null)
  .not("exam_name", "is", null)
  .not("statement", "is", null)
  .order("examining_board", { ascending: true })
  .order("exam_year", { ascending: false })
  .order("exam_name", { ascending: true })
  .order("id", { ascending: true });

      if (error) {
        setMensagem(`Erro ao buscar questões: ${error.message}`);
        setCarregando(false);
        return;
      }

      setQuestoes((data as Questao[]) ?? []);
      setCarregando(false);
    }

    buscarQuestoes();
  }, [router]);

  const orgaos = useMemo(() => {
    const valores = questoes
      .map((questao) => questao.examining_board?.trim())
      .filter((orgao): orgao is string => Boolean(orgao));

    return Array.from(new Set(valores)).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [questoes]);

  const anos = useMemo(() => {
    if (!orgaoSelecionado) {
      return [];
    }

    const valores = questoes
      .filter((questao) => questao.examining_board?.trim() === orgaoSelecionado)
      .map((questao) => questao.exam_year)
      .filter((ano): ano is number => ano !== null);

    return Array.from(new Set(valores)).sort((a, b) => b - a);
  }, [questoes, orgaoSelecionado]);

  const concursos = useMemo(() => {
    if (!orgaoSelecionado || !anoSelecionado) {
      return [];
    }

    const anoNumerico = Number(anoSelecionado);

    const valores = questoes
      .filter(
        (questao) =>
          questao.examining_board?.trim() === orgaoSelecionado &&
          questao.exam_year === anoNumerico,
      )
      .map((questao) => questao.exam_name?.trim())
      .filter((titulo): titulo is string => Boolean(titulo));

    return Array.from(new Set(valores)).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [questoes, orgaoSelecionado, anoSelecionado]);

  const questoesFiltradas = useMemo(() => {
    if (!orgaoSelecionado || !anoSelecionado || !concursoSelecionado) {
      return [];
    }

    const anoNumerico = Number(anoSelecionado);

    return questoes.filter(
      (questao) =>
        questao.examining_board?.trim() === orgaoSelecionado &&
        questao.exam_year === anoNumerico &&
        questao.exam_name?.trim() === concursoSelecionado,
    );
  }, [
    questoes,
    orgaoSelecionado,
    anoSelecionado,
    concursoSelecionado,
  ]);

  function selecionarOrgao(valor: string) {
    setOrgaoSelecionado(valor);
    setAnoSelecionado("");
    setConcursoSelecionado("");
  }

  function selecionarAno(valor: string) {
    setAnoSelecionado(valor);
    setConcursoSelecionado("");
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <section className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-slate-600">Carregando questões...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-5xl">
        <header className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Voltar ao dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Questões discursivas
          </h1>

          <p className="mt-2 text-slate-600">
            Selecione o órgão, o ano e o concurso para encontrar uma questão.
          </p>
        </header>

        {mensagem && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-red-700">{mensagem}</p>
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label
                htmlFor="orgao"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                1. Órgão
              </label>

              <select
                id="orgao"
                value={orgaoSelecionado}
                onChange={(event) => selecionarOrgao(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Selecione o órgão</option>

                {orgaos.map((orgao) => (
                  <option key={orgao} value={orgao}>
                    {orgao}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ano"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                2. Ano
              </label>

              <select
                id="ano"
                value={anoSelecionado}
                onChange={(event) => selecionarAno(event.target.value)}
                disabled={!orgaoSelecionado}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Selecione o ano</option>

                {anos.map((ano) => (
                  <option key={ano} value={String(ano)}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="concurso"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                3. Concurso
              </label>

              <select
                id="concurso"
                value={concursoSelecionado}
                onChange={(event) =>
                  setConcursoSelecionado(event.target.value)
                }
                disabled={!orgaoSelecionado || !anoSelecionado}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Selecione o concurso</option>

                {concursos.map((concurso) => (
                  <option key={concurso} value={concurso}>
                    {concurso}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <section className="mt-8">
          {!concursoSelecionado ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-slate-600">
                Preencha os três filtros para visualizar as questões.
              </p>
            </div>
          ) : questoesFiltradas.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <p className="text-slate-600">
                Nenhuma questão foi encontrada para os filtros selecionados.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  4. Escolha a questão
                </h2>

                <span className="text-sm text-slate-500">
                  {questoesFiltradas.length}{" "}
                  {questoesFiltradas.length === 1
                    ? "questão encontrada"
                    : "questões encontradas"}
                </span>
              </div>

              <div className="space-y-5">
                {questoesFiltradas.map((questao, indice) => (
                  <article
                    key={questao.id}
                    className="rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>Questão {indice + 1}</span>
                      <span>•</span>
                      <span>{questao.examining_board}</span>
                      <span>•</span>
                      <span>{questao.exam_year}</span>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-slate-900">
                      {questao.exam_name}
                    </h3>

                    <p className="mt-4 line-clamp-4 whitespace-pre-line leading-7 text-slate-600">
                      {questao.statement}
                    </p>

                    <div className="mt-6 flex justify-end">
                      <Link
                        href={`/questoes/${questao.id}`}
                        className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
                      >
                        Responder questão
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

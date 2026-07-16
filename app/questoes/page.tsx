"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  FileQuestion,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [busca, setBusca] = useState("");

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
      .filter(
        (questao) =>
          questao.examining_board?.trim() === orgaoSelecionado,
      )
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
      .filter((concurso): concurso is string => Boolean(concurso));

    return Array.from(new Set(valores)).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [questoes, orgaoSelecionado, anoSelecionado]);

  const questoesFiltradas = useMemo(() => {
    if (!orgaoSelecionado || !anoSelecionado || !concursoSelecionado) {
      return [];
    }

    const anoNumerico = Number(anoSelecionado);
    const termoBusca = busca.trim().toLocaleLowerCase("pt-BR");

    return questoes.filter((questao) => {
      const correspondeAosFiltros =
        questao.examining_board?.trim() === orgaoSelecionado &&
        questao.exam_year === anoNumerico &&
        questao.exam_name?.trim() === concursoSelecionado;

      if (!correspondeAosFiltros) {
        return false;
      }

      if (!termoBusca) {
        return true;
      }

      const conteudo = [
        questao.title,
        questao.statement,
        questao.exam_name,
        questao.examining_board,
        String(questao.exam_year ?? ""),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return conteudo.includes(termoBusca);
    });
  }, [
    questoes,
    orgaoSelecionado,
    anoSelecionado,
    concursoSelecionado,
    busca,
  ]);

  const filtrosCompletos = Boolean(
    orgaoSelecionado && anoSelecionado && concursoSelecionado,
  );

  function selecionarOrgao(valor: string) {
    setOrgaoSelecionado(valor);
    setAnoSelecionado("");
    setConcursoSelecionado("");
    setBusca("");
  }

  function selecionarAno(valor: string) {
    setAnoSelecionado(valor);
    setConcursoSelecionado("");
    setBusca("");
  }

  function limparFiltros() {
    setOrgaoSelecionado("");
    setAnoSelecionado("");
    setConcursoSelecionado("");
    setBusca("");
  }

  if (carregando) {
    return <QuestoesSkeleton />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-muted-foreground" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Questões discursivas
            </h1>
          </div>

          <p className="max-w-2xl text-sm text-muted-foreground">
            Selecione uma prova e escolha uma questão para iniciar sua
            preparação.
          </p>
        </div>

        <Badge variant="secondary" className="w-fit">
          {questoes.length} questões disponíveis
        </Badge>
      </section>

      {mensagem && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar as questões</AlertTitle>
          <AlertDescription>{mensagem}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />

            <div>
              <CardTitle className="text-base">
                Localizar uma prova
              </CardTitle>

              <CardDescription>
                Os filtros são preenchidos em sequência.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <FilterField
              id="orgao"
              label="Órgão"
              icon={<Building2 className="size-4" />}
            >
              <select
                id="orgao"
                value={orgaoSelecionado}
                onChange={(event) => selecionarOrgao(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">Selecione o órgão</option>

                {orgaos.map((orgao) => (
                  <option key={orgao} value={orgao}>
                    {orgao}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField
              id="ano"
              label="Ano"
              icon={<CalendarDays className="size-4" />}
            >
              <select
                id="ano"
                value={anoSelecionado}
                onChange={(event) => selecionarAno(event.target.value)}
                disabled={!orgaoSelecionado}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">Selecione o ano</option>

                {anos.map((ano) => (
                  <option key={ano} value={String(ano)}>
                    {ano}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField
              id="concurso"
              label="Concurso"
              icon={<FileQuestion className="size-4" />}
            >
              <select
                id="concurso"
                value={concursoSelecionado}
                onChange={(event) => {
                  setConcursoSelecionado(event.target.value);
                  setBusca("");
                }}
                disabled={!orgaoSelecionado || !anoSelecionado}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">Selecione o concurso</option>

                {concursos.map((concurso) => (
                  <option key={concurso} value={concurso}>
                    {concurso}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder={
                  filtrosCompletos
                    ? "Buscar nas questões desta prova..."
                    : "Selecione os filtros para pesquisar"
                }
                disabled={!filtrosCompletos}
                className="pl-9"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={limparFiltros}
              disabled={
                !orgaoSelecionado &&
                !anoSelecionado &&
                !concursoSelecionado &&
                !busca
              }
            >
              <X className="size-4" />
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {!filtrosCompletos ? (
        <EmptyQuestionsState
          title="Selecione uma prova"
          description="Escolha o órgão, o ano e o concurso para visualizar as questões disponíveis."
        />
      ) : questoesFiltradas.length === 0 ? (
        <EmptyQuestionsState
          title="Nenhuma questão encontrada"
          description={
            busca
              ? "Não encontramos questões correspondentes à sua pesquisa."
              : "Não existem questões disponíveis para os filtros selecionados."
          }
        />
      ) : (
        <section className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Questões encontradas</h2>

              <p className="text-sm text-muted-foreground">
                Escolha uma questão para começar a responder.
              </p>
            </div>

            <span className="text-sm text-muted-foreground">
              {questoesFiltradas.length}{" "}
              {questoesFiltradas.length === 1
                ? "resultado"
                : "resultados"}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border bg-background">
            {questoesFiltradas.map((questao, indice) => (
              <div key={questao.id}>
                {indice > 0 && <Separator />}

                <article className="group p-5 transition-colors hover:bg-muted/30">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          Questão {indice + 1}
                        </Badge>

                        <Badge variant="secondary">
                          {questao.examining_board}
                        </Badge>

                        <Badge variant="outline">
                          {questao.exam_year}
                        </Badge>
                      </div>

                      <h3 className="text-base font-semibold leading-6">
                        {questao.title?.trim() ||
                          questao.exam_name ||
                          `Questão ${indice + 1}`}
                      </h3>

                      {questao.title?.trim() &&
                        questao.exam_name?.trim() &&
                        questao.title.trim() !==
                          questao.exam_name.trim() && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {questao.exam_name}
                          </p>
                        )}

                      <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        {questao.statement}
                      </p>
                    </div>

                    <Link
                      href={`/questoes/${questao.id}`}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      Resolver questão
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type FilterFieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

function FilterField({
  id,
  label,
  icon,
  children,
}: FilterFieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium"
      >
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </label>

      {children}
    </div>
  );
}

type EmptyQuestionsStateProps = {
  title: string;
  description: string;
};

function EmptyQuestionsState({
  title,
  description,
}: EmptyQuestionsStateProps) {
  return (
    <div className="rounded-lg border border-dashed bg-background px-6 py-14 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-muted/40">
        <BookOpen className="size-5 text-muted-foreground" />
      </div>

      <h2 className="mt-4 font-semibold">{title}</h2>

      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function QuestoesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b pb-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Card>
        <CardHeader className="border-b">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>

          <div className="mt-5 border-t pt-5">
            <Skeleton className="h-9 w-full" />
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-44 w-full rounded-lg" />
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  FileQuestion,
  Search,
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

// --- TIPAGENS ---
type Questao = {
  id: number;
  title: string;
  statement: string;
  examining_board: string | null;
  exam_name: string | null;
  exam_year: number | null;
};

type Prova = {
  id: string;
  examining_board: string;
  exam_name: string;
  exam_year: number;
  questoes: Questao[];
};

// --- FUNÇÕES AUXILIARES ---
function formatarNome(texto: string | null | undefined) {
  if (!texto) return "";
  // Ex: "AGU_22_PROCURADOR_FEDERAL" -> "Agu Procurador Federal"
  return texto
    .split("_")
    .filter((word) => isNaN(Number(word))) // Remove blocos que são apenas números (ex: 22)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function QuestoesPage() {
  const router = useRouter();

  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");

  // Estados de Filtro
  const [buscaGeral, setBuscaGeral] = useState("");
  const [orgaoSelecionado, setOrgaoSelecionado] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState("");
  const [concursoSelecionado, setConcursoSelecionado] = useState("");

  // Estado de Navegação (Lista de Provas vs Detalhe da Prova)
  const [provaSelecionada, setProvaSelecionada] = useState<Prova | null>(null);

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

  // AGRUPAMENTO EM PROVAS
  const provas = useMemo(() => {
    const mapa = new Map<string, Prova>();

    questoes.forEach((q) => {
      const orgao = q.examining_board?.trim() || "Desconhecido";
      const ano = q.exam_year || 0;
      const concurso = q.exam_name?.trim() || "Sem Nome";
      const chave = `${orgao}-${ano}-${concurso}`;

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          id: chave,
          examining_board: orgao,
          exam_year: ano,
          exam_name: concurso,
          questoes: [],
        });
      }
      mapa.get(chave)!.questoes.push(q);
    });

    return Array.from(mapa.values());
  }, [questoes]);

  // OPÇÕES PARA OS FILTROS (Baseado nas provas)
  const orgaos = useMemo(() => {
    return Array.from(new Set(provas.map((p) => p.examining_board))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [provas]);

  const anos = useMemo(() => {
    let filtradas = provas;
    if (orgaoSelecionado) {
      filtradas = filtradas.filter((p) => p.examining_board === orgaoSelecionado);
    }
    return Array.from(new Set(filtradas.map((p) => String(p.exam_year)))).sort(
      (a, b) => Number(b) - Number(a)
    );
  }, [provas, orgaoSelecionado]);

  const concursos = useMemo(() => {
    let filtradas = provas;
    if (orgaoSelecionado) {
      filtradas = filtradas.filter((p) => p.examining_board === orgaoSelecionado);
    }
    if (anoSelecionado) {
      filtradas = filtradas.filter((p) => String(p.exam_year) === anoSelecionado);
    }
    return Array.from(new Set(filtradas.map((p) => p.exam_name))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [provas, orgaoSelecionado, anoSelecionado]);

  // FILTRAGEM DE PROVAS
  const provasFiltradas = useMemo(() => {
    return provas.filter((prova) => {
      // Filtros Dropdown
      if (orgaoSelecionado && prova.examining_board !== orgaoSelecionado) return false;
      if (anoSelecionado && String(prova.exam_year) !== anoSelecionado) return false;
      if (concursoSelecionado && prova.exam_name !== concursoSelecionado) return false;

      // Filtro Busca Geral
      if (buscaGeral.trim()) {
        const termo = buscaGeral.toLowerCase();
        const conteudoProva = `
          ${prova.examining_board} 
          ${prova.exam_name} 
          ${prova.exam_year} 
          ${formatarNome(prova.exam_name)}
        `.toLowerCase();

        // Checa se o termo está na prova, se não, checa nas questões dela
        if (!conteudoProva.includes(termo)) {
          const temQuestaoCorrespondente = prova.questoes.some((q) =>
            `${q.title} ${q.statement}`.toLowerCase().includes(termo)
          );
          if (!temQuestaoCorrespondente) return false;
        }
      }

      return true;
    });
  }, [provas, orgaoSelecionado, anoSelecionado, concursoSelecionado, buscaGeral]);

  function limparFiltros() {
    setOrgaoSelecionado("");
    setAnoSelecionado("");
    setConcursoSelecionado("");
    setBuscaGeral("");
  }

  const exibeLimparFiltros = Boolean(
    orgaoSelecionado || anoSelecionado || concursoSelecionado || buscaGeral
  );

  if (carregando) {
    return <QuestoesSkeleton />;
  }

  // --- VIEW DE UMA PROVA ESPECÍFICA ---
  if (provaSelecionada) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
        <Button
          variant="ghost"
          onClick={() => setProvaSelecionada(null)}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="mr-2 size-4" />
          Voltar para provas
        </Button>

        <div className="space-y-2 border-b pb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {provaSelecionada.examining_board}
            </Badge>
            <Badge variant="outline">{provaSelecionada.exam_year}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {formatarNome(provaSelecionada.exam_name)}
          </h1>
          <p className="text-muted-foreground">
            {provaSelecionada.questoes.length} questões discursivas nesta prova.
          </p>
        </div>

        <div className="space-y-4">
          {provaSelecionada.questoes.map((questao, indice) => (
            <Card key={questao.id} className="overflow-hidden transition-colors hover:border-primary/30 shadow-sm">
              <CardHeader className="bg-muted/20 pb-4 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <Badge variant="outline" className="mb-2 bg-background">
                      Questão {indice + 1}
                    </Badge>
                    <CardTitle className="text-lg">
                      {questao.title?.trim() || `Questão ${indice + 1}`}
                    </CardTitle>
                  </div>
                  <Link
                    href={`/questoes/${questao.id}`}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    Responder questão
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {questao.statement}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // --- VIEW DA LISTA DE PROVAS (DEFAULT) ---
  return (
    <div className="space-y-8 pb-10">
      {/* HEADER DA PÁGINA */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Questões discursivas
            </h1>
          </div>
          <p className="max-w-2xl text-base text-muted-foreground">
            Encontre a prova ideal para o seu treino.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit text-sm py-1 px-3">
          {questoes.length} questões totais
        </Badge>
      </section>

      {mensagem && (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{mensagem}</AlertDescription>
        </Alert>
      )}

      {/* ÁREA DE BUSCA E FILTROS */}
      <div className="space-y-4 bg-muted/10 p-4 md:p-6 rounded-xl border border-border/50">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={buscaGeral}
            onChange={(e) => setBuscaGeral(e.target.value)}
            placeholder="Pesquise por órgão, cargo, concurso ou ano..."
            className="pl-12 h-14 text-base rounded-lg bg-background shadow-sm border-border"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ComboboxFiltro
            label="Todos os órgãos"
            icon={<Building2 className="size-4" />}
            value={orgaoSelecionado}
            options={orgaos.map((o) => ({ label: o, value: o }))}
            onChange={(v) => {
              setOrgaoSelecionado(v);
              setAnoSelecionado("");
              setConcursoSelecionado("");
            }}
          />

          <ComboboxFiltro
            label="Todos os anos"
            icon={<CalendarDays className="size-4" />}
            value={anoSelecionado}
            options={anos.map((a) => ({ label: a, value: a }))}
            onChange={(v) => {
              setAnoSelecionado(v);
              setConcursoSelecionado("");
            }}
            disabled={!orgaoSelecionado && anos.length === 0}
          />

          <ComboboxFiltro
            label="Concurso/cargo"
            icon={<FileQuestion className="size-4" />}
            value={concursoSelecionado}
            options={concursos.map((c) => ({
              label: formatarNome(c),
              value: c,
            }))}
            onChange={setConcursoSelecionado}
            disabled={!orgaoSelecionado && concursos.length === 0}
          />

          {exibeLimparFiltros && (
            <Button
              variant="ghost"
              onClick={limparFiltros}
              className="text-muted-foreground hover:text-foreground h-10 px-3"
            >
              <X className="mr-2 size-4" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* LISTAGEM DOS CARDS DE PROVA */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-xl font-semibold">Provas disponíveis</h2>
          <span className="text-sm text-muted-foreground">
            {provasFiltradas.length} {provasFiltradas.length === 1 ? "prova" : "provas"}
          </span>
        </div>

        {provasFiltradas.length === 0 ? (
          <EmptyQuestionsState
            title="Nenhuma prova encontrada"
            description="Tente remover alguns filtros ou buscar com outros termos."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {provasFiltradas.map((prova) => (
              <Card
                key={prova.id}
                className="group flex flex-col h-full transition-all hover:border-primary/50 hover:shadow-md cursor-pointer bg-card"
                onClick={() => setProvaSelecionada(prova)}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="font-semibold text-xs truncate max-w-30">
                      {prova.examining_board}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {prova.exam_year}
                    </Badge>
                  </div>
                  
                  <h3 className="text-lg font-bold leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {formatarNome(prova.exam_name)}
                  </h3>
                  
                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/40 text-sm">
                    <span className="text-muted-foreground font-medium">
                      {prova.questoes.length} {prova.questoes.length === 1 ? "questão" : "questões"}
                    </span>
                    <span className="text-primary font-medium flex items-center gap-1 group-hover:underline underline-offset-4">
                      Ver prova <ArrowRight className="size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// --- COMPONENTE COMBOBOX CUSTOMIZADO (Sem libs extras) ---
type ComboboxFiltroProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

function ComboboxFiltro({ label, icon, value, options, onChange, disabled }: ComboboxFiltroProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [aberto]);

  const opcoesFiltradas = options.filter((opt) =>
    opt.label.toLowerCase().includes(busca.toLowerCase())
  );

  const opcaoSelecionada = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={aberto}
        disabled={disabled}
        onClick={() => setAberto(!aberto)}
        className="h-10 border-border bg-background justify-between min-w-45 w-full md:w-auto"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <span className="truncate">
            {opcaoSelecionada ? opcaoSelecionada.label : label}
          </span>
        </div>
        <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>

      {aberto && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-60 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in zoom-in-95">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 size-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-75 overflow-y-auto p-1">
            {opcoesFiltradas.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado.
              </div>
            ) : (
              opcoesFiltradas.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value === value ? "" : opt.value);
                    setAberto(false);
                    setBusca("");
                  }}
                  className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${
                    opt.value === value ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <Check
                    className={`mr-2 size-4 ${
                      opt.value === value ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className="truncate">{opt.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyQuestionsState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 px-6 py-16 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-background shadow-sm border border-border/50">
        <BookOpen className="size-6 text-muted-foreground/50" />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function QuestoesSkeleton() {
  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-3 border-b pb-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="space-y-4 p-6 border rounded-xl">
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
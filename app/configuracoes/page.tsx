"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  Moon,
  Palette,
  Save,
  Settings,
  Sun,
  Trash2,
  UserRound,
  XCircle,
  LoaderCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tema = "light" | "dark" | "system";

type Preferencias = {
  tema: Tema;
  notificacoes: boolean;
};

type LimitesCorrecao = {
  success: boolean;
  plan?: "free" | "essential" | "pro";
  plan_name?: string;
  monthly_limit?: number;
  used_this_month?: number;
  remaining_this_month?: number;
  period_start?: string;
  error?: string;
};

type DadosLimitesMentor = {
  plan: "free" | "essential" | "pro";
  plan_name: string;
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  maximum_characters: number;
  context_messages: number;
  maximum_output_tokens: number;
};

type RespostaLimitesMentor = {
  success: boolean;
  limits?: DadosLimitesMentor;
  error?: string;
};

const PREFERENCES_KEY = "discursiva-ai-preferencias";

const preferenciasIniciais: Preferencias = {
  tema: "system",
  notificacoes: true,
};

function aplicarTema(tema: Tema) {
  const root = document.documentElement;

  const sistemaEscuro = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;

  const usarEscuro =
    tema === "dark" ||
    (tema === "system" && sistemaEscuro);

  root.classList.toggle("dark", usarEscuro);
}

export default function ConfiguracoesPage() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [salvandoPreferencias, setSalvandoPreferencias] =
    useState(false);
  const [alterandoNome, setAlterandoNome] =
    useState(false);
  const [alterandoEmail, setAlterandoEmail] =
    useState(false);
  const [alterandoSenha, setAlterandoSenha] =
    useState(false);
  const [saindo, setSaindo] = useState(false);
  const [cancelandoAssinatura, setCancelandoAssinatura] =
    useState(false);
  const [excluindoConta, setExcluindoConta] =
    useState(false);
  const [dialogCancelarAberto, setDialogCancelarAberto] =
    useState(false);
  const [dialogExcluirAberto, setDialogExcluirAberto] =
    useState(false);
  const [confirmacaoExclusao, setConfirmacaoExclusao] =
    useState("");

  const [nome, setNome] = useState("");
  const [emailAtual, setEmailAtual] = useState("");
  const [novoEmail, setNovoEmail] = useState("");

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] =
    useState("");
  const [mostrarSenha, setMostrarSenha] =
    useState(false);

  const [mensagemSucesso, setMensagemSucesso] =
    useState("");
  const [mensagemErro, setMensagemErro] =
    useState("");

  const [preferencias, setPreferencias] =
    useState<Preferencias>(preferenciasIniciais);

  const [limitesCorrecao, setLimitesCorrecao] =
    useState<LimitesCorrecao | null>(null);

  const [limitesMentor, setLimitesMentor] =
    useState<DadosLimitesMentor | null>(null);

  const [carregandoLimites, setCarregandoLimites] =
    useState(true);

  const [erroLimites, setErroLimites] =
    useState("");

  const usoCorrecao =
    limitesCorrecao?.used_this_month ?? 0;

  const limiteCorrecao =
    limitesCorrecao?.monthly_limit ?? 0;

  const percentualCorrecao =
    limiteCorrecao > 0
      ? Math.min(
          100,
          Math.round(
            (usoCorrecao / limiteCorrecao) * 100,
          ),
        )
      : 0;

  const usoMentor =
    limitesMentor?.used_today ?? 0;

  const limiteMentor =
    limitesMentor?.daily_limit ?? 0;

  const restanteMentor =
    limitesMentor?.remaining_today ??
    Math.max(
      limiteMentor - usoMentor,
      0,
    );

  const percentualMentor =
    limiteMentor > 0
      ? Math.min(
          100,
          Math.round(
            (usoMentor / limiteMentor) * 100,
          ),
        )
      : 0;

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarConfiguracoes() {
      try {
        const preferenciasSalvas =
          window.localStorage.getItem(
            PREFERENCES_KEY,
          );

        if (preferenciasSalvas) {
          try {
            const valores = JSON.parse(
              preferenciasSalvas,
            ) as Partial<Preferencias>;

            const temaValido: Tema =
              valores.tema === "light" ||
              valores.tema === "dark" ||
              valores.tema === "system"
                ? valores.tema
                : "system";

            const configuracaoCarregada: Preferencias = {
              tema: temaValido,
              notificacoes:
                typeof valores.notificacoes ===
                "boolean"
                  ? valores.notificacoes
                  : true,
            };

            if (componenteAtivo) {
              setPreferencias(
                configuracaoCarregada,
              );
            }

            aplicarTema(
              configuracaoCarregada.tema,
            );
          } catch {
            aplicarTema(
              preferenciasIniciais.tema,
            );
          }
        } else {
          aplicarTema(
            preferenciasIniciais.tema,
          );
        }

        const supabase = createClient();

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          router.replace("/login");
          return;
        }

        if (!componenteAtivo) {
          return;
        }

        const nomeUsuario =
          typeof user.user_metadata?.full_name ===
          "string"
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name ===
                "string"
              ? user.user_metadata.name
              : "";

        setNome(nomeUsuario);
        setEmailAtual(user.email ?? "");
        setNovoEmail(user.email ?? "");
      } catch {
        if (componenteAtivo) {
          setMensagemErro(
            "Não foi possível carregar as configurações da conta.",
          );
        }
      } finally {
        if (componenteAtivo) {
          setCarregando(false);
        }
      }
    }

    void carregarConfiguracoes();

    return () => {
      componenteAtivo = false;
    };
  }, [router]);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarLimites() {
      setCarregandoLimites(true);
      setErroLimites("");

      try {
        const [
          respostaCorrecao,
          respostaMentor,
        ] = await Promise.all([
          fetch(
            "/api/correcoes/limites",
            {
              method: "GET",
              cache: "no-store",
            },
          ),
          fetch(
            "/api/mentor",
            {
              method: "GET",
              cache: "no-store",
            },
          ),
        ]);

        const [
          dadosCorrecao,
          dadosMentor,
        ] = await Promise.all([
          respostaCorrecao.json() as Promise<LimitesCorrecao>,
          respostaMentor.json() as Promise<RespostaLimitesMentor>,
        ]);

        if (!componenteAtivo) {
          return;
        }

        if (
          !respostaCorrecao.ok ||
          dadosCorrecao.success !== true
        ) {
          throw new Error(
            dadosCorrecao.error ??
              "Não foi possível consultar os limites de correção.",
          );
        }

        if (
          !respostaMentor.ok ||
          dadosMentor.success !== true
        ) {
          throw new Error(
            dadosMentor.error ??
              "Não foi possível consultar os limites do Mentor.",
          );
        }

        setLimitesCorrecao(
          dadosCorrecao,
        );

        if (!dadosMentor.limits) {
          throw new Error(
            "A API do Mentor não retornou os limites.",
          );
        }

        setLimitesMentor(
          dadosMentor.limits,
        );
      } catch (error) {
        if (!componenteAtivo) {
          return;
        }

        setErroLimites(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar os limites do plano.",
        );
      } finally {
        if (componenteAtivo) {
          setCarregandoLimites(false);
        }
      }
    }

    void carregarLimites();

    return () => {
      componenteAtivo = false;
    };
  }, []);

  function limparMensagens() {
    setMensagemSucesso("");
    setMensagemErro("");
  }

  function selecionarTema(tema: Tema) {
    setPreferencias((estadoAtual) => ({
      ...estadoAtual,
      tema,
    }));

    aplicarTema(tema);
    limparMensagens();
  }

  function salvarPreferencias() {
    limparMensagens();
    setSalvandoPreferencias(true);

    try {
      window.localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify(preferencias),
      );

      aplicarTema(preferencias.tema);

      setMensagemSucesso(
        "Preferências atualizadas com sucesso.",
      );
    } catch {
      setMensagemErro(
        "Não foi possível salvar as preferências.",
      );
    } finally {
      setSalvandoPreferencias(false);
    }
  }

  async function alterarNome(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    limparMensagens();

    const nomeNormalizado =
      nome.trim().replace(/\s+/g, " ");

    if (nomeNormalizado.length < 2) {
      setMensagemErro(
        "Informe um nome com pelo menos 2 caracteres.",
      );
      return;
    }

    if (nomeNormalizado.length > 80) {
      setMensagemErro(
        "O nome deve ter no máximo 80 caracteres.",
      );
      return;
    }

    setAlterandoNome(true);

    try {
      const supabase = createClient();

      const {
        data,
        error,
      } = await supabase.auth.updateUser({
        data: {
          full_name: nomeNormalizado,
          name: nomeNormalizado,
        },
      });

      if (error) {
        throw error;
      }

      const nomeAtualizado =
        typeof data.user?.user_metadata?.full_name ===
        "string"
          ? data.user.user_metadata.full_name
          : nomeNormalizado;

      setNome(nomeAtualizado);

      setMensagemSucesso(
        "Nome atualizado com sucesso.",
      );

      router.refresh();
    } catch (error) {
      setMensagemErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o nome.",
      );
    } finally {
      setAlterandoNome(false);
    }
  }

  async function alterarEmail(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    limparMensagens();

    const emailNormalizado =
      novoEmail.trim().toLowerCase();

    if (!emailNormalizado) {
      setMensagemErro(
        "Informe o novo endereço de e-mail.",
      );
      return;
    }

    if (
      emailNormalizado ===
      emailAtual.trim().toLowerCase()
    ) {
      setMensagemErro(
        "O novo e-mail deve ser diferente do atual.",
      );
      return;
    }

    setAlterandoEmail(true);

    try {
      const supabase = createClient();

      const { error } =
        await supabase.auth.updateUser({
          email: emailNormalizado,
        });

      if (error) {
        throw error;
      }

      setMensagemSucesso(
        "Solicitação enviada. Verifique as caixas de entrada do e-mail atual e do novo e-mail para confirmar a alteração.",
      );
    } catch (error) {
      setMensagemErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o e-mail.",
      );
    } finally {
      setAlterandoEmail(false);
    }
  }

  async function alterarSenha(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    limparMensagens();

    if (novaSenha.length < 8) {
      setMensagemErro(
        "A nova senha deve ter pelo menos 8 caracteres.",
      );
      return;
    }

    if (novaSenha !== confirmacaoSenha) {
      setMensagemErro(
        "A confirmação da senha não corresponde à nova senha.",
      );
      return;
    }

    setAlterandoSenha(true);

    try {
      const supabase = createClient();

      const { error } =
        await supabase.auth.updateUser({
          password: novaSenha,
        });

      if (error) {
        throw error;
      }

      setNovaSenha("");
      setConfirmacaoSenha("");

      setMensagemSucesso(
        "Senha alterada com sucesso.",
      );
    } catch (error) {
      setMensagemErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a senha.",
      );
    } finally {
      setAlterandoSenha(false);
    }
  }

  async function cancelarAssinaturaEApagarDados() {
    limparMensagens();
    setCancelandoAssinatura(true);

    try {
      const response = await fetch(
        "/api/assinatura/cancelar",
        {
          method: "POST",
        },
      );

      const result =
        (await response.json()) as {
          success?: boolean;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        result.success !== true
      ) {
        throw new Error(
          result.error ||
            "Não foi possível cancelar a assinatura.",
        );
      }

      setDialogCancelarAberto(false);
      setMensagemSucesso(
        result.message ||
          "Assinatura cancelada e dados apagados.",
      );

      setLimitesCorrecao(null);
      setLimitesMentor(null);

      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      setMensagemErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao cancelar a assinatura.",
      );
    } finally {
      setCancelandoAssinatura(false);
    }
  }

  async function excluirContaDefinitivamente() {
    if (
      confirmacaoExclusao.trim().toUpperCase() !==
      "EXCLUIR"
    ) {
      setMensagemErro(
        'Digite "EXCLUIR" para confirmar.',
      );
      return;
    }

    limparMensagens();
    setExcluindoConta(true);

    try {
      const response = await fetch(
        "/api/conta/excluir",
        {
          method: "DELETE",
        },
      );

      const result =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        result.success !== true
      ) {
        throw new Error(
          result.error ||
            "Não foi possível excluir a conta.",
        );
      }

      const supabase = createClient();

      await supabase.auth.signOut();

      window.localStorage.removeItem(
        PREFERENCES_KEY,
      );

      router.replace("/");
      router.refresh();
    } catch (error) {
      setMensagemErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao excluir a conta.",
      );
      setExcluindoConta(false);
    }
  }

  async function sairDaConta() {
    limparMensagens();
    setSaindo(true);

    try {
      const supabase = createClient();

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setMensagemErro(
        error instanceof Error
          ? error.message
          : "Não foi possível sair da conta.",
      );

      setSaindo(false);
    }
  }

  if (carregando) {
    return <ConfiguracoesSkeleton />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2 border-b pb-6">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-muted-foreground" />

          <h1 className="text-2xl font-semibold tracking-tight">
            Configurações
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Gerencie sua conta, segurança e preferências da plataforma.
        </p>
      </header>

      {mensagemSucesso && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
          <CheckCircle2 className="size-4" />

          <AlertTitle>
            Alteração concluída
          </AlertTitle>

          <AlertDescription>
            {mensagemSucesso}
          </AlertDescription>
        </Alert>
      )}

      {mensagemErro && (
        <Alert variant="destructive">
          <AlertTitle>
            Não foi possível concluir
          </AlertTitle>

          <AlertDescription>
            {mensagemErro}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-background text-foreground">
                <BookOpenCheck className="size-5" />
              </div>

              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  Plano e uso
                </CardTitle>

                <CardDescription className="mt-1 leading-5">
                  Acompanhe seus limites atuais de correções e uso do Mentor.
                </CardDescription>
              </div>
            </div>

            {!carregandoLimites &&
              limitesCorrecao?.plan_name && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge
                    variant="outline"
                    className="bg-background font-medium"
                  >
                    Plano {limitesCorrecao.plan_name}
                  </Badge>

                  {limitesCorrecao.plan === "free" && (
                    <Link
                      href="/planos"
                      className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Ver planos
                    </Link>
                  )}
                </div>
              )}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {carregandoLimites ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ) : erroLimites ? (
            <Alert variant="destructive">
              <AlertTitle>
                Não foi possível carregar o uso
              </AlertTitle>

              <AlertDescription>
                {erroLimites}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-background p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40 text-foreground">
                      <BookOpenCheck className="size-4" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold tracking-tight">
                        Correções discursivas
                      </p>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Limite mensal
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-medium text-muted-foreground">
                    {limitesCorrecao?.remaining_this_month ?? 0} restantes
                  </span>
                </div>

                <div className="mt-6">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      {usoCorrecao}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        de {limiteCorrecao}
                      </span>
                    </p>

                    <span className="text-xs text-muted-foreground">
                      {percentualCorrecao}% usado
                    </span>
                  </div>

                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                    aria-label={`${percentualCorrecao}% do limite mensal utilizado`}
                  >
                    <div
                      className="h-full rounded-full bg-foreground/75 transition-all"
                      style={{
                        width: `${percentualCorrecao}%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Renovação automática no primeiro dia de cada mês.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40 text-foreground">
                      <Bot className="size-4" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold tracking-tight">
                        Mentor IA
                      </p>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Limite diário
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-medium text-muted-foreground">
                    {restanteMentor} restantes
                  </span>
                </div>

                <div className="mt-6">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      {usoMentor}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        de {limiteMentor}
                      </span>
                    </p>

                    <span className="text-xs text-muted-foreground">
                      {percentualMentor}% usado
                    </span>
                  </div>

                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                    aria-label={`${percentualMentor}% do limite diário utilizado`}
                  >
                    <div
                      className="h-full rounded-full bg-foreground/75 transition-all"
                      style={{
                        width: `${percentualMentor}%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Renovação automática todos os dias.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/10">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
              <UserRound className="size-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Perfil
              </CardTitle>

              <CardDescription>
                Informações básicas da sua conta.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form
            onSubmit={alterarNome}
            className="space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">
                  Nome
                </Label>

                <Input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(event) => {
                    setNome(event.target.value);
                    limparMensagens();
                  }}
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Digite seu nome"
                  disabled={alterandoNome}
                  required
                />

                <p className="text-xs text-muted-foreground">
                  Esse nome será usado na sua conta e nas áreas personalizadas da plataforma.
                </p>
              </div>

              <div className="space-y-2">
                <Label>E-mail atual</Label>

                <div className="flex min-h-10 items-center rounded-md border bg-background px-3 text-sm text-foreground shadow-xs">
                  {emailAtual}
                </div>

                <p className="text-xs text-muted-foreground">
                  Para alterar o e-mail, use a seção abaixo.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={alterandoNome}
              >
                <Save className="size-4" />

                {alterandoNome
                  ? "Salvando nome..."
                  : "Salvar nome"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/10">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
              <Mail className="size-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Alterar e-mail
              </CardTitle>

              <CardDescription>
                A alteração poderá exigir confirmação por e-mail.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form
            onSubmit={alterarEmail}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="novo-email">
                Novo e-mail
              </Label>

              <Input
                id="novo-email"
                type="email"
                value={novoEmail}
                onChange={(event) =>
                  setNovoEmail(
                    event.target.value,
                  )
                }
                autoComplete="email"
                required
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                disabled={alterandoEmail}
              >
                <Mail className="size-4" />

                {alterandoEmail
                  ? "Enviando confirmação..."
                  : "Alterar e-mail"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/10">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
              <KeyRound className="size-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Alterar senha
              </CardTitle>

              <CardDescription>
                Use uma senha exclusiva e difícil de adivinhar.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form
            onSubmit={alterarSenha}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">
                  Nova senha
                </Label>

                <div className="relative">
                  <Input
                    id="nova-senha"
                    type={
                      mostrarSenha
                        ? "text"
                        : "password"
                    }
                    value={novaSenha}
                    onChange={(event) =>
                      setNovaSenha(
                        event.target.value,
                      )
                    }
                    minLength={8}
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarSenha(
                        (valorAtual) =>
                          !valorAtual,
                      )
                    }
                    className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label={
                      mostrarSenha
                        ? "Ocultar senha"
                        : "Mostrar senha"
                    }
                  >
                    {mostrarSenha ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">
                  Confirmar nova senha
                </Label>

                <Input
                  id="confirmar-senha"
                  type={
                    mostrarSenha
                      ? "text"
                      : "password"
                  }
                  value={confirmacaoSenha}
                  onChange={(event) =>
                    setConfirmacaoSenha(
                      event.target.value,
                    )
                  }
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              A senha deve ter pelo menos 8 caracteres.
            </p>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                disabled={alterandoSenha}
              >
                <KeyRound className="size-4" />

                {alterandoSenha
                  ? "Alterando senha..."
                  : "Alterar senha"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/10">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
              <Palette className="size-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Aparência
              </CardTitle>

              <CardDescription>
                Escolha como a interface deve ser exibida.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <ThemeOption
              title="Claro"
              description="Usar sempre o tema claro."
              icon={<Sun className="size-5" />}
              selected={
                preferencias.tema === "light"
              }
              onClick={() =>
                selecionarTema("light")
              }
            />

            <ThemeOption
              title="Escuro"
              description="Usar sempre o tema escuro."
              icon={<Moon className="size-5" />}
              selected={
                preferencias.tema === "dark"
              }
              onClick={() =>
                selecionarTema("dark")
              }
            />

            <ThemeOption
              title="Sistema"
              description="Acompanhar o tema do dispositivo."
              icon={<Laptop className="size-5" />}
              selected={
                preferencias.tema === "system"
              }
              onClick={() =>
                selecionarTema("system")
              }
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              onClick={salvarPreferencias}
              disabled={salvandoPreferencias}
            >
              <Save className="size-4" />

              {salvandoPreferencias
                ? "Salvando..."
                : "Salvar aparência"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/10">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
              <Bell className="size-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Notificações
              </CardTitle>

              <CardDescription>
                Controle os avisos exibidos pela plataforma.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <Label htmlFor="notificacoes">
                Notificações da plataforma
              </Label>

              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Receba avisos sobre conclusão de correções e atividades
                importantes da sua conta.
              </p>
            </div>

            <Switch
              id="notificacoes"
              checked={
                preferencias.notificacoes
              }
              onCheckedChange={(valor) => {
                setPreferencias(
                  (estadoAtual) => ({
                    ...estadoAtual,
                    notificacoes: valor,
                  }),
                );

                limparMensagens();
              }}
            />
          </div>

          <Separator className="my-6" />

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={salvarPreferencias}
              disabled={salvandoPreferencias}
            >
              <Save className="size-4" />
              Salvar notificações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/25">
        <CardHeader className="border-b bg-destructive/5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10">
              <XCircle className="size-4 text-destructive" />
            </div>

            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Cancelar assinatura
              </CardTitle>

              <CardDescription>
                Encerra a recorrência, apaga o histórico e mantém seu login no plano gratuito.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Cancelar e apagar dados
            </p>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Todas as respostas, correções, históricos e dados de uso serão
              apagados definitivamente. Sua conta continuará ativa e vazia.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDialogCancelarAberto(true)
            }
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <XCircle className="size-4" />
            Cancelar assinatura
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader className="border-b bg-destructive/5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10">
              <Trash2 className="size-4 text-destructive" />
            </div>

            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Excluir conta
              </CardTitle>

              <CardDescription>
                Remove permanentemente a conta, a assinatura e todos os dados.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Exclusão definitiva
            </p>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Esta ação não pode ser desfeita. A recorrência será encerrada antes
              da remoção do acesso.
            </p>
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={() =>
              setDialogExcluirAberto(true)
            }
            className="shrink-0"
          >
            <Trash2 className="size-4" />
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/25">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10">
              <LogOut className="size-4 text-destructive" />
            </div>

            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Sessão
              </CardTitle>

              <CardDescription>
                Encerre o acesso atual à plataforma.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <p className="text-sm font-medium">
              Sair da conta
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Será necessário entrar novamente para acessar suas respostas.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={sairDaConta}
            disabled={saindo}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />

            {saindo ? "Saindo..." : "Sair"}
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={dialogCancelarAberto}
        onOpenChange={(open) => {
          if (!cancelandoAssinatura) {
            setDialogCancelarAberto(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cancelar assinatura e apagar dados?
            </DialogTitle>

            <DialogDescription className="leading-6">
              A recorrência será encerrada no Asaas e todo o histórico da
              plataforma será apagado definitivamente. Seu login permanecerá
              ativo no plano gratuito.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDialogCancelarAberto(false)
              }
              disabled={cancelandoAssinatura}
            >
              Voltar
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void cancelarAssinaturaEApagarDados()
              }
              disabled={cancelandoAssinatura}
            >
              {cancelandoAssinatura ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Confirmar cancelamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogExcluirAberto}
        onOpenChange={(open) => {
          if (!excluindoConta) {
            setDialogExcluirAberto(open);

            if (!open) {
              setConfirmacaoExclusao("");
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir conta definitivamente?
            </DialogTitle>

            <DialogDescription className="leading-6">
              A assinatura será cancelada e todos os dados serão removidos.
              Esta ação é irreversível.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirmar-exclusao">
              Digite EXCLUIR para confirmar
            </Label>

            <Input
              id="confirmar-exclusao"
              value={confirmacaoExclusao}
              onChange={(event) =>
                setConfirmacaoExclusao(
                  event.target.value,
                )
              }
              autoComplete="off"
              disabled={excluindoConta}
              placeholder="EXCLUIR"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDialogExcluirAberto(false)
              }
              disabled={excluindoConta}
            >
              Voltar
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void excluirContaDefinitivamente()
              }
              disabled={
                excluindoConta ||
                confirmacaoExclusao
                  .trim()
                  .toUpperCase() !==
                  "EXCLUIR"
              }
            >
              {excluindoConta ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Excluir definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ThemeOptionProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
};

function ThemeOption({
  title,
  description,
  icon,
  selected,
  onClick,
}: ThemeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "bg-background hover:bg-muted/40",
      ].join(" ")}
    >
      {selected && (
        <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="size-3" />
        </div>
      )}

      <div className="text-muted-foreground">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-medium">
        {title}
      </h3>

      <p className="mt-1 pr-4 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </button>
  );
}

function ConfiguracoesSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2 border-b pb-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {[1, 2, 3, 4, 5].map((item) => (
        <Card key={item}>
          <CardHeader className="border-b bg-muted/10">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>

          <CardContent className="pt-6">
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
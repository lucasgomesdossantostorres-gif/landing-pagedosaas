"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    setCarregando(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        setMensagem(
          "E-mail ou senha inválidos. Confira os dados e tente novamente.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar agora.",
      );
    } finally {
      setCarregando(false);
    }
  }

  async function entrarComGoogle() {
    setMensagem("");
    setCarregandoGoogle(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMensagem(
          "Não foi possível iniciar o acesso com o Google. Tente novamente.",
        );
        setCarregandoGoogle(false);
      }
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar com o Google.",
      );
      setCarregandoGoogle(false);
    }
  }

  const algumaAcaoCarregando = carregando || carregandoGoogle;

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-20">
          <div className="absolute left-8 top-8 hidden items-center gap-3 lg:flex">
            <div className="flex size-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 shadow-sm">
              <Image
                src="/images/Logo1.png"
                alt="Logo Simples Aprova.AI"
                width={40}
                height={40}
                className="size-9 object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-base font-extrabold tracking-[-0.02em]">
                Simples Aprova.AI
              </p>
              <p className="text-xs font-medium text-slate-500">
                Correção por IA para concursos
              </p>
            </div>
          </div>

          <div className="w-full max-w-115">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex size-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                <Image
                  src="/images/Logo1.png"
                  alt="Logo Simples Aprova.AI"
                  width={42}
                  height={42}
                  className="size-10 object-contain"
                  priority
                />
              </div>
              <div>
                <p className="font-extrabold">Simples Aprova.AI</p>
                <p className="text-xs text-slate-500">
                  Correção por IA para concursos
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
              <Sparkles className="size-3.5" />
              Sua evolução continua aqui
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-0.04em] sm:text-[46px]">
              Bem-vindo de volta.
            </h1>

            <p className="mt-3 max-w-md text-base leading-7 text-slate-600 sm:text-lg">
              Entre para continuar treinando suas respostas discursivas e
              acompanhar sua evolução.
            </p>

            <div className="mt-9">
              <button
                type="button"
                onClick={entrarComGoogle}
                disabled={algumaAcaoCarregando}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregandoGoogle ? (
                  <LoaderCircle className="size-5 animate-spin text-blue-600" />
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5 shrink-0"
                  >
                    <path
                      fill="#4285F4"
                      d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.89-1.74 2.99-4.3 2.99-7.37Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 22c2.7 0 4.96-.89 6.61-2.4l-3.22-2.51c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.07v2.59A10 10 0 0 0 12 22Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.62.39 3.15 1.07 4.51l3.32-2.59Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.32 2.59C7.18 7.71 9.39 5.95 12 5.95Z"
                    />
                  </svg>
                )}
                {carregandoGoogle
                  ? "Abrindo o Google..."
                  : "Continuar com o Google"}
              </button>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  ou entre com e-mail
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </div>

            <form onSubmit={entrar} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seuemail@exemplo.com"
                    autoComplete="email"
                    required
                    className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="senha"
                    className="block text-sm font-bold text-slate-800"
                  >
                    Senha
                  </label>
                  <span className="text-xs font-semibold text-slate-400">
                    Acesso seguro
                  </span>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="senha"
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    required
                    className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-12 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((valor) => !valor)}
                    className="absolute right-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </div>
              </div>

              {mensagem && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {mensagem}
                </div>
              )}

              <button
                type="submit"
                disabled={algumaAcaoCarregando}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-base font-extrabold text-white shadow-[0_14px_32px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando ? (
                  <>
                    <LoaderCircle className="size-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar na plataforma
                    <ArrowRight className="size-5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-600">
              Ainda não possui uma conta?{" "}
              <Link
                href="/cadastro"
                className="font-extrabold text-blue-700 transition hover:text-blue-900"
              >
                Criar conta gratuitamente
              </Link>
            </p>

            <p className="mt-8 text-center text-xs leading-5 text-slate-400">
              Ao entrar, você concorda com os Termos de Uso e a Política de
              Privacidade da plataforma.
            </p>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#0b1d4d_0%,#123c94_48%,#2563eb_100%)] p-12 text-white lg:flex lg:items-center lg:justify-center xl:p-20">
          <div className="pointer-events-none absolute -right-32 -top-28 size-105 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 size-90 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,white_1px,transparent_1px)] bg-size-[28px_28px] opacity-20" />

          <div className="relative z-10 w-full max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur">
              <Target className="size-4 text-cyan-200" />
              Treine com estratégia
            </div>

            <h2 className="mt-8 max-w-xl text-4xl font-extrabold leading-tight tracking-[-0.04em] xl:text-5xl">
              Seu próximo resultado começa com um feedback melhor.
            </h2>

            <p className="mt-5 max-w-xl text-lg leading-8 text-blue-100">
              Analise conteúdo, estrutura e linguagem em um só lugar e
              transforme cada resposta em um passo concreto de evolução.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <FileCheck2 className="size-6 text-cyan-200" />
                <p className="mt-4 font-extrabold">Feedback completo</p>
                <p className="mt-1 text-sm leading-6 text-blue-100">
                  Conteúdo, estrutura e linguagem.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <TrendingUp className="size-6 text-cyan-200" />
                <p className="mt-4 font-extrabold">Evolução visível</p>
                <p className="mt-1 text-sm leading-6 text-blue-100">
                  Histórico, notas e desempenho.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <Sparkles className="size-6 text-cyan-200" />
                <p className="mt-4 font-extrabold">Mentor por IA</p>
                <p className="mt-1 text-sm leading-6 text-blue-100">
                  Orientação para o próximo passo.
                </p>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-white/15 bg-slate-950/20 p-6 backdrop-blur">
              <p className="text-sm font-semibold leading-7 text-blue-50">
                “A prática aprova. O feedback acelera.”
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

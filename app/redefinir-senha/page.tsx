"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [sessaoValida, setSessaoValida] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    async function verificar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!ativo) return;
      setSessaoValida(Boolean(session));
      setVerificandoSessao(false);
    }

    void verificar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!ativo) return;
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setSessaoValida(Boolean(session));
          setVerificandoSessao(false);
        }
      },
    );

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function redefinirSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagemErro("");

    if (novaSenha.length < 8) {
      setMensagemErro("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (novaSenha !== confirmacaoSenha) {
      setMensagemErro("A confirmação não corresponde à nova senha.");
      return;
    }

    setSalvando(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      setConcluido(true);
      setNovaSenha("");
      setConfirmacaoSenha("");
    } catch (error) {
      setMensagemErro(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar sua senha.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (verificandoSessao) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <LoaderCircle className="size-5 animate-spin text-blue-600" />
          Validando seu link...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 text-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        {concluido ? (
          <>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em]">Senha atualizada</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Sua nova senha foi salva. Você já pode acessar a plataforma.
            </p>
            <Link href="/login" className="mt-7 inline-flex h-14 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-base font-extrabold text-white transition hover:bg-blue-700">
              Ir para o login
            </Link>
          </>
        ) : !sessaoValida ? (
          <>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <ShieldCheck className="size-6" />
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em]">Link inválido ou expirado</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Solicite um novo link para redefinir sua senha.
            </p>
            <Link href="/esqueci-senha" className="mt-7 inline-flex h-14 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-base font-extrabold text-white transition hover:bg-blue-700">
              Solicitar novo link
            </Link>
          </>
        ) : (
          <>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <LockKeyhole className="size-6" />
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em]">Crie uma nova senha</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Use uma senha exclusiva, com pelo menos 8 caracteres.
            </p>

            <form onSubmit={redefinirSenha} className="mt-8 space-y-5">
              <div>
                <label htmlFor="nova-senha" className="mb-2 block text-sm font-bold text-slate-800">Nova senha</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="nova-senha"
                    type={mostrarSenha ? "text" : "password"}
                    value={novaSenha}
                    onChange={(event) => {
                      setNovaSenha(event.target.value);
                      setMensagemErro("");
                    }}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={salvando}
                    className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-12 text-base text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((valor) => !valor)}
                    className="absolute right-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmacao-senha" className="mb-2 block text-sm font-bold text-slate-800">Confirmar nova senha</label>
                <input
                  id="confirmacao-senha"
                  type={mostrarSenha ? "text" : "password"}
                  value={confirmacaoSenha}
                  onChange={(event) => {
                    setConfirmacaoSenha(event.target.value);
                    setMensagemErro("");
                  }}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={salvando}
                  className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                />
              </div>

              {mensagemErro && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {mensagemErro}
                </div>
              )}

              <button
                type="submit"
                disabled={salvando}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-base font-extrabold text-white shadow-[0_14px_32px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? (
                  <><LoaderCircle className="size-5 animate-spin" /> Salvando...</>
                ) : (
                  <><ShieldCheck className="size-5" /> Salvar nova senha</>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

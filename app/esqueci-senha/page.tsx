"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LoaderCircle, Mail, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function solicitarRedefinicao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (carregando) return;

    setCarregando(true);
    setMensagemErro("");

    try {
      const emailNormalizado = email.trim().toLowerCase();
      if (!emailNormalizado) throw new Error("Informe seu endereço de e-mail.");

      const supabase = createClient();
      const redirectTo =
        `${window.location.origin}/auth/callback?next=${encodeURIComponent("/redefinir-senha")}`;

      const { error } = await supabase.auth.resetPasswordForEmail(
        emailNormalizado,
        { redirectTo },
      );

      if (error) throw error;
      setEnviado(true);
    } catch (error) {
      setMensagemErro(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o e-mail de recuperação.",
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 text-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-blue-700">
          <ArrowLeft className="size-4" />
          Voltar ao login
        </Link>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
          <Sparkles className="size-3.5" />
          Recuperação de acesso
        </div>

        {enviado ? (
          <div className="mt-7">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em]">Verifique seu e-mail</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Enviamos um link de redefinição para{" "}
              <strong className="text-slate-900">{email.trim().toLowerCase()}</strong>
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Verifique também as pastas de spam e promoções.
            </p>
            <button
              type="button"
              onClick={() => {
                setEnviado(false);
                setMensagemErro("");
              }}
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-extrabold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50"
            >
              Enviar novamente
            </button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-0.04em]">Esqueceu sua senha?</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Informe o e-mail da sua conta. Você receberá um link seguro para criar uma nova senha.
            </p>

            <form onSubmit={solicitarRedefinicao} className="mt-8">
              <label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-800">E-mail</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setMensagemErro("");
                  }}
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                  required
                  disabled={carregando}
                  className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                />
              </div>

              {mensagemErro && (
                <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {mensagemErro}
                </div>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-base font-extrabold text-white shadow-[0_14px_32px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando ? (
                  <><LoaderCircle className="size-5 animate-spin" /> Enviando...</>
                ) : (
                  <><Mail className="size-5" /> Enviar link de redefinição</>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

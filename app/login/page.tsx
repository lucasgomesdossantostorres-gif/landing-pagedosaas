"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

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
        setMensagem(`Erro: ${error.message}`);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      const mensagemErro =
        error instanceof Error ? error.message : "Erro desconhecido.";

      setMensagem(`Erro: ${mensagemErro}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          Entrar
        </h1>

        <p className="mt-2 text-slate-600">
          Entre para acessar suas questões e correções.
        </p>

        <form onSubmit={entrar} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="senha"
              className="block text-sm font-medium text-slate-700"
            >
              Senha
            </label>

            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {mensagem && (
          <p className="mt-5 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
            {mensagem}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Ainda não possui uma conta?{" "}
          <a href="/cadastro" className="font-semibold text-blue-600">
            Criar conta
          </a>
        </p>
      </section>
    </main>
  );
}
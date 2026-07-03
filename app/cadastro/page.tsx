"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CadastroPage() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMensagem("");
    setCarregando(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            full_name: nome,
          },
        },
      });

      if (error) {
        setMensagem(`Erro: ${error.message}`);
        return;
      }

      if (!data.session) {
        setMensagem(
          "Cadastro realizado. Verifique seu e-mail para confirmar a conta."
        );
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
          Criar sua conta
        </h1>

        <p className="mt-2 text-slate-600">
          Cadastre-se para responder e corrigir questões discursivas.
        </p>

        <form onSubmit={cadastrar} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="nome"
              className="block text-sm font-medium text-slate-700"
            >
              Nome completo
            </label>

            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
          </div>

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
              minLength={6}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />

            <p className="mt-2 text-sm text-slate-500">
              Use pelo menos 6 caracteres.
            </p>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {carregando ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        {mensagem && (
          <p className="mt-5 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
            {mensagem}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Já possui uma conta?{" "}
          <a href="/login" className="font-semibold text-blue-600">
            Entrar
          </a>
        </p>
      </section>
    </main>
  );
}
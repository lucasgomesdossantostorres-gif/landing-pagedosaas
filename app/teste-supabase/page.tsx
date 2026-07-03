"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TesteSupabasePage() {
  const [mensagem, setMensagem] = useState(
    "Clique no botão para testar a conexão."
  );

  async function testarConexao() {
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.getSession();

      if (error) {
        setMensagem(`Erro: ${error.message}`);
        return;
      }

      setMensagem("Conexão com o Supabase realizada com sucesso.");
    } catch (error) {
      const mensagemErro =
        error instanceof Error ? error.message : "Erro desconhecido.";

      setMensagem(`Erro: ${mensagemErro}`);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Teste de conexão com o Supabase
        </h1>

        <p className="mt-4 text-slate-600">{mensagem}</p>

        <button
          type="button"
          onClick={testarConexao}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          Testar conexão
        </button>
      </section>
    </main>
  );
}
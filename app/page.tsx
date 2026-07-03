export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
          Plataforma de estudos para concursos
        </span>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
          Aprimore suas respostas discursivas com inteligência artificial
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Escolha uma questão, escreva sua resposta e receba uma correção
          detalhada com nota, análise dos critérios e sugestões de melhoria.
        </p>

        <div className="mt-10 flex gap-4">
          <a
            href="/cadastro"
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Criar conta
          </a>

          <a
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Entrar
          </a>
        </div>
      </section>
    </main>
  );
}
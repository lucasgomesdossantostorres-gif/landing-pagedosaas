"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Sparkles, 
  CheckCircle2, 
  PenTool, 
  BrainCircuit,
  Star
} from "lucide-react";

export default function CadastroPage() {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Cadastrando:", { nome, email, senha });
  };

  return (
    <div className="flex min-h-screen w-full bg-[#0F141F] text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* COLUNA ESQUERDA - APRESENTAÇÃO CRIATIVA (Visual do Produto) */}
      <div className="relative hidden w-[55%] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-[#060e22] p-12 lg:flex">
        
        {/* Pattern de Pontinhos */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }}
        />

        {/* Efeito de Brilho de Fundo */}
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-[100px]" />
        
        <div className="relative z-10 flex w-full max-w-lg flex-col items-center">
          
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
              A inteligência por trás<br />da sua aprovação.
            </h2>
            <p className="text-blue-100/80 text-lg">
              Junte-se a centenas de concurseiros que já transformaram seus textos com nossa IA.
            </p>
          </div>

          {/* MOCKUP CRIATIVO - Simulação da IA corrigindo */}
          <div className="relative w-full rounded-2xl border border-blue-400/30 bg-[#0F141F]/60 p-6 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header do Mockup */}
            <div className="flex items-center justify-between border-b border-blue-500/20 pb-4 mb-4">
              <div className="flex items-center gap-2 text-blue-300 font-medium text-sm">
                <BrainCircuit className="size-4" />
                Analisando estrutura discursiva...
              </div>
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-slate-600"></div>
                <div className="size-2.5 rounded-full bg-slate-600"></div>
                <div className="size-2.5 rounded-full bg-blue-500 animate-pulse"></div>
              </div>
            </div>

            {/* Texto simulado */}
            <div className="space-y-3">
              <div className="h-3 w-full rounded-md bg-slate-700/50"></div>
              <div className="h-3 w-11/12 rounded-md bg-slate-700/50"></div>
              <div className="h-3 w-full rounded-md bg-slate-700/50"></div>
              <div className="relative flex items-center h-3 w-4/5 rounded-md bg-slate-700/50">
                {/* Elemento de Highlight da IA */}
                <div className="absolute -inset-y-1 -inset-x-2 rounded border border-blue-400/50 bg-blue-500/20"></div>
              </div>
            </div>

            {/* Popups flutuantes do Mockup */}
            <div className="absolute -right-8 top-24 rounded-xl border border-emerald-500/30 bg-emerald-950/80 p-3 backdrop-blur-md shadow-lg animate-in zoom-in duration-500 delay-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-100">Coesão perfeita</span>
              </div>
            </div>

            <div className="absolute -left-10 bottom-6 rounded-xl border border-amber-500/30 bg-amber-950/80 p-3 backdrop-blur-md shadow-lg animate-in zoom-in duration-500 delay-500">
              <div className="flex items-center gap-2">
                <PenTool className="size-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-100">Melhorar vocabulário</span>
              </div>
            </div>

            {/* Score simulado */}
            <div className="mt-8 flex items-center justify-between rounded-xl bg-blue-900/40 p-4 border border-blue-500/20">
              <div>
                <p className="text-xs text-blue-200/70 mb-1 font-medium uppercase tracking-wider">Nota Estimada</p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white">9.5</span>
                  <span className="text-blue-300 font-medium mb-1">/ 10</span>
                </div>
              </div>
              <div className="flex size-12 items-center justify-center rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300">
                <Star className="size-6 fill-blue-300" />
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* COLUNA DIREITA - FORMULÁRIO DE CADASTRO */}
      <div className="flex w-full flex-col justify-center p-8 sm:p-12 lg:w-[45%] xl:p-20 overflow-y-auto">
        
        <div className="mx-auto w-full max-w-md">
          {/* Logo mobile (escondida no desktop se quiser, mas bom manter para consistência) */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 shadow-sm">
              <div className="size-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">Simples Aprova.AI</h1>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide">Correção por IA</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 mb-5">
              <Sparkles className="size-3.5" />
              Sua jornada começa aqui
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
              Criar conta
            </h2>
            <p className="text-slate-400 text-sm">
              Preencha os dados abaixo e ganhe acesso imediato ao seu painel de correções.
            </p>
          </div>

          {/* Botão Google - Consistente com o Login */}
          <button className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700/60">
            <svg className="size-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Cadastrar com o Google
          </button>

          {/* Divisor */}
          <div className="relative my-6 flex items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="shrink-0 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Ou com seu e-mail
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Formulário - Inputs idênticos ao Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Nome completo</label>
              <input 
                type="text" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500 focus:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">E-mail</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500 focus:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5 pb-2">
              <label className="text-sm font-medium text-slate-300">Senha</label>
              <div className="relative">
                <input 
                  type={mostrarSenha ? "text" : "password"} 
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3.5 pr-12 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500 focus:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {mostrarSenha ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 ml-1">No mínimo 6 caracteres.</p>
            </div>

            <button 
              type="submit"
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-blue-500 active:scale-[0.98]"
            >
              Finalizar cadastro
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          <p className="mt-8 text-center text-sm font-medium text-slate-400">
            Já possui uma conta?{" "}
            <Link href="/login" className="font-bold text-white hover:text-blue-400 transition-colors underline underline-offset-4 decoration-slate-700 hover:decoration-blue-400">
              Fazer login
            </Link>
          </p>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-500 mx-auto max-w-xs">
            Ao se cadastrar, você concorda com os <Link href="/termos" className="underline hover:text-slate-300">Termos de Uso</Link> e a <Link href="/privacidade" className="underline hover:text-slate-300">Política de Privacidade</Link>.
          </p>
        </div>

      </div>
    </div>
  );
}
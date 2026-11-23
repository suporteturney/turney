import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/auth";
import { reais } from "@/lib/comercial";
import { resumoComercial } from "@/lib/comercial-resumo";
import { hojeISO } from "@/lib/dias-uteis";
import { casaNome } from "@/lib/nomes-equipe";
import { temPilar } from "@/lib/permissoes";
import { BlocoCalls, BlocoPassos } from "../comercial/Blocos";
import c from "../comercial/comercial.module.css";
import styles from "../shared.module.css";
import MinhasTarefas from "./MinhasTarefas";
import s from "./inicio.module.css";

// "Meu painel" de quem não é do Pós Venda (Comercial, Marketing): nada das mentoradas aparece aqui.
export default async function PainelGeral({ usuario, saudacao }: { usuario: UsuarioSessao; saudacao: string }) {
  const hoje = hojeISO();
  const [tarefas, r] = await Promise.all([
    prisma.tarefa.findMany({ where: { concluidaEm: null, mentoradaId: null }, orderBy: { prazo: "asc" }, select: { id: true, titulo: true, prazo: true, responsavel: true, criadaPor: true } }),
    temPilar(usuario, "comercial") ? resumoComercial(usuario, true) : null,
  ]);
  const minhas = tarefas.filter(t => (t.responsavel ? casaNome(usuario.nome, t.responsavel) : t.criadaPor === usuario.nome))
    .map(t => ({ id: t.id, titulo: t.titulo, prazo: t.prazo.toISOString().slice(0, 10) }));
  const paraHoje = minhas.filter(t => t.prazo <= hoje).length;
  const data = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const kpi = (href: string, valor: string | number, rotulo: string, sub: string) => (
    <Link className={s.kpi} href={href}><span className={s.kpiValor}>{valor}</span><span className={s.kpiRotulo}>{rotulo}</span><span className={s.kpiSub}>{sub}</span></Link>
  );
  return (
    <div className={styles.content}>
      <header className={s.hero}>
        <div className={s.heroLinha}>
          <div className={s.heroTexto}>
            <p className={s.data}>{data}</p>
            <h1 className={s.saudacao}>{saudacao}, {usuario.nome.split(" ")[0]}</h1>
            <p className={s.resumo}>{paraHoje ? <>Você tem <strong>{paraHoje} {paraHoje === 1 ? "tarefa" : "tarefas"} para hoje</strong>.</> : "Nenhuma tarefa para hoje."}</p>
          </div>
          {r && <div className={s.heroAcoes}><Link className={s.btnOuro} href="/comercial/funil?novo=1">+ Novo lead</Link></div>}
        </div>
        {r && (
          <div className={s.kpis}>
            {kpi("/comercial/funil", r.passos.length, "Leads para hoje", r.semPasso ? `${r.semPasso} sem próximo passo` : "próximos passos")}
            {kpi("/comercial/calls", r.calls.length, "Calls hoje", "na sua agenda")}
            {kpi("/comercial/vendas", r.minhasVendas, "Suas vendas", reais(r.meuVendido, true))}
            {kpi("/comercial/vendas", r.minhaMeta ? `${Math.round((r.meuVendido / r.minhaMeta) * 100)}%` : "—", "Sua meta", r.minhaMeta ? `de ${reais(r.minhaMeta, true)}` : "sem meta definida")}
            {kpi("/comercial/vendas", r.meta ? `${Math.round((r.vendido / r.meta) * 100)}%` : "—", "Meta da equipe", r.meta ? `de ${reais(r.meta, true)}` : "sem meta definida")}
          </div>
        )}
      </header>
      <div className={c.grade2}>
        {r ? <BlocoPassos r={r} /> : <MinhasTarefas eu={usuario.nome} hoje={hoje} tarefas={minhas} podeCriar={!usuario.trocarSenha} />}
        {r && <div className={c.pilha}><BlocoCalls r={r} /><MinhasTarefas eu={usuario.nome} hoje={hoje} tarefas={minhas} podeCriar={!usuario.trocarSenha} /></div>}
      </div>
    </div>
  );
}

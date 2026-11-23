import Link from "next/link";
import { exigirPilar } from "@/lib/auth";
import { nomeMes, reais } from "@/lib/comercial";
import { resumoComercial } from "@/lib/comercial-resumo";
import styles from "../shared.module.css";
import c from "./comercial.module.css";
import { BlocoCalls, BlocoPassos } from "./Blocos";

export default async function ComercialPage() {
  const usuario = await exigirPilar("comercial");
  const r = await resumoComercial(usuario, false);
  const pct = r.meta ? Math.round((r.vendido / r.meta) * 100) : 0;
  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Comercial</div>
          <div className={styles.pageSub}>O que a equipe de vendas precisa ver hoje</div>
        </div>
        <Link className={c.btnPrim} href="/comercial/funil?novo=1">+ Novo lead</Link>
      </div>
      <div className={styles.content}>
        <div className={c.numeros}>
          <div><strong className={c.num}>{reais(r.vendido, true)}</strong><span>{r.nVendas} {r.nVendas === 1 ? "venda" : "vendas"} em {nomeMes(r.mes)}</span></div>
          <div><strong className={c.num}>{r.abertos}</strong><span>{r.abertos === 1 ? "lead em aberto" : "leads em aberto"}</span></div>
          <div><strong className={c.num}>{reais(r.emJogo, true)}</strong><span>em propostas no funil</span></div>
          <div><strong className={c.num}>{r.pendentes}</strong><span><Link className={c.link} href="/comercial/passagem">{r.pendentes === 1 ? "passagem pendente" : "passagens pendentes"}</Link></span></div>
        </div>
        <div className={c.grade2}>
          <BlocoPassos r={r} mostrarResp />
          <div className={c.pilha}>
            <section className={c.bloco}>
              <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Meta do mês</h2><Link className={c.link} href="/comercial/vendas">Vendas →</Link></div>
              <div className={c.metaLinha}><strong className={c.num}>{r.meta ? `${pct}%` : reais(r.vendido, true)}</strong><span>{r.meta ? `${reais(r.vendido, true)} de ${reais(r.meta, true)}` : "sem meta definida"}</span></div>
              {r.meta && <div className={c.trilho}><span className={r.vendido >= r.meta ? c.bateu : ""} style={{ width: `${Math.min(100, pct)}%` }} /></div>}
              {r.meta && r.vendido < r.meta && <p className={c.nota}>Faltam {reais(r.meta - r.vendido, true)}.</p>}
            </section>
            <BlocoCalls r={r} />
          </div>
        </div>
      </div>
    </>
  );
}

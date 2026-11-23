import { exigirPilar } from "@/lib/auth";
import styles from "../shared.module.css";
import c from "../comercial/comercial.module.css";

const SECOES = [
  ["Calendário de conteúdo", "Posts por dia e canal, com o status de cada um"],
  ["Campanhas e tráfego", "Investimento, leads e custo por lead de cada campanha"],
  ["Lançamentos e eventos", "Datas, checklist e responsáveis de cada ação"],
  ["Métricas das redes", "Seguidores, alcance e engajamento por semana"],
];

export default async function MarketingPage() {
  await exigirPilar("marketing");
  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Marketing</div>
          <div className={styles.pageSub}>Este pilar está em construção</div>
        </div>
      </div>
      <div className={styles.content}>
        <section className={c.bloco} style={{ maxWidth: 620 }}>
          <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Seções que vão entrar aqui</h2></div>
          <ul className={c.lista}>
            {SECOES.map(([t, d]) => <li key={t} className={c.item}><div className={c.itemCorpo}><b>{t}</b><small>{d}</small></div><span className={c.tag}>em breve</span></li>)}
          </ul>
        </section>
      </div>
    </>
  );
}

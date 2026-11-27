"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../shared.module.css";
import a from "../agendas/agendas.module.css";
import v from "./avisos.module.css";

type Aviso = { id: string; titulo: string; texto: string | null; link: string | null; lida: boolean; em: string };

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

async function marcar(body: unknown) {
  await fetch("/api/avisos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
}

export default function AvisosCliente({ avisos }: { avisos: Aviso[] }) {
  const router = useRouter();
  const [lidas, setLidas] = useState<Set<string>>(new Set());
  const naoLidos = avisos.filter(x => !x.lida && !lidas.has(x.id)).length;

  async function abrir(x: Aviso) {
    if (!x.lida && !lidas.has(x.id)) {
      setLidas(s => new Set(s).add(x.id));
      await marcar({ id: x.id });
    }
    if (x.link) router.push(x.link);
    router.refresh();
  }
  async function todas() {
    setLidas(new Set(avisos.map(x => x.id)));
    await marcar({ todas: true });
    router.refresh();
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Avisos</div>
          <div className={styles.pageSub}>O que o painel fez sozinho e você precisa saber (ex.: devolutivas comportamentais realizadas).</div>
        </div>
        {naoLidos > 0 && <button className={a.btn} onClick={todas}>Marcar todos como lidos</button>}
      </div>
      <div className={styles.content}>
        <section className={a.bloco} style={{ maxWidth: 760 }}>
          {!avisos.length && <p className={a.vazio}>Nenhum aviso por enquanto.</p>}
          <ul className={v.lista}>
            {avisos.map(x => {
              const nova = !x.lida && !lidas.has(x.id);
              return (
                <li key={x.id}>
                  <button className={`${v.aviso} ${nova ? v.nova : ""}`} onClick={() => abrir(x)}>
                    <span className={v.ponto} aria-label={nova ? "Não lido" : "Lido"} />
                    <span className={v.corpo}>
                      <b>{x.titulo}</b>
                      {x.texto && <span>{x.texto}</span>}
                    </span>
                    <span className={v.quando}>{quando(x.em)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}

"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Mentorada } from "@/lib/generated/prisma";
import MentoradaDrawer from "@/components/MentoradaDrawer";
import styles from "./mentorados.module.css";

const BADGE: Record<string, string> = {
  Ativo: styles.bAtivo,
  Encerrado: styles.bEnc,
  Churn: styles.bChurn,
  "Em Renovação": styles.bRenov,
  Saudável: styles.bSau,
  Atenção: styles.bAte,
  Risco: styles.bRis,
};

function Badge({ label }: { label: string }) {
  return (
    <span className={`${styles.badge} ${BADGE[label] ?? styles.bSilver}`}>
      {label}
    </span>
  );
}

function formatData(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function diasPrazo(prazo: Date | string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const p = new Date(prazo);
  p.setHours(0, 0, 0, 0);
  return Math.round((p.getTime() - hoje.getTime()) / 86400000);
}

export default function MentoradosCliente({
  mentorados,
  filtroTipo,
}: {
  mentorados: Mentorada[];
  filtroTipo?: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtStatus, setFiltStatus] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);
  const POR_PAG = 30;

  const lista = useMemo(() => {
    let r = mentorados;
    if (busca) {
      const b = busca.toLowerCase();
      r = r.filter(
        (m) =>
          m.nome.toLowerCase().includes(b) ||
          (m.email ?? "").toLowerCase().includes(b) ||
          (m.codigo ?? "").toLowerCase().includes(b)
      );
    }
    if (filtStatus) r = r.filter((m) => m.status === filtStatus);
    return r;
  }, [mentorados, busca, filtStatus]);

  const total = lista.length;
  const paginas = Math.ceil(total / POR_PAG);
  const visivel = lista.slice((pagina - 1) * POR_PAG, pagina * POR_PAG);

  const titulo = filtroTipo
    ? `Mentorados · ${filtroTipo}`
    : "Mentorados";

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>{titulo}</div>
          <div className={styles.pageSub}>
            Gestão completa da base — clique na linha para detalhes
          </div>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.topbarDate}>
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <div className={styles.filters}>
              <input
                type="search"
                placeholder="Buscar nome, e-mail, código…"
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                className={styles.searchInput}
              />
              <select
                value={filtStatus}
                onChange={(e) => { setFiltStatus(e.target.value); setPagina(1); }}
              >
                <option value="">Todos os status</option>
                <option value="Ativo">Ativo</option>
                <option value="Em Renovação">Em Renovação</option>
                <option value="Encerrado">Encerrado</option>
                <option value="Churn">Churn</option>
              </select>
            </div>
            <span className={styles.tblCount}>{total} mentorados</span>
          </div>

          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Saúde</th>
                  <th>Início</th>
                  <th>Prazo</th>
                  <th>Localização</th>
                </tr>
              </thead>
              <tbody>
                {visivel.map((m) => {
                  const dias = diasPrazo(m.prazo);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setAberta(m.id)}
                      className={aberta === m.id ? styles.rowAtiva : undefined}
                    >
                      <td>
                        <div className={styles.nomeMain}>{m.nome}</div>
                        {m.codigo && (
                          <div className={styles.nomeId}>{m.codigo}</div>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.bSilver}`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td>
                        <Badge label={m.status} />
                      </td>
                      <td>{m.saude ? <Badge label={m.saude} /> : "—"}</td>
                      <td>{formatData(m.inicio)}</td>
                      <td>
                        {m.prazo ? (
                          <span>
                            {formatData(m.prazo)}
                            {dias !== null && dias <= 30 && dias >= 0 && (
                              <span className={styles.diasWarn}>
                                {" "}· {dias}d
                              </span>
                            )}
                            {dias !== null && dias < 0 && (
                              <span className={styles.diasDanger}>
                                {" "}· vencido
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{m.localizacao ?? "—"}</td>
                    </tr>
                  );
                })}
                {visivel.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--txt3)", padding: "24px" }}>
                      Nenhum resultado encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {paginas > 1 && (
            <div className={styles.pag}>
              <span className={styles.pagInfo}>
                {(pagina - 1) * POR_PAG + 1}–
                {Math.min(pagina * POR_PAG, total)} de {total}
              </span>
              <div className={styles.pagBtns}>
                <button
                  className={styles.pb}
                  disabled={pagina === 1}
                  onClick={() => setPagina(pagina - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(paginas, 7) }, (_, i) => {
                  const p =
                    paginas <= 7
                      ? i + 1
                      : pagina <= 4
                      ? i + 1
                      : pagina >= paginas - 3
                      ? paginas - 6 + i
                      : pagina - 3 + i;
                  return (
                    <button
                      key={p}
                      className={`${styles.pb} ${p === pagina ? styles.cur : ""}`}
                      onClick={() => setPagina(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className={styles.pb}
                  disabled={pagina === paginas}
                  onClick={() => setPagina(pagina + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {aberta && (
        <MentoradaDrawer
          id={aberta}
          onClose={() => setAberta(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </>
  );
}

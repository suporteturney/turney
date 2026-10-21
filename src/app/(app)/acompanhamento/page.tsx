import { prisma } from "@/lib/prisma";
import styles from "../shared.module.css";

export default async function AcompanhamentoPage() {
  const registros = await prisma.acompanhamento.findMany({
    orderBy: { data: "desc" },
    take: 100,
    include: {
      mentorada: { select: { nome: true, tipo: true, status: true, codigo: true } },
    },
  });

  // Mentoradas ativas para formulário
  const mentoradas = await prisma.mentorada.findMany({
    where: { status: { in: ["Ativo", "Em Andamento", "Em Renovação"] } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, tipo: true },
  });

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Acompanhamento</div>
          <div className={styles.pageSub}>Histórico de acompanhamentos individuais</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.row2}>
          <div>
            {registros.length === 0 ? (
              <div className={styles.card} style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 13, color: "var(--txt3)" }}>Nenhum acompanhamento registrado ainda.</div>
                <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 6 }}>
                  Acesse o perfil individual de cada mentorada para adicionar anotações.
                </div>
              </div>
            ) : (
              <div>
                {registros.map(r => (
                  <div key={r.id} className={styles.card} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy-mid)" }}>
                          {r.mentorada.nome}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 1 }}>
                          {r.mentorada.tipo} · {r.mentorada.status}
                          {r.mentorada.codigo && ` · ${r.mentorada.codigo}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--txt3)" }}>
                          {new Date(r.data).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                        {r.autor && <div style={{ fontSize: 10, color: "var(--txt3)" }}>{r.autor}</div>}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--txt)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {r.texto}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Como registrar acompanhamentos</div>
              <div className={styles.cardSub}>Passos para adicionar notas</div>
              <div style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.8 }}>
                <p>1. Acesse a lista de <strong>Mentorados</strong> no menu lateral</p>
                <p>2. Clique na mentorada desejada para abrir o perfil</p>
                <p>3. Na aba <strong>Acompanhamento</strong>, registre as notas da sessão</p>
              </div>
              <div className={styles.divider} />
              <div className={styles.cardTitle} style={{ fontSize: 12 }}>Mentoradas Ativas</div>
              <div style={{ marginTop: 8, maxHeight: 300, overflowY: "auto" }}>
                {mentoradas.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--brd, #F0EAE0)" }}>
                    <div style={{ fontSize: 12, color: "var(--navy-mid)", fontWeight: 600 }}>{m.nome}</div>
                    <span className={`${styles.badge} ${styles.bSilver}`} style={{ fontSize: 10 }}>{m.tipo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

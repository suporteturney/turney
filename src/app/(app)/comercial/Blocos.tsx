import Link from "next/link";
import { NOME_RESULTADO, linkWhats } from "@/lib/comercial";
import type { ResumoComercial } from "@/lib/comercial-resumo";
import c from "./comercial.module.css";

const br = (iso: string) => iso.split("-").reverse().join("/").slice(0, 5);
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

// Próximos passos vencidos ou de hoje.
export function BlocoPassos({ r, mostrarResp = false }: { r: ResumoComercial; mostrarResp?: boolean }) {
  return (
    <section className={c.bloco}>
      <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Leads para falar hoje</h2><Link className={c.link} href="/comercial/funil">Funil →</Link></div>
      {!r.passos.length && <p className={c.vazio}>Nenhum próximo passo para hoje.</p>}
      <ul className={c.lista}>
        {r.passos.slice(0, 10).map(p => {
          const whats = linkWhats(p.whatsapp);
          const atrasado = p.proximoPassoEm < r.hoje;
          return (
            <li key={p.id} className={c.item}>
              <div className={c.itemCorpo}>
                <Link className={c.nomeBtn} href={`/comercial/funil?lead=${p.id}`}>{p.nome}</Link>
                <small>{p.proximoPasso ?? "Próximo contato"} · {p.etapa}{mostrarResp && p.responsavel ? ` · ${p.responsavel.split(" ")[0]}` : ""}</small>
              </div>
              {whats && <a className={c.whats} href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
              <span className={`${c.quando} ${atrasado ? c.atrasado : c.hoje}`}>{atrasado ? `era ${br(p.proximoPassoEm)}` : "hoje"}</span>
            </li>
          );
        })}
      </ul>
      {r.passos.length > 10 && <p className={c.nota}>E mais {r.passos.length - 10} no funil.</p>}
      {r.semPasso > 0 && <p className={c.nota} style={{ marginTop: 8 }}>{r.semPasso} {r.semPasso === 1 ? "lead em aberto está" : "leads em aberto estão"} sem próximo passo.</p>}
    </section>
  );
}

export function BlocoCalls({ r }: { r: ResumoComercial }) {
  return (
    <section className={c.bloco}>
      <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Calls de hoje</h2><Link className={c.link} href="/comercial/calls">Semana →</Link></div>
      {!r.calls.length && <p className={c.vazio}>Nenhuma call hoje.</p>}
      <ul className={c.lista}>
        {r.calls.map(x => (
          <li key={x.id ?? x.eventoId} className={c.item}>
            <b className={c.num}>{hora(x.inicio)}</b>
            <div className={c.itemCorpo}>
              {x.lead ? <Link className={c.nomeBtn} href={`/comercial/funil?lead=${x.lead.id}`}>{x.lead.nome}</Link> : <b>{x.titulo}</b>}
              {x.responsavel && <small>{x.responsavel}</small>}
            </div>
            {x.resultado ? <span className={c.tag}>{NOME_RESULTADO[x.resultado]}</span> : x.link && <a className={c.btnMini} href={x.link} target="_blank" rel="noreferrer">Entrar</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}

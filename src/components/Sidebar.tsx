"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { UsuarioSessao } from "@/lib/auth";
import { pode, rotuloPapel, temPilar, type Pilar } from "@/lib/permissoes";
import Isotipo from "@/components/Isotipo";
import Avatar from "@/components/Avatar";
import styles from "./Sidebar.module.css";

type Item = { href: string; label: string; icon: string; exato?: boolean };
type Secao = { titulo?: string; itens: Item[] };

// Os três pilares da empresa: clicar abre as seções de cada um.
const PILARES_MENU: { k: Pilar; label: string; icon: string; secoes: Secao[] }[] = [
  {
    k: "comercial", label: "Comercial", icon: "target",
    secoes: [{
      itens: [
        { href: "/comercial", label: "Visão geral", icon: "grid", exato: true },
        { href: "/comercial/funil", label: "Funil de vendas", icon: "kanban" },
        { href: "/comercial/inteligencia", label: "Inteligência comercial", icon: "zap" },
        { href: "/comercial/vendas", label: "Vendas e metas", icon: "bar-chart" },
        { href: "/comercial/calls", label: "Calls", icon: "calendar" },
        { href: "/comercial/passagem", label: "Passagem", icon: "arrow" },
      ],
    }],
  },
  {
    k: "marketing", label: "Marketing", icon: "megaphone",
    secoes: [{ itens: [{ href: "/marketing", label: "Visão geral", icon: "grid" }] }],
  },
  {
    k: "posvenda", label: "Pós Venda", icon: "heart",
    secoes: [
      {
        itens: [
          { href: "/dashboard", label: "Dashboard", icon: "grid" },
          { href: "/mentorados", label: "Mentorados", icon: "users" },
          { href: "/renovacoes", label: "Renovações", icon: "refresh" },
          { href: "/acompanhamento", label: "Acompanhamento", icon: "file" },
          { href: "/saude", label: "Saúde da Base", icon: "heart" },
          { href: "/assiduidade", label: "Assiduidade", icon: "calendar" },
          { href: "/pipeline", label: "Pipeline", icon: "kanban" },
          { href: "/tarefas", label: "Tarefas", icon: "check" },
          { href: "/jornada", label: "Jornada", icon: "clock" },
          { href: "/analises", label: "Análises", icon: "bar-chart" },
          { href: "/insights", label: "Insights", icon: "zap" },
        ],
      },
      {
        titulo: "POR PROGRAMA",
        itens: [
          { href: "/mentorados?tipo=Nexus", label: "Nexus", icon: "layers" },
          { href: "/mentorados?tipo=Atlas", label: "Atlas", icon: "dot" },
          { href: "/mentorados?tipo=Delta", label: "Delta", icon: "dot" },
        ],
      },
    ],
  },
];

const MENU_ADMIN = {
  grupo: "ADMINISTRAÇÃO",
  itens: [
    { href: "/equipe", label: "Equipe", icon: "shield" },
    { href: "/agendas", label: "Agendas", icon: "calendar" },
    { href: "/hubla", label: "Hubla", icon: "layers" },
    { href: "/devolutivas", label: "Devolutivas DISC", icon: "file" },
    { href: "/formularios", label: "Formulários", icon: "file" },
    { href: "/atividades", label: "Atividades", icon: "list" },
  ],
};

const ICONS: Record<string, React.ReactNode> = {
  bell: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  target: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  megaphone: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10v4a1 1 0 0 0 1 1h3l8 5V4L7 9H4a1 1 0 0 0-1 1z" /><path d="M19 9a4 4 0 0 1 0 6" />
    </svg>
  ),
  arrow: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="12" x2="20" y2="12" /><polyline points="13 5 20 12 13 19" />
    </svg>
  ),
  home: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  kanban: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="12" rx="1" /><rect x="17" y="3" width="4" height="8" rx="1" />
    </svg>
  ),
  check: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="3" /><polyline points="8 12 11 15 16 9" />
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  list: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  grid: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  users: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  refresh: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  file: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  zap: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  heart: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  calendar: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" />
    </svg>
  ),
  clock: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  "bar-chart": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  layers: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  dot: <span className={styles.navDot} />,
};

export default function Sidebar({ usuario, tarefasVencendo = 0, avisos = 0, foto = null }: { usuario: UsuarioSessao; tarefasVencendo?: number; avisos?: number; foto?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const pilares = PILARES_MENU.filter(p => temPilar(usuario, p.k));

  const casa = (item: Item) => {
    const base = item.href.split("?")[0];
    return item.exato ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
  };
  // O pilar da página atual abre sozinho; clicar abre e fecha os outros.
  const doPilar = pilares.find(p => p.secoes.some(x => x.itens.some(casa)))?.k ?? null;
  const [aberto, setAberto] = useState<Pilar | null>(doPilar ?? (pilares.length === 1 ? pilares[0].k : null));
  const [anterior, setAnterior] = useState(doPilar);
  if (anterior !== doPilar) { setAnterior(doPilar); if (doPilar) setAberto(doPilar); }

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const linkItem = (item: Item, sub = false) => (
    <Link key={item.href} href={item.href} className={`${styles.navA} ${sub ? styles.navSub : ""} ${casa(item) ? styles.active : ""}`}>
      <span className={styles.navIcon}>{ICONS[item.icon]}</span>
      {item.label}
      {(item.href === "/tarefas" || (item.href === "/inicio" && !temPilar(usuario, "posvenda"))) && tarefasVencendo > 0 && (
        <span className={styles.navBadge} title="Tarefas atrasadas ou para hoje">{tarefasVencendo}</span>
      )}
      {item.href === "/avisos" && avisos > 0 && <span className={styles.navBadge} title="Avisos não lidos">{avisos}</span>}
    </Link>
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoMark}><Isotipo size={18} /></div>
        <div>
          <div className={styles.logoName}>TURNEY</div>
          <div className={styles.logoSub}>CENTRAL</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {linkItem({ href: "/inicio", label: "Meu painel", icon: "home" })}
        {linkItem({ href: "/avisos", label: "Avisos", icon: "bell" })}
        {pilares.map(p => {
          const on = aberto === p.k;
          return (
            <div key={p.k} className={styles.pilar}>
              <button
                className={`${styles.pilarBtn} ${on ? styles.pilarOn : ""} ${doPilar === p.k ? styles.pilarAtual : ""}`}
                onClick={() => setAberto(on ? null : p.k)} aria-expanded={on}
              >
                <span className={styles.navIcon}>{ICONS[p.icon]}</span>
                {p.label}
                <svg className={styles.seta} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="9 6 15 12 9 18" /></svg>
              </button>
              {on && p.secoes.map((sec, i) => (
                <div key={i}>
                  {sec.titulo && <div className={`${styles.navHead} ${styles.navSub}`}>{sec.titulo}</div>}
                  {sec.itens.map(item => linkItem(item, true))}
                </div>
              ))}
            </div>
          );
        })}
        {pode(usuario, "equipe") && (
          <div>
            <div className={styles.navHead}>{MENU_ADMIN.grupo}</div>
            {MENU_ADMIN.itens.map(item => linkItem(item))}
          </div>
        )}
      </nav>

      <div className={styles.foot}>
        <div className={styles.csBadge}>
          <Link href="/conta" title={foto ? "Minha conta" : "Colocar minha foto"}>
            <Avatar nome={usuario.nome} foto={foto} tamanho={28} titulo={false} />
          </Link>
          <div>
            <div className={styles.csBadgeTitle}>{usuario.nome}</div>
            <div className={styles.csBadgeSub}>
              {rotuloPapel(usuario.papel)} · <Link href="/conta" className={styles.contaLink}>minha conta</Link>
            </div>
          </div>
          <button onClick={sair} className={styles.sairBtn} title="Sair">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

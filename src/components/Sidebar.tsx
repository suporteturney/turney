"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UsuarioSessao } from "@/lib/auth";
import { pode, rotuloPapel } from "@/lib/permissoes";
import styles from "./Sidebar.module.css";

const MENU = [
  {
    grupo: "PRINCIPAL",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: "grid" },
      { href: "/mentorados", label: "Mentorados", icon: "users" },
      { href: "/renovacoes", label: "Renovações", icon: "refresh" },
      { href: "/acompanhamento", label: "Acompanhamento", icon: "file" },
      { href: "/saude", label: "Saúde da Base", icon: "heart" },
      { href: "/assiduidade", label: "Assiduidade", icon: "calendar" },
      { href: "/jornada", label: "Jornada", icon: "clock" },
      { href: "/analises", label: "Análises", icon: "bar-chart" },
      { href: "/insights", label: "Insights", icon: "zap" },
    ],
  },
  {
    grupo: "POR PROGRAMA",
    itens: [
      { href: "/mentorados?tipo=Nexus", label: "Nexus", icon: "layers" },
      { href: "/mentorados?tipo=Atlas", label: "Atlas", icon: "dot" },
      { href: "/mentorados?tipo=Delta", label: "Delta", icon: "dot" },
    ],
  },
];

const MENU_ADMIN = {
  grupo: "ADMINISTRAÇÃO",
  itens: [
    { href: "/equipe", label: "Equipe", icon: "shield" },
    { href: "/atividades", label: "Atividades", icon: "list" },
  ],
};

const ICONS: Record<string, React.ReactNode> = {
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

export default function Sidebar({ usuario }: { usuario: UsuarioSessao }) {
  const pathname = usePathname();
  const router = useRouter();
  const menu = pode(usuario, "equipe") ? [...MENU, MENU_ADMIN] : MENU;

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href.split("?")[0]);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>t</div>
        <div>
          <div className={styles.logoName}>TURNEY</div>
          <div className={styles.logoSub}>PÓS VENDA</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {menu.map((grupo) => (
          <div key={grupo.grupo}>
            <div className={styles.navHead}>{grupo.grupo}</div>
            {grupo.itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navA} ${isActive(item.href) ? styles.active : ""}`}
              >
                <span className={styles.navIcon}>{ICONS[item.icon]}</span>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.foot}>
        <div className={styles.csBadge}>
          <svg className={styles.csBadgeIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <div>
            <div className={styles.csBadgeTitle}>{usuario.nome}</div>
            <div className={styles.csBadgeSub}>
              {rotuloPapel(usuario.papel)} · <Link href="/conta" className={styles.contaLink}>minha senha</Link>
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

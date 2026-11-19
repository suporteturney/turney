// Bolinha de quem é da equipe: a foto, ou as iniciais numa cor fixa por nome.
const CORES = ["#73452B", "#2F4A6B", "#5B6B3A", "#7A3E5C", "#3F6E6A", "#8A5A1F"];
const corDe = (nome: string) => CORES[[...nome].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES.length];
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();

export default function Avatar({ nome, foto, tamanho = 30, className = "", titulo = true }: {
  nome: string; foto?: string | null; tamanho?: number; className?: string; titulo?: boolean;
}) {
  const base: React.CSSProperties = {
    width: tamanho, height: tamanho, borderRadius: "50%", flexShrink: 0, display: "inline-grid", placeItems: "center",
    overflow: "hidden", fontSize: Math.max(8, Math.round(tamanho * 0.37)), fontWeight: 800, letterSpacing: "0.02em",
    color: "#FAF7F0", background: corDe(nome), lineHeight: 1,
  };
  return (
    <span className={className} style={base} title={titulo ? nome : undefined} aria-hidden="true">
      {foto
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={foto} alt="" width={tamanho} height={tamanho} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : iniciais(nome)}
    </span>
  );
}

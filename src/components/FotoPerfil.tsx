"use client";
import { useRef, useState } from "react";
import Avatar from "@/components/Avatar";

// Escolher, trocar ou remover a foto de perfil. A imagem é cortada em quadrado e reduzida aqui no navegador.
const LADO = 192;

function reduzir(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = LADO; canvas.height = LADO;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); falha(new Error("Não foi possível ler a imagem.")); return; }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO);
      URL.revokeObjectURL(url);
      ok(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("Esse arquivo não é uma imagem que o navegador consiga abrir. Tente JPG ou PNG.")); };
    img.src = url;
  });
}

export default function FotoPerfil({ usuarioId, nome, foto: fotoIni, onMudou, compacto = false }: {
  usuarioId: string; nome: string; foto: string | null; onMudou?: (url: string | null) => void; compacto?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState(fotoIni);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setEnviando(true); setMsg(null);
    try {
      const imagem = await reduzir(arq);
      const r = await fetch(`/api/equipe/${usuarioId}/foto`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagem }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível salvar a foto.");
      setFoto(j.url); onMudou?.(j.url); setMsg({ txt: "Foto salva." });
    } catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
    setEnviando(false);
  }

  async function remover() {
    if (!window.confirm(`Remover a foto de ${nome}? A bolinha volta a mostrar as iniciais.`)) return;
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch(`/api/equipe/${usuarioId}/foto`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Não foi possível remover.");
      setFoto(null); onMudou?.(null); setMsg({ txt: "Foto removida." });
    } catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
    setEnviando(false);
  }

  const btn: React.CSSProperties = {
    font: "inherit", fontSize: 12, fontWeight: 700, borderRadius: 7, padding: "6px 11px", cursor: "pointer",
    background: "var(--surface)", color: "var(--navy-mid)", border: "1px solid var(--bdr)",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Avatar nome={nome} foto={foto} tamanho={compacto ? 48 : 72} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => input.current?.click()} disabled={enviando}>
            {enviando ? "Enviando…" : foto ? "Trocar foto" : "Escolher foto"}
          </button>
          {foto && <button type="button" style={{ ...btn, color: "#991b1b", borderColor: "#F5C2C2", background: "transparent" }} onClick={remover} disabled={enviando}>Remover</button>}
        </div>
        <span style={{ fontSize: 11, color: msg?.erro ? "#991b1b" : "var(--txt3)" }} role={msg ? "status" : undefined}>
          {msg?.txt ?? "Uma foto de rosto, de preferência quadrada. Aparece nas bolinhas da plataforma."}
        </span>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={escolher} hidden />
    </div>
  );
}

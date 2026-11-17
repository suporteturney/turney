// Tempo congelado vira tempo a mais de mentoria, contado em meses de calendário:
// congelou de 17/11 a 17/01 (2 meses) → o encerramento de 15/02 passa para 15/04.
// Usado no servidor (ao salvar) e na ficha (aviso antes de salvar). Datas no formato "AAAA-MM-DD".

const DIA = 86_400_000;
type Periodo = { de: string | null; ate: string | null };
type Duracao = { meses: number; dias: number };

const dia = (iso: string) => iso.slice(0, 10);

// Soma (ou subtrai, com valores negativos) meses e depois dias; dia 31 vira o último dia do mês quando ele não existe.
function somar(iso: string, meses: number, dias: number) {
  const [y, m, d] = dia(iso).split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  const alvo = Date.UTC(y, m - 1 + meses, Math.min(d, ultimo));
  return new Date(alvo + dias * DIA).toISOString().slice(0, 10);
}

export function duracaoCongelamento({ de, ate }: Periodo): Duracao {
  if (!de || !ate || dia(ate) <= dia(de)) return { meses: 0, dias: 0 };
  const [y1, m1, d1] = dia(de).split("-").map(Number);
  const [y2, m2, d2] = dia(ate).split("-").map(Number);
  let meses = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) meses--;
  const dias = Math.round((Date.parse(dia(ate)) - Date.parse(somar(de, meses, 0))) / DIA);
  return { meses, dias };
}

export function textoDuracao({ meses, dias }: Duracao) {
  const partes = [
    meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "",
    dias ? `${dias} ${dias === 1 ? "dia" : "dias"}` : "",
  ].filter(Boolean);
  return partes.join(" e ") || "0 dias";
}

// Encerramento depois de trocar o congelamento salvo (`antigo`) pelo novo: devolve o tempo do antigo e soma o do novo.
// Um congelamento que começa depois do fim do anterior é outro congelamento: o anterior continua somado.
export function prazoComCongelamento(prazo: string, antigo: Periodo, novo: Periodo) {
  const outro = !!novo.de && !!antigo.ate && dia(novo.de) > dia(antigo.ate);
  const a = outro ? { meses: 0, dias: 0 } : duracaoCongelamento(antigo);
  const n = duracaoCongelamento(novo);
  if (a.meses === n.meses && a.dias === n.dias) return dia(prazo);
  const semAntigo = somar(somar(prazo, 0, -a.dias), -a.meses, 0);
  return somar(semAntigo, n.meses, n.dias);
}

// Isotipo da Turney (o "t"), desenhado a partir do arquivo oficial da marca.
// Usa a cor do texto em volta (currentColor), então a cor vem do CSS de quem usa.
export default function Isotipo({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 -1.5 144 144" fill="currentColor" aria-hidden="true">
      <path d="M0 0H32A36 36 0 0 0 68 36V68Q50 68 32 58V68A40.5 40.5 0 0 0 113 68H144A72 72 0 0 1 0 68Z" />
    </svg>
  );
}

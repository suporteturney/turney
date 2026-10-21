import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turney — CS Hub · Pós Venda",
  description: "Gestão de mentorados Turney",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turney Central",
  description: "Comercial, Marketing e Pós Venda da Turney",
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

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ónix Govern',
  description: 'Gobierno de IA para empresas en México: Revisión inicial, inventario, priorización y plan.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <body className="onix-shell min-h-screen">{children}</body>
    </html>
  );
}

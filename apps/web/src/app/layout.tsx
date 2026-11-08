import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ónix Govern',
  description: 'Gobierno de IA para organizaciones en México — Revisión inicial orientativa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <body className="onix-shell min-h-screen">{children}</body>
    </html>
  );
}

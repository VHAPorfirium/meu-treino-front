import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { SwRegister } from '@/components/layout/sw-register';

export const metadata: Metadata = {
  title: 'Ritmo · Diário de treino',
  description: 'Acompanhamento de treino de academia',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    // `default` deixa o iOS adaptar cor dos ícones (escuros no modo claro, claros no escuro)
    // respeitando `<meta name="theme-color">`, sem deixar o relógio branco invisível sobre bg-paper.
    statusBarStyle: 'default',
    title: 'Ritmo',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF7F1' },
    { media: '(prefers-color-scheme: dark)', color: '#121214' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('theme_preference');var d=document.documentElement;if(p==='dark'||p==='light'){var isDark=p==='dark';d.classList.toggle('dark',isDark);d.classList.toggle('light',!isDark);var c=isDark?'#121214':'#FBF7F1';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c);});}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <AuthProvider>{children}</AuthProvider>
        <SwRegister />
      </body>
    </html>
  );
}

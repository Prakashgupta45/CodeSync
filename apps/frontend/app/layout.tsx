import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './context/auth-context';

export const metadata: Metadata = {
  title: 'CodeSync - Real-Time Collaborative IDE & Pair Programming',
  description: 'AI-Powered Collaborative Pair Programming & Technical Coding Interview Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var theme = localStorage.getItem('codesync-theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
                if (theme === 'light') {
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.remove('light');
                }
              } catch (e) {}
            })();`,
          }}
        />
      </head>
      <body className="antialiased selection:bg-replit-orange selection:text-white bg-bg-main text-text-main">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

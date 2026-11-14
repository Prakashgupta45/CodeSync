import type { Metadata } from 'next';
import './globals.css';
import { AdminAuthProvider } from '../context/admin-auth-context';

export const metadata: Metadata = {
  title: 'CodeSync AI — Central Admin Console',
  description: 'Enterprise Administrative Console for CodeSync AI Platform',
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
                var theme = localStorage.getItem('codesync-admin-theme') || 'light';
                document.documentElement.setAttribute('data-theme', theme);
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              } catch (e) {}
            })();`,
          }}
        />
      </head>
      <body className="antialiased selection:bg-replit-orange selection:text-white bg-bg-main text-text-main font-sans">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}

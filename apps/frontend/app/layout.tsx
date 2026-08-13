import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './context/auth-context';

export const metadata: Metadata = {
  title: 'CodeSync AI - Real-Time Pair Programming & Coding Interviews',
  description: 'AI-Powered Collaborative Pair Programming & Technical Coding Interview Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

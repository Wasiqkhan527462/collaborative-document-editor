import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'CollabDocs - Lightweight Document Editor',
  description: 'A collaborative document editor inspired by Google Docs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 2rem' }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

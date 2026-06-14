import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  lastUpdated?: Date | null;
}

export default function Layout({ children, lastUpdated }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col gradient-hero">
      <Navbar lastUpdated={lastUpdated} />
      <main className="flex-1 pt-20 pb-8 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Realtime ChatGPT Voice Bot',
  description: 'A realtime voice chat interface for ChatGPT',
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <main className="min-h-screen bg-black">
      {children}
    </main>
  );
}
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hoops League',
  description: 'Community basketball league — schedules, standings, and stats.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900`}>
        <header className="border-b border-gray-200 bg-white shadow-sm">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <span className="text-xl font-extrabold tracking-tight text-orange-500">
              🏀 Hoops League
            </span>
            <ul className="flex gap-6 text-sm font-medium text-gray-600">
              <li><a href="/"          className="hover:text-orange-500">Home</a></li>
              <li><a href="/games"     className="hover:text-orange-500">Games</a></li>
              <li><a href="/standings" className="hover:text-orange-500">Standings</a></li>
              <li><a href="/teams"     className="hover:text-orange-500">Teams</a></li>
              <li><a href="/players"   className="hover:text-orange-500">Players</a></li>
            </ul>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mt-16 border-t border-gray-200 py-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Hoops League. All rights reserved.
        </footer>
      </body>
    </html>
  );
}

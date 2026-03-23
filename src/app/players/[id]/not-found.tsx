import Link from 'next/link';

export default function PlayerNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="text-6xl">🏀</span>
      <h1 className="text-2xl font-bold">Player not found</h1>
      <p className="text-gray-500">This player doesn&apos;t exist or has been removed.</p>
      <Link
        href="/players"
        className="mt-2 rounded-xl bg-orange-500 px-6 py-2.5 font-semibold text-white hover:bg-orange-600"
      >
        ← All Players
      </Link>
    </div>
  );
}

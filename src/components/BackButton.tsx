'use client';
import { usePathname, useRouter } from 'next/navigation';
export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/') return null;
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1 text-xs font-bold text-[#5a7a9a] hover:text-orange-400 transition-colors shrink-0"
      aria-label="חזרה"
    >
      <span className="text-base leading-none">‹</span>
      <span>חזרה</span>
    </button>
  );
}

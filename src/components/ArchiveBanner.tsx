import Link from 'next/link';

/**
 * Visible warning shown when a page is rendering data for a season other
 * than `current_season`. Tells the user they're looking at archived data
 * and gives them a one-click way back to the live view (same pathname,
 * stripped of the ?season= param).
 *
 * `pathname` is what the "← חזרה לעונה הנוכחית" link points at. Server
 * components don't have access to usePathname so the caller passes it in.
 */
export default function ArchiveBanner({
  viewing,
  current,
  pathname,
}: {
  viewing: string;
  current: string;
  pathname: string;
}) {
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
    >
      <p className="text-amber-200 font-bold">
        📁 ארכיון — מציג נתונים של עונת{' '}
        <span dir="ltr" className="font-mono">{viewing}</span>
        {' '}(עונה נוכחית:{' '}
        <span dir="ltr" className="font-mono">{current}</span>
        )
      </p>
      <Link
        href={pathname}
        className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/20 transition"
      >
        ← חזרה לעונה הנוכחית
      </Link>
    </div>
  );
}

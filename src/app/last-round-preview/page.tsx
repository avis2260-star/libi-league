// ── Preview-only page for the new "Last Round Results" section ───────────
// Not linked from the main nav. Renders the LastRoundResults server
// component with a thin preview banner so it can be reviewed before
// integrating into the home page.

export const dynamic = 'force-dynamic';

import LastRoundResults from '@/components/LastRoundResults';

export default function LastRoundPreviewPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/[0.06] px-4 py-3 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-orange-400">
          תצוגה מקדימה · Last Round Results
        </p>
        <p className="mt-1 text-xs font-bold text-[#8aaac8]">
          קומפוננטה חדשה לעמוד הבית — מציגה את תוצאות המחזור האחרון שנגמר
        </p>
      </div>

      <LastRoundResults />
    </div>
  );
}

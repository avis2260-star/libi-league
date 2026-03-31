'use client';

// icons inlined — no external dependency needed

interface Props {
  isOpen: boolean;
  imagePreview: string | null;
  issues: string[];
  recommendation: string;
  confidenceScore: number;
  onReupload: () => void;
  onProceed: () => void;
}

export default function ImageQualityModal({
  isOpen, imagePreview, issues, recommendation, confidenceScore, onReupload, onProceed,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-[#0f1e30] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-red-500/20">

        {/* Header */}
        <div className="bg-red-500/10 p-5 flex items-center gap-4 border-b border-red-500/20">
          <div className="bg-red-500/20 p-3 rounded-xl shrink-0">
            <svg className="text-red-400 w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">איכות תמונה בעייתית</h3>
            <p className="text-sm text-red-400">ציון איכות: {confidenceScore}/10 — המערכת מתקשה לקרוא את הטופס</p>
          </div>
        </div>

        {/* Issues */}
        <div className="p-5 space-y-4">
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-[#8aaac8] uppercase tracking-wide">בעיות שזוהו</p>
            <ul className="space-y-1">
              {issues.map((issue, i) => (
                <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>{issue}
                </li>
              ))}
            </ul>
            {recommendation && (
              <p className="text-sm text-orange-300 font-medium pt-2">
                💡 {recommendation}
              </p>
            )}
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="תצוגה מקדימה" className="w-full h-full object-cover opacity-40 grayscale" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-lg">תצוגת ניתוח</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 bg-white/[0.02] border-t border-white/5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onReupload}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 px-5 rounded-xl transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> צלם מחדש (מומלץ)
          </button>
          <button
            onClick={onProceed}
            className="flex-1 flex items-center justify-center gap-2 border border-white/10 text-[#8aaac8] font-medium py-3 px-5 rounded-xl hover:bg-white/5 transition-all text-sm"
          >
            המשך בכל זאת <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

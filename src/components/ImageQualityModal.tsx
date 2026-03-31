'use client';

import { AlertTriangle, RefreshCw, ChevronLeft } from 'lucide-react';

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
            <AlertTriangle className="text-red-400" size={24} />
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
            <RefreshCw size={16} /> צלם מחדש (מומלץ)
          </button>
          <button
            onClick={onProceed}
            className="flex-1 flex items-center justify-center gap-2 border border-white/10 text-[#8aaac8] font-medium py-3 px-5 rounded-xl hover:bg-white/5 transition-all text-sm"
          >
            המשך בכל זאת <ChevronLeft size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

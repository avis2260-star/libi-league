'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

type LangContextType = {
  lang: 'he' | 'en';
  toggle: () => void;
  t: (he: string) => string;
};

const LangContext = createContext<LangContextType>({
  lang: 'he',
  toggle: () => {},
  t: (he: string) => he,
});

export const useLang = () => useContext(LangContext);

// Hebrew → English dictionary for UI strings
const DICT: Record<string, string> = {
  // Nav
  'בית': 'Home',
  'משחקים': 'Games',
  'טבלאות': 'Standings',
  'קבוצות': 'Teams',
  'גביע': 'Cup',
  'ליגה': 'League',
  'תחרויות': 'Competitions',
  'מידע': 'Info',
  'עוד': 'More',
  'עוד דפים': 'More Pages',

  // Bottom nav more links
  'כרטיסי שחקן': 'Player Cards',
  'משחק חי': 'Live Game',
  'הגשת תוצאות': 'Submit Results',
  'תוצאות': 'Results',
  'פלייאוף': 'Playoff',
  'תקנון': 'Rules',
  'אודות': 'About',
  'סובב מסך לרוחב': 'Rotate Screen',
  'בטל סיבוב מסך': 'Cancel Rotation',

  // Player cards page
  'שחקנים': 'Players',
  'פעילים': 'Active',
  'לא פעילים': 'Inactive',
  'הכל': 'All',
  'חיפוש שם שחקן...': 'Search player name...',
  'כל הקבוצות': 'All Teams',
  'מיין: שם': 'Sort: Name',
  'מיין: קבוצה': 'Sort: Team',
  'מיין: נקודות': 'Sort: Points',
  'פעיל': 'Active',
  'לא פעיל': 'Inactive',

  // Stats
  'נק׳': 'PTS',
  'נקודות': 'Points',
  '3נק׳': '3PT',
  'פאולים': 'Fouls',
  'משחקים שהשתתף': 'Games Played',
  'נקודות בממוצע': 'PPG',
  '3נק׳ בממוצע': '3PT Avg',
  'עבירות בממוצע': 'Fouls Avg',
  'ממוצעי עונה': 'Season Averages',
  'גרף ביצועים': 'Performance Chart',
  'היסטוריית משחקים': 'Game History',
  'סה״כ נק׳': 'Total PTS',
  'סה״כ 3נק׳': 'Total 3PT',
  'סה״כ עבירות': 'Total Fouls',

  // Game history table
  'תאריך': 'Date',
  'יריב': 'Opponent',
  'תוצאה': 'Score',
  'נגד': 'vs',

  // Standings
  'מחוז צפון': 'North Division',
  'מחוז דרום': 'South Division',
  'צפון': 'North',
  'דרום': 'South',
  'נצחונות': 'Wins',
  'הפסדים': 'Losses',

  // Team page
  '← חזרה לרשימת הקבוצות': '← Back to Teams',
  'יומן משחקים': 'Game Log',
  'משחקי גביע': 'Cup Games',
  'נקודות לניצחון': 'Points For',
  'נקודות נגד': 'Points Against',
  'אחוז נצחונות': 'Win %',

  // Submit flow
  'הגשת התוצאות': 'Submit Results',
  'הקבוצה שלך *': 'Your Team *',
  'בחר משחק': 'Select Game',
  'שמך המלא *': 'Your Full Name *',
  'המשך להעלאת טופס ←': 'Continue to Upload',
  'העלה טופס משחק': 'Upload Scoresheet',
  'צלם את דף הסטטיסטיקות של המשחק': 'Take a photo of the game stats sheet',
  '📷 צלם / בחר תמונה': '📷 Take / Select Photo',
  'החלף תמונה': 'Change Photo',
  '✅ שלח נתונים לאישור': '✅ Submit for Approval',
  '← חזור': '← Back',
  'תודה!': 'Thank You!',
  'הנתונים התקבלו וממתינים לאישור מנהל הליגה': 'Data received and pending league manager approval',

  // Cropper
  '✂️ סמן את אזור הטופס': '✂️ Mark Form Area',
  '✂️ חתוך והמשך': '✂️ Crop & Continue',
  'איפוס': 'Reset',
  'דלג': 'Skip',

  // Scorers
  'קלעי הליגה': 'League Scorers',
  'רשימת קלעי הליגה': 'League Scorers List',

  // General
  '← כל השחקנים': '← All Players',
  'גלריית סרטונים': 'Video Gallery',
  'לא נמצאו משחקים': 'No Games Found',
};

export default function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<'he' | 'en'>('he');

  // Persist choice
  useEffect(() => {
    const saved = localStorage.getItem('libi-lang');
    if (saved === 'en') setLang('en');
  }, []);

  const toggle = useCallback(() => {
    setLang(prev => {
      const next = prev === 'he' ? 'en' : 'he';
      localStorage.setItem('libi-lang', next);
      // Update html dir and lang
      document.documentElement.lang = next === 'he' ? 'he' : 'en';
      document.documentElement.dir = next === 'he' ? 'rtl' : 'ltr';
      return next;
    });
  }, []);

  const t = useCallback((he: string): string => {
    if (lang === 'he') return he;
    return DICT[he] ?? he;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  );
}

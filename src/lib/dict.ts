// Shared Hebrew → English dictionary used by both client (TranslationProvider) and server (getLang)
export const DICT: Record<string, string> = {
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

  // Home page
  'סקירה כללית': 'Overview',
  'משחקי ליגה': 'League Games',
  'מחזורים עד כה': 'Rounds Played',
  'מחזורי עונה': 'Season Rounds',
  'ביצועי שיא עונה': 'Season Records',
  'שיא סלים במשחק': 'Top Single-Game Score',
  'שיא סלים משני הצדדים': 'Highest Combined Score',
  'הפרש גדול ביותר': 'Biggest Win Margin',
  'משחקים שהוכרעו ב-3 נקודות או פחות': 'Games Decided by 3 or Less',
  '🥇 מוביל צפון': '🥇 North Leader',
  '🥇 מוביל דרום': '🥇 South Leader',
  'עובדות עונה': 'Season Facts',
  'מוביל סלים בדרום': 'South Scoring Leader',
  'גמר הגביע': 'Cup Final',
  'מחזורים שנותרו': 'Rounds Remaining',
  'מתוך': 'out of',
  'מחזורים': 'rounds',
  'מחזור': 'Round',

  // Games page
  'לוח המשחקים': 'Game Schedule',
  'הסתיים': 'Finished',
  'קרובים': 'Upcoming',
  'חוץ': 'Away',

  // Standings page
  'דירוג': 'Rank',
  'קבוצה': 'Team',
  'מ': 'G',
  'נ': 'W',
  'ה': 'L',
  'עבירות': 'Fouls',
  'נק׳ ליגה': 'League PTS',

  // Playoff
  'רבע גמר': 'Quarter Finals',
  'חצי גמר': 'Semi Finals',
  'גמר': 'Final',
  'הטוב מ-3': 'Best of 3',
  'ניצחונות': 'Wins',
  'טרם החל': 'Not Started',
  'שוויון': 'Tied',
  'מוביל': 'Leading',
  'ניצח בסדרה': 'Won Series',
  'טרם נקבע': 'TBD',
  'הרכב': 'Roster',
  'הצג הרכבים': 'Show Rosters',
  'הסתר הרכבים': 'Hide Rosters',
  'לא נמצאו שחקנים': 'No Players Found',

  // Popup / modal
  'משחקים קרובים': 'Upcoming Games',
  'כל המשחקים': 'All Games',
  'סגור': 'Close',
  'לחץ לפרטים': 'Tap for Details',
};

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
  'מוביל סלים בליגה': 'League Scoring Leader',
  'סלים': 'baskets',
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
  '← כל המשחקים': '← All Games',
  '← כל משחקי המחזור': '← All Round Games',
  'בית ': 'Home ',
  'חוץ ': 'Away ',
  'סגל': 'Roster',

  // Footer
  'עמוד הבית': 'Home',
  'טבלת הליגה': 'Standings',
  'לוח תוצאות חי': 'Live Scoreboard',
  'תקנון הליגה': 'League Rules',
  'תנאי שימוש ומדיניות פרטיות': 'Terms & Privacy',
  'תנאי שימוש': 'Terms of Use',
  'צור קשר': 'Contact Us',
  'ניווט מהיר': 'Quick Navigation',
  'ליגת ליבי': 'Libi League',
  'ליגת כדורסל קהילתית — מביאים את המשחק לשכונה, עם לוח משחקים, טבלאות ותוצאות בזמן אמת.':
    'A community basketball league — bringing the game to the neighborhood, with schedules, standings and live results.',
  'הנתונים באתר הינם לידיעה בלבד.': 'Site data is for information purposes only.',
  'נמצאה טעות?': 'Found a mistake?',
  'פנו אלינו': 'Contact us',
  'כל הזכויות שמורות': 'All rights reserved',
  'נבנה באהבה לקהילה': 'Built with love for the community',
  'עונה 2025–2026': 'Season 2025–2026',
  'ליגת ליבי · כדורסל קהילתי': 'Libi League · Community Basketball',

  // About page
  'פורמט הליגה': 'League Format',
  'שלב הבית': 'Regular Season',
  '14 מחזורים — כל קבוצה משחקת נגד כל קבוצה אחרת במחוזה פעמיים (בית וחוץ).':
    '14 rounds — every team plays every other team in its division twice (home and away).',
  'ארבעת המובילות מכל מחוז נפגשות בסדרות של הטוב מ-3 משחקים — רבע גמר, חצי גמר וגמר.':
    'The top four from each division meet in best-of-3 series — quarterfinals, semifinals and finals.',
  'טורניר גביע מקביל הפתוח לכל קבוצות הליגה, בפורמט נוקאאוט חד-שלבי.':
    'A parallel cup tournament open to all league teams, in a single-elimination knockout format.',
  'כלל הבית': 'Home-Court Rule',
  'הקבוצה המדורגת גבוה יותר מארחת את משחקים 1 ו-3. הקבוצה הנמוכה מארחת את משחק 2.':
    'The higher-seeded team hosts games 1 and 3. The lower-seeded team hosts game 2.',
  'שיטת הניקוד': 'Scoring System',
  'נקודות לקבוצה המנצחת': 'Points for the winning team',
  'נקודה לקבוצה המפסידה': 'Point for the losing team',
  '* קבוצה שלא מגיעה למשחק מקבלת 0 נקודות ועלולה להיקנס בניכוי נקודות.':
    '* A team that does not show up for a game receives 0 points and may be penalized.',
  'קבוצות משתתפות': 'Participating Teams',
  'מחוזות': 'Divisions',
  'ליגה קהילתית לכדורסל הפועלת משנת 2012 המאגדת קבוצות מרחבי הארץ, עם שני מחוזות — צפון ודרום — ומערכת גביע ופלייאוף מרגשת.':
    'A community basketball league running since 2012, uniting teams from across the country across two divisions — North and South — with an exciting cup and playoff system.',

  // Cup page
  '🏆 גביע ליגת ליבי': '🏆 Libi League Cup',
  'טורניר הגביע העונתי 2025–2026': 'Cup Tournament 2025–2026',
  '💡 לחצו על כל קבוצה כדי לצפות במסע שלה בטורניר':
    '💡 Click any team to follow its tournament journey',
  'טורניר': 'Tournament',
  'הימור עוצמתי': 'Underdog Story',

  // Hall of Fame
  'היכל התהילה': 'Hall of Fame',
  'מורשת הכדורסל של ליגת ליבי': 'The Basketball Legacy of Libi League',
  'אלופת הליגה': 'League Champion',
  'אלופת הפלייאוף · 2025–2026': 'Playoff Champion · 2025–2026',
  'מחזיקת הגביע': 'Cup Holder',
  'אלופת הגביע · 2025–2026': 'Cup Champion · 2025–2026',
  'אלופות הליגה': 'League Champions',
  'מחזיקות הגביע': 'Cup Holders',
  'אין עונות להצגה עדיין': 'No seasons to display yet',
  'אין מחזיקות גביע להצגה עדיין': 'No cup holders to display yet',
  'אין שיאים להצגה עדיין': 'No records to display yet',
  'סגנית אלופה:': 'Runner-up:',
  'MVP של העונה': 'Season MVP',
  'לחץ לפרטי הגמר ←': 'Click for final details →',
  'שיאי כל הזמנים': 'All-Time Records',
  'קטגוריה': 'Category',
  'בעל השיא': 'Record Holder',
  'נתון': 'Value',

  // Teams page
  'קפטן:': 'Captain:',
  'פרטי קשר:': 'Contact:',
  'לא נמצאו קבוצות במסד הנתונים.': 'No teams found in the database.',
  'הוסף קבוצות דרך לוח הניהול.': 'Add teams via the admin panel.',
  'קבוצות נוספות': 'Other Teams',
  'קבוצות ': 'teams ',

  // Scorers page
  '← חזרה לדף הבית': '← Back to Home',
  'טבלת מובילי הנקודות — עונת 2025–2026': 'Top Scorers — Season 2025–2026',
  'אין נתוני קליעה עדיין': 'No scoring data yet',
  'מקום': 'Rank',
  'שחקן': 'Player',
  'סובב למצב אופקי לצפייה בנתוני 3נק׳ ופאולים':
    'Rotate to landscape to view 3PT and fouls',

  // Last Round Results
  'תוצאות מחזור': 'Round Results',
  'הפסד טכני': 'Technical loss',
  '🔴 הפסד טכני': '🔴 Technical loss',
  'טכני *': 'Technical *',
  'כל התוצאות ←': 'All Results →',

  // Contact form
  'שגיאה לא ידועה': 'Unknown error',
  'בעיית חיבור לשרת': 'Server connection problem',
  'ההודעה נשלחה בהצלחה!': 'Message sent successfully!',
  'נחזור אליך בהקדם.': 'We will get back to you soon.',
  'שלח הודעה נוספת': 'Send another message',
  'לשאלות, עדכונים ומידע נוסף על הליגה':
    'For questions, updates and more info about the league',
  'שם מלא': 'Full name',
  'כתובת אימייל': 'Email address',
  'ההודעה שלך...': 'Your message...',
  'שולח...': 'Sending...',
  'שלח הודעה': 'Send message',

  // Submit / scoresheet upload (longer phrases)
  'הגשת תוצאות משחק': 'Submit Game Results',
  'בחר את הקבוצה שלך, המשחק, וצלם את דף הסטטיסטיקות':
    'Select your team, the game, and take a photo of the stats sheet',

  // Cup bracket / journey
  'המסע של': 'Journey of',
  'אין משחקים בטורניר עדיין': 'No tournament games yet',
  'מנצחת': 'Winner',
  'מפסידה': 'Loser',
  'הוכרע': 'Decided',
  'הסיבוב הבא': 'Next Round',

  // Live / scoreboard extras
  'אין משחק חי כרגע': 'No live game right now',
  'משחק חי כעת': 'Game Live Now',
  'התחיל ב': 'Started at',

  // Misc
  'נשמר': 'Saved',
  'שגיאה': 'Error',
  'טוען...': 'Loading...',
  'לא נמצאו תוצאות': 'No results found',
  'קליק לפרטים': 'Click for details',
};

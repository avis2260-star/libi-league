import ChampionReveal from '@/components/ChampionReveal';

export default function ChampionPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: '#0b1520' }}
    >
      <ChampionReveal
        champion='ראשון "גפן"'
        division="מחוז דרום"
        scoreWinner={84}
        scoreLoser={71}
        opponentName="גוטלמן השרון"
        mvpName="שם השחקן"
        mvpStats="32 נק׳ · 8 ריבאונד · 5 בישול"
        date="21.03.2026"
        season="2025–2026"
      />
    </div>
  );
}

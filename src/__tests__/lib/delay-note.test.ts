import { cleanDelayNote, DELAY_NOTE_MAX } from '@/lib/delay-note';

describe('cleanDelayNote', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanDelayNote('  הופסק   בגלל\nמזג האוויר ')).toBe('הופסק בגלל מזג האוויר');
  });

  it('treats an empty note as no note', () => {
    expect(cleanDelayNote('')).toBeNull();
    expect(cleanDelayNote('   ')).toBeNull();
    expect(cleanDelayNote(null)).toBeNull();
  });

  it('caps the length', () => {
    expect(cleanDelayNote('א'.repeat(DELAY_NOTE_MAX + 50))).toHaveLength(DELAY_NOTE_MAX);
  });
});

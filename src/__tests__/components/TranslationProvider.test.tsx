/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TranslationProvider, { useLang } from '@/components/TranslationProvider';

// A tiny consumer that surfaces the context so we can assert on it.
function Probe() {
  const { lang, t, toggle } = useLang();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="home">{t('בית')}</span>
      <span data-testid="unknown">{t('מחרוזת שלא קיימת')}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

describe('TranslationProvider', () => {
  it('defaults to Hebrew and returns Hebrew source strings unchanged', () => {
    render(<TranslationProvider><Probe /></TranslationProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('he');
    expect(screen.getByTestId('home')).toHaveTextContent('בית');
  });

  it('translates via the dictionary when initialLang is en', () => {
    render(<TranslationProvider initialLang="en"><Probe /></TranslationProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(screen.getByTestId('home')).toHaveTextContent('Home');
  });

  it('leaves strings missing from the dictionary unchanged in English mode', () => {
    render(<TranslationProvider initialLang="en"><Probe /></TranslationProvider>);
    expect(screen.getByTestId('unknown')).toHaveTextContent('מחרוזת שלא קיימת');
  });

  it('toggles he→en, translating, setting the cookie and updating <html> dir', async () => {
    const user = userEvent.setup();
    render(<TranslationProvider><Probe /></TranslationProvider>);

    expect(screen.getByTestId('home')).toHaveTextContent('בית');

    await user.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(screen.getByTestId('home')).toHaveTextContent('Home');
    expect(document.cookie).toContain('libi-lang=en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('toggles back en→he and restores RTL', async () => {
    const user = userEvent.setup();
    render(<TranslationProvider initialLang="en"><Probe /></TranslationProvider>);

    await user.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('lang')).toHaveTextContent('he');
    expect(document.documentElement.dir).toBe('rtl');
  });
});

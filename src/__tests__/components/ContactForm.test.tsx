/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Replace the i18n context with an identity translator so assertions can use
// the Hebrew source strings directly.
jest.mock('@/components/TranslationProvider', () => ({
  useLang: () => ({ lang: 'he', toggle: jest.fn(), t: (s: string) => s }),
}));

import ContactForm from '@/components/ContactForm';

function fillForm(user: ReturnType<typeof userEvent.setup>) {
  return Promise.all([]).then(async () => {
    await user.type(screen.getByPlaceholderText('שם מלא'), 'Dana');
    await user.type(screen.getByPlaceholderText('כתובת אימייל'), 'dana@x.com');
    await user.type(screen.getByPlaceholderText('ההודעה שלך...'), 'Hello there');
  });
}

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('ContactForm', () => {
  it('renders all three input fields and the submit button', () => {
    render(<ContactForm />);
    expect(screen.getByPlaceholderText('שם מלא')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('כתובת אימייל')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ההודעה שלך...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שלח הודעה' })).toBeInTheDocument();
  });

  it('posts the entered values to /api/contact and shows the success state', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'שלח הודעה' }));

    await waitFor(() => expect(screen.getByText('ההודעה נשלחה בהצלחה!')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith('/api/contact', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({ name: 'Dana', email: 'dana@x.com', message: 'Hello there' });
  });

  it('clears the form after a successful submission', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'שלח הודעה' }));

    // Success view offers to send another message; going back shows empty fields.
    await waitFor(() => screen.getByText('שלח הודעה נוספת'));
    await user.click(screen.getByText('שלח הודעה נוספת'));
    expect(screen.getByPlaceholderText('שם מלא')).toHaveValue('');
  });

  it('shows the server-provided error message on a failed submission', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'כל השדות חובה' }) });
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'שלח הודעה' }));

    await waitFor(() => expect(screen.getByText('כל השדות חובה')).toBeInTheDocument());
  });

  it('shows a connection error when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'שלח הודעה' }));

    await waitFor(() => expect(screen.getByText('בעיית חיבור לשרת')).toBeInTheDocument());
  });
});

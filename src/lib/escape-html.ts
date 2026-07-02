/**
 * Escape a string for safe interpolation into HTML (email bodies, etc.).
 * User-supplied text must ALWAYS pass through this before being embedded
 * in the notification emails — otherwise a form submission can inject
 * markup/links into mail the admin trusts.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Sanitizing Markdown renderer. marked + DOMPurify are dynamically imported so
// they code-split onto the notes route and stay out of the main bundle.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderMarkdown(md: string): Promise<string> {
  const src = md ?? '';
  try {
    const [{ marked }, DOMPurifyMod] = await Promise.all([
      import('marked'),
      import('dompurify'),
    ]);
    const DOMPurify = DOMPurifyMod.default;
    const rawHtml = marked.parse(src, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  } catch {
    // Malformed input or no DOM available - degrade to escaped plain text.
    return escapeHtml(src);
  }
}

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '$lib/markdown';

describe('renderMarkdown', () => {
  it('renders headings, bold, and lists', async () => {
    const out = await renderMarkdown('# Title\n\n**bold**\n\n- one\n- two');
    expect(out).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<li>');
  });

  it('strips <script> tags', async () => {
    const out = await renderMarkdown('ok\n\n<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips inline event handlers', async () => {
    const out = await renderMarkdown('<img src=x onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain('onerror');
  });

  it('strips javascript: URLs', async () => {
    const out = await renderMarkdown('[click](javascript:alert(1))');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });
});

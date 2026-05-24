import React from 'react';

/**
 * Tiny markdown renderer — just enough for the Gemini-generated cup
 * previews. Handles:
 *  • **bold** → <strong>
 *  • Lines starting with "- " or "* " → bulleted list
 *  • Blank lines → paragraph breaks
 *  • Lines starting with "## " / "### " → subheadings
 *
 * Deliberately not a full markdown parser — keeps the surface tight,
 * predictable, and no external dependency. If a future preview needs
 * more (tables, links, code), swap in react-markdown then.
 */

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on **bold** segments. The regex captures groups so split returns
  // alternating plain / bold tokens. Odd indices are the bold content.
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <strong key={`${keyBase}-b-${i}`} className="font-black text-white">{part}</strong>;
    }
    return <React.Fragment key={`${keyBase}-t-${i}`}>{part}</React.Fragment>;
  });
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'heading'; level: 3 | 4; text: string };

function toBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd());
  const blocks: Block[] = [];

  // State machine: paragraph buffer + list buffer.
  let paraBuf: string[] = [];
  let listBuf: string[] = [];

  function flushPara() {
    if (paraBuf.length) {
      blocks.push({ kind: 'paragraph', lines: paraBuf });
      paraBuf = [];
    }
  }
  function flushList() {
    if (listBuf.length) {
      blocks.push({ kind: 'list', items: listBuf });
      listBuf = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushPara();
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushPara();
      listBuf.push(bulletMatch[1]);
      continue;
    }

    const h3Match = line.match(/^###\s+(.*)$/);
    if (h3Match) {
      flushPara();
      flushList();
      blocks.push({ kind: 'heading', level: 4, text: h3Match[1] });
      continue;
    }

    const h2Match = line.match(/^##\s+(.*)$/);
    if (h2Match) {
      flushPara();
      flushList();
      blocks.push({ kind: 'heading', level: 3, text: h2Match[1] });
      continue;
    }

    flushList();
    paraBuf.push(line);
  }

  flushPara();
  flushList();
  return blocks;
}

export default function MarkdownLite({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  const blocks = toBlocks(text);

  const paraSize  = compact ? 'text-xs'  : 'text-sm';
  const listSize  = compact ? 'text-xs'  : 'text-sm';
  const gap       = compact ? 'space-y-2' : 'space-y-3';

  return (
    <div className={`${gap} leading-relaxed text-[#e0ecf5]`}>
      {blocks.map((b, idx) => {
        if (b.kind === 'paragraph') {
          return (
            <p key={idx} className={paraSize}>
              {b.lines.map((line, lineIdx) => (
                <React.Fragment key={lineIdx}>
                  {renderInline(line, `${idx}-${lineIdx}`)}
                  {lineIdx < b.lines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          );
        }
        if (b.kind === 'list') {
          return (
            <ul key={idx} className={`${listSize} list-disc list-inside space-y-1.5 marker:text-amber-400/70`}>
              {b.items.map((item, i) => (
                <li key={i}>{renderInline(item, `${idx}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        // heading
        const cls = b.level === 3
          ? 'text-base font-black text-white mt-1'
          : 'text-sm font-black text-amber-300 uppercase tracking-wider mt-1';
        const Tag = b.level === 3 ? 'h3' : 'h4';
        return <Tag key={idx} className={cls}>{renderInline(b.text, `${idx}-h`)}</Tag>;
      })}
    </div>
  );
}

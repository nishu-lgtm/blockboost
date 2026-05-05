"use client";

import React from "react";

// ---------------------------------------------------------------------------
// Inline token processor (bold, italic, code, links)
// ---------------------------------------------------------------------------

function processInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded text-[0.8em] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------

export function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H1
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-base font-bold text-slate-900 mt-4 mb-2 first:mt-0">
          {processInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5 first:mt-0">
          {processInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-slate-800 mt-3 mb-1 first:mt-0">
          {processInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-slate-200 my-3" />);
      i++;
      continue;
    }

    // Unordered list — collect consecutive items
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 my-2 text-sm text-slate-700">
          {items.map((item, j) => (
            <li key={j}>{processInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list — collect consecutive items
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1 my-2 text-sm text-slate-700">
          {items.map((item, j) => (
            <li key={j}>{processInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Block quote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-3 border-indigo-300 pl-3 my-2 text-sm text-slate-600 italic"
        >
          {processInline(line.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // Empty line → spacer
    if (line.trim() === "") {
      // Only add spacer if previous element isn't already a block
      if (elements.length > 0) {
        elements.push(<div key={i} className="h-2" />);
      }
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={i} className="text-sm text-slate-700 leading-relaxed">
        {processInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

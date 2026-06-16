import React from "react";
import { Terminal, Table, HelpCircle } from "lucide-react";

interface MarkdownViewerProps {
  content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  if (!content) return null;

  // Split content by lines
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushTable = () => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      const idx = `table-${Math.random()}`;
      elements.push(
        <div key={idx} className="my-6 overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
          <table className="min-w-full divide-y divide-slate-200 font-sans text-xs">
            <thead className="bg-slate-50">
              <tr>
                {tableHeaders.map((col, i) => (
                  <th
                    key={`th-${i}`}
                    className="px-4 py-3 text-left font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200"
                  >
                    {col.replace(/^\s+|\s+$/g, "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableRows.map((row, rIdx) => (
                <tr key={`tr-${rIdx}`} className="hover:bg-slate-50/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={`td-${cIdx}`} className="px-4 py-2.5 text-slate-600 font-normal leading-relaxed">
                      {parseInlineFormatting(cell.replace(/^\s+|\s+$/g, ""))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableHeaders = [];
    tableRows = [];
    inTable = false;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      const idx = `list-${Math.random()}`;
      elements.push(
        <ul key={idx} className="list-disc pl-6 space-y-2 my-4 text-slate-600 leading-relaxed text-sm">
          {listItems.map((item, i) => (
            <li key={`li-${i}`}>{parseInlineFormatting(item)}</li>
          ))}
        </ul>
      );
    }
    listItems = [];
    inList = false;
  };

  const parseInlineFormatting = (text: string) => {
    // Basic regex formatting for bold (**text**) and code (`text`)
    const parts: React.ReactNode[] = [];
    let currentIdx = 0;
    
    // Expressing both bold ** and inline `
    const regex = /(\*\*|`)(.*?)\1/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // Add plain text before match
      if (match.index > currentIdx) {
        parts.push(text.substring(currentIdx, match.index));
      }
      
      const type = match[1];
      const matchText = match[2];
      
      if (type === "**") {
        parts.push(<strong key={match.index} className="font-bold text-slate-900">{matchText}</strong>);
      } else {
        parts.push(<code key={match.index} className="font-mono text-xs text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-100/50">{matchText}</code>);
      }
      
      currentIdx = regex.lastIndex;
    }
    
    if (currentIdx < text.length) {
      parts.push(text.substring(currentIdx));
    }
    
    return parts.length > 0 ? parts : text;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for tables
    if (line.trim().startsWith("|")) {
      if (inList) flushList();
      
      // Parse table cells
      const cells = line.split("|").slice(1, -1);
      
      // Skip separator lines with hyphens, e.g., |---|---|
      if (line.match(/^\|[\s-:\\|]+$/)) {
        inTable = true;
        continue;
      }

      if (!inTable) {
        tableHeaders = cells;
        inTable = true;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      if (inTable && !line.trim().startsWith("|")) {
        flushTable();
      }
    }

    // Check for lists
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      if (inTable) flushTable();
      inList = true;
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    } else {
      if (inList && !line.trim().startsWith("- ") && !line.trim().startsWith("* ")) {
        flushList();
      }
    }

    // Skip empty lines or treat them as spacing
    if (line.trim() === "") {
      elements.push(<div key={`space-${i}`} className="h-2" />);
      continue;
    }

    // Standard markdown tags
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-slate-900 mt-8 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
          {parseInlineFormatting(line.replace("# ", ""))}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-slate-800 mt-6 mb-3 tracking-tight flex items-center gap-2 border-l-4 border-[#c74634] pl-2.5">
          {parseInlineFormatting(line.replace("## ", ""))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-slate-700 mt-4 mb-2 tracking-wide uppercase">
          {parseInlineFormatting(line.replace("### ", ""))}
        </h3>
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-emerald-400 bg-emerald-50/40 p-4 rounded-r-lg text-emerald-800 my-4 text-xs italic leading-relaxed">
          {parseInlineFormatting(line.replace("> ", ""))}
        </blockquote>
      );
    } else {
      // Avoid printing raw mermaid code block lines
      if (line.trim().startsWith("```mermaid") || line.trim() === "```") {
        continue;
      }
      // If it looks like a mermaid code line within the block, skip it
      if (line.trim().includes("graph TD") || line.trim().includes("sequenceDiagram") || line.trim().includes("participant ")) {
        // Let's check if the previous lines had a mermaid marker.
        // We'll skip standard mermaid syntactic markers so they don't print as raw paragraphs in the TDD.
        let isMermaidSyntax = false;
        const scanRange = 10;
        for (let j = Math.max(0, i - scanRange); j <= i; j++) {
          if (lines[j]?.trim().startsWith("```mermaid")) {
            isMermaidSyntax = true;
            break;
          }
        }
        if (isMermaidSyntax) continue;
      }

      // Check if it's general code block content (outside mermaid)
      let isCodeBlockContent = false;
      let openBlocks = 0;
      for (let j = 0; j <= i; j++) {
        if (lines[j]?.trim().startsWith("```") && !lines[j]?.trim().startsWith("```mermaid")) {
          openBlocks = openBlocks === 0 ? 1 : 0;
        }
      }
      if (openBlocks > 0) {
        elements.push(
          <div key={i} className="bg-slate-800 text-slate-200 p-3 rounded-lg font-mono text-xs my-1 overflow-x-auto border border-slate-700 flex items-center gap-1.5 leading-relaxed">
            <Terminal size={12} className="text-slate-400 flex-shrink-0" />
            <span>{line}</span>
          </div>
        );
        continue;
      }

      elements.push(
        <p key={i} className="text-slate-600 leading-relaxed text-sm my-2 text-justify">
          {parseInlineFormatting(line)}
        </p>
      );
    }
  }

  // Flush remaining elements
  if (inTable) flushTable();
  if (inList) flushList();

  return <div className="space-y-1 font-sans">{elements}</div>;
};

interface ParsedDiagrams {
  architecture: string;
  sequence: string;
}

export interface ParsedTddReport {
  markdown: string;
  diagrams: ParsedDiagrams;
}

/**
 * Parses and extracts Mermaid diagrams from the LLM generated Markdown report.
 */
export function parseTddReport(markdown: string): ParsedTddReport {
  const result: ParsedTddReport = {
    markdown,
    diagrams: {
      architecture: "",
      sequence: "",
    },
  };

  if (!markdown) {
    return result;
  }

  // Regex to match: ```mermaid\n[code]\n```
  const mermaidRegex = /```mermaid([\s\S]*?)```/g;
  let match;
  const matches: string[] = [];

  while ((match = mermaidRegex.exec(markdown)) !== null) {
    if (match[1]) {
      matches.push(match[1].trim());
    }
  }

  // Identify which is which
  // System architecture contains: TD, LR, graph, dynamic connections
  // Sequence contains: sequenceDiagram, participants, ->
  matches.forEach((chartCode) => {
    const lowerCode = chartCode.toLowerCase();
    
    if (lowerCode.includes("sequencediagram") || lowerCode.includes("participant") || lowerCode.includes("alt ") || lowerCode.includes("opt ")) {
      result.diagrams.sequence = chartCode;
    } else if (lowerCode.includes("graph td") || lowerCode.includes("graph lr") || lowerCode.includes("subgraph")) {
      result.diagrams.architecture = chartCode;
    } else {
      // Fallback: If architecture is empty, assign it. If that is occupied, assign to sequence.
      if (!result.diagrams.architecture) {
        result.diagrams.architecture = chartCode;
      } else if (!result.diagrams.sequence) {
        result.diagrams.sequence = chartCode;
      }
    }
  });

  return result;
}

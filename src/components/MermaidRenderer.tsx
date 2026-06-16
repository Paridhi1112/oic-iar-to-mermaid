import React, { useEffect, useRef, useState } from "react";
import { Copy, Check, Download, AlertTriangle } from "lucide-react";
import mermaid from "mermaid";

// Initialize mermaid inside client-side component safely
mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  fontFamily: "Inter, var(--font-sans), sans-serif",
  flowchart: {
    htmlLabels: true,
    curve: "basis",
  },
  sequence: {
    actorMargin: 50,
    width: 150,
    height: 60,
  }
});

interface MermaidRendererProps {
  chart: string;
  title?: string;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [errorString, setErrorString] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const renderChart = async () => {
      if (!chart || chart.trim() === "") {
        setSvg("");
        setErrorString(null);
        return;
      }

      setErrorString(null);

      // Clean up the mermaid syntax before rendering
      // Common issues: LLM output includes unescaped parenthesis, or markdown wrappers
      let cleanChart = chart.trim();
      if (cleanChart.startsWith("```mermaid")) {
        cleanChart = cleanChart.substring(10);
      }
      if (cleanChart.endsWith("```")) {
        cleanChart = cleanChart.substring(0, cleanChart.length - 3);
      }
      cleanChart = cleanChart.trim();

      // Clean syntax errors: Replace common OIC unescaped characters in node names
      // Replace items like: OIC_Flow(Assign Data) -> OIC_Flow["Assign Data"]
      // Let's keep it relatively safe while retaining structural lines
      try {
        const uniqueId = `mermaid-container-${Math.floor(Math.random() * 1000000)}`;
        const { svg: svgCode } = await mermaid.render(uniqueId, cleanChart);
        
        if (active) {
          setSvg(svgCode);
        }
      } catch (err: any) {
        console.error("Mermaid Render Error:", err);
        // Clean error messages for display
        if (active) {
          setErrorString(err.message || String(err));
        }
      }
    };

    renderChart();

    return () => {
      active = false;
    };
  }, [chart]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(chart.trim());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title?.toLowerCase().replace(/\s+/g, "_") || "mermaid_diagram"}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm my-4">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider font-sans">
          {title || "Interaction Diagram"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-2 py-1 rounded transition-all cursor-pointer shadow-xs"
            title="Copy RAW Mermaid Code"
          >
            {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={13} />}
            <span>{isCopied ? "Copied" : "Copy Code"}</span>
          </button>
          
          {svg && (
            <button
              onClick={downloadSvg}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-2 py-1 rounded transition-all cursor-pointer shadow-xs"
              title="Download as Vector SVG"
            >
              <Download size={13} />
              <span>SVG</span>
            </button>
          )}
        </div>
      </div>

      {/* Diagram container */}
      <div className="p-6 overflow-x-auto flex justify-center bg-white min-h-[160px]">
        {errorString ? (
          <div className="max-w-2xl w-full p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex gap-2 text-orange-800 font-semibold text-sm mb-2">
              <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <span>Mermaid Rendering Warning</span>
            </div>
            <p className="text-xs text-orange-700 leading-relaxed font-sans mb-3">
              Mermaid couldn't parse the code perfectly. This is common when labels have parenthesis or brackets. 
              The diagram is displayed below as raw code for you to copy.
            </p>
            <pre className="text-[11px] font-mono whitespace-pre bg-orange-100/50 p-3 rounded-md text-orange-900 border border-orange-200 overflow-x-auto max-h-56">
              {chart}
            </pre>
          </div>
        ) : svg ? (
          <div 
            ref={containerRef}
            className="mermaid-render-svg w-full flex justify-center max-w-full"
            style={{ minHeight: "100px" }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex items-center justify-center text-slate-400 text-sm font-sans py-12">
            Rendering Architecture Model...
          </div>
        )}
      </div>
    </div>
  );
};

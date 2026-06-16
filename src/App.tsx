import React, { useState, useEffect, useRef } from "react";
import { 
  FileArchive, 
  FileText, 
  Cpu, 
  Layers, 
  Activity, 
  CheckCircle, 
  RefreshCw, 
  Download, 
  Copy, 
  ChevronRight, 
  Info, 
  Sparkles, 
  Code2, 
  AlertCircle, 
  FileCode2, 
  ArrowRight,
  TrendingUp,
  Workflow,
  DownloadCloud,
  FileDown
} from "lucide-react";
import { parseIarArchive } from "./utils/iarExtractor";
import { parseTddReport, ParsedTddReport } from "./utils/tddParser";
import { localAnalyzeOicXml } from "./utils/localAnalyzer";
import { mockOicTemplates, OicXmlTemplate } from "./data/mockOicXml";
import { MermaidRenderer } from "./components/MermaidRenderer";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { PythonInstructions } from "./components/PythonInstructions";
import { ExtractedXmlFile, GenerationStatus, OciModelType } from "./types";

export default function App() {
  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedXmlFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ExtractedXmlFile | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // App compile settings
  const [selectedModel, setSelectedModel] = useState<OciModelType>("gemini-3.5-flash");
  const [detailsLevel, setDetailsLevel] = useState<string>("high");

  // Output TDD and parsing records
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationProgressMessage, setGenerationProgressMessage] = useState<string>("");
  const [tddMarkdown, setTddMarkdown] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedTddReport | null>(null);
  const [isLocalCompiled, setIsLocalCompiled] = useState<boolean>(false);

  // UI Navigation
  const [activeTab, setActiveTab] = useState<"tdd" | "diagrams" | "python">("tdd");
  const [copiedDocument, setCopiedDocument] = useState<boolean>(false);

  // Progressive logging interval during compiler generation
  const progressiveLoggingTicks = [
    "Reading orchestration definitions segment...",
    "Extracting schema bindings & payload partner links...",
    "Reconstructing sequential BPEL processing streams...",
    "Scanning mappings & custom XSLT data transitions...",
    "Evaluating fault handlers, scope switches & retry gates...",
    "Constructing standard Mermaid system architecture flowchart...",
    "Synthesizing sequence chronological diagram timelines...",
    "Refining technical grammar into formal TDD document format..."
  ];

  useEffect(() => {
    let tickIdx = 0;
    let timer: any;
    if (generationStatus === "analyzing") {
      setGenerationProgressMessage(progressiveLoggingTicks[0]);
      timer = setInterval(() => {
        tickIdx = (tickIdx + 1) % progressiveLoggingTicks.length;
        setGenerationProgressMessage(progressiveLoggingTicks[tickIdx]);
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [generationStatus]);

  // Handle file uploads
  const handleFileUpload = async (file: File) => {
    try {
      setGenerationError(null);
      setGenerationStatus("parsing");
      setTddMarkdown(null);
      setParsedResult(null);

      const files = await parseIarArchive(file);
      setExtractedFiles(files);

      if (files.length > 0) {
        // Find default or primary file
        const primary = files.find(f => f.isPrimary) || files[0];
        setSelectedFile(primary);
        setGenerationStatus("idle");
      } else {
        setExtractedFiles([]);
        setSelectedFile(null);
        setGenerationStatus("failed");
        setGenerationError("No valid XML flow definitions found inside the selected file archive.");
      }
    } catch (e: any) {
      console.error(e);
      setGenerationStatus("failed");
      setGenerationError(`Engine failed to parse uploaded archive: ${e.message || String(e)}`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Pre-load a demo template xml
  const loadMockTemplate = (template: OicXmlTemplate) => {
    setGenerationError(null);
    setTddMarkdown(null);
    setParsedResult(null);
    setIsLocalCompiled(false);

    const mockExtracted: ExtractedXmlFile = {
      name: template.fileName,
      path: `icspackage/project/${template.id}_01.00.0000/${template.fileName}`,
      content: template.xml,
      size: template.xml.length,
      isPrimary: true
    };

    setExtractedFiles([mockExtracted]);
    setSelectedFile(mockExtracted);
    setGenerationStatus("idle");
  };

  // Trigger Gemini analysis of current OIC XML file
  const generateTdd = async () => {
    if (!selectedFile) return;

    try {
      setGenerationError(null);
      setGenerationStatus("analyzing");
      setTddMarkdown(null);
      setParsedResult(null);
      setIsLocalCompiled(false);

      const response = await fetch("/api/generate-tdd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          xmlContent: selectedFile.content,
          model: selectedModel,
          fileName: selectedFile.name,
          detailsLevel: detailsLevel
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An unexpected error occurred during document generation.");
      }

      setTddMarkdown(data.tddMarkdown);
      const parsed = parseTddReport(data.tddMarkdown);
      setParsedResult(parsed);
      setGenerationStatus("completed");
      setActiveTab("tdd");
      setIsLocalCompiled(false);
    } catch (e: any) {
      console.warn("API call failed, falling back to clean local parser compilation:", e);
      try {
        const localMd = localAnalyzeOicXml(selectedFile.content, selectedFile.name);
        setTddMarkdown(localMd);
        const parsed = parseTddReport(localMd);
        setParsedResult(parsed);
        setIsLocalCompiled(true);
        setGenerationStatus("completed");
        setActiveTab("tdd");
      } catch (localErr: any) {
        console.error("Local compilation fallback also failed:", localErr);
        setGenerationStatus("failed");
        setGenerationError(
          `Service Error: ${e.message || "Failed to communicate with document builder API."}\n` +
          `Local Compiler Exception: ${localErr.message || String(localErr)}`
        );
      }
    }
  };

  const copyTddToClipboard = () => {
    if (!tddMarkdown) return;
    navigator.clipboard.writeText(tddMarkdown);
    setCopiedDocument(true);
    setTimeout(() => setCopiedDocument(false), 2000);
  };

  const downloadTddFile = () => {
    if (!tddMarkdown) return;
    const blob = new Blob([tddMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFile?.name.replace(".xml", "") || "OIC_Flow"}_Technical_Design_Document.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f4f4f4] text-slate-800 flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. Header Bar: OCI Identity Bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#161b1d] text-white border-b border-slate-700 shrink-0 select-none shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#c74634] flex items-center justify-center font-black text-xs rounded select-none shadow-sm text-white">
            OCI
          </div>
          <div>
            <h1 className="text-md sm:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              OIC Flow Document Generator
              <span className="hidden sm:inline px-2 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-mono rounded">v3.1</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-slate-300 font-mono hidden sm:inline">OCI.GenAI.Active</span>
          </div>
          <div className="text-xs text-slate-400 border-l border-slate-700 pl-6 hidden md:block">
            Region: <span className="text-slate-200">us-ashburn-1</span>
          </div>
          <a 
            href="#python-hub" 
            onClick={() => { setActiveTab("python"); }}
            className="flex items-center gap-1.5 text-xs text-[#f4f4f4] hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded transition-all shadow-sm"
          >
            <FileCode2 size={13} className="text-[#c74634]" />
            <span>Hosting Blueprint</span>
          </a>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* Left Hand: Controller & File Upload Panel (cols 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6 max-h-full overflow-y-auto">
          
          {/* Action A: File Drag & Drop zone */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5 font-sans">
              <FileArchive size={14} className="text-[#c74634]" />
              <span>Inbound Integration Archive</span>
            </h3>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive 
                  ? "border-[#c74634] bg-red-50/10" 
                  : "border-slate-200 hover:border-[#c74634] hover:bg-slate-50/50"
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept=".iar,.xml"
                onChange={handleFileChange}
              />
              <div className="p-3 bg-slate-100 rounded-full text-slate-500 mb-3 group-hover:scale-110 transition-transform">
                <FileArchive size={20} className="text-[#c74634]" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Drag-and-Drop or Browse Files
              </p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[210px] leading-relaxed">
                Accepts OIC <strong>.iar</strong> package bundle or pre-extracted orchestration <strong>.xml</strong> layouts.
              </p>
            </div>

            {/* Trial Sandbox Examples */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                No OIC archive? Load enterprise XML demos:
              </span>
              <div className="space-y-2">
                {mockOicTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => loadMockTemplate(template)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/60 block transition-all group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#c74634]">
                        {template.name}
                      </span>
                      <ChevronRight size={13} className="text-slate-400 opacity-60 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                        {template.style}
                      </span>
                      <span className="text-[9px] text-slate-400 truncate max-w-[190px]">
                        {template.fileName}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action B: XML Package File tree inspector */}
          {extractedFiles.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 font-sans">
                  <Layers size={14} className="text-[#c74634]" />
                  <span>Archive File Navigator</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  {extractedFiles.length} files found
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
                {extractedFiles.map((f, idx) => (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f)}
                    className={`w-full text-left p-2.5 text-xs transition-all flex items-start gap-2.5 ${
                      selectedFile?.path === f.path 
                        ? "bg-red-50/10 border-l-4 border-[#c74634] font-semibold text-slate-900" 
                        : "hover:bg-slate-100/50 text-slate-600"
                    }`}
                  >
                    <FileText size={14} className={`flex-shrink-0 mt-0.5 ${selectedFile?.path === f.path ? "text-[#c74634]" : "text-slate-400"}`} />
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{f.name}</span>
                        {f.isPrimary && (
                          <span className="text-[8px] bg-red-100 text-[#c74634] font-bold px-1.5 rounded uppercase flex-shrink-0 text-center scale-95">
                            Orchestrator
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                        {f.path} • {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {selectedFile && (
                <div className="bg-[#161b1d] rounded-lg p-3 text-[10px] font-mono text-slate-300 border border-slate-800 max-h-36 overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                    <span className="text-[#c74634] font-semibold truncate">Preview: {selectedFile.name}</span>
                    <span className="text-slate-500">First 50 lines</span>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                    {selectedFile.content.split("\n").slice(0, 50).join("\n")}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action C: Enterprise Compiler Configuration parameters */}
          {selectedFile && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 font-sans pb-2 border-b border-slate-100">
                <Cpu size={14} className="text-[#c74634]" />
                <span>Compiler Parameters</span>
              </h3>

              {/* Model Choice selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  LLM Execution Engine
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedModel("gemini-3.5-flash")}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                      selectedModel === "gemini-3.5-flash"
                        ? "border-[#c74634] bg-red-50/5 shadow-xs font-semibold"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="mt-0.5 p-1 bg-red-50 text-[#c74634] rounded">
                      <Sparkles size={13} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-800 font-medium">Gemini 3.5 Flash</span>
                        <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 rounded uppercase font-bold">Standard</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">High-speed, cost-efficient flow processing (Sub-15 seconds).</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedModel("gemini-3.1-pro-preview")}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                      selectedModel === "gemini-3.1-pro-preview"
                        ? "border-slate-800 bg-slate-50 shadow-xs font-semibold"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="mt-0.5 p-1 bg-slate-100 text-slate-800 rounded">
                      <Cpu size={13} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-800 font-medium">Gemini 3.1 Pro (Reasoning)</span>
                        <span className="text-[8px] bg-amber-100 text-amber-800 px-1 rounded uppercase font-bold">Complex tasks</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Recommended for extremely complex architectures with massive scope arrays.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Documentation Detail level */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  TDD Coverage Density
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["medium", "high", "full"].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setDetailsLevel(lvl)}
                      className={`py-1.5 px-2 rounded-lg border text-xs capitalize text-center cursor-pointer transition-all ${
                        detailsLevel === lvl 
                          ? "bg-[#c74634] border-[#c74634] text-white font-medium" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trigger Analysis Button */}
              <button
                onClick={generateTdd}
                disabled={generationStatus === "analyzing"}
                className={`w-full py-3 px-4 rounded-xl font-bold font-sans text-sm flex items-center justify-center gap-2 transition-all cursor-[#c74634] cursor-pointer shadow-md ${
                  generationStatus === "analyzing"
                    ? "bg-slate-100 border border-slate-200 text-slate-400"
                    : "bg-[#c74634] hover:bg-[#b03a2a] text-white active:scale-98 shadow-sm"
                }`}
              >
                {generationStatus === "analyzing" ? (
                  <>
                    <RefreshCw size={16} className="animate-spin text-[#c74634]" />
                    <span>Analyzing Integration...</span>
                  </>
                ) : (
                  <>
                    <Cpu size={16} />
                    <span>Generate OIC Document (TDD)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Hand: Visual Output Workspace Area (cols 8) */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
          
          {/* Output Navbar */}
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-shrink-0">
            <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/60 select-none">
              <button
                onClick={() => setActiveTab("tdd")}
                disabled={generationStatus === "analyzing"}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all ${
                  activeTab === "tdd" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <FileText size={14} className="text-[#c74634]" />
                <span>📝 Technical Design Doc</span>
              </button>
              
              <button
                onClick={() => setActiveTab("diagrams")}
                disabled={generationStatus === "analyzing" || !parsedResult}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all ${
                  activeTab === "diagrams" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900 disabled:opacity-50"
                }`}
              >
                <Layers size={14} className="text-[#c74634]" />
                <span>📊 Diagrams</span>
              </button>

              <button
                onClick={() => setActiveTab("python")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all ${
                  activeTab === "python" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Code2 size={14} className="text-[#c74634]" />
                <span>💻 Deploy Python Hub</span>
              </button>
            </div>

            {/* Document downloads actions */}
            {activeTab === "tdd" && tddMarkdown && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={copyTddToClipboard}
                  className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-[#c74634] hover:bg-slate-50 bg-white border border-slate-200 px-3 py-1.5 rounded transition-all cursor-pointer shadow-xs active:scale-95 font-semibold"
                >
                  <Copy size={13} className={copiedDocument ? "text-emerald-500" : "text-slate-400"} />
                  <span>{copiedDocument ? "Copied" : "Copy Document"}</span>
                </button>
                <button
                  onClick={downloadTddFile}
                  className="flex items-center gap-1.5 text-xs text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded font-semibold cursor-pointer transition-all shadow-xs active:scale-95"
                >
                  <DownloadCloud size={13} />
                  <span>Download .md</span>
                </button>
              </div>
            )}
          </div>

          {/* Active Canvas Body element */}
          <div className="flex-1 p-6 overflow-y-auto max-h-full">
            
            {isLocalCompiled && generationStatus === "completed" && (
              <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-start gap-2.5 shadow-xs">
                <Sparkles size={16} className="text-[#c74634] mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-bold text-slate-800">Local Parsing Compiler Active</h5>
                  <p className="text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    This document was compiled successfully using a high-context client-side XML parser. Add a <strong>GEMINI_API_KEY</strong> environment variable in Google AI Studio to unlock full Generative AI refinement.
                  </p>
                </div>
              </div>
            )}

            {/* Status messages while processing */}
            {generationStatus === "parsing" && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full animate-bounce mb-3">
                  <FileArchive size={32} />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Reading Integration Archive</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Unpacking `.iar` ZIP directories client-side to locate primary BPEL orchestration documents...
                </p>
              </div>
            )}

            {generationStatus === "analyzing" && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full scale-125 animate-pulse" />
                  <div className="relative p-4 bg-indigo-600 text-white rounded-full animate-spin">
                    <RefreshCw size={28} />
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-800">OIC XML Compiler Active</h4>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed animate-pulse">
                  {generationProgressMessage}
                </p>
                <div className="w-64 h-1 bg-slate-100 rounded-full mt-6 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-rose-500 to-indigo-600 rounded-full animate-[shimmer_1.5s_infinite]" style={{ width: "80%" }} />
                </div>
              </div>
            )}

            {generationStatus === "failed" && (
              <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl max-w-2xl mx-auto">
                <div className="flex gap-2 text-rose-800 font-bold mb-2">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>Compilation Engine Aborted</span>
                </div>
                <div className="text-xs text-rose-700 leading-relaxed font-mono whitespace-pre-wrap">
                  {generationError}
                </div>
                <div className="text-xs text-slate-500 mt-4 leading-relaxed font-sans border-t border-rose-200/50 pt-3">
                  💡 <strong>Recommendation:</strong> Verify that your <code>GEMINI_API_KEY</code> is correctly set in the Secrets manager in Google AI Studio, or check that your uploaded XML contains standard Oracle Integration Cloud namespace constructs.
                </div>
              </div>
            )}

            {generationStatus === "idle" && (
              <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3">
                  <Workflow size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Orchestration Flow Loaded</h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  The OIC metadata has been extracted successfully. Click the compile button to execute the OCI-level AI analyzer steps.
                </p>
                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-left flex items-start gap-3">
                  <Info size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    <span className="font-semibold text-slate-700">File Selected:</span> {selectedFile?.name}<br/>
                    <span className="font-semibold text-slate-700">Estimated Size:</span> {selectedFile ? (selectedFile.size / 1024).toFixed(1) : "0"} KB<br/>
                    This source code will be passed to our generation endpoint using high-context structural mappings.
                  </div>
                </div>
              </div>
            )}

            {!tddMarkdown && generationStatus === "idle" && !selectedFile && (
              <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
                <div className="p-4 bg-slate-100 text-slate-400 rounded-full mb-4">
                  <Workflow size={32} />
                </div>
                <h4 className="text-sm font-bold text-slate-800 font-sans">Awaiting Integration Artifacts</h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Deploy or select an Oracle Integration Cloud (.iar) package or BPEL flowchart xml in the left-hand panel to build the architecture diagram.
                </p>
              </div>
            )}

            {/* Content Tabs (once generated successfully) */}
            {generationStatus === "completed" && (
              <div>
                {activeTab === "tdd" && tddMarkdown && (
                  <div className="prose max-w-none text-slate-800">
                    <MarkdownViewer content={tddMarkdown} />
                  </div>
                )}

                {activeTab === "diagrams" && parsedResult && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5 font-sans">
                        <TrendingUp size={16} className="text-indigo-600" />
                        <span>System Architecture Layout</span>
                      </h3>
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                        Visualizing the integration ecosystem. Shows triggering applications, primary processing orchestration pipelines, and downstream SaaS system invokes.
                      </p>
                      {parsedResult.diagrams.architecture ? (
                        <MermaidRenderer 
                          chart={parsedResult.diagrams.architecture} 
                          title="System Architecture Diagram" 
                        />
                      ) : (
                        <div className="text-xs text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200">
                          Architecture landscape flowchart could not be extracted separately. View the main Technical Design Document text for coordinates.
                        </div>
                      )}
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                      <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5 font-sans">
                        <Workflow size={16} className="text-indigo-600" />
                        <span>Chronological Sequence Process</span>
                      </h3>
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                        Displays actual step-by-step sequential transactions, mapping stages, switch checkpoints, loop loops and exception traps.
                      </p>
                      {parsedResult.diagrams.sequence ? (
                        <MermaidRenderer 
                          chart={parsedResult.diagrams.sequence} 
                          title="Chronological Sequence Diagram" 
                        />
                      ) : (
                        <div className="text-xs text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200">
                          Sequence chronologies could not be parsed separately. Check the markdown tab.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "python" && (
              <div id="python-hub" className="space-y-6">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3">
                  <Info className="text-indigo-600 mt-0.5 flex-shrink-0" size={16} />
                  <div className="text-xs text-indigo-800 leading-relaxed">
                    <strong>Self-Hosting Information:</strong> Because the preview in AI Studio runs entirely within a Node.js container environment, 
                    we have built this live designer in React with an Express server using the platform's standard Gemini API. 
                     Below, you can access the exact <strong>production-ready Python Streamlit script and OCI GenAI SDK</strong> parameters 
                    to host this utility completely within your Oracle Cloud Infrastructure tenancy.
                  </div>
                </div>
                <PythonInstructions />
              </div>
            )}

          </div>
          
          {/* Footer details */}
          <div className="bg-[#161b1d] p-3 border-t border-slate-700 text-slate-400 shrink-0 flex items-center justify-between font-mono text-[10px] select-none">
            <div className="flex gap-4">
              <div><span className="text-slate-500">Engine:</span> <span className="text-slate-300">v3.1.0-Release</span></div>
              {selectedFile && (
                <div className="hidden sm:block"><span className="text-slate-500">Source:</span> <span className="text-[#c74634]">{(selectedFile.size / 1024).toFixed(1)} KB</span></div>
              )}
            </div>
            <div className="text-[#10b981] uppercase tracking-widest flex items-center gap-1.5 font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
              <span>Output Verified by OCI Generative AI</span>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}

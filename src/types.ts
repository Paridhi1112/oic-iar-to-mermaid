export interface ExtractedXmlFile {
  name: string;
  path: string;
  content: string;
  size: number; // bytes
  isPrimary: boolean;
}

export type GenerationStatus = "idle" | "parsing" | "analyzing" | "completed" | "failed";

export type OciModelType = "gemini-3.5-flash" | "gemini-3.1-pro-preview";

export interface OciModelOption {
  value: OciModelType;
  label: string;
  description: string;
  isPaid: boolean;
}

export interface GeneratedTddResult {
  tddMarkdown: string;
  metadata: {
    name: string;
    version: string;
    style: string;
    diagrams: {
      architecture: string;
      sequence: string;
    }
  };
}

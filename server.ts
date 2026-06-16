import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase payload size limit to handle large XML strings
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Shared Gemini API initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets or in the environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Route: Generate TDD
app.post("/api/generate-tdd", async (req, res) => {
  try {
    const { xmlContent, model, fileName, detailsLevel } = req.body;
    
    if (!xmlContent || xmlContent.trim() === "") {
      return res.status(400).json({ error: "No XML content provided for analysis." });
    }

    const selectedModel = model || "gemini-3.5-flash";
    const client = getGeminiClient();

    const systemInstruction = `You are an expert Enterprise Integration Architect specializing in Oracle Cloud Infrastructure (OCI) and Oracle Integration Cloud (OIC Gen 2/3). 
Analyze the provided OIC Integration XML metadata and output a production-grade, highly precise, and well-structured Technical Design Document (TDD).

IMPORTANT INSTRUCTIONS:
1. Extract metadata accurately (do not invent information). If any endpoints are missing, categorize them as "[Unknown/To Be Declared]" or infer them reasonably from namespace URIs or partner links in the XML.
2. Structure the document EXACTLY with these sections:
   A. Executive Summary & Integration Metadata: Extract Name, ID, Version, Style (e.g., App-Driven, Scheduled Orchestration, Publish/Subscribe), and Description.
   B. System Architecture Diagram: Provide a clear Mermaid.js 'graph TD' or 'graph LR' architecture landscape showing [Source Trigger / Client] -> [OIC Integration Flow] -> [Target Invokes / External Systems].
   C. Endpoints & Connection Dictionary: A Markdown table mapping all Trigger and Invoke adapters, connections, operations, target services, and URIs where visible.
   D. Sequential Integration Flow Logic: Highly detailed, logical chronological breakdown of all Scopes, Variable assignments, Mappings, XSLT formulas, If/Else Switches, Loops (For-Each), and Fault Handlers. Focus heavily on how data maps from trigger to invoke.
   E. Detailed Sequence Diagram: A granular Mermaid.js 'sequenceDiagram' showing the step-by-step chronology between participants (Trigger, Orchestrator, Invoke Systems, Fault Handler).

3. Diagrams Rules:
   - Enclose Mermaid diagrams strictly inside triple backticks (\\\`\\\`\\\`mermaid and \\\`\\\`\\\`).
   - Do NOT use syntax-breaking characters in node names or labels (such as parenthesis (), brackets [], braces {}, or special characters like / & % inside the actual name text). Use simple alphanumeric text, underscores, or double-quotes if needed (e.g., Client["Trigger Client"] is fine, or simple OIC_Flow).
   - Check Mermaid syntax for correctness. Always start sequence diagrams with "sequenceDiagram" and flowcharts with "graph TD".

Source File Name analyzed: ${fileName || "unknown_oic_flow.xml"}
Details requested: ${detailsLevel || "high"}`;

    const prompt = `Here is the OIC Orchestration XML Metadata:
\`\`\`xml
${xmlContent.substring(0, 150000)}
${xmlContent.length > 150000 ? "\n[... XML content truncated for size limits ...]" : ""}
\`\`\`

Analyze the above integration XML completely and generate the formal Technical Design Document (TDD) as specified.`;

    const response = await client.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // low temperature for highly precise metadata extraction
      }
    });

    if (!response || !response.text) {
      throw new Error("Unable to retrieve response text from the Gemini model.");
    }

    res.json({ tddMarkdown: response.text });
  } catch (error: any) {
    console.error("Error generating TDD:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred on the server." });
  }
});

// Serve frontend assets in development / production
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

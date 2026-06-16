import JSZip from "jszip";
import { ExtractedXmlFile } from "../types";

/**
 * Parses OIC .iar (ZIP archive) or raw XML, extracts orchestration metadata XML,
 * and identifies which is likely the primary BPEL/Orchestration XML.
 */
export async function parseIarArchive(file: File): Promise<ExtractedXmlFile[]> {
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  // Case 1: Raw XML file uploaded directly
  if (fileExtension === "xml") {
    const textContent = await file.text();
    return [
      {
        name: file.name,
        path: file.name,
        content: textContent,
        size: file.size,
        isPrimary: true,
      },
    ];
  }

  // Case 2: Integration Archive (.iar) file uploaded
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFilesList: ExtractedXmlFile[] = [];

  // Iterate over files in the ZIP
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir || !relativePath.endsWith(".xml")) {
      continue;
    }

    try {
      const textContent = await zipEntry.async("string");
      const sizeValue = (zipEntry as any)._data?.uncompressedSize || textContent.length;

      // Heuristic for primary orchestration XML:
      // Typically resides under icspackage/project/ID_VERSION/ID.xml
      // Let's check for standard patterns in path, while avoiding wsdl, schemas, xsds, maps, or manifest files
      let isPrimaryCandidate = false;
      const lowerPath = relativePath.toLowerCase();

      if (
        lowerPath.includes("/icspackage/project/") &&
        !lowerPath.includes("/resource/") &&
        !lowerPath.includes("wsdl") &&
        !lowerPath.includes("xsd") &&
        !lowerPath.includes("map") &&
        !lowerPath.includes("layout")
      ) {
        // If it resides directly in the project ID folder and matches its name
        isPrimaryCandidate = true;
      }

      // Safeguard: Check if the XML contains standard OIC flow symbols:
      // e.g. `<flow`, `<variables`, `<partnerLinks`, or `<oracle-ics`
      const hasFlowMetadata = 
        textContent.includes("<flow") || 
        textContent.includes("xmlns:oracle-ics") || 
        textContent.includes("<icspackage") || 
        textContent.includes("<orchestration");

      xmlFilesList.push({
        name: relativePath.split("/").pop() || relativePath,
        path: relativePath,
        content: textContent,
        size: sizeValue,
        isPrimary: isPrimaryCandidate && hasFlowMetadata,
      });
    } catch (e) {
      console.error(`Error reading XML block ${relativePath}:`, e);
    }
  }

  // If we couldn't flag a specific primary XML as isPrimary:
  // Sort by size and tag the largest file containing '<flow' or '<orchestration' as primary
  const designatedPrimary = xmlFilesList.find((f) => f.isPrimary);
  if (!designatedPrimary && xmlFilesList.length > 0) {
    // Find the largest file containing orchestration markers, or fall back to largest XML
    const bestCandidate = xmlFilesList
      .filter((f) => f.content.includes("<flow") || f.content.includes("<orchestration") || f.content.includes("oracle-ics"))
      .sort((a, b) => b.size - a.size)[0] || 
      xmlFilesList.sort((a, b) => b.size - a.size)[0];
      
    if (bestCandidate) {
      bestCandidate.isPrimary = true;
    }
  }

  return xmlFilesList;
}

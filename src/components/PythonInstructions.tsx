import React, { useState } from "react";
import { Copy, Check, FileCode, Server, Terminal, ShieldAlert } from "lucide-react";

export const PythonInstructions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"app" | "req" | "iam">("app");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const appPyCode = `import streamlit as st
import zipfile
import io
import os
import xml.etree.ElementTree as ET
import oci
from oci.generative_ai_inference import GenerativeAiInferenceClient
from oci.generative_ai_inference.models import ChatDetails, CohereChatRequest, OnPremiseUserMessage, OnPremiseSystemMessage

# Set up Streamlit Page Configuration
st.set_page_config(
    page_title="OIC Flow TDD Builder",
    page_icon="💼",
    layout="wide"
)

# ----------------- PART 1: Core Preprocessing & XML Extraction -----------------
def extract_oic_xml(iar_file_bytes):
    """
    Reads OIC .iar archive bytes using zipfile, identifies primary flow/orchestration xml,
    safely parses/cleans and returns raw XML string.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(iar_file_bytes)) as z:
            namelist = z.namelist()
            
            # Heuristic 1: Find any xml located inside icspackage/project/{integration_id}_{version}/
            primary_xml_path = None
            for name in namelist:
                if "/icspackage/project/" in name and name.endswith(".xml"):
                    # Check if it contains the main integration flow
                    primary_xml_path = name
                    break
            
            # Heuristic 2: Fallback to any xml that names the main project structure
            if not primary_xml_path:
                xml_files = [n for n in namelist if n.endswith(".xml")]
                # Skip package descriptors if possible, but use longest xml which usually represents the orchestration
                xml_files.sort(key=lambda x: z.getinfo(x).file_size, reverse=True)
                if xml_files:
                    primary_xml_path = xml_files[0]
            
            if not primary_xml_path:
                return None, "No XML metadata files found inside the Integration Archive."
            
            with z.open(primary_xml_path) as f:
                raw_data = f.read()
                # Parse and pretty print or clean namespaces if needed to make it safe
                # We return raw decoded text and its name
                return raw_data.decode("utf-8"), os.path.basename(primary_xml_path)
    except Exception as e:
        return None, f"Archived processing error: {str(e)}"


# ----------------- PART 2: OCI Generative AI SDK Layer -----------------
class OCIGenAILayer:
    def __init__(self, use_instance_principals=False, config_profile="DEFAULT"):
        """
        Initializes the OCI SDK Client. Supports either Config File or Instance Principals.
        """
        self.endpoint = "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com" # standard US GenAI Endpoint
        
        try:
            if use_instance_principals:
                # Used when deployed on OCI Compute Instance with Instance Principals configured
                signer = oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
                self.client = GenerativeAiInferenceClient(config={}, signer=signer, service_endpoint=self.endpoint)
                st.sidebar.info("Authenticated using OCI Instance Principals.")
            else:
                # Default configuration locally from ~/.oci/config
                config = oci.config.from_file(profile_name=config_profile)
                self.client = GenerativeAiInferenceClient(config=config, service_endpoint=self.endpoint)
                st.sidebar.info(f"Authenticated using OCI config profile: {config_profile}")
        except Exception as e:
            st.sidebar.error(f"OCI Auth Error: {str(e)}")
            st.sidebar.warning("Falling back to local initialization. Please set up OCI CLI configuration.")
            self.client = None

    def generate_tdd_from_xml(self, xml_content, filename="integration_flow.xml", compartment_id=None):
        """
        Executes Inference call to OCI Generative AI Service using Cohere Command R+ model.
        """
        if not self.client:
            return "Error: OCI Generative AI Client was not properly initialized."
        
        if not compartment_id:
            return "Please provide a valid OCI Compartment OCID to run Generative AI services."

        # Model OCID for Cohere Command R+ in OCI Generative AI (US Chicago region)
        # Check current OCI documentation for the exact live model ID
        model_id = "cohere.command-r-plus" 

        # Construct System Instruction
        system_instruction = (
            "You are an expert Enterprise Integration Architect. Analyze the provided OIC Integration XML metadata "
            "and output a production-grade Technical Design Document (TDD) structured exactly as follows:\\n\\n"
            "A. Executive Summary & Integration Metadata: Extract Name, Version, and Style (e.g., App-Driven or Scheduled Orchestration).\\n"
            "B. System Architecture Diagram: Provide a clear Mermaid.js 'graph TD' or 'graph LR' architecture landscape showing [Source Trigger] -> [OIC Flow] -> [Target Invokes].\\n"
            "C. Endpoints & Connection Dictionary: A Markdown table mapping all Trigger and Invoke adapters, connections, operations, and URIs.\\n"
            "D. Sequential Integration Flow Logic: Detailed breakdown of Scopes, Mappings, XSLT formulas, If/Else Switches, Loops (For-Each), and Fault Handlers.\\n"
            "E. Detailed Sequence Diagram: A granular Mermaid.js 'sequenceDiagram' showing step-by-step chronology between participants.\\n\\n"
            "Enclose all Mermaid diagrams strictly inside triple backticks (\`\`\`mermaid ... \`\`\`) without syntax-breaking characters in node names."
        )

        # Truncate content to fit high-model parameters safely
        xml_snippet = xml_content[:120000] # Safe token representation
        user_prompt = f"Please analyze this OIC file {filename} and produce the TDD:\\n\\n{xml_snippet}"

        try:
            # Build Chat details payload
            user_msg = OnPremiseUserMessage(role="USER", content=user_prompt)
            system_msg = OnPremiseSystemMessage(role="SYSTEM", content=system_instruction)

            chat_req = CohereChatRequest(
                message=user_prompt,
                preamble_override=system_instruction,
                max_tokens=4000,
                temperature=0.1,
                is_stream=False
            )

            chat_details = ChatDetails(
                compartment_id=compartment_id,
                serving_mode=oci.generative_ai_inference.models.OnDemandServingMode(model_id=model_id),
                chat_request=chat_req
            )

            # Query GenAI Service
            response = self.client.chat(chat_details)
            return response.data.chat_response.text
        except Exception as e:
            return f"Error executing OCI Generative AI client call: {str(e)}"


# ----------------- PART 3: Streamlit Interface Layer -----------------
def main():
    st.title("💼 OIC Flow Document Generator on OCI")
    st.markdown("Automate OIC orchestration metadata reviews into gorgeous enterprise TDDs powered by OCI Enterprise GenAI Services.")
    st.write("---")

    # Sidebar parameters
    st.sidebar.header("OCI Service Integration Config")
    compartment_ocid = st.sidebar.text_input(
        "Compartment OCID (Required)",
        placeholder="ocid1.compartment.oc1..xxxxxx",
        help="Specify the OCID of the compartment where GenAI service use is allowed."
    )
    
    auth_method = st.sidebar.selectbox(
        "OCI SDK Auth Mode",
        ["Instance Principals", "Local .oci/config"],
        help="Choose Instance Principals when running inside an OCI Compute sandbox with dynamic groups."
    )
    
    use_instance_p = auth_method == "Instance Principals"
    profile_name = st.sidebar.text_input("Config Profile", value="DEFAULT")

    # File uploader
    uploaded_file = st.file_uploader("Upload OIC Integration Archive (.iar) or Orchestration XML (.xml)", type=["iar", "xml"])

    if uploaded_file is not None:
        file_bytes = uploaded_file.read()
        file_ext = os.path.splitext(uploaded_file.name)[1].lower()
        
        xml_content = ""
        filename = uploaded_file.name
        
        if file_ext == ".xml":
            xml_content = file_bytes.decode("utf-8")
            st.success(f"Successfully loaded raw XML: {filename} ({len(xml_content)} characters)")
        else:
            with st.spinner("Extracting primary flow metadata from OIC Archive..."):
                xml_content, name_found = extract_oic_xml(file_bytes)
                if xml_content:
                    filename = name_found
                    st.success(f"Extracted orchestration flow: **{filename}** inside the .iar archive!")
                else:
                    st.error(name_found) # Contains the error string
                    return

        # Trigger Document Generation
        if st.button("Generate Technical Design Document (TDD)", type="primary"):
            if not compartment_ocid:
                st.error("Please provide your OCI Compartment OCID in the sidebar config to proceed.")
                return

            with st.spinner("Invoking OCI Generative AI Cohere Engine to construct TDD..."):
                # Initialize GenAI SDK Wrapper
                genai_layer = OCIGenAILayer(use_instance_principals=use_instance_p, config_profile=profile_name)
                
                # Run Generation
                report = genai_layer.generate_tdd_from_xml(
                    xml_content=xml_content,
                    filename=filename,
                    compartment_id=compartment_ocid
                )
                
                # Display output markdown safely
                st.markdown("## Generated Technical Design Document (TDD)")
                st.markdown(report)
                
                # Support downloads of the raw MD
                st.download_button(
                    label="Download Markdown TDD",
                    data=report,
                    file_name=f"{filename}_Technical_Design_Document.md",
                    mime="text/markdown"
                )

if __name__ == "__main__":
    main()
`;

  const requirementsTxt = `streamlit>=1.30.0
oci>=2.115.0
urllib3<2.0.0
`;

  const iamPolicies = `# OCI IAM Access Policies and Hosting Configuration
# Place your compute instances inside an OCI Dynamic Group to enable authentication via Instance Principals.

# 1. CREATE A DYNAMIC GROUP FOR YOUR EXECUTING INSTANCES
# Name: OIC_DocGen_DG
# Match Rule (All compute in compartment):
# ALL {instance.compartment.id = 'ocid1.compartment.oc1..your_compartment_ocid'}

# 2. DEFINE THE IAM STRATEGY POLICIES 
# Apply this at the root compartment/tenancy level depending on your architectural boundaries:

Allow dynamic-group OIC_DocGen_DG to use generative-ai-inference in tenancy
Allow dynamic-group OIC_DocGen_DG to use generative-ai-inference in compartment id ocid1.compartment.oc1..your_compartment_ocid

# 3. LOCAL CONFIG CHECK (If testing locally via API Keys)
# Verify ~/.oci/config exists and has format:
# [DEFAULT]
# user=ocid1.user.oc1..xxxx
# fingerprint=xx:xx:xx:...
# tenancy=ocid1.tenancy.oc1..xxxx
# region=us-chicago-1
# key_file=~/.oci/oci_private_key.pem
`;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-6 shadow-xl border border-slate-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="text-indigo-400" size={24} />
            <span>OCI Python Reference Code Hub</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Production-grade Python assets to run this generator self-hosted on Oracle Cloud Infrastructure (OCI).
          </p>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 select-none">
          <button
            onClick={() => setActiveTab("app")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
              activeTab === "app" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <FileCode size={14} />
            <span>app.py (Streamlit)</span>
          </button>
          <button
            onClick={() => setActiveTab("req")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
              activeTab === "req" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <Terminal size={14} />
            <span>requirements.txt</span>
          </button>
          <button
            onClick={() => setActiveTab("iam")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
              activeTab === "iam" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldAlert size={14} />
            <span>OCI IAM & Deployment</span>
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === "app" && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400">Main application script using Streamlit and OCI inference Client</span>
              <button
                onClick={() => handleCopy(appPyCode, "app")}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-slate-800/50 px-2.5 py-1.5 rounded-md border border-slate-700/60 cursor-pointer transition-all"
              >
                {copiedIndex === "app" ? <Check size={14} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedIndex === "app" ? "Copied Source!" : "Copy Python Code"}</span>
              </button>
            </div>
            <pre className="text-xs font-mono p-4 bg-slate-950 rounded-lg overflow-x-auto max-h-[480px] text-slate-300 border border-slate-800/80 leading-relaxed">
              {appPyCode}
            </pre>
          </div>
        )}

        {activeTab === "req" && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400">Required packages to run on OCI Compute / Container instance</span>
              <button
                onClick={() => handleCopy(requirementsTxt, "req")}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-slate-800/50 px-2.5 py-1.5 rounded-md border border-slate-700/60 cursor-pointer transition-all"
              >
                {copiedIndex === "req" ? <Check size={14} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedIndex === "req" ? "Copied!" : "Copy requirements.txt"}</span>
              </button>
            </div>
            <pre className="text-sm font-mono p-4 bg-slate-950 rounded-lg overflow-x-auto text-slate-300 border border-slate-800/80">
              {requirementsTxt}
            </pre>
            <div className="mt-4 p-3 bg-indigo-950/40 border border-indigo-900/50 rounded-lg text-xs leading-relaxed text-indigo-300">
              <strong>Tip:</strong> Install them on your OCI compute VM using <code>pip install -r requirements.txt</code> in a clean virtual environment.
            </div>
          </div>
        )}

        {activeTab === "iam" && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400">Policies to configure under OCI Identity & Access Management (IAM)</span>
              <button
                onClick={() => handleCopy(iamPolicies, "iam")}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-slate-800/50 px-2.5 py-1.5 rounded-md border border-slate-700/60 cursor-pointer transition-all"
              >
                {copiedIndex === "iam" ? <Check size={14} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedIndex === "iam" ? "Copied Setup!" : "Copy Policies"}</span>
              </button>
            </div>
            <pre className="text-xs font-mono p-4 bg-slate-950 rounded-lg overflow-x-auto text-slate-300 border border-slate-800/80 leading-relaxed">
              {iamPolicies}
            </pre>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <h4 className="font-semibold text-white text-sm mb-1">Compute Deployment Steps</h4>
                <ol className="text-xs text-slate-400 list-decimal pl-4 space-y-1">
                  <li>Provision an OCI Linux VM inside your Virtual Cloud Network (VCN).</li>
                  <li>Bind the VM with the Dynamic Group listed above.</li>
                  <li>Clone this script, install dependencies.</li>
                  <li>Launch: <code>streamlit run app.py --server.port 80</code></li>
                </ol>
              </div>
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <h4 className="font-semibold text-white text-sm mb-1">Container Instance Alternative</h4>
                <ol className="text-xs text-slate-400 list-decimal pl-4 space-y-1">
                  <li>Package this script inside a standard Dockerfile with port 8501 exposed.</li>
                  <li>Push container to OCI Container Registry (OCIR).</li>
                  <li>Deploy to OCI Container Instances with instance role signer enabled!</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

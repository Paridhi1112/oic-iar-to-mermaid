# OIC Artifact Technical Compiler & Visualizer

A sophisticated full-stack Web Application designed to ingest Oracle Integration Cloud (OIC) integrations—either as raw XML configurations or compressed `.iar` (Integration Archive) archives—and compile them into beautiful, enterprise-ready **Technical Design Documents (TDD)** and **Interactive Visual Diagrams**.

## 🚀 Core Features

- **Archive File Navigator**: Seamlessly uploads, unpacks, and traverses `.iar` / `.zip` OIC integration packages inside the browser.
- **Dual-Mode Document Compiler**:
  - **Generative AI Refinement**: Connects to the Gemini API to produce fully-refined, industry-standard descriptive analyses.
  - **Local Parsing Compiler fallback**: A deterministic, robust browser-based XML parser compiling structural system metadata, logical flow mappings, and structural sequence choreography completely offline and without an API key!
- **Interactive Modeling & Visual Diagrams**:
  - **System Landscape Topology**: Understand cross-system boundary adapters, incoming triggers, and outgoing invokes.
  - **Chronological Sequence Diagram**: Trace message orchestration flow timelines, callbacks, or loops step-by-step using Mermaid.js.
- **Deploy Python Hub**: Compiles your visual configurations into fully deployable pipelines, including helpful scripts to streamline orchestration processes.

---

## 💻 Local Quickstart

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional for Gemini integration)
Create a `.env` file at the root of your directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*Note: If no API key is specified, the application will automatically activate the local client-side compiler compiler to analyze your OIC files instantly.*

### 3. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 4. Build for Production
```bash
npm run build
```

---

## 📦 How to Deploy on Oracle Cloud Infrastructure (OCI) for Free

Oracle Cloud Infrastructure (OCI) offers an industry-leading **Always Free Tier** which is perfect for hosting this application permanently at zero cost.

### Option A: OCI Ampere A1 Compute Instance (Easiest)
OCI provides up to 4 Ampere A1 ARM CPUs and 24 GB of RAM completely free.

1. **Sign Up for OCI Free Tier**: Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) and create a free master cloud account.
2. **Create a VM Instance**:
   - In the OCI Console, navigate to **Compute > Instances > Create Instance**.
   - Under **Image and shape**, change the shape to **Specialty Shapes > VM.Standard.A1.Flex** (ARM Ampere). Select **1 OCPU** and **6 GB RAM** (which is well within the free tier).
   - Choose **Ubuntu** or **Oracle Linux** as your OS image.
   - Generate or upload your SSH Keys and download the private key.
3. **Configure the Ingress Security Rules**:
   - In your newly created instance, go to its Virtual Cloud Network (VCN) subnet.
   - Click **Default Security List** and click **Add Ingress Rules**.
   - Set **Source CIDR** to `0.0.0.0/0`, IP Protocol to `TCP`, and **Destination Port Range** to `80,443` (for web traffic) or port `3000` directly.
4. **Deploy the Code on VM**:
   - Connect to your VM via SSH:
     ```bash
     ssh -i your_private_key.key ubuntu@<YOUR_INSTANCE_PUBLIC_IP>
     ```
   - Install Git, Node.js, and PM2 (Process Manager):
     ```bash
     sudo apt update
     sudo apt install -y git nodejs npm
     sudo npm install -g pm2
     ```
   - Clone your project, install packages, and build:
     ```bash
     git clone <YOUR_GIT_REPOSITORY_URL>
     cd <PROJECT_DIR>
     npm install
     npm run build
     ```
   - Start the server using PM2 to keep it running 24/7:
     ```bash
     pm2 start dist/server.cjs --name "oic-visualizer"
     ```
   - (Optional) Set up nginx as a reverse-proxy to route port `80` traffic to port `3000`.

---

## 🐙 How to Push this Code to Git & GitHub

### Method A: Direct Export from Google AI Studio Workspace (Recommended)
You can connect your Google AI Studio template directly to GitHub:
1. Open the **Settings Menu** at the top right of your build workspace interface.
2. Select **Export to GitHub**.
3. Follow the user prompt authorization flow to log in to your GitHub account, designate a repository title, and commit all code assets in a single click.

### Method B: Manual Git Commands from Local Terminal
If you exported the project code as a ZIP file, unpack it on your computer and run these terminal steps:

1. **Initialize Git Repository**:
   ```bash
   git init
   ```
2. **Stage All Files**:
   ```bash
   git add .
   ```
3. **Commit Code Assets**:
   ```bash
   git commit -m "feat: initial commit of oic artifact technical visualizer"
   ```
4. **Create a GitHub Repository**:
   - Log into your account on [github.com](https://github.com).
   - Click **New** button to create a new repository. Keep it private or public. Do not check "Add a README" since we have already created one for you.
5. **Associate Remote and Push**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<your_username>/<your_repository_name>.git
   git push -u origin main
   ```

---

*Enterprise OIC Technical Design Document Visualizer © 2026.*

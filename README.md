# Diagram Studio

Diagram Studio turns a short topic or specification into a compact explanation, editable diagram source, and a rendered preview. It supports flowchart, sequence, class, state, and entity-relationship diagrams. It is a headless CLI that can be called from a project or pull request workflow when a diagram is useful.

## Quick start

Requirements: Node.js 20 or newer and an OpenAI API key.

```sh
npm install
export OPENAI_API_KEY="..."
npx diagram-studio generate "How an HTTP request reaches a web server" --type flowchart
```

PowerShell:

```powershell
$env:OPENAI_API_KEY = "..."
npx diagram-studio generate "How an HTTP request reaches a web server" --type flowchart
```

The default output directory is `outputs/<slug>/`. Each run saves a PNG preview and editable `.excalidraw` source. The CLI prints a concise explanation, quality notes, file paths, and (when a terminal preview is supported) the preview as a data URL. Set `--no-preview` for documentation-only workflows. Use `--format svg` to also save SVG instead of PNG.

To place artifacts in another project's generated-artifacts directory, use `--project-artifacts PATH`. Generated outputs are never committed or published automatically.

## Generation options

```text
diagram-studio generate <prompt> [--type flowchart|sequence|class|state|er]
  [--format png|svg] [--output PATH] [--project-artifacts PATH]
  [--no-preview] [--model MODEL]
```

Without `--type`, the model chooses one of the supported diagram types. Complex topics are requested as a simple overview with sparse labels. Generation uses the Responses API and web search when available, and returns source links where they help. Only the prompt passed to the command is sent; no surrounding conversation or project files are collected. API keys are read from `OPENAI_API_KEY` and never written to outputs.

If no API key is configured, the CLI explains how to configure it and exits without creating a misleading diagram. For deterministic or sensitive content, provide an explicit spec using `--spec PATH` instead of an external model:

```json
{
  "type": "flowchart",
  "title": "Request lifecycle",
  "explanation": "A request passes through validation before the service handles it.",
  "nodes": [
    { "id": "client", "label": "Client" },
    { "id": "validate", "label": "Validate request" },
    { "id": "service", "label": "Service" }
  ],
  "edges": [
    { "from": "client", "to": "validate" },
    { "from": "validate", "to": "service", "label": "valid" }
  ],
  "sources": [],
  "uncertainty": ""
}
```

## Renderer and quota fallback

The primary renderer is a local Excalidraw scene exporter. It does not call Excalidraw's hosted AI service, consume its AI quota, or open the editor. If a configured Excalidraw-compatible AI adapter returns an explicit HTTP 429 quota/rate-limit response, generation silently switches to Mermaid source and reports the fallback renderer in its output metadata. The core local renderer remains usable without that adapter or a paid Excalidraw plan. Mermaid fallback is selected with `--renderer mermaid`; Mermaid.ink renders the diagram source to SVG, which is saved directly or converted to PNG. Only the minimum Mermaid source is sent to that renderer, and no API key is sent. The endpoint can be self-hosted by replacing it in `renderMermaidSvg`.

All five diagram types map to node and relationship semantics in the saved source. Layout is intentionally overview-first, with a restrained color palette and compact labels. A lightweight quality check verifies required content and edges, visible label sizes, and successful image rendering. Treat model output as a draft and retry with more detail if the check reports omissions or ambiguity.

## Project and PR workflow integration

Call the CLI from any automation when a diagram would clarify a workflow, architecture, or change. Diagrams are optional. Pass only the minimum prompt or relevant specification, and point `--project-artifacts` at the requesting project's artifact directory. Do not pass whole conversations, secrets, or unrelated code.

## Development

```sh
npm install
npm run start -- generate --help
```


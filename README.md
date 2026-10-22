# Diagram Studio

Diagram Studio turns a short topic or specification into a compact explanation, editable diagram source, and a rendered preview. It supports flowchart, sequence, class, state, and entity-relationship diagrams. It is a headless CLI that can be called from a project or pull request workflow when a diagram is useful.

## Quick start

Requirements: Node.js 22 or newer, an installed Chrome, Chromium, Edge, or Firefox browser, and an OpenAI API key.

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

The default output directory is Diagram Studio's `outputs/<slug>/`, independent of the caller's current directory. Each successful run saves a PNG preview, editable renderer source, and a machine-readable `.diagram.json` specification. The CLI prints a concise explanation, quality notes, file paths, a retry invitation, and the preview as a data URL. Set `--no-preview` for documentation-only workflows. Use `--format svg` to save SVG instead of PNG.

To place artifacts in another project's generated-artifacts directory, use `--project-artifacts PATH`. Generated outputs are never committed or published automatically.

## Generation options

```text
diagram-studio generate <prompt> [--type flowchart|sequence|class|state|er]
  [--renderer auto|excalidraw|mermaid] [--format png|svg]
  [--output PATH] [--project-artifacts PATH]
  [--no-preview] [--model MODEL]
```

Without `--type`, the model chooses one of the supported diagram types. Complex topics are requested as a simple overview with sparse labels. Generation uses the Responses API and web search when available, and returns source links where they help. Only the prompt passed to the command is sent; no surrounding conversation or project files are collected. API keys are read from `OPENAI_API_KEY` and never written to outputs.

If no API key is configured, the CLI explains how to configure it and exits without creating a misleading diagram. For deterministic or sensitive content, provide an explicit spec using `--spec PATH` instead of an external model:

```json
{
  "type": "flowchart",
  "renderer": "excalidraw",
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

## Renderer selection and retry

The worker specification can set `renderer` to `excalidraw` or `mermaid`. `--renderer` overrides that field; `auto` (the default) uses the specification and defaults to Excalidraw. Excalidraw scenes are rendered headlessly by the official `@excalidraw/cli` package with an installed Chrome, Chromium, Edge, or Firefox browser. Local rendering needs no Excalidraw account or API key and does not call Excalidraw AI or use its quota. SVG output uses Diagram Studio's local SVG exporter. Generation never opens the interactive editor.

For a deliberate Mermaid retry, reuse the saved specification:

```sh
diagram-studio generate --spec outputs/request-lifecycle/request-lifecycle.diagram.json \
  --renderer mermaid --format png --output outputs/request-lifecycle
```

If Excalidraw PNG rendering fails, Diagram Studio keeps the generated `.diagram.json` specification and `.excalidraw` source and prints a retry command using that same specification with `--renderer mermaid`. This retry is explicit; the CLI does not detect AI quota exhaustion or switch renderers automatically. Mermaid.ink renders the Mermaid source to SVG when SVG is requested and PNG when PNG is requested. Only the diagram source is sent to that renderer, and no API key is sent.

All five diagram types map to node and relationship semantics in the saved source. Layout is intentionally overview-first, with a restrained color palette and compact labels. A lightweight quality check verifies required content and edges, visible label sizes, and successful image rendering. Treat model output as a draft and retry with more detail if the check reports omissions or ambiguity.

## Project and PR workflow integration

Call the CLI from any automation when a diagram would clarify a workflow, architecture, or change. Diagrams are optional. Pass only the minimum prompt or relevant specification, and point `--project-artifacts` at the requesting project's artifact directory. Do not pass whole conversations, secrets, or unrelated code.

## Development

```sh
npm install
npm run start -- generate --help
```


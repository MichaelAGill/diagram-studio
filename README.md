# Diagram Studio

Diagram Studio is a reusable headless Mermaid renderer for flowchart, sequence, class, state, and entity-relationship diagrams. The calling assistant or project worker researches the topic and supplies Mermaid source plus a concise explanation; Diagram Studio validates and renders that source.

## Quick start

Requirements: Node.js 22 or newer and network access to Mermaid.ink for rendering. No model runtime, model download, API key, account, browser, or paid service is used by Diagram Studio.

```sh
npm install
npx diagram-studio render --source request.mmd --title "Request lifecycle" \
  --explanation "A client request passes through the edge and application service."
```

PowerShell:

```powershell
npx diagram-studio render --source request.mmd --title "Request lifecycle" `
  --explanation "A client request passes through the edge and application service."
```

The default output directory is Diagram Studio's `outputs/<slug>/`, independent of the caller's current directory. Each successful run saves a PNG preview, editable renderer source, and a machine-readable `.diagram.json` specification. The CLI prints a concise explanation, quality notes, file paths, a retry invitation, and the preview as a data URL. Set `--no-preview` for documentation-only workflows. Use `--format svg` to save SVG instead of PNG.

To place artifacts in another project's generated-artifacts directory, use `--project-artifacts PATH`. Generated outputs are never committed or published automatically.

## Caller contract

```text
diagram-studio render --spec PATH [--format png|svg]
  [--output PATH] [--project-artifacts PATH] [--no-preview]
diagram-studio render --source PATH --explanation TEXT [--type TYPE]
  [--title TITLE] [--format png|svg] [--output PATH]
```

The caller supplies a JSON spec containing `type`, `title`, `explanation`, and `mermaid`, or passes a Mermaid file with `--source` and a concise `--explanation`. The caller's existing model can research the topic, choose a supported diagram type, and produce Mermaid; Diagram Studio does not make model calls. The spec may include relevant `sources` and `uncertainty` fields.

Example spec:

```json
{
  "type": "flowchart",
  "title": "Request lifecycle",
  "explanation": "A request passes through validation before the service handles it.",
  "mermaid": "flowchart LR\n  Client[Client] -->|request| Service[Service]",
  "sources": [],
  "uncertainty": ""
}
```

## Rendering and outputs

PNG is rendered by Mermaid.ink by default; `--format svg` returns SVG. The editable `.mmd`, machine-readable `.diagram.json`, and image are saved to `outputs/<slug>/` or `--project-artifacts`. Preview output is inline by default; pass `--no-preview` to suppress it. Only the caller's Mermaid source is sent to Mermaid.ink for rendering; no key, credentials, conversation history, or unrelated project files are sent. The service is free to use without an account or API key.

To retry a failed render, use the saved spec:

```sh
diagram-studio render --spec outputs/request-lifecycle/request-lifecycle.diagram.json \
  --format png --output outputs/request-lifecycle
```

The quality check verifies the declared type, detects diagram entities and relationships, checks label counts and lengths, confirms rendering, and validates the resulting PNG or SVG. Treat caller-provided Mermaid as editable source and correct any source syntax/rendering issues if the CLI reports them.

## Project and PR workflow integration

Call the CLI from any project worker when a diagram would clarify a workflow, architecture, or change. Diagrams are optional. Have the worker pass only the minimum relevant Mermaid source and explanation, and point `--project-artifacts` at the requesting project's artifact directory. Do not pass whole conversations, secrets, or unrelated code.

## Development

```sh
npm install
npm run start -- render --help
```

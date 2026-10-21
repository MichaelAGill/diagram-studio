# Diagram Studio project guide

## Scope
- This repository builds Diagram Studio, a reusable headless diagram generation CLI. Keep generated files in `outputs/` or the requesting project's artifacts directory; never commit or publish generated diagrams automatically.
- Support flowchart, sequence, class, state, and entity-relationship diagrams. Data charts are outside scope.
- Save editable Excalidraw or Mermaid source and a PNG by default; honor SVG when requested. Preview inline by default unless disabled.
- Send only the user's diagram prompt and necessary generation instructions to an external model. Never send conversation history, credentials, or unrelated project files.
- Check every generated diagram for render success, useful coverage, and readable labels.

## Delivery
- The user has standing approval to deliver requested Diagram Studio code changes directly to `main`; do not ask for this approval again. Do not create a pull request or require PR review for this repository.
- Preserve remote history; never force-push. Respect existing auto-deployment but report deployment only when a configured pipeline confirms it.
- Do not automatically commit or publish generated diagram outputs.

## Development
- Prefer Node.js built-ins and keep the CLI headless. Do not open an editor as part of generation.
- Do not add or run tests unless the user asks. Non-test build, type, and CLI checks are allowed.


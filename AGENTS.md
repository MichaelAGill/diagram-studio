# Diagram Studio project guide

## Scope
- This repository builds Diagram Studio, a reusable headless diagram generation CLI. Keep generated files in `outputs/` or the requesting project's artifacts directory; never commit or publish generated diagrams automatically.
- Support flowchart, sequence, class, state, and entity-relationship diagrams. Data charts are outside scope.
- Accept caller-supplied Mermaid source and save it with a PNG by default; honor SVG when requested. Preview inline by default unless disabled.
- Diagram Studio does not call a model. The caller's existing assistant or worker researches the topic and supplies Mermaid source plus a concise explanation.
- For Mermaid.ink rendering, send only the caller-supplied Mermaid source. Never send conversation history, credentials, or unrelated project files.
- Check every generated diagram for render success, useful coverage, and readable labels.

## Delivery
- The user always authorizes requested Diagram Studio code changes to be delivered directly to `main`; never ask for approval again. Do not create a pull request or require PR review for this repository.
- Preserve remote history; never force-push. Respect existing auto-deployment but report deployment only when a configured pipeline confirms it.
- Do not automatically commit or publish generated diagram outputs.

## Development
- Prefer Node.js built-ins and keep the CLI headless. Do not open an editor as part of generation. Mermaid.ink may be used when the local Mermaid renderer cannot launch in the current environment.
- Do not add or run tests unless the user asks. Non-test build, type, and CLI checks are allowed.

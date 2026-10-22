#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(projectDir, 'src', 'cli.mjs');
const outputRoot = path.join(projectDir, 'outputs');
const types = ['flowchart', 'sequence', 'class', 'state', 'er'];
const formats = ['png', 'svg'];

function reply(id, result, error) {
  const message = error
    ? { jsonrpc: '2.0', id, error: { code: error.code ?? -32603, message: error.message } }
    : { jsonrpc: '2.0', id, result };
  process.stdout.write(JSON.stringify(message) + '\n');
}

function toolError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function validate(args) {
  if (!args || typeof args !== 'object') throw new Error('Tool arguments are required.');
  const mermaid = args.mermaid;
  const title = args.title;
  const explanation = args.explanation;
  const type = args.type;
  const format = args.format || 'png';
  if (typeof mermaid !== 'string' || !mermaid.trim() || mermaid.length > 50000) {
    throw new Error('Provide Mermaid source of 1 to 50,000 characters.');
  }
  if (!types.includes(type)) throw new Error('Choose flowchart, sequence, class, state, or er.');
  if (typeof title !== 'string' || !title.trim() || title.length > 90) throw new Error('Provide a title up to 90 characters.');
  if (typeof explanation !== 'string' || !explanation.trim() || explanation.length > 700) {
    throw new Error('Provide a concise explanation up to 700 characters.');
  }
  if (!formats.includes(format)) throw new Error('Format must be png or svg.');
  return { mermaid, title: title.trim(), explanation: explanation.trim(), type, format, preview: args.preview !== false };
}

function runCli(args, sourcePath, outputPath) {
  const cliArgs = [
    cliPath, 'render', '--source', sourcePath,
    '--type', args.type, '--title', args.title,
    '--explanation', args.explanation, '--format', args.format,
    '--output', outputPath, '--no-preview'
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, cliArgs, { cwd: projectDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error((stderr || stdout || 'Diagram rendering failed.').trim()));
      const match = stdout.match(/\{[\s\S]*\}/);
      if (!match) return reject(new Error('Diagram Studio returned no render metadata.'));
      try { resolve(JSON.parse(match[0])); } catch { reject(new Error('Diagram Studio returned invalid render metadata.')); }
    });
  });
}

async function renderTool(rawArgs) {
  const args = validate(rawArgs);
  await fs.mkdir(outputRoot, { recursive: true });
  const slug = args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'diagram';
  const outputPath = path.join(outputRoot, slug + '-' + Date.now());
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diagram-studio-'));
  const sourcePath = path.join(tempDir, 'diagram.mmd');
  try {
    await fs.writeFile(sourcePath, args.mermaid, 'utf8');
    const metadata = await runCli(args, sourcePath, outputPath);
    const content = [{
      type: 'text',
      text: [
        args.title,
        args.explanation,
        'Quality: ' + metadata.quality + '.',
        'Rendered image: ' + metadata.image,
        'Editable Mermaid: ' + metadata.source,
        'Diagram spec: ' + metadata.specification
      ].join('\n')
    }];
    if (args.preview) {
      const image = await fs.readFile(metadata.image);
      content.push({ type: 'image', data: image.toString('base64'), mimeType: args.format === 'svg' ? 'image/svg+xml' : 'image/png' });
    }
    return { content };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

const toolDefinition = {
  name: 'render_diagram',
  description: 'Render caller-supplied Mermaid through Diagram Studio. Include only the minimum source needed; the tool saves editable source and a PNG or SVG under Diagram Studio outputs and returns a preview by default.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: types, description: 'Mermaid diagram type.' },
      title: { type: 'string', maxLength: 90 },
      explanation: { type: 'string', maxLength: 700 },
      mermaid: { type: 'string', maxLength: 50000, description: 'Caller-generated Mermaid source; Diagram Studio does not call an AI model.' },
      format: { type: 'string', enum: formats, default: 'png' },
      preview: { type: 'boolean', default: true }
    },
    required: ['type', 'title', 'explanation', 'mermaid']
  }
};

async function handle(message) {
  const id = message && message.id;
  const method = message && message.method;
  const params = (message && message.params) || {};
  if (id === undefined) return;
  if (method === 'initialize') {
    reply(id, {
      protocolVersion: params.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'diagram-studio', version: '1.0.0' }
    });
  } else if (method === 'ping') {
    reply(id, {});
  } else if (method === 'tools/list') {
    reply(id, { tools: [toolDefinition] });
  } else if (method === 'tools/call') {
    if (params.name !== toolDefinition.name) return reply(id, toolError('Unknown Diagram Studio tool.'));
    try { reply(id, await renderTool(params.arguments)); }
    catch (error) { reply(id, toolError(error.message || 'Diagram rendering failed.')); }
  } else {
    reply(id, undefined, { code: -32601, message: 'Unsupported method: ' + method });
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  for (;;) {
    const newline = input.indexOf('\n');
    if (newline < 0) break;
    const line = input.slice(0, newline).trim();
    input = input.slice(newline + 1);
    if (!line) continue;
    try {
      const request = JSON.parse(line);
      handle(request).catch(error => process.stderr.write('MCP request failed: ' + error.message + '\n'));
    } catch (error) {
      process.stderr.write('Invalid MCP request: ' + error.message + '\n');
    }
  }
});

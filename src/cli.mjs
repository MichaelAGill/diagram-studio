#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const TYPES = ['flowchart', 'sequence', 'class', 'state', 'er'];
const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log('Diagram Studio — Mermaid renderer\n\n' +
    'Usage:\n' +
    '  diagram-studio render --spec <file.json> [options]\n' +
    '  diagram-studio render --source <file.mmd> --explanation <text> [options]\n\n' +
    'Options:\n' +
    '  --spec <path>               Caller-created JSON spec with Mermaid source\n' +
    '  --source <path>             Caller-created Mermaid source file\n' +
    '  --type <' + TYPES.join('|') + '>  Diagram type (inferred when omitted)\n' +
    '  --title <text>              Diagram title (defaults to source filename)\n' +
    '  --explanation <text>        Concise caller-provided explanation\n' +
    '  --format <png|svg>          Rendered image format (default: png)\n' +
    '  --output <directory>        Output directory (default: outputs/<slug>)\n' +
    '  --project-artifacts <path>  Write into a requesting project artifact folder\n' +
    '  --no-preview                Suppress inline preview output\n' +
    '  --help                      Show this help\n');
}

function parseArgs(argv) {
  const options = { format: 'png', preview: true };
  let args = argv;
  if (args[0] === 'render') args = args.slice(1);
  for (let i = 0; i < args.length; i++) {
    const item = args[i];
    if (item === '--help' || item === '-h') options.help = true;
    else if (item === '--no-preview') options.preview = false;
    else if (['--spec', '--source', '--type', '--title', '--explanation', '--format', '--output', '--project-artifacts'].includes(item)) {
      if (!args[i + 1]) throw new Error('Missing value for ' + item);
      options[item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = args[++i];
    } else if (item.startsWith('-')) throw new Error('Unknown option: ' + item);
    else throw new Error('Unexpected argument: ' + item + '. Pass caller-created Mermaid with --source or --spec.');
  }
  if (options.help) return options;
  if (Boolean(options.spec) === Boolean(options.source)) throw new Error('Provide exactly one of --spec or --source.');
  if (options.type && !TYPES.includes(options.type)) throw new Error('Unsupported diagram type: ' + options.type);
  if (!['png', 'svg'].includes(options.format)) throw new Error('Format must be png or svg.');
  return options;
}

function cleanText(value, max = 300) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function inferType(source) {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('%%'));
  const declaration = lines.find(line => line !== '---') || '';
  if (/^(?:flowchart|graph)\s/i.test(declaration)) return 'flowchart';
  if (/^sequenceDiagram\b/i.test(declaration)) return 'sequence';
  if (/^classDiagram\b/i.test(declaration)) return 'class';
  if (/^stateDiagram(?:-v2)?\b/i.test(declaration)) return 'state';
  if (/^erDiagram\b/i.test(declaration)) return 'er';
  return '';
}

function validateSpec(raw, options) {
  const mermaid = String(raw?.mermaid || raw?.source || '');
  if (!mermaid.trim() || mermaid.length > 50000) throw new Error('Mermaid source is missing or exceeds 50,000 characters.');
  const detectedType = inferType(mermaid);
  const type = raw?.type || options.type || detectedType;
  if (!TYPES.includes(type)) throw new Error('Could not identify a supported Mermaid diagram type. Choose one of ' + TYPES.join(', ') + '.');
  if (!detectedType || detectedType !== type) throw new Error('The declared diagram type (' + type + ') does not match its Mermaid source.');
  if (options.type && options.type !== type) throw new Error('Diagram type does not match --type.');
  const title = cleanText(raw?.title || options.title || '', 90);
  const explanation = cleanText(raw?.explanation || options.explanation || '', 700);
  if (!title) throw new Error('Provide a title in the spec or with --title.');
  if (!explanation) throw new Error('Provide a concise explanation in the spec or with --explanation.');
  const sources = Array.isArray(raw?.sources) ? raw.sources.slice(0, 5).map(value => cleanText(value, 300)).filter(value => /^https:\/\//i.test(value)) : [];
  const uncertainty = cleanText(raw?.uncertainty, 300);
  return { type, title, explanation, mermaid: mermaid.trim() + '\n', sources, uncertainty, renderer: 'mermaid.ink' };
}

function analyzeDiagram(spec) {
  const nodeIds = new Set();
  let relationships = 0;
  const lines = spec.mermaid.split(/\r?\n/);
  const addEndpoints = (line, pattern, rightIndex = 2) => {
    const match = line.match(pattern);
    if (match) { nodeIds.add(match[1]); nodeIds.add(match[rightIndex]); relationships++; }
  };
  for (const line of lines) {
    if (spec.type === 'flowchart') addEndpoints(line, /^\s*([\w-]+)(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*(?:-->|---|-\.->|==>|--o|o--|--x|x--|<--)\s*(?:\|[^|]*\|\s*)?([\w-]+)/);
    else if (spec.type === 'sequence') {
      const participant = line.match(/^\s*(?:participant|actor)\s+([\w-]+)/i);
      if (participant) nodeIds.add(participant[1]);
      addEndpoints(line, /^\s*([\w-]+)\s*(?:-->>|->>|-->|->|-\)|--\))\s*([\w-]+)\s*:/);
    } else if (spec.type === 'class') {
      const klass = line.match(/^\s*class\s+([\w-]+)/i);
      if (klass) nodeIds.add(klass[1]);
      addEndpoints(line, /^\s*([\w-]+)\s+(?:<\|--|\*--|o--|-->|--|\.\.>|<\.\.)\s+([\w-]+)/);
    } else if (spec.type === 'state') {
      const state = line.match(/^\s*state\s+(?:"[^"]+"\s+as\s+)?([\w*-]+)/i);
      if (state) nodeIds.add(state[1]);
      addEndpoints(line, /^\s*(\[\*\]|[\w*-]+)\s*(?:-->|->)\s*(\[\*\]|[\w*-]+)/);
    } else {
      const entity = line.match(/^\s*([\w-]+)\s*\{/);
      if (entity) nodeIds.add(entity[1]);
      addEndpoints(line, /^\s*([\w-]+)\s+([|o{}.\-]+)\s+([\w-]+)\s*:/, 3);
    }
  }
  const labels = [];
  for (const line of lines) {
    const classDeclaration = line.match(/^\s*class\s+([\w-]+)/i);
    if (classDeclaration) labels.push(classDeclaration[1]);
    const participant = line.match(/^\s*(?:participant|actor)\s+\S+\s+as\s+(.+)$/i);
    if (participant) labels.push(participant[1].trim());
    const namedParticipant = line.match(/^\s*(?:participant|actor)\s+([\w-]+)/i);
    if (namedParticipant) labels.push(namedParticipant[1]);
    const entity = line.match(/^\s*([\w-]+)\s*\{/);
    if (entity) labels.push(entity[1]);
    for (const match of line.matchAll(/\[([^\]\n]+)\]|\(([^)\n]+)\)|\{([^}\n]+)\}|\"([^\"\n]+)\"|:\s*([^|\n]+)/g)) {
      const label = match.slice(1).find(Boolean)?.trim();
      if (label && label !== '*') labels.push(label);
    }
  }
  const uniqueLabels = [...new Set(labels)];
  const issues = [];
  if (nodeIds.size < 2) issues.push('Fewer than two labeled diagram entities were detected.');
  if (relationships < 1) issues.push('No relationship or transition was detected.');
  if (uniqueLabels.length < 2) issues.push('Fewer than two readable labels were detected.');
  if (uniqueLabels.some(label => label.length > 100)) issues.push('One or more labels exceed 100 characters.');
  if (lines.some(line => line.length > 180)) issues.push('One or more Mermaid lines exceed 180 characters.');
  return { nodeCount: nodeIds.size, relationships, labelCount: uniqueLabels.length, issues };
}

function slug(value) {
  return cleanText(value.toLowerCase(), 60).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
}

function encodeMermaidState(source) {
  const state = JSON.stringify({ code: source, mermaid: '{}', grid: true, panZoom: true, rough: false, updateDiagram: true });
  return deflateSync(Buffer.from(state, 'utf8'), { level: 9 }).toString('base64url');
}

async function renderMermaid(source, imagePath, format) {
  const packed = encodeMermaidState(source);
  const url = format === 'svg'
    ? 'https://mermaid.ink/svg/pako:' + packed + '?bgColor=F8FAFC'
    : 'https://mermaid.ink/img/pako:' + packed + '?type=png&bgColor=F8FAFC';
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(45000) }); }
  catch { throw new Error('Could not reach the Mermaid renderer. Check network access and retry.'); }
  if (!response.ok) throw new Error('Mermaid renderer failed (' + response.status + ').');
  const image = Buffer.from(await response.arrayBuffer());
  if (format === 'png') {
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!image.subarray(0, 8).equals(pngSignature) || image.length < 24) throw new Error('Mermaid renderer did not return a valid PNG image.');
    await fs.writeFile(imagePath, image);
    return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
  }
  const svg = image.toString('utf8');
  if (!svg.includes('<svg') || !svg.includes('</svg>')) throw new Error('Mermaid renderer did not return a valid SVG image.');
  await fs.writeFile(imagePath, svg);
  return null;
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(error.message); usage(); process.exitCode = 2; return; }
  if (options.help) { usage(); return; }
  try {
    let raw;
    if (options.spec) raw = JSON.parse(await fs.readFile(options.spec, 'utf8'));
    else {
      const mermaid = await fs.readFile(options.source, 'utf8');
      raw = {
        type: options.type || inferType(mermaid),
        title: options.title || path.basename(options.source, path.extname(options.source)).replace(/[-_]+/g, ' '),
        explanation: options.explanation,
        mermaid
      };
    }
    const spec = validateSpec(raw, options);
    const analysis = analyzeDiagram(spec);
    const structuralIssues = analysis.issues.filter(issue => !issue.includes('exceed 100 characters') && !issue.includes('exceed 180 characters'));
    if (structuralIssues.length) throw new Error('Quality check failed: ' + structuralIssues.join(' '));
    const directory = options.projectArtifacts || options.output || path.join(PROJECT_DIR, 'outputs', slug(spec.title));
    await fs.mkdir(directory, { recursive: true });
    const base = slug(spec.title);
    const imagePath = path.resolve(directory, base + '.' + options.format);
    const sourcePath = path.resolve(directory, base + '.mmd');
    const specPath = path.resolve(directory, base + '.diagram.json');
    await fs.writeFile(sourcePath, spec.mermaid);
    await fs.writeFile(specPath, JSON.stringify(spec, null, 2) + '\n');
    const dimensions = await renderMermaid(spec.mermaid, imagePath, options.format);
    const metadata = {
      type: spec.type, renderer: 'mermaid.ink', format: options.format,
      explanation: spec.explanation, sources: spec.sources, uncertainty: spec.uncertainty,
      specification: specPath, source: sourcePath, image: imagePath,
      ...(dimensions ? { dimensions } : {}),
      quality: analysis.issues.length ? 'needs-review' : 'passed',
      qualityNotes: analysis.issues,
      coverage: { entities: analysis.nodeCount, relationships: analysis.relationships, labels: analysis.labelCount }
    };
    console.log(JSON.stringify(metadata, null, 2));
    if (spec.uncertainty) console.log('Uncertainty: ' + spec.uncertainty);
    if (spec.sources.length) console.log('Sources: ' + spec.sources.join(' · '));
    console.log('Add details and render again for a more specific diagram.');
    if (options.preview) {
      const image = await fs.readFile(imagePath);
      const mime = options.format === 'svg' ? 'svg+xml' : 'png';
      console.log('\n![' + spec.title + '](data:image/' + mime + ';base64,' + image.toString('base64') + ')');
    }
  } catch (error) {
    console.error(error.message || String(error)); process.exitCode = 1;
  }
}

main();

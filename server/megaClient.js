import { File } from "megajs";
import { orderBy } from "natural-orderby";

const nodeMap = new Map();
const reverseMap = new Map();
const pathMap = new Map();
let sessionCounter = 0;

function buildTree(megaNode, sessionId, counter, parentPath = "") {
  const id = `${sessionId}-${counter.value++}`;
  const nodePath = parentPath
    ? `${parentPath}/${megaNode.name}`
    : megaNode.name;

  nodeMap.set(id, megaNode);
  reverseMap.set(megaNode, id);
  pathMap.set(id, parentPath);

  const entry = {
    id,
    name: megaNode.name,
    size: megaNode.size || 0,
    directory: !!megaNode.directory,
  };

  if (megaNode.directory && megaNode.children) {
    const sorted = orderBy(megaNode.children, (v) => v.name);
    entry.children = sorted.map((child) =>
      buildTree(child, sessionId, counter, nodePath),
    );
    entry.size = entry.children.reduce((sum, c) => sum + c.size, 0);
  }

  return entry;
}

export async function loadSharedLink(url) {
  const file = File.fromURL(url);
  file.api.userAgent = "mega-dl-webui/1.0";
  await file.loadAttributes();

  const sessionId = `s${++sessionCounter}`;
  const counter = { value: 0 };
  const tree = buildTree(file, sessionId, counter);
  return { sessionId, ...tree };
}

export function downloadFile(megaNode, options = {}) {
  const downloadOpts = { start: options.start || 0, forceHttps: true };
  if (options.handleRetries) downloadOpts.handleRetries = options.handleRetries;
  const stream = megaNode.download(downloadOpts);
  return { stream };
}

export function getNodeById(id) {
  return nodeMap.get(id);
}

export function getIdForNode(megaNode) {
  return reverseMap.get(megaNode) || null;
}

export function getNodePath(id) {
  return pathMap.get(id) || "";
}

export function clearSession(sessionId) {
  const prefix = `${sessionId}-`;
  for (const [id, node] of nodeMap) {
    if (id.startsWith(prefix)) {
      reverseMap.delete(node);
      nodeMap.delete(id);
      pathMap.delete(id);
    }
  }
}

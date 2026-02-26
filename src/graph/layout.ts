import type { AppNode, AppEdge } from '../types';

const NODE_DIMS: Record<string, { width: number; height: number }> = {
  billingAccount: { width: 260, height: 88 },
  project:        { width: 280, height: 132 },
  apiKey:         { width: 220, height: 84 },
  service:        { width: 200, height: 64 },
};

const RANK_GAP       = 80;   // vertical gap between parent bottom and child top
const NODE_GAP       = 40;   // horizontal gap between siblings
const TREE_GAP       = 80;   // horizontal gap between separate root trees
const ORPHAN_GAP_Y   = 120;
const ORPHAN_COLS    = 3;
const ORPHAN_COL_W   = 280;
const ORPHAN_COL_GAP = 60;
const ORPHAN_ROW_GAP = 50;

function nodeDims(node: AppNode) {
  return NODE_DIMS[node.type ?? 'project'] ?? { width: 200, height: 80 };
}

/**
 * Recursively place a subtree rooted at `id`.
 * Returns the total width consumed so the caller can tile siblings.
 * Writes final positions into `out`.
 */
function placeSubtree(
  id: string,
  startX: number,
  startY: number,
  nodeMap: Map<string, AppNode>,
  children: Map<string, string[]>,
  out: Map<string, { x: number; y: number }>,
): number {
  const node = nodeMap.get(id);
  const { width, height } = node ? nodeDims(node) : { width: 200, height: 80 };
  const kids = children.get(id) ?? [];

  if (kids.length === 0) {
    out.set(id, { x: startX, y: startY });
    return width;
  }

  // First pass: lay out children left-to-right, accumulate total width
  const childY = startY + height + RANK_GAP;
  let cx = startX;
  const childWidths: number[] = [];

  for (const kid of kids) {
    const w = placeSubtree(kid, cx, childY, nodeMap, children, out);
    childWidths.push(w);
    cx += w + NODE_GAP;
  }

  const totalChildWidth = childWidths.reduce((s, w) => s + w, 0) + NODE_GAP * (kids.length - 1);

  // Center this node over the span of its children
  const treeWidth = Math.max(width, totalChildWidth);
  const offsetToCenter = startX + (treeWidth - width) / 2;
  out.set(id, { x: offsetToCenter, y: startY });

  // If children span is narrower than this node, shift children right to re-center
  if (totalChildWidth < width) {
    const shift = (width - totalChildWidth) / 2;
    // Shift all descendants under this node
    shiftDescendants(id, shift, children, out);
  }

  return treeWidth;
}

/** Shift all descendants of `id` (not id itself) by `dx`. */
function shiftDescendants(
  id: string,
  dx: number,
  children: Map<string, string[]>,
  out: Map<string, { x: number; y: number }>,
) {
  for (const kid of children.get(id) ?? []) {
    const pos = out.get(kid);
    if (pos) out.set(kid, { x: pos.x + dx, y: pos.y });
    shiftDescendants(kid, dx, children, out);
  }
}

// ── Public ────────────────────────────────────────────────────────────────────
export function applyTreeLayout(nodes: AppNode[], edges: AppEdge[]): AppNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build parent→children map and track which nodes have a parent
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const connectedIds = new Set<string>();

  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source)!.push(e.target);
    hasParent.add(e.target);
  }

  // Roots = connected nodes with no incoming edge
  const roots = nodes.filter((n) => connectedIds.has(n.id) && !hasParent.has(n.id));
  // Orphans = nodes with no edges at all
  const orphans = nodes.filter((n) => !connectedIds.has(n.id));

  // Billing accounts first, then alphabetical for stability
  roots.sort((a, b) => {
    const ab = a.type === 'billingAccount' ? 0 : 1;
    const bb = b.type === 'billingAccount' ? 0 : 1;
    return ab - bb || a.id.localeCompare(b.id);
  });

  const positioned = new Map<string, { x: number; y: number }>();
  let cursorX = 40;
  let maxBottom = 0;

  for (const root of roots) {
    const treeWidth = placeSubtree(root.id, cursorX, 40, nodeMap, children, positioned);
    cursorX += treeWidth + TREE_GAP;
  }

  // Compute max bottom once after all trees are placed
  positioned.forEach((pos, id) => {
    const n = nodeMap.get(id);
    if (!n) return;
    maxBottom = Math.max(maxBottom, pos.y + nodeDims(n).height);
  });

  // Orphan grid below all trees
  const orphanStartY = roots.length > 0 ? maxBottom + ORPHAN_GAP_Y : 40;
  orphans.forEach((node, i) => {
    const { height } = nodeDims(node);
    const col = i % ORPHAN_COLS;
    const row = Math.floor(i / ORPHAN_COLS);
    positioned.set(node.id, {
      x: 40 + col * (ORPHAN_COL_W + ORPHAN_COL_GAP),
      y: orphanStartY + row * (height + ORPHAN_ROW_GAP),
    });
  });

  return nodes.map((n) => {
    const pos = positioned.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

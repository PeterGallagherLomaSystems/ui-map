import type { Node, Edge } from '@xyflow/react';

export type ExportNode = {
  id: string;
  type: string | undefined;
  data: Record<string, unknown>;
  xy: { x: number; y: number };
  parentIds: string[];
  childIds: string[];
};

export function serialiseMap(nodes: Node[], edges: Edge[]): ExportNode[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const parents = new Map<string, Set<string>>();
    const children = new Map<string, Set<string>>();

    // init sets
    for (const n of nodes) {
        parents.set(n.id, new Set());
        children.set(n.id, new Set());
    }

    // build relationships from edges (directed: source -> target)
    for (const e of edges) {
        const s = e.source;
        const t = e.target;
        if (nodeMap.has(s) && nodeMap.has(t)) {
            children.get(s)!.add(t);
            parents.get(t)!.add(s);
        }
    }

    // build serializable export array
    return nodes.map(n => {
        // sanitize data by JSON round-trip (drops functions, DOM, circular will throw)
        let safeData: Record<string, unknown>;
        try {
            safeData = JSON.parse(JSON.stringify(n.data ?? {}));
        } 
        catch {
            // fallback: shallow copy of enumerable props excluding functions
            safeData = {};
            for (const [k, v] of Object.entries(n.data ?? {})) {
                if (typeof v !== 'function') safeData[k] = v as unknown;
            } 
        }

        return {
            id: n.id,
            type: n.type,
            data: safeData,
            xy: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
            parentIds: Array.from(parents.get(n.id) ?? []),
            childIds: Array.from(children.get(n.id) ?? []),
        } as ExportNode;
    });
}
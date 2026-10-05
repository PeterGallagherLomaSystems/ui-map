import { useCallback, useMemo, useState, useRef, useEffect, type ChangeEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import Toolbar from './components/Toolbar'
import TitleNode from './components/TitleNode';
import SettingsNode from './components/SettingsNode';
import { serialiseMap } from './utils/serialiseMap';
import { useToast }from './components/ToastContext';

const uiMapNodes: Node[] = [
];

const uiMapEdges: Edge[] = [
];

function App() {
  const nodeTypes = useMemo(() => ({ settings: SettingsNode, title: TitleNode }), []);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const nodeHeightsRef = useRef<Record<string, number>>({});
  const layoutRef = useRef<() => void>(() => {});
  const reactFlowInstance = useRef<any | null>(null);
  const { addToast } = useToast();

  
  const [nodes, setNodes, onNodesChange] =
    useNodesState(uiMapNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(uiMapEdges);

  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const makeOnChange = useCallback(
    (nodeId: string) => (upd: Record<string, unknown>) => {
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...upd } } : n)));
    },
    [setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) => {
        const next = addEdge(connection, currentEdges);
        return next;
      });
      // schedule layout after edges update so positions update to reflect new connection
      setTimeout(() => layoutRef.current?.(), 50);
    },
    [setEdges]
  );

  // Layout using subtree sizes to avoid overlaps.
  // spacing: horizontal unit spacing per subtree unit; rowOffset: vertical distance between levels
  const spacing = 220;
  // Default vertical spacing; we'll compute per-parent based on node content height
  const rowOffset = 180;
    const baseNodeHeight = 80; // estimated height for a node with no extra rows
    const rowItemHeight = 28; // additional height per settings row
    const rowGap = 24; // vertical gap between parent bottom and child top

  const computeSubtreeSizes = (rootIds: string[]) => {
    const memo = new Map<string, number>();
    const childrenMap = new Map<string, string[]>();
    for (const e of edgesRef.current) {
      childrenMap.set(e.source, (childrenMap.get(e.source) ?? []).concat(e.target));
    }
    const getChildrenLocal = (id: string) => childrenMap.get(id) ?? [];

    const dfs = (id: string, seen = new Set<string>()): number => {
      if (memo.has(id)) return memo.get(id)!;
      if (seen.has(id)) { memo.set(id, 0); return 0; } // guard cycles
      seen.add(id);
      const kids = getChildrenLocal(id);
      if (!kids.length) { memo.set(id, 1); return 1; }
      let sum = 0;
      for (const k of kids) sum += Math.max(1, dfs(k, seen));
      memo.set(id, Math.max(1, sum));
      return memo.get(id)!;
    };

    for (const r of rootIds) dfs(r);
    return { memo, getChildrenLocal };
  };

  const layoutFromRoots = useCallback(() => {
    // build children map & subtree sizes for current graph
    const incoming = new Set(edgesRef.current.map(e => e.target));
    const roots = nodesRef.current.filter(n => !incoming.has(n.id));
    if (!nodesRef.current.length) return;
    const { memo: sizes } = computeSubtreeSizes(nodesRef.current.map(n => n.id));

    // build a global children map for traversal
    const childrenMap = new Map<string, string[]>();
    for (const e of edgesRef.current) {
      childrenMap.set(e.source, (childrenMap.get(e.source) ?? []).concat(e.target));
    }
    const getChildrenGlobal = (id: string) => childrenMap.get(id) ?? [];

    const posMap = new Map<string, { x: number; y: number }>();
    const assigned = new Set<string>();

    // helper to compute height for a node (prefer measured DOM height)
    const nodeHeight = (n: Node) => {
      const measured = nodeHeightsRef.current[n.id];
      if (typeof measured === 'number' && measured > 0) return measured;
      const rows = (n.data as any)?.rows ?? [];
      return baseNodeHeight + (Array.isArray(rows) ? rows.length * rowItemHeight : 0);
    };

    // layout each root's subtree independently to avoid cross-root influence
    for (const root of roots) {
      // collect subtree nodes and levels for this root
      const levelMapSub = new Map<string, number>();
      const queueSub: Array<{ id: string; level: number }> = [];
      levelMapSub.set(root.id, 0);
      queueSub.push({ id: root.id, level: 0 });
      const subtreeNodes: string[] = [root.id];
      while (queueSub.length) {
        const { id, level } = queueSub.shift()!;
        const kids = getChildrenGlobal(id);
        for (const k of kids) {
          if (!levelMapSub.has(k)) {
            levelMapSub.set(k, level + 1);
            queueSub.push({ id: k, level: level + 1 });
            subtreeNodes.push(k);
          }
        }
      }

      // compute max level for this subtree
      const maxLevelSub = subtreeNodes.reduce((m, id) => Math.max(m, levelMapSub.get(id) ?? 0), 0);

      // compute max heights per level inside this subtree
      const maxHeightsSub: number[] = new Array(maxLevelSub + 1).fill(0);
      for (const id of subtreeNodes) {
        const n = nodesRef.current.find(x => x.id === id)!;
        const lvl = levelMapSub.get(id) ?? 0;
        const h = nodeHeight(n);
        maxHeightsSub[lvl] = Math.max(maxHeightsSub[lvl], h);
      }

      // compute offsets per level for this subtree
      const extraLevelGap = 40;
      const offsetsSub: number[] = new Array(maxLevelSub + 1).fill(0);
      for (let i = 1; i <= maxLevelSub; i++) {
        offsetsSub[i] = offsetsSub[i - 1] + maxHeightsSub[i - 1] + rowGap + extraLevelGap;
      }

      // base Y is root's current Y (keep root where it is)
      const rootPos = root.position ?? { x: 0, y: 0 };
      posMap.set(root.id, { x: rootPos.x, y: rootPos.y });
      assigned.add(root.id);

      // position nodes level-by-level relative to root
      for (let lvl = 0; lvl < maxLevelSub; lvl++) {
        const nodesThisLevel = subtreeNodes.filter(id => (levelMapSub.get(id) ?? 0) === lvl);
        // compute Y for children (level+1)
        const childY = rootPos.y + (offsetsSub[lvl + 1] ?? (lvl + 1) * (rowOffset + extraLevelGap));

        for (const parentId of nodesThisLevel) {
          const parentNode = nodesRef.current.find(x => x.id === parentId)!;
          const parentPos = posMap.get(parentId) ?? { x: parentNode.position?.x ?? 0, y: parentNode.position?.y ?? 0 };
          const kids = getChildrenGlobal(parentId).filter(k => subtreeNodes.includes(k));
          if (!kids.length) continue;
          const kidSizes = kids.map(k => Math.max(1, sizes.get(k) ?? 1));
          const totalUnits = kidSizes.reduce((a, b) => a + b, 0);
          const startX = parentPos.x - (totalUnits * spacing) / 2;
          let cursor = 0;
          for (let i = 0; i < kids.length; i++) {
            const kid = kids[i];
            const unit = kidSizes[i];
            const centerX = startX + (cursor + unit / 2) * spacing;
            if (!assigned.has(kid)) {
              posMap.set(kid, { x: centerX, y: childY });
              assigned.add(kid);
            }
            cursor += unit;
          }
        }
      }
    }

    // apply positions
    setNodes(prev => prev.map(n => {
      const p = posMap.get(n.id);
      return p ? { ...n, position: p } : n;
    }));
  }, [setNodes]);

  const alignAll = useCallback(() => { layoutFromRoots(); }, [layoutFromRoots]);

  // expose layout function via ref so earlier callbacks can call it
  useEffect(() => {
    layoutRef.current = layoutFromRoots;
  }, [layoutFromRoots]);

  const onAddTitleScreen = useCallback(() => {
    const id = crypto?.randomUUID?.() ?? Date.now().toString();
    // place new node below the current lowest node row to avoid overlap
    const maxY = nodesRef.current.length ? nodesRef.current.reduce((m, n) => Math.max(m, n.position?.y ?? 0), 0) : 0;
    const y = maxY ? maxY + rowOffset : 100;
    setNodes((prev) => {
      const newNode: Node = {
        id,
        type: 'title',
        position: { x: 200, y },
        data: {
          title: `Screen ${prev.length + 1}`,
          onChange: makeOnChange(id),
          onHeightMeasured: (h: number) => { nodeHeightsRef.current[id] = h },
        },
      }
      return [...prev, newNode];
    });
    setTimeout(() => alignAll(), 10);
  }, [setNodes, alignAll, makeOnChange]);

  const onAddSettingsScreen = useCallback(() => {
    const id = crypto?.randomUUID?.() ?? Date.now().toString();
    // place new node below the current lowest node row to avoid overlap
    const maxY = nodesRef.current.length ? nodesRef.current.reduce((m, n) => Math.max(m, n.position?.y ?? 0), 0) : 0;
    const y = maxY ? maxY + rowOffset : 100;
    setNodes((prev => {
      const newNode: Node = {
        id,
        type: 'settings',
        position: { x: 200, y },
        data: {
          title: `Screen ${prev.length + 1}`,
          rows: [''],
          onChange: makeOnChange(id),
          onHeightMeasured: (h: number) => { nodeHeightsRef.current[id] = h },
        },
      };
      return [...prev, newNode];
    }));
    setTimeout(() => alignAll(), 10);
  }, [setNodes, alignAll, makeOnChange]);

  const removeSelectedScreen = useCallback(() => {
    if (!selectedNode) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNode));
    setEdges(prev => prev.filter(e => e.source !== selectedNode && e.target !== selectedNode));
    setSelectedNode(null);
    setTimeout(() => alignAll(), 10);
  }, [selectedNode, setNodes, setEdges, alignAll]);

  const onRemoveAllScreens = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setTimeout(() => alignAll(), 10);
  }, [setNodes, setEdges, alignAll]);

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    setSelectedNode(nodes && nodes.length ? nodes[0].id : null);
  }, []);

  const handleExport = useCallback(() => {
    const payload = serialiseMap(nodes, edges);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ui-map.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const handleImport = useCallback(async () => {
    // If there are existing nodes, ask before opening file picker
    if (nodesRef.current.length > 0) {
      const result = await addToast({
        message: 'There are currently nodes visible. Do you want to clear them before importing?',
        type: 'info',
        actions: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
      })
      if (!result) return; // user aborted
      // clear now so imported file replaces current graph
      setNodes([]);
      setEdges([]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  }, [addToast, setNodes, setEdges]);

  const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      // validate payload shape, then import:
      // 1) clear current graph: setNodes([]); setEdges([]);
      // 2) build nodes/edges from payload and call setNodes/setEdges
      console.log('Imported payload', payload);

      // Build import nodes/edges. Support two shapes:
      // - array of export nodes (from serialiseMap)
      // - object with `nodes` and `edges` arrays (React Flow format)
      const importedNodes: Node[] = [];
      const importedEdges: Edge[] = [];

      const isExportArray = Array.isArray(payload);
      const exportNodes = isExportArray ? payload : payload.nodes ?? [];

      // If we have export-style nodes (id, type, data, xy, childIds)
      for (const en of exportNodes) {
        const pos = (en.xy && typeof en.xy.x === 'number') ? { x: en.xy.x, y: en.xy.y } : (en.position ?? { x: 0, y: 0 });
        const nodeData = { ...(en.data ?? {}) } as Record<string, unknown>;

        // attach onChange for editable nodes
        nodeData.onChange = makeOnChange(en.id);
        // attach height measurement callback so layout can use real DOM heights
        nodeData.onHeightMeasured = (h: number) => { nodeHeightsRef.current[en.id] = h };
        importedNodes.push({
          id: en.id,
          type: en.type,
          position: pos,
          data: nodeData,
        } as Node);

        // children -> edges
        const children = en.childIds ?? en.children ?? [];
        for (const childId of children) {
          importedEdges.push({ id: `${en.id}->${childId}`, source: en.id, target: childId } as Edge);
        }
      }

      // fallback: if payload provided raw edges in an object
      if (!isExportArray && Array.isArray(payload.edges)) {
        for (const e of payload.edges) {
          importedEdges.push({ id: e.id ?? `${e.source}->${e.target}`, source: e.source, target: e.target } as Edge);
        }
      }

      // Apply imported graph
      if (importedNodes.length) setNodes(importedNodes);
      if (importedEdges.length) setEdges(importedEdges);

      // try to fit view after import
      setTimeout(() => reactFlowInstance.current?.fitView?.(), 50);
    } catch (err) {
      console.error('Failed to import file', err);
    } finally {
      // reset input so selecting same file later fires change
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    setTimeout(() => alignAll(), 50);
  }, [setNodes, setEdges, makeOnChange, alignAll]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
      <Toolbar 
        onAddTitleScreen={onAddTitleScreen} 
        onAddSettingsScreen={onAddSettingsScreen} 
        onRemoveScreen={removeSelectedScreen} 
        onRemoveAllScreens={onRemoveAllScreens} 
        selectedNode={selectedNode} 
        onExport={handleExport} 
        onImport={handleImport} />
      <div style={{ flex: 1 }}>
        <ReactFlow
          onInit={(ins) => (reactFlowInstance.current = ins)}
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          fitView
          style={{ width: '100%', height: '100%' }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import './TitleNode.css';

export default function TitleNode(props: { id: string; data: { title?: string; onChange?: (p:{title:string})=>void; onHeightMeasured?: (h:number) => void } }) {
  const { data } = props;
  const [title, setTitle] = useState(data.title ?? '');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => data.onHeightMeasured?.(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // keep local state in sync when React Flow updates node.data
  useEffect(() => {
    setTitle(data.title ?? '');
    }, [data.title]);

  // notify parent of changes
  const notify = (newTitle: string) => {
    data.onChange?.({ title: newTitle});
  };

  // update title and notify parent
  const updateTitle = (v: string) => {
    setTitle(v);
    notify(v);
  };

  return (
    <div ref={rootRef} className="title-node">
      <Handle type="target" position={Position.Top} id="in" />
      <div>
        <label>Page</label>
      </div>
      <input
        className="title-node-title"
        value={title}
        onChange={(e) => updateTitle(e.target.value)} 
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDownCapture={(e) => e.stopPropagation()}
      />
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  );
}
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Handle, Position } from '@xyflow/react'
import './SettingsNode.css';

// Data type for the settings node
type Data = {
    title?: string;
    rows?: string[];
    onChange?: (payload: { title: string; rows: string[] }) => void;
};

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

// Settings node component
export default function SettingsNode(props: { id: string; data: Data & { onHeightMeasured?: (h: number) => void }; }) {
    const { data } = props;
    const [title, setTitle] = useState(data.title ?? '');
    const [rows, setRows] = useState<string[]>(
        data.rows && data.rows.length ? data.rows : ['']);

    const rootRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const measure = () => {
            const h = el.offsetHeight;
            data.onHeightMeasured?.(h);
        };
        measure();
        // observe size changes
        const ro = new ResizeObserver(() => measure());
        ro.observe(el);
        return () => ro.disconnect();
    }, [data]);

    // keep local state in sync when React Flow updates node.data
    useEffect(() => {
        setTitle(data.title ?? '');
        setRows(data.rows && data.rows.length ? data.rows : ['']);
    }, [data.title, data.rows]);

    // notify parent of changes
    const notify = (newTitle: string, newRows: string[]) => {
        data.onChange?.({ title: newTitle, rows: newRows });
    };

    // update title and notify parent
    const updateTitle = (v: string) => {
        setTitle(v);
        notify(v, rows);
    };

    // update a specific row and notify parent
    const updateRow = (idx: number, value: string) => {
        const next = rows.map((r, i) => (i === idx ? value : r));
        setRows(next);
        notify(title, next);
    };

    // add a new row and notify parent
    const addRow = () => {
        const next = [...rows, ''];
        setRows(next);
        notify(title, next);
    };

    // remove a specific row and notify parent
    const removeRow = (idx: number) => {
        const next = rows.filter((_, i) => i !== idx);
        const final = next.length ? next : [''];
        setRows(final);
        notify(title, final);
    };

    // render the settings node UI
    return (
        <div ref={rootRef} className="settings-node">
            <Handle type="target" position={Position.Top} id="in"/>
            <div>
                <label>Settings</label>
            </div>
            <input 
                className="settings-node-title" 
                value={title} 
                onChange={(e) => updateTitle(e.target.value)} 
                onPointerDown={stop}
                onMouseDownCapture={stop}
                placeholder="Title" 
            />

            <table className="settings-node-table">
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            <td>
                                <input
                                    className="settings-node-input"
                                    value={r}
                                    onChange={(e) => updateRow(i, e.target.value)}
                                    onPointerDown={stop}
                                    onMouseDownCapture={stop}
                                    placeholder="Value"
                                />
                            </td>
                            <td>
                                <button
                                    type="button"
                                    className="settings-node-remove"
                                    onPointerDown={stop}
                                    onMouseDownCapture={stop}
                                    onClick={() => removeRow(i)}
                                >
                                x
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="settings-node-actions">
                <button type="button" 
                    onClick={addRow} 
                    onPointerDown={stop}
                    onMouseDownCapture={stop}>
                    + Add row
                </button>
            </div>
            <Handle type="source" position={Position.Bottom} id="out"/>
        </div>
    )
}
import type { ReactNode, MouseEventHandler } from 'react';
import './ToolbarButton.css';

function ToolbarButton({ children, onClick, disabled }: { children: ReactNode, onClick: MouseEventHandler<HTMLButtonElement>, disabled?: boolean | undefined }) {
    return (
        <button className="toolbar-button" onClick={onClick} disabled={disabled}>
            {children}
        </button>
    );
}

function ToolbarButtonFile({ children, onImport, disabled }: { children: ReactNode, onImport: MouseEventHandler<HTMLButtonElement>, disabled?: boolean | undefined }) {
    return (
        <button className="toolbar-button" onClick={onImport} disabled={disabled}>
            {children}
        </button>
    );
}

export { ToolbarButton, ToolbarButtonFile };
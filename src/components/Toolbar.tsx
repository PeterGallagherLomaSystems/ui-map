import ScreenList from './Screen-list';
import './Toolbar.css';
import { ToolbarButton, ToolbarButtonFile } from './ToolbarButton';

function Toolbar({onAddTitleScreen, onAddSettingsScreen, onRemoveScreen, onRemoveAllScreens, selectedNode, onExport, onImport }: 
    {onAddTitleScreen: () => void, onAddSettingsScreen: () => void, onRemoveScreen: () => void, onRemoveAllScreens: () => void, selectedNode: string | null, onExport: () => void, onImport: () => void})
{
    return (
        <div className="toolbar">
            <div>
                <h3>Toolbar</h3>
            </div>
            <div>
                <ToolbarButton onClick={onAddTitleScreen}>Add Title Screen</ToolbarButton>
            </div>
            <div>
                <ToolbarButton onClick={onAddSettingsScreen}>Add Settings Screen</ToolbarButton>
            </div>
            <div>
                <ToolbarButton onClick={onRemoveScreen} disabled={!selectedNode}>Remove Selected Screen</ToolbarButton>
            </div>
            <div>
                <ToolbarButton onClick={onRemoveAllScreens} >Remove All Screens</ToolbarButton>
            </div>
            <div>
                <label>---------------------------------</label>
            </div>
            <div>
                <ToolbarButtonFile onImport={onImport}>
                    Import Graph
                </ToolbarButtonFile>
            </div>
            <div>
                <ToolbarButton onClick={onExport}>
                    Export Graph
                </ToolbarButton>
            </div>
            <ScreenList />
        </div>
    );
}

export default Toolbar;
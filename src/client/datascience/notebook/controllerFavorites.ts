import { inject, injectable } from 'inversify';
import { QuickPickItem, ThemeIcon } from 'vscode';
import { IExtensionSyncActivationService } from '../../activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../common/application/types';
import { disposeAllDisposables } from '../../common/helpers';
import { IDisposable, IDisposableRegistry, IPersistentState, IPersistentStateFactory } from '../../common/types';
import { JupyterNotebookView } from './constants';
import { INotebookControllerManager } from './types';
import { VSCodeNotebookController } from './vscodeNotebookController';

@injectable()
export class NotebookControllerFavorites implements IExtensionSyncActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    private readonly workspaceState: IPersistentState<string[]>;
    private readonly globalState: IPersistentState<string[]>;
    constructor(@inject(ICommandManager) private readonly commandManager: ICommandManager,
    @inject(IDisposableRegistry) disposables :IDisposableRegistry,
    @inject(INotebookControllerManager) private readonly controllers :INotebookControllerManager,
    @inject(IPersistentStateFactory) private readonly stateFactory :IPersistentStateFactory,
    @inject(IApplicationShell) private readonly appShell :IApplicationShell,
    @inject(IWorkspaceService) private readonly workspace :IWorkspaceService
){
        disposables.push(this);
        this.globalState = this.stateFactory.createGlobalPersistentState<string[]>('HIDDEN-GLOBALLY', []);
        this.workspaceState = this.stateFactory.createGlobalPersistentState<string[]>('HIDDEN-WORKSPACE', []);
    }
    activate(): void {
        this.disposables.push(this.commandManager.registerCommand('jupyter.manageKernels', this.onManageFavoriteKernels, this));
    }
    public dispose(){
        disposeAllDisposables(this.disposables);
    }

    private onManageFavoriteKernels(){
        const controllers = this.controllers.registeredNotebookControllers();
        type QuickPickType = QuickPickItem & {controller: VSCodeNotebookController, default:boolean};
        const nbControllers = controllers.filter(item =>item.controller.notebookType === JupyterNotebookView);
        const quickPick = this.appShell.createQuickPick<QuickPickType>();
        const hiddenKernels = this.getKernelsToBeHidden();
        function createQuickPickItems(controllers: VSCodeNotebookController[], favorite?: VSCodeNotebookController){
            return controllers.map(item => {
                const label = item === favorite ? `$(star) ${item.label}` : item.label;
                const add = {
                    iconPath: new ThemeIcon('star-full'),
                    tooltip: 'Select as default controller'
                };
                const up = {
                    iconPath: new ThemeIcon('arrow-up'),
                    tooltip: 'Move up'
                };
                const down = {
                    iconPath: new ThemeIcon('arrow-down'),
                    tooltip: 'Move down'
                };
                return <QuickPickType>{
                    label,
                    picked: !hiddenKernels.has(item.id),
                    description: '(last used 2hrs ago)',
                    detail: item.controller.detail,
                    controller: item,
                    buttons: item === favorite ? [up, down] : [add, up, down],
                    default: item === favorite
                };
            });    
        }
        const items = createQuickPickItems(nbControllers);
        quickPick.canSelectMany = true;
        quickPick.activeItems = items;
        quickPick.items = items;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        quickPick.sortByLabel = true;
        quickPick.selectedItems = items.filter(item => item.picked);
        quickPick.placeholder = 'Unselect items you wish to hide from the kernel picker';
        quickPick.show();
        quickPick.onDidTriggerItemButton(item => {            
            item.item.label = `$(star) ${item.item.label}`;
            quickPick.items = createQuickPickItems(quickPick.items.map(item => item.controller), item.item.controller);
            quickPick.selectedItems = quickPick.items.filter(item => item.picked);
        });
        quickPick.onDidAccept(() => {
            quickPick.hide();
            const selectedItems = new Set(quickPick.selectedItems.map(item =>item.controller));
            const defaultItem = quickPick.selectedItems.find(item => item.default);
            if (defaultItem){
                defaultItem.controller.label = `$(star-full) ${defaultItem.controller.label}`;
            }
            const hiddenItems = items.map(item => item.controller).filter(item => !selectedItems.has(item));
            hiddenItems.map(item => item.dispose());
            this.updateSelection(hiddenItems);
        });
    }

    private getKernelsToBeHidden(){
        if (this.workspace.workspaceFolders?.length){
            return new Set(this.workspaceState.value);
        }
        return new Set(this.globalState.value);
    }
    private async updateSelection(itemsToHide: VSCodeNotebookController[]){
        if (this.workspace.workspaceFolders?.length){
            void this.workspaceState.updateValue(itemsToHide.map(item=> item.id))
        } else {
            void this.globalState.updateValue(itemsToHide.map(item=> item.id))
        }
    }
}


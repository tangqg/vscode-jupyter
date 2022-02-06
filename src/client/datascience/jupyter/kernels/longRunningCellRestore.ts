// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IAnyMessageArgs } from '@jupyterlab/services/lib/kernel/kernel';
import type { IIOPubMessage, IOPubMessageType } from '@jupyterlab/services/lib/kernel/messages';
import { inject, injectable, named } from 'inversify';
import { Memento, NotebookDocument } from 'vscode';
import { IExtensionSyncActivationService } from '../../../activation/types';
import { GLOBAL_MEMENTO, IMemento } from '../../../common/types';
import { INotebookControllerManager } from '../../notebook/types';
import { VSCodeNotebookController } from '../../notebook/vscodeNotebookController';
import { IKernel, IKernelProvider } from './types';

@injectable()
export class LongRunningCellRestore implements IExtensionSyncActivationService {
    private readonly lastExecutedCellInfo = new Map<
        string,
        { cellIndex: number; executionId: string; kernelId: string }
    >();
    // private readonly notebookUrisSeenInThisSession = new Map<string, string>();
    constructor(
        @inject(IKernelProvider) private readonly kernelProvider: IKernelProvider,
        @inject(INotebookControllerManager) private readonly controllers: INotebookControllerManager,
        // @inject(IVSCodeNotebook) private readonly notebooks: IVSCodeNotebook,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private readonly memento: Memento
    ) {}
    activate(): void {
        this.kernelProvider.onDidStartKernel((kernel) => this.startMonitoringKernel(kernel));
        this.controllers.onNotebookControllerSelected(this.onDidSelectNotebookController, this);
        // this.notebooks.onDidOpenNotebookDocument(this.onDidOpenNotebookDocument, this);
    }
    // private onDidOpenNotebookDocument(notebook: NotebookDocument) {
    //     const info = this.notebookUrisSeenInThisSession.get(notebook.uri.toString());
    //     if (!info) {
    //         return;
    //     }
    //     const controller = this.controllers.getSelectedNotebookController(notebook);
    //     if (!controller || controller.connection.id !== info) {
    //         return;
    //     }
    //     const kernel =
    // }

    private onDidSelectNotebookController(e: { notebook: NotebookDocument; controller: VSCodeNotebookController }) {
        if (e.controller.connection.kind !== 'connectToLiveKernel') {
            return;
        }
        // const lastExecutedCellInfo = this.lastExecutedCellInfo.get(e.notebook.uri.toString());
        const lastExecutedCellInfo:
            | { cellIndex: number; executionId: string; kernelId: string }
            | undefined = this.memento.get(`LONG:${e.notebook.uri.toString()}`);
        const kernel = this.kernelProvider.get(e.notebook);
        if (
            !lastExecutedCellInfo ||
            lastExecutedCellInfo.kernelId !== e.controller.connection.kernelModel.id ||
            !kernel
        ) {
            return;
        }
        if (lastExecutedCellInfo.cellIndex >= e.notebook.cellCount) {
            return;
        }
        const cell = e.notebook.cellAt(lastExecutedCellInfo.cellIndex);
        void kernel.resumeExecution(cell);
    }
    private startMonitoringKernel(kernel: IKernel) {
        if (
            !kernel.session?.kernel ||
            (kernel.kernelConnectionMetadata.kind !== 'connectToLiveKernel' &&
                kernel.kernelConnectionMetadata.kind !== 'startUsingRemoteKernelSpec')
        ) {
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

        kernel.session.kernel.iopubMessage.connect((_sender, message) => {
            this.handlIOPubMessage(jupyterLab, kernel, message);
        }, this);
        kernel.session.kernel.anyMessage.connect((_sender, message) => {
            this.handlAnyMessage(jupyterLab, kernel, message);
        }, this);
    }
    private handlIOPubMessage(
        jupyterLab: typeof import('@jupyterlab/services'),
        kernel: IKernel,
        message: IIOPubMessage<IOPubMessageType>
    ) {
        if (!jupyterLab.KernelMessage.isExecuteInputMsg(message)) {
            return;
        }
        console.log(message);
        console.log(kernel);
    }
    private handlAnyMessage(
        _jupyterLab: typeof import('@jupyterlab/services'),
        kernel: IKernel,
        message: IAnyMessageArgs
    ) {
        if (message.direction !== 'send') {
            return;
        }
        if (message.msg.channel !== 'shell' || message.msg.header.msg_type !== 'execute_request') {
            return;
        }
        const executionId = message.msg.header.msg_id;
        const cellId = message.msg.metadata.cellId;
        if (typeof cellId !== 'string') {
            return;
        }
        const cell = kernel.notebookDocument.getCells().find((cell) => cell.document.uri.toString() === cellId);
        if (!cell) {
            return;
        }
        const kernelId = kernel.session?.kernel?.model.id;
        if (!kernelId) {
            return;
        }
        // this.notebookUrisSeenInThisSession.set(
        //     kernel.notebookDocument.uri.toString(),
        //     kernel.kernelConnectionMetadata.id
        // );
        this.lastExecutedCellInfo.set(kernel.notebookDocument.uri.toString(), {
            cellIndex: cell.index,
            executionId,
            kernelId
        });
        void this.memento.update(`LONG:${kernel.notebookDocument.uri.toString()}`, {
            cellIndex: cell.index,
            executionId,
            kernelId
        });
        console.log(cell);
        console.log(message);
        console.log(kernel);
    }
}

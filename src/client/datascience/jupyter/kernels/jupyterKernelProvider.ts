import { Kernel, ServerConnection } from '@jupyterlab/services';
import {
    IInfoReply,
    ShellMessageType,
    IShellMessage,
    ControlMessageType,
    IControlMessage,
    IInfoReplyMsg,
    ICompleteReplyMsg,
    IInspectReplyMsg,
    IHistoryRequestRange,
    IHistoryRequestSearch,
    IHistoryRequestTail,
    IHistoryReplyMsg,
    IExecuteRequestMsg,
    IExecuteReplyMsg,
    IDebugRequestMsg,
    IDebugReplyMsg,
    IIsCompleteReplyMsg,
    ICommInfoReplyMsg,
    IReplyErrorContent,
    IReplyAbortContent,
    IInputReply,
    ICommOpenMsg,
    IIOPubMessage,
    IOPubMessageType,
    IMessage,
    MessageType
} from '@jupyterlab/services/lib/kernel/messages';
import { ISpecModel } from '@jupyterlab/services/lib/kernelspec/restapi';
import { JSONObject } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';
import { NotebookDocument } from 'vscode';
import { KernelSocketInformation } from '../../types';
import { IKernel } from './types';

export class JupyterKernelProvider {
    public async getKernelConnection(notebook: NotebookDocument): Promise<Kernel.IKernelConnection> {}
}

export class KernelWrapper implements Kernel.IKernelConnection {
    constructor(private readonly kernel: IKernel, private readonly kernelSocketInfo: KernelSocketInformation) {}
    public get id(): string {
        return this.kernelSocketInfo.options.id;
    }
    public get name(): string {
        return this.kernelSocketInfo.options.model.name;
    }
    get model(): Kernel.IModel {
        return this.kernelSocketInfo.options.model;
    }
    get username(): string {
        return this.kernelSocketInfo.options.userName;
    }
    get clientId(): string {
        return this.kernelSocketInfo.options.clientId;
    }
    get status(): Kernel.Status {
        return this.kernel.status;
    }
    get connectionStatus(): Kernel.ConnectionStatus {
        return 'connected';
    }
    get info(): Promise<IInfoReply> {
        const info = this.kernel.info;
        if (info?.status === 'ok') {
            return Promise.resolve(info);
        }
        throw new Error('Kernel not ready');
    }
    get spec(): Promise<ISpecModel | undefined> {
        switch (this.kernel.kernelConnectionMetadata.kind) {
            case 'startUsingPythonInterpreter':
            case 'startUsingRemoteKernelSpec':
            case 'startUsingLocalKernelSpec': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const spec: ISpecModel = { ...this.kernel.kernelConnectionMetadata.kernelSpec, resources: {} } as any;
                return Promise.resolve(spec);
            }
            case 'connectToLiveKernel': {
                this.kernel.kernelConnectionMetadata.kernelModel.display_name;
                const spec: ISpecModel = {
                    ...this.kernel.kernelConnectionMetadata.kernelModel,
                    resources: {}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any;
                return Promise.resolve(spec);
            }
        }
    }
    public handleComms: boolean = true;
    sendShellMessage<T extends ShellMessageType>(
        msg: IShellMessage<T>,
        expectReply?: boolean,
        disposeOnDone?: boolean
    ): Kernel.IShellFuture<IShellMessage<T>, IShellMessage<ShellMessageType>> {
        throw new Error('Method not implemented.');
    }
    sendControlMessage<T extends ControlMessageType>(
        msg: IControlMessage<T>,
        expectReply?: boolean,
        disposeOnDone?: boolean
    ): Kernel.IControlFuture<IControlMessage<T>, IControlMessage<ControlMessageType>> {
        throw new Error('Method not implemented.');
    }
    reconnect(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    interrupt(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async restart(): Promise<void> {
        // commands.execute(Commands.NotebookEditorRestartKernel, {)
    }
    requestKernelInfo(): Promise<IInfoReplyMsg | undefined> {
        return this.kernel.session!.requestKernelInfo();
    }
    requestComplete(content: { code: string; cursor_pos: number }): Promise<ICompleteReplyMsg> {
        return this.kernel.session!.requestComplete(content);
    }
    requestInspect(content: { code: string; cursor_pos: number; detail_level: 0 | 1 }): Promise<IInspectReplyMsg> {
        return this.kernel.session!.requestInspect(content);
    }
    requestHistory(
        content: IHistoryRequestRange | IHistoryRequestSearch | IHistoryRequestTail
    ): Promise<IHistoryReplyMsg> {
        throw new Error('Method not implemented.');
    }
    requestExecute(
        content: {
            code: string;
            silent?: boolean | undefined;
            store_history?: boolean | undefined;
            user_expressions?: JSONObject | undefined;
            allow_stdin?: boolean | undefined;
            stop_on_error?: boolean | undefined;
        },
        disposeOnDone?: boolean,
        metadata?: JSONObject
    ): Kernel.IShellFuture<IExecuteRequestMsg, IExecuteReplyMsg> {
        return this.kernel.session!.requestExecute(content, disposeOnDone, metadata);
    }
    requestDebug(
        content: { seq: number; type: 'request'; command: string; arguments?: any },
        disposeOnDone?: boolean
    ): Kernel.IControlFuture<IDebugRequestMsg, IDebugReplyMsg> {
        return this.kernel.session!.requestDebug(content, disposeOnDone);
    }
    requestIsComplete(content: { code: string }): Promise<IIsCompleteReplyMsg> {
        throw new Error('Method not implemented.');
    }
    requestCommInfo(content: { target_name?: string | undefined }): Promise<ICommInfoReplyMsg> {
        throw new Error('Method not implemented.');
    }
    sendInputReply(content: IReplyErrorContent | IReplyAbortContent | IInputReply): void {
        throw new Error('Method not implemented.');
    }
    createComm(targetName: string, commId?: string): Kernel.IComm {
        throw new Error('Method not implemented.');
    }
    hasComm(commId: string): boolean {
        throw new Error('Method not implemented.');
    }
    registerCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: ICommOpenMsg<'iopub' | 'shell'>) => void | PromiseLike<void>
    ): void {
        return this.kernel.session!.registerCommTarget(targetName, callback);
    }
    removeCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: ICommOpenMsg<'iopub' | 'shell'>) => void | PromiseLike<void>
    ): void {
        throw new Error('Method not implemented.');
    }
    registerMessageHook(
        msgId: string,
        hook: (msg: IIOPubMessage<IOPubMessageType>) => boolean | PromiseLike<boolean>
    ): void {
        return this.kernel.session!.registerMessageHook(msgId, hook);
    }
    removeMessageHook(
        msgId: string,
        hook: (msg: IIOPubMessage<IOPubMessageType>) => boolean | PromiseLike<boolean>
    ): void {
        return this.kernel.session!.removeMessageHook(msgId, hook);
    }
    statusChanged: ISignal<this, Kernel.Status>;
    connectionStatusChanged: ISignal<this, Kernel.ConnectionStatus>;
    iopubMessage: ISignal<this, IIOPubMessage<IOPubMessageType>>;
    unhandledMessage: ISignal<this, IMessage<MessageType>>;
    anyMessage: ISignal<this, Kernel.IAnyMessageArgs>;
    serverSettings: ServerConnection.ISettings;
    shutdown(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    clone(
        options?: Pick<Kernel.IKernelConnection.IOptions, 'clientId' | 'username' | 'handleComms'>
    ): Kernel.IKernelConnection {
        throw new Error('Method not implemented.');
    }
    disposed: ISignal<this, void>;
    get isDisposed(): boolean {
        return this.kernel.disposed;
    }
    dispose(): void {
        void this.kernel.dispose();
    }
}

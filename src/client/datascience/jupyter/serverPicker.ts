// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { isNil } from 'lodash';
import { QuickPickItem, Uri } from 'vscode';
import { IClipboard } from '../../common/application/types';
import { DataScience } from '../../common/utils/localize';
import {
    IMultiStepInput,
    IMultiStepInputFactory,
    InputFlowAction,
    InputStep,
    IQuickPickParameters
} from '../../common/utils/multiStepInput';
import { captureTelemetry } from '../../telemetry';
import { Identifiers, Settings, Telemetry } from '../constants';
import {
    IJupyterServerUriStorage,
    IJupyterUriProvider,
    IJupyterUriProviderRegistration,
    JupyterServerUriHandle
} from '../types';

const defaultUri = 'https://hostname:8080/?token=849d61a414abafab97bc4aab1f3547755ddc232c2b8cb7fe';

interface ISelectUriQuickPickItem extends QuickPickItem {
    newChoice: boolean;
    provider?: IJupyterUriProvider;
    url?: string;
}

type SelectedServer = {
    providerId?: string;
    uri?: string;
    selection?: 'remote' | 'local';
};
@injectable()
export class JupyterServerPicker {
    private readonly localLabel = `$(zap) ${DataScience.jupyterSelectURILocalLabel()}`;
    private readonly newLabel = `$(server) ${DataScience.jupyterSelectURINewLabel()}`;
    private readonly remoteLabel = `$(server) ${DataScience.jupyterSelectURIRemoteLabel()}`;
    constructor(
        @inject(IClipboard) private readonly clipboard: IClipboard,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IJupyterUriProviderRegistration)
        private extraUriProviders: IJupyterUriProviderRegistration,
        @inject(IJupyterServerUriStorage) private readonly serverUriStorage: IJupyterServerUriStorage
    ) {}

    @captureTelemetry(Telemetry.SelectJupyterURI)
    public async selectJupyterURI(
        allowLocal: boolean
    ): Promise<
        | {
              providerId: string;
              uri: string;
              selection: 'remote';
          }
        | {
              selection: 'local';
          }
        | undefined
    > {
        const multiStep = this.multiStepFactory.create<SelectedServer>();
        // tslint:disable-next-line: no-any
        const state: SelectedServer = {} as any;
        await multiStep.run(this.startSelectingURI.bind(this, allowLocal), state);
        switch (state.selection) {
            case 'remote': {
                return {
                    providerId: state.providerId!,
                    selection: 'remote',
                    uri: state.uri!
                };
            }
            case 'local': {
                return {
                    selection: 'local'
                };
            }
            default:
                return;
        }
    }

    private async startSelectingURI(
        allowLocal: boolean,
        input: IMultiStepInput<SelectedServer>,
        state: SelectedServer
    ): Promise<InputStep<SelectedServer> | void> {
        // First step, show a quick pick to choose either the remote or the local.
        // newChoice element will be set if the user picked 'enter a new server'

        // Get the list of items and show what the current value is
        const items = await this.getUriPickList(allowLocal);
        const uri = await this.serverUriStorage.getUri();
        const activeItem = items.find(
            (i) => i.url === uri || (i.label === this.localLabel && uri === Settings.JupyterServerLocalLaunch)
        );
        const currentValue =
            uri === Settings.JupyterServerLocalLaunch ? DataScience.jupyterSelectURILocalLabel() : activeItem?.label;
        const placeholder = currentValue // This will show at the top (current value really)
            ? DataScience.jupyterSelectURIQuickPickCurrent().format(currentValue)
            : DataScience.jupyterSelectURIQuickPickPlaceholder();

        const item = await input.showQuickPick<ISelectUriQuickPickItem, IQuickPickParameters<ISelectUriQuickPickItem>>({
            placeholder,
            items: await this.getUriPickList(allowLocal),
            activeItem,
            title: allowLocal
                ? DataScience.jupyterSelectURIQuickPickTitle()
                : DataScience.jupyterSelectURIQuickPickTitleRemoteOnly()
        });
        if (item.label === this.localLabel) {
            state.selection = 'local';
        } else if (!item.newChoice && !item.provider) {
            state.uri = item.url;
            state.selection = 'remote';
        } else if (!item.provider) {
            return this.selectRemoteURI.bind(this);
        } else {
            return this.selectProviderURI.bind(this, item.provider, item);
        }
    }

    private async selectProviderURI(
        provider: IJupyterUriProvider,
        item: ISelectUriQuickPickItem,
        _input: IMultiStepInput<SelectedServer>,
        state: SelectedServer
    ): Promise<InputStep<SelectedServer> | void> {
        const result = await provider.handleQuickPick(item, true);
        if (result === 'back') {
            throw InputFlowAction.back;
        }
        if (result) {
            const uri = this.generateUriFromRemoteProvider(provider.id, result);
            state.providerId = provider.id;
            state.uri = uri;
            state.selection = 'remote';
        }
    }

    private generateUriFromRemoteProvider(id: string, result: JupyterServerUriHandle) {
        // tslint:disable-next-line: no-http-string
        return `${Identifiers.REMOTE_URI}?${Identifiers.REMOTE_URI_ID_PARAM}=${id}&${
            Identifiers.REMOTE_URI_HANDLE_PARAM
        }=${encodeURI(result)}`;
    }

    private async selectRemoteURI(
        input: IMultiStepInput<SelectedServer>,
        state: SelectedServer
    ): Promise<InputStep<SelectedServer> | void> {
        let initialValue = defaultUri;
        try {
            const text = await this.clipboard.readText().catch(() => '');
            const parsedUri = Uri.parse(text.trim(), true);
            // Only display http/https uris.
            initialValue = text && parsedUri && parsedUri.scheme.toLowerCase().startsWith('http') ? text : defaultUri;
        } catch {
            // We can ignore errors.
        }
        // Ask the user to enter a URI to connect to.
        const uri = await input.showInputBox({
            title: DataScience.jupyterSelectURIPrompt(),
            value: initialValue || defaultUri,
            validate: this.validateSelectJupyterURI,
            prompt: ''
        });

        if (uri) {
            state.selection = 'remote';
            state.uri = uri;
        }
    }

    private validateSelectJupyterURI = async (inputText: string): Promise<string | undefined> => {
        try {
            // tslint:disable-next-line:no-unused-expression
            new URL(inputText);

            // Double check http
            if (!inputText.toLowerCase().includes('http')) {
                throw new Error('Has to be http');
            }
        } catch {
            return DataScience.jupyterSelectURIInvalidURI();
        }
    };

    private async getUriPickList(allowLocal: boolean): Promise<ISelectUriQuickPickItem[]> {
        // Ask our providers to stick on items
        let providerItems: ISelectUriQuickPickItem[] = [];
        const providers = await this.extraUriProviders.getProviders();
        if (providers) {
            providers.forEach((p) => {
                const newproviderItems = p.getQuickPickEntryItems().map((i) => {
                    return { ...i, newChoice: false, provider: p };
                });
                providerItems = providerItems.concat(newproviderItems);
            });
        }

        // Always have 'local' and 'add new'
        let items: ISelectUriQuickPickItem[] = [];
        if (allowLocal) {
            items.push({ label: this.localLabel, detail: DataScience.jupyterSelectURILocalDetail(), newChoice: false });
            items = items.concat(providerItems);
            items.push({ label: this.newLabel, detail: DataScience.jupyterSelectURINewDetail(), newChoice: true });
        } else {
            items = items.concat(providerItems);
            items.push({
                label: this.remoteLabel,
                detail: DataScience.jupyterSelectURIRemoteDetail(),
                newChoice: true
            });
        }

        // Get our list of recent server connections and display that as well
        const savedURIList = await this.serverUriStorage.getSavedUriList();
        savedURIList.forEach((uriItem) => {
            if (uriItem.uri) {
                const uriDate = new Date(uriItem.time);
                items.push({
                    label: !isNil(uriItem.displayName) ? uriItem.displayName : uriItem.uri,
                    detail: DataScience.jupyterSelectURIMRUDetail().format(uriDate.toLocaleString()),
                    newChoice: false,
                    url: uriItem.uri
                });
            }
        });

        return items;
    }
}
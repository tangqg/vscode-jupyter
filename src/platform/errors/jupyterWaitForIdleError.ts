// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { DataScience } from '../../platform/common/utils/localize';
import { sendTelemetryEvent } from '../../platform/telemetry';
import { Telemetry } from '../../datascience-ui/common/constants';
import { KernelConnectionMetadata } from '../../kernels/types';
import { BaseKernelError } from './types';

export class JupyterWaitForIdleError extends BaseKernelError {
    constructor(kernelConnectionMetadata: KernelConnectionMetadata) {
        super('timeout', DataScience.jupyterLaunchTimedOut(), kernelConnectionMetadata);
        sendTelemetryEvent(Telemetry.SessionIdleTimeout);
    }
}
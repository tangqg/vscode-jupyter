// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const esbuild = require('esbuild');
const path = require('path');
const outDir = path.join(__dirname, '..', '..', 'out', 'ipywidgets', 'dist');
const tsConfig = path.join(__dirname, 'tsconfig.json');
const entryPoint = path.join(__dirname, 'src', 'index.ts');
const common = require('../../build/webpack/common');
const constants = require('../../build/constants');
const version = require(path.join(__dirname, 'node_modules', '@jupyter-widgets', 'jupyterlab-manager', 'package.json'))
    .version;
// Any build on the CI is considered production mode.
const isProdBuild = constants.isCI || process.argv.includes('--mode');

esbuild
    .build({
        outfile: path.join(outDir, 'ipywidgets.js'),
        publicPath: 'built/',
        platform: 'browser',
        entryPoints: [entryPoint],
        loader: { '.svg': 'file', '.eot': 'file', '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
        bundle: true,
        tsconfig: tsConfig,
        minify: isProdBuild,
        logLevel: 'error',
        define: { this: 'undefined' },
        format: 'esm'
    })
    .catch(() => process.exit(1));

#! /usr/bin/env node

'use strict';

const path = require('path');
const cfork = require('cfork');
const proxy = require('../');
const argv = process.argv;
const proxyPort = getArg('--proxy') || 9229;
const debugPort = getArg('--debug');
const silent = getArg('--silent') === 'true';
const refork = getArg('--refork') !== 'false';
const useHttp = getArg('--http') === 'true';
let jsFile = getArg('--file') || argv[argv.length - 1];

if (!path.isAbsolute(jsFile)) {
  jsFile = path.resolve(process.cwd(), jsFile);
}

// prevent cfork print epipe error
/* istanbul ignore next */
process.on('uncaughtException', err => {
  if (err.code !== 'EPIPE') {
    console.error(err);
  }
});

// hack to make cfork start with debugPort
if (debugPort) {
  process.debugPort = debugPort - 1;
}

// fork js
cfork({
  exec: jsFile,
  execArgv: [ '--inspect' ],
  silent,
  count: 1,
  refork,
}).on('fork', worker => {
  const debugPort = worker.process.spawnargs
    .find(arg => arg.startsWith('--inspect'))
    .match(/\d+/)[0];

  proxy(proxyPort, debugPort)
    .then(({ httpUrl, chromeUrl }) => {
      console.log(`\nproxy url: ${useHttp ? httpUrl : chromeUrl}\n`);
    });
});

function getArg(arg) {
  const key = `${arg}=`;
  const result = argv.find(item => item.startsWith(key));
  if (result) {
    return result.substring(key.length);
  }
}

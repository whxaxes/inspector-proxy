'use strict';

const path = require('path');
const exec = require('child_process').exec;
const co = require('co');
const proxy = require('../');
const WebSocket = require('ws');
const assert = require('assert');
const proxyPort = 9229;

function createServer(port) {
  const server = path.resolve(__dirname, './server.js');
  const proc = exec(`node ${server}${port ? ' --port=' + port : ''}`);
  return new Promise((resolve, reject) => {
    proc.stdout.once('data', port => {
      resolve({ process: proc, port: +port.trim() });
    });
    proc.stderr.once('data', reject);
    setTimeout(() => {
      reject('time out');
    }, 2000);
  });
}

describe('test/index.test.js', () => {
  let data;
  afterEach(function* () {
    data.process.kill();
  });

  it('should work correctly', function* () {
    data = yield createServer();
    const info = yield proxy(proxyPort, data.port);
    assert(info.httpUrl.includes(`127.0.0.1:${proxyPort}/__ws_proxy__`));
    assert(info.chromeUrl.includes(`127.0.0.1:${proxyPort}/__ws_proxy__`));
  });

  it('should work correctly with mock ws', function* () {
    data = yield createServer();
    const info = yield proxy(proxyPort, data.port);
    const wsUrl = info.chromeUrl.substring(info.chromeUrl.indexOf('ws=') + 3);
    const ws = new WebSocket(`ws://${wsUrl}`);
    ws.on('open', () => ws.send('test'));
    yield new Promise(resolve => ws.once('message', resolve));
  });

  it('should not handle with other ws', function* () {
    data = yield createServer();
    yield proxy(proxyPort, data.port);
    const ws = new WebSocket(`ws://127.0.0.1:${proxyPort}/111`);
    yield Promise.race([
      new Promise(resolve => ws.on('error', resolve)),
      new Promise(resolve => ws.on('close', resolve)),
    ]);
  });

  it('should retry when server unavailable', function* () {
    const port = 9860;

    const result = yield {
      p: proxy(proxyPort, port),
      c: new Promise((resolve, reject) => {
        setTimeout(() => {
          createServer(port).then(resolve, reject);
        }, 100);
      }),
    };

    const info = result.p;
    data = result.c;
    assert(info.httpUrl.includes(`127.0.0.1:${proxyPort}/__ws_proxy__`));
    assert(info.chromeUrl.includes(`127.0.0.1:${proxyPort}/__ws_proxy__`));
  });

  it('should throw error while retry over times', function* () {
    yield proxy(proxyPort, 6666).catch(e =>
      assert(e.message === 'fetch inspect json failed')
    );
  });
});

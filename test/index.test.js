'use strict';

const InterceptorProxy = require('../');
const WebSocket = require('ws');
const assert = require('assert');
const utils = require('./utils');
const proxyPort = 9229;
const proxy = new InterceptorProxy({ port: proxyPort });

describe('test/index.test.js', () => {
  let data;
  afterEach(function* () {
    proxy.end();
    data.process.kill();
  });

  it('should work correctly', function* () {
    data = yield utils.createServer();
    yield proxy.start({ debugPort: data.port });
    assert(proxy.url.includes(`127.0.0.1:${proxyPort}/__ws_proxy__`));
  });

  it('should throw error while no proxy port', done => {
    try {
      new InterceptorProxy();
    } catch (e) {
      done();
    }
  });

  it('should work correctly with mock ws', function* () {
    data = yield utils.createServer();
    yield proxy.start({ debugPort: data.port });
    const wsUrl = proxy.url.substring(proxy.url.indexOf('ws=') + 3);
    const ws = new WebSocket(`ws://${wsUrl}`);
    ws.on('open', () => ws.send('test'));
    yield new Promise(resolve => ws.once('message', resolve));
  });

  it('should not handle with other ws', function* () {
    data = yield utils.createServer();
    yield proxy.start({ debugPort: data.port });
    const ws = new WebSocket(`ws://127.0.0.1:${proxyPort}/111`);
    yield new Promise(resolve => ws.on('error', resolve));
  });

  it('should start multi proxy without error', function* () {
    data = yield utils.createServer();
    const s2 = yield utils.createServer();
    const p2 = new InterceptorProxy({ port: 9117 });
    yield proxy.start({ debugPort: data.port });
    yield p2.start({ debugPort: s2.port });

    const wsUrl = proxy.url.substring(proxy.url.indexOf('ws=') + 3);
    const ws = new WebSocket(`ws://${wsUrl}`);
    ws.on('open', () => ws.send('test'));

    const wsUrl2 = p2.url.substring(p2.url.indexOf('ws=') + 3);
    const ws2 = new WebSocket(`ws://${wsUrl2}`);
    ws2.on('open', () => ws2.send('test'));

    yield [
      new Promise(resolve => ws.once('message', resolve)),
      new Promise(resolve => ws2.once('message', resolve)),
    ];

    p2.end();
    s2.process.kill();
  });

  it('should retry when server unavailable', function* () {
    const debugPort = 9860;
    yield {
      p: proxy.start({ debugPort }),
      c: new Promise((resolve, reject) => {
        setTimeout(() => {
          utils.createServer(debugPort).then(resolve, reject);
        }, 100);
      }),
    };
  });
});

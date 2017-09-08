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

  it('should work correctly with mock ws', done => {
    co(function* () {
      data = yield createServer();
      const info = yield proxy(proxyPort, data.port);
      const wsUrl = info.chromeUrl.substring(info.chromeUrl.indexOf('ws=') + 3);
      const ws = new WebSocket(`ws://${wsUrl}`);
      ws.on('open', () => {
        ws.send('test');
      });
      ws.once('message', data => {
        assert(data === '111');
        done();
      });
    }).catch(done);
  });

  it('should not handle with other ws', done => {
    co(function* () {
      data = yield createServer();
      yield proxy(proxyPort, data.port);
      const ws = new WebSocket(`ws://127.0.0.1:${proxyPort}/111`);
      ws.on('error', () => { done(); });
    }).catch(done);
  });

  it('should retry when server unavailable', done => {
    co(function* () {
      const port = 9860;

      proxy(proxyPort, port).then(info => {
        assert(info.httpUrl.includes(`127.0.0.1:${proxyPort}/__ws_proxy__`));
        assert(info.chromeUrl.includes(`127.0.0.1:${proxyPort}/__ws_proxy__`));
        done();
      }).catch(done);

      setTimeout(() => {
        createServer(port)
          .then(json => {
            data = json;
          })
          .catch(done);
      }, 0);
    }).catch(done);
  });

  it('should throw error while retry over times', done => {
    co(function* () {
      proxy(proxyPort, 6666)
        .catch(e => {
          assert(e.message === 'fetch inspect json failed');
          done();
        });
    }).catch(done);
  });
});

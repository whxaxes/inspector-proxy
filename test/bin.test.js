'use strict';

const spawn = require('cross-spawn');
const inspectFile = require.resolve('./server2.js');
const WebSocket = require('ws');
const assert = require('assert');
const urllib = require('urllib');
const coffee = require('coffee');
const utils = require('./utils');
const version = require('../package').version;

describe('test/bin.test.js', () => {
  const bin = require.resolve('../bin/bin.js');
  let proc;

  afterEach(() => {
    proc.kill();
  });

  it('should work correctly', done => {
    proc = spawn(bin, [ `--file=${inspectFile}`, '--silent=true' ]);
    proc.stdout.on('data', data => {
      if (data.toString().includes('127.0.0.1:9229/__ws_proxy__')) {
        done();
      }
    });
    proc.stderr.on('data', data => {
      console.log(data.toString());
    });
  });

  it('should show help', done => {
    coffee.fork(bin, [ '-h' ])
      .expect(/Usage: inspector-proxy/)
      .expect(/Options/)
      .end(done);
  });

  it('should show version', done => {
    coffee.fork(bin, [ '-v' ])
      .expect(version)
      .end(done);
  });

  it('should work correctly without appointing file', function* () {
    proc = spawn(bin, [ '--proxy=9228' ]);
    let serverProc;
    utils.createServer(5858).then(({ process }) => {
      serverProc = process;
    });

    let str = '';
    yield new Promise(resolve => {
      proc.stdout.on('data', data => {
        str += data.toString();
        if (data.toString().includes('127.0.0.1:9228/__ws_proxy__')) {
          serverProc.kill();
          resolve();
        }
      });
    });

    assert(str.includes('5858 opened'));
  });

  it('should appoint port by argv', done => {
    proc = spawn(bin, [
      '--proxy=9228',
      '--debug=9888',
      '--silent=true',
      './test/server2.js',
    ]);

    proc.stderr.on('data', data => {
      assert(data.includes('127.0.0.1:9888/'));
    });

    proc.stdout.on('data', data => {
      if (data.toString().includes('127.0.0.1:9228/__ws_proxy__')) {
        const ws = new WebSocket('ws://127.0.0.1:9228/__ws_proxy__');
        ws.on('open', done);
        ws.on('error', done);
      }
    });
  });

  it('should restart inspect process while it was killed', function* () {
    proc = spawn(bin, [ '--proxy=9228', '--debug=9888', inspectFile ]);

    // cfork ready
    const forkReady = () => new Promise(resolve =>
      proc.stdout.on('data', data => {
        const content = data.toString();
        if (content.includes('127.0.0.1:9228/__ws_proxy__')) {
          proc.stdout.removeAllListeners('data');
          setTimeout(resolve, 1000);
        }
      })
    );

    // start inspect server
    yield forkReady();

    // kill server
    const json = yield urllib.request('http://127.0.0.1:7001/');
    process.kill(json.data.toString());

    // restart server
    yield forkReady();
  });
});

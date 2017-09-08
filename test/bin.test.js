'use strict';

const spawn = require('child_process').spawn;
const inspectFile = require.resolve('./server2.js');
const WebSocket = require('ws');
const assert = require('assert');

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
      assert(data.toString().includes('127.0.0.1:9228/__ws_proxy__'));
      const ws = new WebSocket('ws://127.0.0.1:9228/__ws_proxy__');
      ws.on('open', done);
      ws.on('error', done);
    });
  });
});

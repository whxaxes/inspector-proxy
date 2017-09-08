'use strict';

const spawn = require('child_process').spawn;
const inspectFile = require.resolve('./server2.js');
const WebSocket = require('ws');
const co = require('co');
const urllib = require('urllib');
const assert = require('assert');
const puppeteer = require('puppeteer');

describe('test/bin.test.js', () => {
  const bin = require.resolve('../bin/bin.js');
  let proc;

  afterEach(() => {
    proc.kill();
  });

  it('should work correctly', done => {
    proc = spawn(bin, [ `--file=${inspectFile}`, '--silent=true' ]);
    proc.stdout.on('data', data => {
      assert(data.toString().includes('127.0.0.1:9229/__ws_proxy__'));
      done();
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

  it('should work with chrome correctly', done => {
    co(function* () {
      const browser = yield puppeteer.launch();
      proc = spawn(bin, [ '--proxy=9228', '--debug=9888', '--http=true', inspectFile ]);
      // cfork ready
      const forkReady = () => new Promise(resolve =>
        proc.stdout.on('data', data => {
          const content = data.toString();
          if (content.includes('https://')) {
            proc.stdout.removeAllListeners('data');
            resolve(content.substring(content.indexOf('https://')));
          }
        })
      );
      // debugger attached
      const debugAttach = () => new Promise(resolve => {
        proc.stderr.on('data', data => {
          if (data.toString().includes('Debugger attached')) {
            proc.stderr.removeAllListeners('data');
            resolve();
          }
        });
      });

      // get http url
      const httpUrl = yield forkReady();

      // create page
      const page = yield browser.newPage();

      // open debug url && first attach
      yield [ debugAttach(), page.goto(httpUrl) ];

      // kill server
      const json = yield urllib.request('http://127.0.0.1:7001/');
      process.kill(json.data.toString());

      // refork ready
      yield forkReady();

      // reload page & second attach
      yield [ debugAttach(), page.reload() ];

      done();
    }).catch(done);
  });
});

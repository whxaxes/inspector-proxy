'use strict';

const TCPProxy = require('tcp-proxy.js');
const urllib = require('urllib');
const co = require('co');
const EventEmitter = require('events').EventEmitter;
const evt = new EventEmitter();
const KEY = '__ws_proxy__';
const proxy = new TCPProxy();
let timeout;
let inspectInfo;
let attached = false;

module.exports = ({ proxyPort, debugPort }) =>
  co(function* () {
    watchingInspect(debugPort);

    // wait for inspectInfo
    yield new Promise(resolve =>
      evt.once('attached', resolve)
    );

    yield proxy.createProxy({
      port: proxyPort,
      forwardPort: debugPort,
      interceptor: {
        client(chunk) {
          if (
            !inspectInfo ||
            chunk[0] !== 0x47 || // G
            chunk[1] !== 0x45 || // E
            chunk[2] !== 0x54 || // T
            chunk[3] !== 0x20 // space
          ) {
            return;
          }

          const content = chunk.toString();

          // replace key to websocket id
          if (content.includes(KEY)) {
            return content.replace(KEY, inspectInfo.id);
          }
        },
      },
    });

    proxy.once('close', () => {
      clearTimeout(timeout);
    });

    return {
      evt,
      proxy,
      url: `chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:${proxyPort}/${KEY}`,
    };
  });

function watchingInspect(debugPort, delay = 0) {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    urllib
      .request(`http://127.0.0.1:${debugPort}/json`, {
        dataType: 'json',
      })
      .then(({ data }) => {
        if (!attached) {
          console.log(`attached debug port ${debugPort}`);
        }

        attached = true;
        evt.emit('attached', inspectInfo = data[0]);
        watchingInspect(debugPort, 1000);
      })
      .catch(() => {
        if (attached) {
          console.log(`${debugPort} closed`);
        }

        attached = false;
        watchingInspect(debugPort, 1000);
      });
  }, delay);
}

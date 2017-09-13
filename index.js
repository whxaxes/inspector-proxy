'use strict';

const TCPProxy = require('tcp-proxy.js');
const urllib = require('urllib');
const co = require('co');
const assert = require('assert');
const EventEmitter = require('events').EventEmitter;
const KEY = '__ws_proxy__';
const linkPrefix = 'chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:';

module.exports = class InterceptorProxy extends EventEmitter {
  constructor(options = {}) {
    super();
    const port = options.port;
    assert(port, 'proxy port is needed!');
    this.timeout;
    this.silent = !!options.silent;
    this.attached = false;
    this.inspectInfo = null;
    this.proxyPort = port;
    this.proxy = new TCPProxy({ port });
    this.url = `${linkPrefix}${port}/${KEY}`;
    this.proxy.on('close', () => {
      clearTimeout(this.timeout);
    });
  }

  start({ debugPort }) {
    this.debugPort = debugPort;
    return co.call(this, function* () {
      yield this.end();

      this.watchingInspect();

      // wait for inspectInfo
      yield new Promise(resolve =>
        this.once('attached', resolve)
      );

      yield this.proxy.createProxy({
        forwardPort: this.debugPort,
        interceptor: {
          client: chunk => {
            if (
              !this.inspectInfo ||
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
              return content.replace(KEY, this.inspectInfo.id);
            }
          },
        },
      });
    });
  }

  end() {
    return this.proxy.end();
  }

  log(info) {
    if (!this.silent) {
      console.log(info);
    }
  }

  watchingInspect(delay = 0) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      urllib
        .request(`http://127.0.0.1:${this.debugPort}/json`, {
          dataType: 'json',
        })
        .then(({ data }) => {
          this.attach(data && data[0]);
        })
        .catch(e => {
          this.detach(e);
        });
    }, delay);
  }

  attach(data) {
    if (!this.attached) {
      this.log(`${this.debugPort} opened`);
    }

    this.attached = true;
    this.emit('attached', this.inspectInfo = data);
    this.watchingInspect(1000);
  }

  detach(e) {
    if (e.code === 'HPE_INVALID_CONSTANT') {
      // old debugger protocol, it's not http response
      return this.attach();
    }

    if (this.attached) {
      this.emit('detached');
      this.log(`${this.debugPort} closed`);
    }

    this.attached = false;
    this.watchingInspect(1000);
  }
};

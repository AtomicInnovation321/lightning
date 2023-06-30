const {deepStrictEqual} = require('node:assert').strict;
const EventEmitter = require('node:events');
const {strictEqual} = require('node:assert').strict;
const test = require('node:test');

const {subscribeToPeers} = require('./../../../lnd_methods');

const makeLnd = overrides => {
  const data = {
    pub_key: Buffer.alloc(33, 3).toString('hex'),
    type: 'PEER_ONLINE',
  };

  Object.keys(overrides).forEach(k => data[k] = overrides[k]);

  return {
    default: {
      subscribePeerEvents: ({}) => {
        const emitter = new EventEmitter();

        emitter.cancel = () => {};

        if (overrides.data === undefined) {
          process.nextTick(() => emitter.emit('data', data));
        } else {
          process.nextTick(() => emitter.emit('data', overrides.data));
        }

        return emitter;
      },
    },
  };
};

const tests = [
  {
    args: {
      lnd: {
        default: {
          subscribePeerEvents: ({}) => {
            const emitter = new EventEmitter();

            emitter.cancel = () => {};

            process.nextTick(() => emitter.emit('error', 'err'));

            return emitter;
          },
        },
      },
    },
    description: 'Errors are returned',
    error: 'err',
  },
  {
    args: {
      lnd: {
        default: {
          subscribePeerEvents: ({}) => {
            const emitter = new EventEmitter();

            emitter.cancel = () => {};

            process.nextTick(() => emitter.emit('error', {
              details: 'Cancelled on client',
            }));

            return emitter;
          },
        },
      },
    },
    description: 'Errors are returned',
    error: {details: 'Cancelled on client'},
  },
  {
    args: {lnd: makeLnd({data: null})},
    description: 'A peer is expected',
    error: new Error('ExpectedPeerInPeerEventData'),
  },
  {
    args: {lnd: makeLnd({pub_key: undefined})},
    description: 'A public key is expected',
    error: new Error('ExpectedPeerPublicKeyInPeerEventData'),
  },
  {
    args: {lnd: makeLnd({})},
    description: 'Peer event emitted',
    expected: {public_key: Buffer.alloc(33, 3).toString('hex')},
  },
  {
    args: {lnd: makeLnd({type: 'PEER_OFFLINE'})},
    description: 'Peer disconnect event emitted',
    expected: {public_key: Buffer.alloc(33, 3).toString('hex')},
  },
  {
    args: {lnd: makeLnd({type: 'UNKNOWN_TYPE'})},
    description: 'Unknown event emitted',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, (t, end) => {
    try {
      subscribeToPeers({});
    } catch (err) {
      deepStrictEqual(
        err,
        new Error('ExpectedAuthenticatedLndToSubscribeToPeers'), 'Needs lnd');
    }

    const sub = subscribeToPeers(args);

    if (!!error) {
      sub.once('error', err => {
        deepStrictEqual(err, error, 'Got expected error');

        subscribeToPeers(args);

        process.nextTick(() => {
          sub.removeAllListeners();

          return end();
        });
      });
    } else {
      if (!expected) {
        return end();
      }

      sub.once('connected', peer => {
        strictEqual(peer.public_key, expected.public_key, 'Connected peer');

        return end();
      });

      sub.once('disconnected', peer => {
        strictEqual(peer.public_key, expected.public_key, 'Got disconnected');

        return end();
      });
    }

    return;
  });
});

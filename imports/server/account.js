import { Universal } from '@aeternity/aepp-sdk';

let _account;
let callbacks = [];

export async function account() {
  if (_account) {
    return _account;
  }

  return new Promise((resolve, reject) => {
    const done = (err, result) => {
      if (err) {
        reject(err);
      }
      resolve(result);
      callbacks = callbacks.filter(i => i !== done);
    };
    callbacks.push(done);
  });
}

Meteor.startup(async () => {
  _account = await Universal({
    url: Meteor.settings.public.nodeUrl,
    internalUrl: Meteor.settings.public.nodeInternalUrl,
    networkId: Meteor.settings.public.networkId,
    keypair: {
      publicKey: process.env.PUBLIC_KEY,
      secretKey: process.env.SECRET_KEY
    }
  });
  console.log(`Initialized account with address: ${await _account.address()}`);
  console.log(`Current balance ${await _account.balance(await _account.address())}`);
  callbacks.forEach(cb => cb(null, _account))
});
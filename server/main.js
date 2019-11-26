import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { account } from '/imports/server/account';
import { Channel } from '@aeternity/aepp-sdk';
import fs from 'fs';

const videoMeta = {
  'video.mp4': {
    duration: 37
  },
  'video2.mp4': {
    duration: 19
  },
  'video3.mp4': {
    duration: 9
  },
  'video4.mp4': {
    duration: 43
  },
  'video5.mp4': {
    duration: 41
  },
  'video6.mp4': {
    duration: 48
  },
};

const activeChannels = {};

Meteor.methods({
  async createChannel(publicKey, initialDeposit) {
    const acc = await account();
    const sharedParams = {
      url: Meteor.settings.public.channelUrl,
      initiatorId: await acc.address(),
      responderId: publicKey,
      pushAmount: 0,
      initiatorAmount: 0.005e18,
      responderAmount: initialDeposit,
      channelReserve: 0,
      ttl: 100,
      host: 'localhost',
      port: 3333,
      lockPeriod: 10,
      minimumDepth: 0
    };

    const channel = await Channel({
      ...sharedParams,
      role: 'initiator',
      sign(tag, tx) {
        return acc.signTransaction(tx);
      }
    });

    channel.on('statusChanged', (status) => {
      console.log(status);
      if (status === 'open') {
        activeChannels[channel.id()] = {
          params: sharedParams,
          channel,
        };
      }
    });

    return sharedParams;
  },

  async reconnectChannel(publicKey, channelId, round) {
    const acc = await account();
    const channel = await Channel.reconnect({
      url: Meteor.settings.public.channelUrl,
      sign(tag, tx) {
        return acc.signTransaction(tx);
      }
    }, {
      channelId,
      round,
      role: 'initiator',
      pubkey: await acc.address()
    });
    activeChannels[channelId] = {
      params: {
        initiatorId: await acc.address(),
        responderId: publicKey
      },
      channel,
    };
  }
});

WebApp.connectHandlers.use('/stream', (req, res) => {
  const file = Assets.absoluteFilePath(req.query.file);
  const { params, channel } = activeChannels[req.query.channelId] || {};
  if (!channel) {
    res.status = 501;
    return res.end();
  }

  fs.stat(file, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.status = 404;
        return res.end();
      }
      return res.end(err);
    }

    const range = req.headers.range;
    if (!range) {
      res.status = 416;
      return res.end();
    }

    const streamLen = Math.floor((stats.size / videoMeta[req.query.file]['duration']) * 1); // 1 second
    // const streamLen = 500000;
    const positions = range.replace(/bytes=/, '').split('-');
    const start = parseInt(positions[0], 10);
    const total = stats.size;
    const end1 = positions[1] ? parseInt(positions[1], 10) : total - 1;
    const end2 = start + streamLen;
    const end = end1 < end2 ? end1 : end2;
    // const end = end1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    });

    const stream = fs.createReadStream(file, { start, end })
      .on('open', () => {
        // if (start <= (streamLen * 3)) {
        //   return stream.pipe(res);
        // }

        const bytesPerSec = stats.size / videoMeta[req.query.file]['duration'];
        const amount = Math.floor(((chunksize / bytesPerSec) * 0.016) * 1e18);

        channel.update(
          params.responderId,
          params.initiatorId,
          amount.toString(),
          async (tx) => (await account()).signTransaction(tx)
        ).then(({ accepted }) => {
            if (accepted) {
              stream.pipe(res);
            }
          })
          .catch((err) => console.log(err) || res.end(err));
      })
      .on('error', (err) => res.end(err));
  });
});
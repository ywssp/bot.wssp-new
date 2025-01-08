'use strict';

import { Listener } from '@sapphire/framework';
import type { Client } from 'discord.js';

import { getFreeClientID, setToken } from 'play-dl';

import http from 'http';

import LRU from 'lru-cache';
import { Duration } from 'luxon';

import { innertubeSetup } from '../functions/music-utilities/innertubeSetup';

export class ReadyListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, {
      ...options,
      once: true,
      event: 'ready'
    });
  }

  public async run(client: Client) {
    // Setup the HTTP server if the CREATE_HTTP_SERVER env variable is set to true
    if (process.env.CREATE_HTTP_SERVER === 'true') {
      const port = 3000;

      const server = http.createServer();
      server.listen(port, () => {
        this.container.logger.info(
          `Successfully created HTTP server on port ${port}! Ping the URL to keep the bot alive!`
        );
      });

      server.on('request', (req, res) => {
        const pingedDate = new Date();
        res.write(`Bot Pinged! Currently ${pingedDate}`);
        res.end();
      });
    }

    // Setup the SoundCloud client ID
    getFreeClientID().then((id) => {
      setToken({
        soundcloud: {
          client_id: id
        }
      });
    });

    await innertubeSetup();

    // Setup the guild music data map
    this.container.guildMusicDataMap = new Map();

    // Setup the caches
    const ttlDuration = Duration.fromObject({ days: 7 }).as('milliseconds');

    this.container.caches = {
      youtubeTracks: new LRU({
        max: 100,
        ttl: ttlDuration,
        ttlResolution: ttlDuration / 7
      }),
      ytMusicTracks: new LRU({
        max: 100,
        ttl: ttlDuration,
        ttlResolution: ttlDuration / 7
      }),
      soundcloudTracks: new LRU({
        max: 100,
        ttl: ttlDuration,
        ttlResolution: ttlDuration / 7
      }),
      spotifyTracks: new LRU({
        max: 100,
        ttl: ttlDuration,
        ttlResolution: ttlDuration / 7
      }),
      tetrioUserInfos: new LRU({
        max: 50
      }),
      tetrioUserRecords: new LRU({
        max: 50
      })
    };

    this.container.radioWebsockets = {
      kpop: {
        connection: null,
        heartbeat: null,
        lastUpdate: null,
        firstUpdate: true,
        guildIdSet: new Set()
      },
      jpop: {
        connection: null,
        heartbeat: null,
        lastUpdate: null,
        firstUpdate: true,
        guildIdSet: new Set()
      }
    };

    // Log the bot's start time
    const now = new Date();

    this.container.logger.info(
      `${client.user?.tag} has started in ${now.toUTCString()}`
    );
  }
}

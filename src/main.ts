'use strict';

// Install source-map-support for easier debugging
import { LogLevel, SapphireClient } from '@sapphire/framework';

import * as source_map_support from 'source-map-support';

import '@sapphire/plugin-hmr';
// eslint-disable-next-line import/no-unresolved
import '@sapphire/plugin-logger/register';

import { GatewayIntentBits } from 'discord.js';

import 'dotenv/config';

import LRU from 'lru-cache';
import type WebSocket from 'ws';
// eslint-disable-next-line import/no-unresolved
import { Innertube } from 'youtubei.js';

import { TetrioUserInfo, TetrioUserRecords } from './interfaces/APIs/TetrioAPI';
import { GuildMusicData } from './interfaces/Music/GuildMusicData/GuildMusicData';
import {
  CachedAdaptedTrackInfo,
  CachedTrackInfo
} from './interfaces/Music/Queue System/TrackInfo';
import { RadioStationNames } from './interfaces/Music/Radio/AvailableRadioStations';
import { RadioWebsocketUpdate } from './interfaces/Music/Radio/RadioWebsocketUpdate';

source_map_support.install();

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ],
  hmr: {
    enabled: process.env.HOT_RELOAD === 'true'
  },
  logger: {
    level: process.env.DEBUG ? LogLevel.Debug : LogLevel.Info
  }
});

client.login(process.env.BOT_TOKEN);

declare module '@sapphire/framework' {
  interface Preconditions {
    InVoiceChannel: never;
    IsPlaying: never;
    OwnerOnly: never;
    HasGuildMusicData: never;
  }
}

declare module '@sapphire/pieces' {
  interface Container {
    guildMusicDataMap: Map<string, GuildMusicData>;
    caches: {
      youtubeTracks: LRU<string, CachedTrackInfo>;
      soundcloudTracks: LRU<string, CachedTrackInfo>;
      ytMusicTracks: LRU<string, CachedTrackInfo>;
      spotifyTracks: LRU<string, CachedAdaptedTrackInfo>;
      tetrioUserInfos: LRU<string, TetrioUserInfo>;
      tetrioUserRecords: LRU<string, TetrioUserRecords>;
    };
    radioWebsockets: Record<
      RadioStationNames,
      {
        connection: WebSocket | null;
        firstUpdate: boolean;
        heartbeat: NodeJS.Timeout | null;
        lastUpdate: Exclude<RadioWebsocketUpdate, { op: 0 | 10 }>['d'] | null;
        guildIdSet: Set<string>;
      }
    >;
    innertube: Innertube;
  }
}

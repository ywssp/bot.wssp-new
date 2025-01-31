'use strict';

import { container } from '@sapphire/framework';

import { DateTime } from 'luxon';
import WebSocket from 'ws';

import {
  RadioStationNames,
  RadioStations,
  radioStations
} from '../../../interfaces/Music/Radio/AvailableRadioStations';
import { RadioWebsocketUpdate } from '../../../interfaces/Music/Radio/RadioWebsocketUpdate';
import { sendRadioUpdate } from './sendRadioUpdate';

const radioWebsocketURLs: Record<
  RadioStationNames,
  RadioStations[RadioStationNames]['websocketUrl']
> = {
  kpop: radioStations.kpop.websocketUrl,
  jpop: radioStations.jpop.websocketUrl
};

export function createRadioWebsocketConnection(radioName: 'kpop' | 'jpop') {
  const socket = new WebSocket(radioWebsocketURLs[radioName]);

  socket.onopen = () => {
    container.radioWebsockets[radioName].connection = socket;
    container.radioWebsockets[radioName].firstUpdate = true;
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data as string) as RadioWebsocketUpdate;

    if (container.radioWebsockets[radioName].guildIdSet.size === 0) {
      socket.close();
      return;
    }

    if (data.op === 10) {
      return;
    }

    if (data.op === 0) {
      const heartbeatInterval = data.d.heartbeat;

      container.radioWebsockets[radioName].heartbeat = setInterval(() => {
        socket.send(JSON.stringify({ op: 9 }));
      }, heartbeatInterval);

      return;
    }

    if (data.op === 1) {
      if (
        container.radioWebsockets[radioName].lastUpdate?.startTime ===
        data.d.startTime
      ) {
        return;
      }

      container.radioWebsockets[radioName].lastUpdate = data.d;

      if (container.radioWebsockets[radioName].firstUpdate) {
        container.radioWebsockets[radioName].firstUpdate = false;
      } else {
        container.radioWebsockets[radioName].lastUpdate.localStartTime =
          DateTime.now();
      }

      for (const guildId of container.radioWebsockets[radioName].guildIdSet) {
        sendRadioUpdate(guildId, data.d);
      }

      return;
    }
  };

  socket.onclose = () => {
    if (container.radioWebsockets[radioName].connection !== null) {
      container.radioWebsockets[radioName].connection = null;
    }

    if (container.radioWebsockets[radioName].heartbeat !== null) {
      clearInterval(container.radioWebsockets[radioName].heartbeat!);

      container.radioWebsockets[radioName].heartbeat = null;
    }
  };
}

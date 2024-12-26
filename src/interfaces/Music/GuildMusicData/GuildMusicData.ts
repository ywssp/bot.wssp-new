'use strict';

import { container } from '@sapphire/framework';
import { SendableChannels, VoiceBasedChannel } from 'discord.js';

import { QueueSystemData } from './QueueSystemData';
import { RadioData } from './RadioData';

export class GuildMusicData {
  guildId: string;
  voiceChannelId: string;
  announceChannelId: string;
  announceStyle: 'embed_fancy' | 'embed_simple' | 'text_simple' | 'none';

  queueData: QueueSystemData;
  radioData: RadioData;

  leaveTimeout: NodeJS.Timeout | null = null;

  constructor(
    guildId: string,
    voiceChannel: VoiceBasedChannel,
    textUpdateChannel: SendableChannels
  ) {
    this.guildId = guildId;
    this.announceChannelId = textUpdateChannel.id;
    this.voiceChannelId = voiceChannel.id;
    this.announceStyle = 'embed_simple';
    this.queueData = new QueueSystemData();
    this.radioData = new RadioData();
  }

  getTextUpdateChannel() {
    return container.client.channels.cache.get(
      this.announceChannelId
    ) as SendableChannels;
  }

  setTextUpdateChannel(channel: SendableChannels) {
    this.announceChannelId = channel.id;
  }

  sendUpdateMessage(message: Parameters<SendableChannels['send']>[0]) {
    const textUpdateChannel = this.getTextUpdateChannel();

    if (textUpdateChannel === undefined) {
      throw new Error(
        `Cannot find text update channel with id ${this.announceChannelId}`
      );
    }

    textUpdateChannel.send(message);
  }

  setVoiceChannel(channel: VoiceBasedChannel) {
    this.voiceChannelId = channel.id;
  }

  getVoiceChannel() {
    return container.client.channels.cache.get(
      this.voiceChannelId
    ) as VoiceBasedChannel;
  }
}

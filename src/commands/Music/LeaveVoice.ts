'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';
import { getVoiceConnection } from '@discordjs/voice';

import { disposeAudioPlayer } from '../../functions/music-utilities/disposeAudioPlayer';
import { getAudioPlayer } from '../../functions/music-utilities/getAudioPlayer';
import { getPlayingType } from '../../functions/music-utilities/getPlayingType';
import {
  deleteGuildMusicData,
  getGuildMusicData
} from '../../functions/music-utilities/guildMusicDataManager';
import { disconnectGuildFromRadioWebsocket } from '../../functions/music-utilities/radio/disconnectGuildFromRadioWebsocket';
import { GuildMusicData } from '../../interfaces/Music/GuildMusicData/GuildMusicData';

export class LeaveVCCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'leave',
      description: 'Leaves the voice channel.',
      runIn: 'GUILD_ANY',
      preconditions: ['InVoiceChannel', 'IsPlaying']
    });
  }

  public override registerApplicationCommands(
    registry: ChatInputCommand.Registry
  ) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName('clear')
            .setDescription('What to clear after leaving the voice channel.')
            .setRequired(false)
            .addChoices(
              { name: 'Queue - Clears the queue', value: 'queue' },
              { name: 'Data - Clears all of the data', value: 'data' }
            )
        )
    );
  }

  public chatInputRun(interaction: ChatInputCommand.Interaction) {
    const voiceConnection = getVoiceConnection(interaction.guildId as string);
    const audioPlayer = getAudioPlayer(interaction.guildId as string);

    if (voiceConnection === undefined || audioPlayer === undefined) {
      interaction.reply('There is nothing playing!');
      return;
    }

    const guildMusicData = getGuildMusicData(
      interaction.guildId as string
    ) as GuildMusicData;

    const playingType = getPlayingType(interaction.guildId as string);

    if (playingType === 'radio') {
      disconnectGuildFromRadioWebsocket(interaction.guildId as string);
    }

    switch (interaction.options.getString('clear') as 'queue' | 'data' | null) {
      case 'queue':
        if (guildMusicData.queueData !== undefined) {
          guildMusicData.queueData.trackQueue.length = 0;
        }
        break;
      case 'data':
        deleteGuildMusicData(interaction.guildId as string);
        break;
      default:
        break;
    }

    const voiceChannelName = interaction.guild?.members.me?.voice.channel?.name;

    disposeAudioPlayer(interaction.guildId as string);
    voiceConnection.destroy();
    interaction.reply(`🛑 | Left the voice channel \`${voiceChannelName}\``);
    return;
  }
}

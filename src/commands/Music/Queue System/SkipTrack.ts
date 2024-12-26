'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

import { getAudioPlayer } from '../../../functions/music-utilities/getAudioPlayer';
import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { createEmbedFromTrackArray } from '../../../functions/music-utilities/queue-system/createEmbedFromTrackArray';
import { ColorPalette } from '../../../settings/ColorPalette';

export class SkipTrackCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'skip',
      description: 'Skips an amount of tracks.',
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
        .addIntegerOption((option) =>
          option
            .setName('number')
            .setDescription('The number of tracks to skip. Defaults to `1`')
            .setMinValue(1)
            .setRequired(false)
        )
    );
  }

  public chatInputRun(interaction: ChatInputCommand.Interaction) {
    const guildMusicData = getGuildMusicData(interaction.guildId as string);

    if (guildMusicData === undefined) {
      interaction.reply('The queue is empty.');
      return;
    }

    const guildQueueData = guildMusicData.queueData;

    const audioPlayer = getAudioPlayer(interaction.guildId as string);

    if (audioPlayer === undefined) {
      interaction.reply({
        content: '❓ | There is no track playing.',
        ephemeral: true
      });
      return;
    }

    let skipNumber = interaction.options.getInteger('number') ?? 1;

    if (
      skipNumber < 1 ||
      (guildQueueData.getQueue().length - 1 > 0 &&
        skipNumber >= guildQueueData.getQueue().length)
    ) {
      interaction.reply({
        content: `⛔ | Invalid number. The number must be between \`1-${
          guildQueueData.getQueue().length
        }\`.`,
        ephemeral: true
      });
      return;
    }

    if (guildQueueData.getQueue().length === 0) {
      skipNumber = 1;
    }

    const currentTrack = guildQueueData.getCurrentTrack()!;

    const skippedTracks = guildQueueData.trackQueue.slice(0, skipNumber - 1);
    guildQueueData.trackQueue.splice(0, skipNumber - 1);

    skippedTracks.unshift(currentTrack);

    const embed = new EmbedBuilder()
      .setColor(ColorPalette.Notice)
      .setTitle(
        `Skipped ${skippedTracks.length} track${
          skippedTracks.length > 1 ? 's' : ''
        } from the queue`
      );

    guildQueueData.markSkipped();

    audioPlayer.stop();
    interaction.reply({
      embeds: [createEmbedFromTrackArray(embed, skippedTracks)]
    });
    return;
  }
}

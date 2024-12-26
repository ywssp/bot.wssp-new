'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder, inlineCode } from 'discord.js';

import { createPagedEmbed } from '../../../functions/createPagedEmbed';
import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { createEmbedFieldFromTrack } from '../../../functions/music-utilities/queue-system/createEmbedFieldFromTrack';
import { ColorPalette } from '../../../settings/ColorPalette';

export class DisplayQueueCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'queue',
      description: 'Displays the music queue of the server.',
      runIn: 'GUILD_ANY',
      preconditions: ['HasGuildMusicData']
    });
  }

  public override registerApplicationCommands(
    registry: ChatInputCommand.Registry
  ) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public chatInputRun(interaction: ChatInputCommand.Interaction) {
    const guildMusicData = getGuildMusicData(interaction.guildId as string);

    if (
      guildMusicData === undefined ||
      guildMusicData.queueData.getQueue().length <= 1
    ) {
      interaction.reply('❓ | The queue is empty.');
      return;
    }

    const guildQueueData = guildMusicData.queueData;
    const queue = guildQueueData.getQueue();

    const queueFields = queue.map((track, index) =>
      createEmbedFieldFromTrack(track, `${index + 1}. `)
    );

    let description = null;

    if (guildQueueData.shuffle) {
      description =
        '🔀 | The queue is shuffled. Tracks will be played in a random order.';
    }

    if (guildQueueData.loop.type === 'track') {
      if (description === null) {
        description = '';
      } else {
        description += '\n';
      }

      const currentTrack = guildQueueData.getCurrentTrack();

      if (currentTrack !== undefined) {
        description += `🔂 | ${inlineCode(currentTrack.title)} by ${inlineCode(
          currentTrack.getArtistHyperlinks()
        )} is looping.`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(ColorPalette.Default)
      .setTitle('Queue')
      .setDescription(description)
      .setFooter({
        text: 'Use "/skip <number>" to go a specific song'
      });

    createPagedEmbed(interaction, queueFields, embed);
    return;
  }
}

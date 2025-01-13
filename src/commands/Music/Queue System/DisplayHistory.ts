'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

import { createPagedEmbed } from '../../../functions/createPagedEmbed';
import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { createEmbedFieldFromTrack } from '../../../functions/music-utilities/queue-system/createEmbedFieldFromTrack';
import { ColorPalette } from '../../../settings/ColorPalette';

export class DisplayTrackHistoryCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'history',
      description: 'Displays the music history of the server.',
      runIn: 'GUILD_ANY'
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
      guildMusicData.queueData.getHistory().length === 0
    ) {
      interaction.reply('❓ | The track history is empty.');
      return;
    }

    const history = guildMusicData.queueData.getHistory();

    const historyFields = history.map((track, index) =>
      createEmbedFieldFromTrack(track, `${index + 1}. `)
    );

    const embed = new EmbedBuilder()
      .setColor(ColorPalette.Default)
      .setTitle('History');

    createPagedEmbed(interaction, historyFields, embed);
  }
}

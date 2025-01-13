'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';

import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';

export class ClearTrackListCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'clear',
      description: 'Clears the track history or queue.',
      runIn: 'GUILD_ANY',
      preconditions: ['InVoiceChannel', 'HasGuildMusicData']
    });
  }

  public override registerApplicationCommands(
    registry: ChatInputCommand.Registry
  ) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
          subcommand.setName('queue').setDescription('Clears the track queue.')
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('history')
            .setDescription('Clears the track history.')
        )
    );
  }

  public chatInputRun(interaction: ChatInputCommand.Interaction) {
    const guildMusicData = getGuildMusicData(interaction.guildId as string);

    if (guildMusicData === undefined) {
      interaction.reply({
        content: 'The track list is empty.',
        ephemeral: true
      });
      return;
    }

    const guildQueueData = guildMusicData.queueData;

    if (interaction.options.getSubcommand() === 'queue') {
      guildQueueData.trackList = [];

      interaction.reply('🗑 | Cleared the track queue.');
    }
    if (interaction.options.getSubcommand() === 'history') {
      guildQueueData.trackHistory = [];

      interaction.reply('🗑 | Cleared the track history.');
    }

    return;
  }
}

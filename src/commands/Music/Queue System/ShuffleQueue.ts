'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';

import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';

export class ShuffleQueueCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'shuffle',
      description: 'Toggles the shuffle mode of the music player.',
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
        .addBooleanOption((option) =>
          option
            .setName('shuffle')
            .setDescription('Where to toggle the shuffle mode.')
            .setRequired(false)
        )
    );
  }

  public chatInputRun(interaction: ChatInputCommand.Interaction) {
    const guildMusicData = getGuildMusicData(interaction.guildId as string);

    if (guildMusicData === undefined) {
      interaction.reply({
        content: '❓ | There is no track playing.',
        ephemeral: true
      });
      return;
    }

    const guildQueueData = guildMusicData.queueData;

    const mode =
      interaction.options.getBoolean('shuffle') ?? !guildQueueData.shuffle;

    guildQueueData.shuffle = mode;

    interaction.reply(
      `${mode ? '🔀' : '➡️'} | Shuffle mode is now \`${mode ? 'on' : 'off'}\`.`
    );
    return;
  }
}

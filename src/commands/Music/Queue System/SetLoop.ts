'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';

import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';

export class SetLoopCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'loop',
      description: 'Sets the loop mode of the music player.',
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
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('The loop mode to set.')
            .setRequired(true)
            .setChoices(
              { name: 'Off', value: 'off' },
              { name: 'Track', value: 'track' },
              { name: 'Queue', value: 'queue' }
            )
        )
    );
  }

  public chatInputRun(interaction: ChatInputCommand.Interaction) {
    const guildMusicData = getGuildMusicData(interaction.guildId as string);

    if (guildMusicData === undefined) {
      interaction.reply({
        content: 'There is no music data for this guild.',
        ephemeral: true
      });
      return;
    }

    const guildQueueData = guildMusicData.queueData;

    const mode = interaction.options.getString('mode') as
      | 'off'
      | 'track'
      | 'queue';

    guildQueueData.setLoopType(mode);

    interaction.reply(
      `${guildQueueData.loop.emoji} | Loop mode set to \`${mode}\`.`
    );
    return;
  }
}

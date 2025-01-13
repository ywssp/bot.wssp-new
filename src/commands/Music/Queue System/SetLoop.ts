'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';

import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { QueuePlaylist } from '../../../interfaces/Music/Queue System/QueuePlaylist';

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
        .addSubcommand((subcommand) =>
          subcommand
            .setName('main')
            .setDescription('Changes the loop mode of the main queue.')
            .addStringOption((option) =>
              option
                .setName('mode')
                .setDescription('The loop mode to set.')
                .setRequired(true)
                .addChoices([
                  { name: 'Off', value: 'off' },
                  { name: 'Track', value: 'track' },
                  { name: 'Queue', value: 'queue' }
                ])
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('playlist')
            .setDescription('Changes the loop mode of the selected playlist.')
            .addBooleanOption((option) =>
              option
                .setName('mode')
                .setDescription('The loop mode to set.')
                .setRequired(false)
            )
            .addIntegerOption((option) =>
              option
                .setName('playlist-number')
                .setDescription(
                  'The playlist to shuffle. Defaults to the nearest playlist.'
                )
                .setMinValue(1)
                .setRequired(false)
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

    const scope = interaction.options.getSubcommand(true) as
      | 'main'
      | 'playlist';

    if (scope === 'main') {
      const mode = interaction.options.getString('mode', true) as
        | 'off'
        | 'track'
        | 'queue';
      guildQueueData.setLoopType(mode);

      interaction.reply(
        `${guildQueueData.loop.emoji} | Set main queue loop to \`${mode}\`.`
      );
      return;
    }

    let playlistNumber = interaction.options.getInteger('playlist-number') ?? 1;

    let playlist: QueuePlaylist | undefined;
    let playlistCount = 0;

    for (const item of guildQueueData.trackList) {
      if (item instanceof QueuePlaylist) {
        playlistCount++;

        if (playlistNumber > 1) {
          playlistNumber--;
          continue;
        }

        playlist = item;
        break;
      }
    }

    if (playlistCount === 0) {
      interaction.reply({
        content: '❓ | There are no playlists to loop.',
        ephemeral: true
      });
      return;
    }

    if (playlist === undefined) {
      interaction.reply({
        content: `❓ | The playlist number is invalid. The number must be from \`${
          playlistCount === 1 ? '1' : '1-' + playlistCount
        }\``,
        ephemeral: true
      });
      return;
    }

    const mode =
      interaction.options.getBoolean('mode', false) ?? !playlist.queueLoop;

    playlist.queueLoop = mode;

    interaction.reply(
      `${playlist.queueLoop ? '🔁' : '➡️'} | Set playlist loop to \`${
        mode ? 'on' : 'off'
      }\`.`
    );
  }
}

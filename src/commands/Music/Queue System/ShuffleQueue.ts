'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';

import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { QueuePlaylist } from '../../../interfaces/Music/Queue System/QueuePlaylist';

export class ShuffleQueueCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'shuffle',
      description: 'Toggles the shuffle for the current/upcoming playlist',
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
            .setDescription('Whether to shuffle the playlist or not')
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

    let mode = interaction.options.getBoolean('shuffle');

    let playlistNumber = interaction.options.getInteger('playlist-number') ?? 1;

    let playlist: QueuePlaylist | undefined;
    let playlistCount = 0;

    for (const item of guildQueueData.trackQueue) {
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
        content: '❓ | There are no playlists to shuffle.',
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

    if (playlist.shuffled === mode) {
      interaction.reply({
        content: `❗ | The playlist is already ${
          playlist.shuffled ? '' : 'un'
        }shuffled.`,
        ephemeral: true
      });
      return;
    }

    if (playlist.shuffled) {
      playlist.unshuffle();
    } else {
      playlist.shuffle();
    }

    mode = playlist.shuffled;

    interaction.reply(
      `${mode ? '🔀' : '➡️'} | The playlist \`${playlist.title}\` is now ${
        playlist.shuffled ? '' : 'un'
      }shuffled.`
    );
    return;
  }
}

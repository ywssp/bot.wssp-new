'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';
import { bold, EmbedBuilder, hyperlink, inlineCode } from 'discord.js';

import { createPagedEmbed } from '../../../functions/createPagedEmbed';
import { getGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { createEmbedFieldFromTrack } from '../../../functions/music-utilities/queue-system/createEmbedFieldFromTrack';
import { QueueItem } from '../../../interfaces/Music/GuildMusicData/QueueSystemData';
import { QueuePlaylist } from '../../../interfaces/Music/Queue System/QueuePlaylist';
import { QueuedTrackInfo } from '../../../interfaces/Music/Queue System/TrackInfo';
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
      guildMusicData.queueData.getQueue().length < 1
    ) {
      interaction.reply('❓ | The queue is empty.');
      return;
    }

    const guildQueueData = guildMusicData.queueData;
    const queue = guildQueueData.getQueue();

    let index = 0;
    let trackNumber = 1;

    let playlistCount = 0;

    const queueFields = [];
    let playlistQueue: QueuedTrackInfo[] = [];
    let endOfPlaylist = false;

    while (index < queue.length) {
      const currentItem = queue[index];

      if (
        currentItem instanceof QueuePlaylist &&
        currentItem.getRemainingTracksCount() > 0 &&
        playlistQueue.length === 0
      ) {
        playlistCount++;

        let header = 'Start of Playlist';

        if (index === 0) {
          header = 'Currently Playing from';
        }

        // 📼1 Start of Playlist Name
        const remainingTracks = currentItem.getRemainingTracksCount();
        const totalTracks = currentItem.trackList.length;

        const playlistField = {
          name: `${playlistCount}-📼 | ${header} "${currentItem.title}"`,
          value: `${remainingTracks} ${
            remainingTracks === totalTracks ? 'tracks' : 'tracks remaining'
          } `,
          inline: false
        };

        if (currentItem.shuffled) {
          playlistField.value += '\n🔀 Shuffled';
        }

        queueFields.push(playlistField);

        playlistQueue = currentItem.getRemainingTracks();
      }

      let track: QueueItem;

      if (playlistQueue.length > 0) {
        track = playlistQueue.shift() as QueueItem;

        if (playlistQueue.length === 0) {
          index++;
          playlistQueue = [];
          endOfPlaylist = true;
        }
      } else {
        track = currentItem as QueueItem;
        index++;
      }

      queueFields.push(createEmbedFieldFromTrack(track, `${trackNumber}. `));

      if (endOfPlaylist) {
        const endPlaylistField = {
          name: `\u200b`,
          value: `📼 End of Playlist ${bold(
            hyperlink(currentItem.title, currentItem.url)
          )}`,
          inline: false
        };

        queueFields.push(endPlaylistField);

        endOfPlaylist = false;
      }

      trackNumber++;
    }

    let embedDescription: string | null = null;

    if (guildQueueData.loop.type === 'track') {
      const currentTrack = guildQueueData.getCurrentTrack();

      if (currentTrack !== undefined) {
        embedDescription = `🔂 | ${inlineCode(
          currentTrack.title
        )} by ${inlineCode(currentTrack.getArtistHyperlinks())} is looping.`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(ColorPalette.Default)
      .setTitle('Queue')
      .setDescription(embedDescription)
      .setFooter({
        text: 'Use "/skip <number>" to skip to a track'
      });

    createPagedEmbed(interaction, queueFields, embed);
    return;
  }
}

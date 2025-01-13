'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';
import {
  channelMention,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits
} from 'discord.js';

import * as playdl from 'play-dl';

import { createGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { createSimpleEmbedFromTrack } from '../../../functions/music-utilities/queue-system/createSimpleEmbedFromTrack';
import { getTrackNamings } from '../../../functions/music-utilities/queue-system/getTrackNamings';
import { searchSoundCloud } from '../../../functions/music-utilities/queue-system/searchers/soundcloud';
import { searchSpotifyAdapt } from '../../../functions/music-utilities/queue-system/searchers/spotify';
import { searchYoutube } from '../../../functions/music-utilities/queue-system/searchers/youtube';
import { searchYTMusic } from '../../../functions/music-utilities/queue-system/searchers/youtubeMusic';
import { startQueuePlayback } from '../../../functions/music-utilities/queue-system/startQueuePlayback';
import { TrackCacheResult } from '../../../interfaces/Music/Queue System/TrackCacheResult';
import {
  AdaptedTrackInfo,
  QueuedAdaptedTrackInfo,
  QueuedTrackInfo,
  TrackInfo
} from '../../../interfaces/Music/Queue System/TrackInfo';
import { ColorPalette } from '../../../settings/ColorPalette';
import {
  SoundCloudTerms,
  SpotifyTerms,
  YouTubeTerms,
  YTMusicTerms
} from '../../../settings/MusicSourceTerms';

export class PlayMusicCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'play',
      description: 'Plays a track from YouTube, YouTube Music, or SoundCloud',
      runIn: ['GUILD_TEXT'],
      preconditions: ['InVoiceChannel']
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
            .setName('youtube')
            .setDescription('Plays a video from YouTube')
            .addStringOption((option) =>
              option
                .setName('link-or-query')
                .setDescription(
                  'The link of the video, or the query to use for searching'
                )
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('soundcloud')
            .setDescription('Plays a track from SoundCloud')
            .addStringOption((option) =>
              option
                .setName('link-or-query')
                .setDescription(
                  'The link of the track, or the query to use for searching'
                )
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('yt_music')
            .setDescription(
              'Plays a track based from a YouTube video, of by searching'
            )
            .addStringOption((option) =>
              option
                .setName('link-or-query')
                .setDescription(
                  'The link of the track, or the query to use for searching'
                )
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('spotify')
            .setDescription(
              '*SEARCH INACCURATE* Plays a track from Spotify, using a song from YouTube Music'
            )
            .addStringOption((option) =>
              option
                .setName('link-or-query')
                .setDescription(
                  'The link of the track, or the query to use for searching'
                )
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('history')
            .setDescription('Replays a track from the track history')
            .addIntegerOption((option) =>
              option
                .setName('index')
                .setDescription(
                  'The index of the track in the history. Uses the latest track if omitted'
                )
                .setMinValue(1)
                .setRequired(false)
            )
        )
    );
  }

  public async chatInputRun(interaction: ChatInputCommand.Interaction) {
    if (interaction.channel === null) {
      interaction.reply({
        content: '❓ | Cannot find channel.',
        ephemeral: true
      });
      return;
    }

    const botMember = interaction.guild?.members.me;
    const botMemberExists = botMember !== null && botMember !== undefined;
    const channelInGuild = !interaction.channel.isDMBased();
    const channelSendable = interaction.channel.isSendable();
    const canSendMessages = botMember?.permissions.has(
      PermissionFlagsBits.SendMessages
    );
    if (
      !botMemberExists ||
      !channelSendable ||
      !channelInGuild ||
      !canSendMessages
    ) {
      interaction.reply({
        content: '❌ | Cannot send update messages to this channel.',
        ephemeral: true
      });
      return;
    }

    const voiceChannel = (interaction.member as GuildMember).voice.channel;

    if (voiceChannel === null) {
      interaction.reply({
        content: '❓ | Cannot find voice channel.',
        ephemeral: true
      });
      return;
    }

    if (
      !voiceChannel.permissionsFor(botMember).has(PermissionFlagsBits.Speak) ||
      !voiceChannel.permissionsFor(botMember).has(PermissionFlagsBits.Connect)
    ) {
      interaction.reply({
        content: `❌ | Cannot play music in ${channelMention(
          voiceChannel.id
        )}.`,
        ephemeral: true
      });
      return;
    }

    const guildQueueData = createGuildMusicData(
      interaction.guildId as string,
      voiceChannel,
      interaction.channel
    ).queueData;

    let source = interaction.options.getSubcommand(true) as
      | 'youtube'
      | 'yt_music'
      | 'soundcloud'
      | 'spotify'
      | 'history';
    const linkOrQuery = interaction.options.getString('link-or-query') ?? '';

    if (source !== 'history') {
      if (linkOrQuery.length < 3) {
        interaction.reply('Search query is too short!');
        return;
      }

      let linkOrQueryType = await playdl.validate(linkOrQuery);

      if (linkOrQueryType === false) {
        linkOrQueryType = 'search';
      }

      if (
        linkOrQueryType === 'yt_playlist' ||
        linkOrQueryType === 'so_playlist' ||
        linkOrQueryType === 'sp_playlist' ||
        linkOrQueryType === 'sp_album'
      ) {
        interaction.reply({
          content: 'Playlist detected. Use the `addplaylist` command instead.',
          ephemeral: true
        });
        return;
      }

      if (linkOrQueryType.startsWith('yt_') && source === 'soundcloud') {
        source = 'youtube';
      }

      if (linkOrQueryType.startsWith('so_') && source !== 'soundcloud') {
        source = 'soundcloud';
      }

      if (linkOrQueryType.startsWith('sp_') && source !== 'spotify') {
        source = 'spotify';
      }
    }

    if (!interaction.replied) {
      await interaction.deferReply();
    }

    let searchResult: TrackInfo | AdaptedTrackInfo;
    let cacheStatus: TrackCacheResult['cacheData'] | undefined;

    if (source === 'youtube') {
      try {
        const search = await searchYoutube(linkOrQuery, {
          limit: 1
        });

        if (!Array.isArray(search)) {
          cacheStatus = search.cacheData;
          searchResult = search.data;
        } else {
          searchResult = search[0];
        }
      } catch (error) {
        this.container.logger.error(error);

        if (error instanceof Error) {
          interaction.editReply({
            content: `❌ | ${error.message}`
          });
        } else {
          interaction.editReply({
            content: `❌ | An error occurred while searching for ${YouTubeTerms.trackTerm}s.`
          });
        }

        return;
      }
    } else if (source === 'yt_music') {
      try {
        const search = await searchYTMusic(linkOrQuery, {
          limit: 1
        });

        if (!Array.isArray(search)) {
          cacheStatus = search.cacheData;
          searchResult = search.data;
        } else {
          searchResult = search[0];
        }
      } catch (error) {
        this.container.logger.error(error);

        if (error instanceof Error) {
          interaction.editReply({
            content: `❌ | ${error.message}`
          });
        } else {
          interaction.editReply({
            content: `❌ | An error occurred while searching for ${YTMusicTerms.trackTerm}s.`
          });
        }

        return;
      }
    } else if (source === 'soundcloud') {
      try {
        const search = await searchSoundCloud(linkOrQuery, {
          limit: 1
        });

        if (!Array.isArray(search)) {
          cacheStatus = search.cacheData;
          searchResult = search.data;
        } else {
          searchResult = search[0];
        }
      } catch (error) {
        this.container.logger.error(error);

        if (error instanceof Error) {
          interaction.editReply({
            content: `❌ | ${error.message}`
          });
        } else {
          interaction.editReply({
            content: `❌ | An error occurred while searching for ${SoundCloudTerms.trackTerm}s.`
          });
        }

        return;
      }
    } else if (source === 'spotify') {
      try {
        const search = await searchSpotifyAdapt(linkOrQuery, {
          limit: 1
        });

        if (!Array.isArray(search)) {
          cacheStatus = search.cacheData;
          searchResult = search.data;
        } else {
          searchResult = search[0];
        }
      } catch (error) {
        this.container.logger.error(error);

        if (error instanceof Error) {
          interaction.editReply({
            content: `❌ | ${error.message}`
          });
        } else {
          interaction.editReply({
            content: `❌ | An error occurred while searching for ${SpotifyTerms.trackTerm}s.`
          });
        }

        return;
      }
    } else {
      const trackIndex =
        (interaction.options.getInteger('index', false) ?? 1) - 1;

      const history = guildQueueData.getHistory();

      if (history.length === 0) {
        interaction.editReply({
          content: '❓ | Track history is empty.'
        });
        return;
      }

      if (trackIndex >= history.length) {
        interaction.editReply({
          content: '❌ | Invalid track index. Range: 1 - ' + history.length
        });
        return;
      }

      searchResult = history[trackIndex];
    }

    let queuedTrack: QueuedTrackInfo | QueuedAdaptedTrackInfo;

    if (searchResult instanceof AdaptedTrackInfo) {
      queuedTrack = new QueuedAdaptedTrackInfo(searchResult, interaction.user);
    } else {
      queuedTrack = new QueuedTrackInfo(searchResult, interaction.user);
    }

    guildQueueData.addTracksToQueue(queuedTrack);

    const namings = getTrackNamings(queuedTrack);

    const baseEmbed = new EmbedBuilder()
      .setColor(ColorPalette.Success)
      .setTitle(`Added ${namings.fullTrackTerm} to queue`);

    if (cacheStatus !== undefined) {
      baseEmbed.setFooter({
        text: `Cache ${
          cacheStatus.status
        }, cached on ${cacheStatus.cachedAt.toLocaleString()}`
      });
    }

    const embed = createSimpleEmbedFromTrack(baseEmbed, queuedTrack);

    interaction.editReply({ content: null, embeds: [embed] });

    startQueuePlayback(interaction.guildId as string);
  }
}

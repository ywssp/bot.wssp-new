/* eslint-disable import/no-named-as-default-member */
'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';
import {
  channelMention,
  EmbedBuilder,
  GuildMember,
  hyperlink,
  PermissionFlagsBits
} from 'discord.js';

import play, {
  SoundCloudPlaylist,
  SoundCloudTrack,
  SpotifyAlbum,
  SpotifyPlaylist,
  SpotifyTrack,
  YouTubePlayList
} from 'play-dl';

import { Duration } from 'luxon';

import { createGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { startQueuePlayback } from '../../../functions/music-utilities/queue-system/startQueuePlayback';
import { QueuePlaylist } from '../../../interfaces/Music/Queue System/QueuePlaylist';
import { QueuedTrackInfo } from '../../../interfaces/Music/Queue System/TrackInfo';
import { ColorPalette } from '../../../settings/ColorPalette';
import {
  MusicSourceTerms,
  SoundCloudTerms,
  SpotifyTerms,
  YouTubeTerms
} from '../../../settings/MusicSourceTerms';

export class AddPlaylistCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'addplaylist',
      description:
        'Adds the contents of a YouTube, SoundCloud, or Spotify playlist to the queue.',
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
        .addStringOption((option) =>
          option
            .setName('link')
            .setDescription(
              'The link of a YouTube, SoundCloud, or Spotify playlist.'
            )
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName('loop')
            .setDescription('Whether to loop the playlist.')
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName('shuffle')
            .setDescription('Shuffles the playlist.')
            .setRequired(false)
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

    const link = interaction.options.getString('link') as string;

    const linkType = await play.validate(link);

    if (
      !linkType ||
      !['yt_playlist', 'so_playlist', 'sp_playlist', 'sp_album'].includes(
        linkType
      )
    ) {
      interaction.reply({
        content: '❓ | Invalid playlist link.',
        ephemeral: true
      });
      return;
    }

    let source: 'YouTube' | 'SoundCloud' | 'Spotify';
    let namings: MusicSourceTerms;

    if (linkType === 'yt_playlist') {
      source = 'YouTube';
      namings = YouTubeTerms;
    } else if (linkType === 'so_playlist') {
      source = 'SoundCloud';
      namings = SoundCloudTerms;
    } else {
      source = 'Spotify';
      namings = SpotifyTerms;
    }

    await interaction.reply(`Processing ${namings.source} Playlist...`);

    type playlistOwner = {
      name: string;
      url?: string;
    };

    let playlistMetadata: {
      title: string;
      url?: string;
      owner: playlistOwner[];
      thumbnail?: string;
      playlistLength?: number;
    };

    let tracks: QueuedTrackInfo[];
    let playlistDuration: Duration | 'Unknown / Live' = Duration.fromMillis(0);

    if (source === 'YouTube') {
      let playlist: YouTubePlayList;

      try {
        playlist = await play.playlist_info(link, {
          incomplete: true
        });
      } catch (error) {
        interaction.editReply({
          content: `❌ | An error occurred while getting the ${source} playlist info.`
        });
        this.container.logger.error(error);
        return;
      }

      const foundTracks = (await playlist.all_videos()).filter(
        (video) => !video.private
      );

      tracks = foundTracks.map((video) => {
        const track = new QueuedTrackInfo(video, interaction.user);

        if (playlistDuration !== 'Unknown / Live') {
          if (track.duration === 'Live Stream') {
            playlistDuration = 'Unknown / Live';
          } else {
            playlistDuration = playlistDuration.plus(track.duration);
          }
        }

        return track;
      });

      playlistMetadata = {
        title: playlist.title ?? 'Unknown',
        url: playlist.url,
        owner: [
          {
            name: playlist.channel?.name ?? 'Unknown',
            url: playlist.channel?.url
          }
        ],
        thumbnail: playlist.thumbnail?.url,
        playlistLength: playlist.videoCount
      };
    } else if (source === 'SoundCloud') {
      let playlist: SoundCloudPlaylist;

      try {
        playlist = (await play.soundcloud(link)) as SoundCloudPlaylist;
      } catch (error) {
        interaction.editReply({
          content: `❌ | An error occurred while getting the ${source} playlist info.`
        });
        this.container.logger.error(error);
        return;
      }

      let foundTracks: SoundCloudTrack[];

      try {
        foundTracks = await playlist.all_tracks();
      } catch (error) {
        interaction.editReply({
          content: `❌ | An error occurred while getting the ${namings.trackTerm}s of the playlist.`
        });
        this.container.logger.error(error);
        return;
      }

      tracks = foundTracks.map(
        (track) => new QueuedTrackInfo(track, interaction.user)
      );

      playlistDuration = Duration.fromMillis(playlist.durationInMs);

      playlistMetadata = {
        title: playlist.name,
        url: playlist.url,
        owner: [
          {
            name: playlist.user.name,
            url: playlist.user.url
          }
        ],
        playlistLength: playlist.total_tracks
      };
    } else {
      let playlist: SpotifyPlaylist | SpotifyAlbum;

      try {
        if (play.is_expired()) {
          await play.refreshToken();
        }

        playlist = await (
          (await play.spotify(link)) as SpotifyPlaylist | SpotifyAlbum
        ).fetch();
      } catch (error) {
        interaction.editReply({
          content: `❌ | An error occurred while getting the ${source} playlist info.`
        });
        this.container.logger.error(error);
        return;
      }

      const foundTracks: SpotifyTrack[] = [];

      try {
        const pageCount = playlist.total_pages;

        for (let i = 1; i <= pageCount; i++) {
          const nextTracks = playlist.page(i);

          if (nextTracks === undefined || nextTracks.length === 0) {
            continue;
          }

          let playableTracks = nextTracks.filter((track) => track.playable);

          if (playlist instanceof SpotifyAlbum) {
            playableTracks = playableTracks.map((track) => {
              track.thumbnail = playlist.thumbnail;

              return track;
            });
          }

          foundTracks.push(...playableTracks);
        }
      } catch (error) {
        interaction.editReply({
          content: `❌ | An error occurred while getting the ${namings.trackTerm}s of the playlist.`
        });
        this.container.logger.error(error);
        return;
      }

      tracks = foundTracks.map((track) => {
        playlistDuration = (playlistDuration as Duration).plus(
          Duration.fromMillis(track.durationInMs)
        );

        const convertedTrack = new QueuedTrackInfo(track, interaction.user);

        return convertedTrack;
      });

      playlistMetadata = {
        title: playlist.name,
        url: playlist.url,
        owner: [],
        thumbnail: playlist.thumbnail.url,
        playlistLength: playlist.total_tracks
      };

      if (playlist instanceof SpotifyAlbum) {
        playlistMetadata.owner = playlist.artists.map((artist) => ({
          name: artist.name,
          url: artist.url
        }));
      } else {
        playlistMetadata.owner = [
          {
            name: playlist.owner.name,
            url: playlist.owner.url
          }
        ];
      }
    }

    if (tracks.length === 0) {
      interaction.editReply({
        content: `❌ | No ${namings.trackTerm}s were found in the playlist.`
      });
      return;
    }

    if (interaction.options.getBoolean('loop')) {
      guildQueueData.setLoopType('queue');
    }

    let lengthDescription = '';

    if (playlistDuration instanceof Duration) {
      // Remove seconds
      playlistDuration = playlistDuration
        .shiftTo('hours', 'minutes')
        .mapUnits((unit) => Math.floor(unit));

      lengthDescription += playlistDuration.toHuman({
        unitDisplay: 'short'
      });
    } else {
      lengthDescription += 'Duration unknown';
    }

    lengthDescription += '\n';

    if (playlistMetadata.playlistLength !== undefined) {
      if (playlistMetadata.playlistLength !== tracks.length) {
        lengthDescription += `${tracks.length}/${playlistMetadata.playlistLength} playable ${namings.trackTerm}s`;
      } else {
        lengthDescription += `${tracks.length} ${namings.trackTerm}s `;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(ColorPalette.Success)
      .setTitle(`${source} Playlist Added to Queue`)
      .addFields([
        {
          name: 'Playlist Name',
          value: playlistMetadata.url
            ? hyperlink(playlistMetadata.title, playlistMetadata.url)
            : playlistMetadata.title
        },
        {
          name: 'Author',
          value: playlistMetadata.owner
            .map((owner) =>
              owner.url ? hyperlink(owner.name, owner.url) : owner.name
            )
            .join(', ')
        },
        {
          name: 'Length',
          value: lengthDescription
        }
      ]);

    if (playlistMetadata.thumbnail !== undefined) {
      embed.setThumbnail(playlistMetadata.thumbnail);
    }

    if (source === 'Spotify') {
      embed.setFooter({
        text:
          namings.fullTrackTerm +
          's may not have a matching track in other sources.'
      });
    }

    interaction.editReply({
      content: null,
      embeds: [embed]
    });

    const queuePlaylist = new QueuePlaylist(
      playlistMetadata.title,
      link,
      tracks,
      interaction.options.getBoolean('shuffle') ?? false,
      false
    );

    guildQueueData.addPlaylistToQueue(queuePlaylist);

    startQueuePlayback(interaction.guildId as string);
  }
}

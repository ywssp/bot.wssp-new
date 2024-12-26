'use strict';

import { ChatInputCommand, Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  channelMention,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  MessageComponentInteraction,
  PermissionFlagsBits
} from 'discord.js';

import { createGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { createEmbedFieldFromTrack } from '../../../functions/music-utilities/queue-system/createEmbedFieldFromTrack';
import { createSimpleEmbedFromTrack } from '../../../functions/music-utilities/queue-system/createSimpleEmbedFromTrack';
import { searchSoundCloud } from '../../../functions/music-utilities/queue-system/searchers/soundcloud';
import { searchSpotifyAdapt } from '../../../functions/music-utilities/queue-system/searchers/spotify';
import { searchYoutube } from '../../../functions/music-utilities/queue-system/searchers/youtube';
import { searchYTMusic } from '../../../functions/music-utilities/queue-system/searchers/youtubeMusic';
import { startQueuePlayback } from '../../../functions/music-utilities/queue-system/startQueuePlayback';
import {
  AdaptedTrackInfo,
  QueuedAdaptedTrackInfo,
  QueuedTrackInfo,
  TrackInfo
} from '../../../interfaces/Music/Queue System/TrackInfo';
import { ColorPalette } from '../../../settings/ColorPalette';
import {
  MusicSourceTerms,
  SoundCloudTerms,
  SpotifyTerms,
  YouTubeTerms,
  YTMusicTerms
} from '../../../settings/MusicSourceTerms';

export class SearchVideosCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'search',
      description: 'Searches for multiple videos on different platforms.',
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
            .setDescription('Search videos on YouTube')
            .addStringOption((option) =>
              option
                .setName('query')
                .setDescription('The search query.')
                .setRequired(true)
                .setMinLength(3)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('yt_music')
            .setDescription('Search tracks on YouTube Music')
            .addStringOption((option) =>
              option
                .setName('query')
                .setDescription('The search query.')
                .setRequired(true)
                .setMinLength(3)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('soundcloud')
            .setDescription('Search tracks on SoundCloud')
            .addStringOption((option) =>
              option
                .setName('query')
                .setDescription('The search query.')
                .setRequired(true)
                .setMinLength(3)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('spotify')
            .setDescription('Search tracks on Spotify')
            .addStringOption((option) =>
              option
                .setName('query')
                .setDescription('The search query.')
                .setRequired(true)
                .setMinLength(3)
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

    const source = interaction.options.getSubcommand() as
      | 'youtube'
      | 'yt_music'
      | 'soundcloud'
      | 'spotify';
    const query = interaction.options.getString('query', true);

    if (query.length < 3) {
      interaction.reply({
        content: 'The query must be at least 3 characters long.',
        ephemeral: true
      });
      return;
    }

    let namings: MusicSourceTerms;

    if (source === 'youtube') {
      namings = YouTubeTerms;
    } else if (source === 'yt_music') {
      namings = YTMusicTerms;
    } else if (source === 'soundcloud') {
      namings = SoundCloudTerms;
    } else {
      namings = SpotifyTerms;
    }

    await interaction.deferReply();

    let choices: (TrackInfo | AdaptedTrackInfo)[];

    try {
      if (source === 'youtube') {
        choices = (await searchYoutube(query, {
          limit: 5,
          forceSearch: true
        })) as TrackInfo[];
      } else if (source === 'yt_music') {
        choices = (await searchYTMusic(query, {
          limit: 5,
          forceSearch: true
        })) as TrackInfo[];
      } else if (source === 'soundcloud') {
        choices = (await searchSoundCloud(query, {
          limit: 5,
          forceSearch: true
        })) as TrackInfo[];
      } else {
        choices = (await searchSpotifyAdapt(query, {
          limit: 5,
          forceSearch: true
        })) as AdaptedTrackInfo[];
      }
    } catch {
      interaction.editReply({
        content: `❌ | An error occurred while searching for ${namings.trackTerm}s.`
      });
      return;
    }

    const buttonRows = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        [1, 2, 3, 4, 5].map((number) =>
          new ButtonBuilder()
            .setCustomId(number.toString())
            .setLabel(number.toString())
            .setStyle(ButtonStyle.Secondary)
        )
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🛑')
      )
    ];

    const selectionTimeSeconds = 30;

    const selectionEmbed = new EmbedBuilder()
      .setColor(ColorPalette.Selection)
      .setTitle(`Select a ${namings.trackTerm}`)
      .addFields(
        choices.map((item, index) =>
          createEmbedFieldFromTrack(item, `${index + 1}. `)
        )
      )
      .setFooter({
        text: `You have ${selectionTimeSeconds} seconds to select a ${namings.trackTerm}.`
      });

    const selectionMessage = await interaction.editReply({
      embeds: [selectionEmbed],
      components: buttonRows
    });

    if (selectionMessage === undefined) {
      interaction.editReply('🚫 | Failed to send selection message.');
      return;
    }

    let collected;

    try {
      collected = await selectionMessage.awaitMessageComponent({
        filter: (i: MessageComponentInteraction) => {
          i.deferUpdate();
          return i.user.id === interaction.user.id;
        },
        time: selectionTimeSeconds * 1000,
        componentType: ComponentType.Button
      });
    } catch {
      interaction.editReply({
        content: `🛑 | No ${namings.trackTerm} selected.`,
        embeds: [],
        components: []
      });
      return;
    }

    if (collected.customId === 'cancel') {
      interaction.editReply({
        content: '🛑 | Selection cancelled.',
        embeds: [],
        components: []
      });
      return;
    }

    const trackIndex = parseInt(collected.customId) - 1;

    let queuedTrack: QueuedTrackInfo | QueuedAdaptedTrackInfo;
    if (choices[trackIndex] instanceof AdaptedTrackInfo) {
      queuedTrack = new QueuedAdaptedTrackInfo(
        choices[trackIndex] as AdaptedTrackInfo,
        interaction.user
      );
    } else {
      queuedTrack = new QueuedTrackInfo(choices[trackIndex], interaction.user);
    }

    // TODO: Implement caching of selected track
    // Previous code: storeTrackInCache(queuedTrack);
    guildQueueData.addTracksToQueue(queuedTrack);

    const baseEmbed = new EmbedBuilder()
      .setColor(ColorPalette.Success)
      .setTitle(`Added ${namings.trackTerm} to queue`);

    const replyEmbed = createSimpleEmbedFromTrack(baseEmbed, queuedTrack);

    if (queuedTrack.thumbnail) {
      replyEmbed.setThumbnail(queuedTrack.thumbnail);
    }

    await interaction.editReply({ embeds: [replyEmbed], components: [] });

    startQueuePlayback(interaction.guildId as string);
  }
}

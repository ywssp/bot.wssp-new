import { ChatInputCommand, Command } from '@sapphire/framework';
import {
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  MessageComponentInteraction,
  EmbedBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';

import play, { SoundCloudTrack, YouTubeVideo } from 'play-dl';

import { createGuildMusicData } from '../../../functions/music-utilities/guildMusicDataManager';
import { storeTrackInCache } from '../../../functions/music-utilities/queue-system/trackCacheManager';
import { createFancyEmbedFromTrack } from '../../../functions/music-utilities/queue-system/createFancyEmbedFromTrack';
import { startQueuePlayback } from '../../../functions/music-utilities/queue-system/startQueuePlayback';
import {
  QueuedTrackInfo,
  TrackInfo
} from '../../../interfaces/Music/GuildMusicData/Queue System/TrackInfo';

import { ColorPalette } from '../../../settings/ColorPalette';
import { createEmbedFieldFromTrack } from '../../../functions/music-utilities/queue-system/createEmbedFieldFromTrack';
import {
  SoundCloudTrackNaming,
  YouTubeVideoNaming
} from '../../../settings/TrackNaming';

export class SearchVideosCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'search',
      description: 'Searches for multiple videos on YouTube.',
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

    const voiceChannel = (interaction.member as GuildMember).voice.channel;

    if (voiceChannel === null) {
      interaction.reply({
        content: '❓ | Cannot find voice channel.',
        ephemeral: true
      });
      return;
    }

    const guildQueueData = createGuildMusicData(
      interaction.guildId as string,
      voiceChannel,
      interaction.channel
    ).queueSystemData;

    const source = interaction.options.getSubcommand() as
      | 'youtube'
      | 'soundcloud';
    const query = interaction.options.getString('query', true);

    if (query.length < 3) {
      interaction.reply({
        content: 'The query must be at least 3 characters long.',
        ephemeral: true
      });
      return;
    }

    const namings =
      source === 'youtube' ? YouTubeVideoNaming : SoundCloudTrackNaming;

    interaction.deferReply();

    let choices: TrackInfo[];

    try {
      let searchResult: YouTubeVideo[] | SoundCloudTrack[];
      if (source === 'youtube') {
        searchResult = await play.search(query, {
          limit: 5,
          source: {
            youtube: 'video'
          }
        });
      } else {
        searchResult = await play.search(query, {
          limit: 5,
          source: {
            soundcloud: 'tracks'
          }
        });
      }

      choices = searchResult.map((item) => new TrackInfo(item));
    } catch (error) {
      interaction.editReply({
        content: `❌ | An error occurred while searching for ${namings.trackIdentifier}s.`
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
      .setTitle(`Select a ${namings.trackIdentifier}`)
      .addFields(
        choices.map((item, index) =>
          createEmbedFieldFromTrack(item, String(index + 1))
        )
      )
      .setFooter({
        text: `You have ${selectionTimeSeconds} seconds to select a ${namings.trackIdentifier}.`
      });

    const selectionMessage = await interaction.channel?.send({
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
    } catch (e) {
      interaction.editReply(`🛑 | No ${namings.trackIdentifier} selected.`);
      selectionMessage.delete();
      return;
    }

    selectionMessage.delete();

    if (collected.customId === 'cancel') {
      selectionMessage.delete();
      interaction.editReply({
        content: '🛑 | Selection cancelled.'
      });
      return;
    }

    const videoIndex = parseInt(collected.customId) - 1;

    const queuedTrack = new QueuedTrackInfo(
      choices[videoIndex],
      interaction.user
    );

    storeTrackInCache(queuedTrack);
    guildQueueData.trackList.push(queuedTrack);

    const baseEmbed = new EmbedBuilder()
      .setColor(ColorPalette.Success)
      .setTitle(`Added ${namings.trackIdentifier} to queue`);

    const replyEmbed = createFancyEmbedFromTrack(baseEmbed, queuedTrack);

    if (queuedTrack.thumbnail) {
      replyEmbed.setThumbnail(queuedTrack.thumbnail);
    }

    interaction.editReply({ embeds: [replyEmbed] });

    startQueuePlayback(interaction.guildId as string);
  }
}

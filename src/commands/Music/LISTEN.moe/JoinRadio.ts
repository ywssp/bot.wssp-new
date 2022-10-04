import { ChatInputCommand, Command } from '@sapphire/framework';
import { MessageEmbed, GuildMember } from 'discord.js';

import {
  createAudioPlayer,
  NoSubscriberBehavior,
  createAudioResource,
  AudioPlayerStatus,
  AudioPlayerPlayingState,
  AudioResource,
  AudioPlayer
} from '@discordjs/voice';

import { getGuildMusicData } from '../../../functions/music-utilities/getGuildMusicData';
import { setupRadioWebsocket } from '../../../functions/music-utilities/LISTEN.moe/setupWebsocket';

import { ColorPalette } from '../../../settings/ColorPalette';
import { getPlayingType } from '../../../functions/music-utilities/getPlayingType';
import { getAudioPlayer } from '../../../functions/music-utilities/getAudioPlayer';
import { disconnectRadioWebsocket } from '../../../functions/music-utilities/LISTEN.moe/disconnectWebsocket';
import { connectVoiceChannel } from '../../../functions/music-utilities/connectVoiceChannel';
import internal from 'stream';
import { unsubscribeVoiceConnection } from '../../../functions/music-utilities/unsubscribeVoiceConnection';

export class JoinRadioCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'radio',
      description: 'Joins a LISTEN.moe radio channel.',
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
            .setName('channel')
            .setDescription('The radio station to join.')
            .setRequired(true)
            .addChoices(
              {
                name: 'J-Pop',
                value: 'jpop'
              },
              {
                name: 'K-Pop',
                value: 'kpop'
              }
            )
        )
    );
  }

  public async chatInputRun(interaction: ChatInputCommand.Interaction) {
    const guildMusicData = getGuildMusicData({
      guildId: interaction.guildId as string,
      create: true,
      interaction
    });

    const station = interaction.options.getString('channel') as 'jpop' | 'kpop';

    const stationURL = `https://listen.moe/${
      station === 'kpop' ? '/kpop' : ''
    }/stream`;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const voiceChannel = (interaction.member as GuildMember)!.voice.channel!;

    const voiceConnection = connectVoiceChannel(voiceChannel);

    let audioPlayer: AudioPlayer;

    const playingType = getPlayingType(interaction.guildId as string);

    if (playingType !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      audioPlayer = getAudioPlayer(interaction.guildId as string)!;

      if (playingType === 'radio') {
        if (
          ((
            (audioPlayer?.state as AudioPlayerPlayingState)
              .resource as AudioResource<{ url: string }>
          ).metadata?.url as string) === stationURL
        ) {
          interaction.reply('Already playing from that radio station!');
          return;
        }

        interaction.channel?.send('Switching radio stations...');

        guildMusicData.radioData?.websocket?.connection.close();
        clearTimeout(guildMusicData.radioData?.websocket?.heartbeat);
      } else {
        interaction.channel?.send('Switching to radio...');
      }

      audioPlayer.removeAllListeners().stop();
    } else {
      audioPlayer = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play
        }
      });
    }

    interaction.deferReply();

    audioPlayer.on('error', (error) => {
      this.container.logger.error(error);

      const embed = new MessageEmbed()
        .setColor(ColorPalette.error)
        .setTitle('Playback Error')
        .setDescription(
          'An error occurred while playing music.\nDisconnecting from the voice channel.'
        );

      audioPlayer.removeAllListeners().stop();
      unsubscribeVoiceConnection(interaction.guildId as string);
      voiceConnection.destroy();
      disconnectRadioWebsocket(interaction.guildId as string);
      interaction.channel?.send({
        embeds: [embed]
      });
    });

    audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      const radioStationResource = await this.createRadioStationResource(
        stationURL
      );

      if (radioStationResource === null) {
        const embed = new MessageEmbed()
          .setColor(ColorPalette.error)
          .setTitle('Playback Error')
          .setDescription(
            'An error occurred while playing music.\nDisconnecting from the voice channel.'
          );

        audioPlayer.removeAllListeners().stop();
        unsubscribeVoiceConnection(interaction.guildId as string);
        voiceConnection.destroy();
        interaction.channel?.send({
          embeds: [embed]
        });
        return;
      }

      audioPlayer.play(radioStationResource);
    });

    voiceConnection.subscribe(audioPlayer);

    const radioStationResource = await this.createRadioStationResource(
      stationURL
    );

    if (radioStationResource === null) {
      const embed = new MessageEmbed()
        .setColor(ColorPalette.error)
        .setTitle('Playback Error')
        .setDescription(
          'An error occurred while playing music.\nDisconnecting from the voice channel.'
        );

      audioPlayer.removeAllListeners().stop();
      unsubscribeVoiceConnection(interaction.guildId as string);
      voiceConnection.destroy();
      interaction.channel?.send({
        embeds: [embed]
      });
      return;
    }

    audioPlayer.play(radioStationResource);

    setupRadioWebsocket(interaction.guildId as string, station);

    const embed = new MessageEmbed()
      .setColor(ColorPalette.success)
      .setTitle('Connected')
      .setDescription(
        `Connected to the LISTEN.moe ${
          station === 'kpop' ? 'K-Pop' : 'J-Pop'
        } radio station.`
      );

    interaction.editReply({
      embeds: [embed]
    });
  }

  private async createRadioStationResource(stationURL: string) {
    const radioStream = (await fetch(stationURL)).body;

    if (radioStream === null) {
      return null;
    }

    return createAudioResource(radioStream as unknown as internal.Readable, {
      metadata: {
        title: 'LISTEN.moe Radio',
        url: stationURL,
        type: 'radio'
      }
    });
  }
}

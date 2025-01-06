/* eslint-disable no-use-before-define */
'use strict';

import { container } from '@sapphire/framework';
import {
  EmbedBuilder,
  hideLinkEmbed,
  hyperlink,
  inlineCode,
  User
} from 'discord.js';
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  NoSubscriberBehavior
} from '@discordjs/voice';

import * as playdl from 'play-dl';

import { Readable } from 'stream';

import _ from 'lodash';
import { Duration } from 'luxon';

import { GuildMusicData } from '../../../interfaces/Music/GuildMusicData/GuildMusicData';
import { MusicResourceMetadata } from '../../../interfaces/Music/MusicResourceMetadata';
import { QueuePlaylist } from '../../../interfaces/Music/Queue System/QueuePlaylist';
import {
  AdaptedTrackInfo,
  QueuedAdaptedTrackInfo,
  QueuedTrackInfo,
  TrackInfo
} from '../../../interfaces/Music/Queue System/TrackInfo';
import { ColorPalette } from '../../../settings/ColorPalette';
import { connectToVoiceChannel } from '../connectToVoiceChannel';
import { disposeAudioPlayer } from '../disposeAudioPlayer';
import { getAudioPlayer } from '../getAudioPlayer';
import { getPlayingType } from '../getPlayingType';
import { getGuildMusicData } from '../guildMusicDataManager';
import { disconnectGuildFromRadioWebsocket } from '../radio/disconnectGuildFromRadioWebsocket';
import { createFancyEmbedFromTrack } from './createFancyEmbedFromTrack';
import { createSimpleEmbedFromTrack } from './createSimpleEmbedFromTrack';
import { getTrackNamings } from './getTrackNamings';
import { matchYTMusicToSpotify } from './searchers/spotify';

function sendNowPlayingMessage(musicData: GuildMusicData) {
  const currentTrack = musicData.queueData.getCurrentTrack();
  let nextTrack = musicData.queueData.getQueue()[0];

  if (nextTrack instanceof QueuePlaylist) {
    nextTrack = nextTrack.getRemainingTracks()[0];
  }

  const announceStyle = musicData.announceStyle;

  if (announceStyle === 'none') {
    return;
  }

  if (currentTrack === undefined) {
    throw new Error('No track is currently playing.');
  }

  let message: Parameters<GuildMusicData['sendUpdateMessage']>[0];

  if (announceStyle === 'embed_fancy') {
    const baseEmbed = new EmbedBuilder()
      .setColor(ColorPalette.Info)
      .setTitle('Now Playing');

    const embed = createFancyEmbedFromTrack(baseEmbed, currentTrack).addFields([
      {
        name: 'Added By',
        value: currentTrack.addedBy
      }
    ]);

    if (nextTrack !== undefined) {
      let nextString = '';

      let nextTrackIdentifier = _.capitalize(
        getTrackNamings(nextTrack).trackTerm
      );

      if (musicData.queueData.shuffle) {
        nextString = `🔀 | The next track will be randomly picked from the queue.`;
        nextTrackIdentifier = 'Track';
      } else {
        // Creates a string with a hyperlink to the next track, and a hyperlink to the next track's uploader.        / /
        // If the uploader doesn't have a URL, it will just use the uploader's name.
        // Example: [Next Track Title](<Track URL>) by [Uploader Name](<Optional Uploader URL>)

        const uploaderString = nextTrack.getArtistHyperlinks();

        nextString = `${hyperlink(
          nextTrack.title,
          nextTrack.url
        )} by ${uploaderString}`;
      }

      embed.addFields([
        {
          name: `\u200B`,
          value: '\u200B'
        },
        {
          name: `Next ${nextTrackIdentifier}`,
          value: nextString
        }
      ]);
    } else {
      embed.setFooter({
        text: 'Leaving in 5 minutes after the queue is empty.'
      });
    }

    message = { embeds: [embed] };
  } else if (announceStyle === 'embed_simple') {
    const baseEmbed = new EmbedBuilder()
      .setColor(ColorPalette.Info)
      .setTitle('Now Playing');

    const embed = createSimpleEmbedFromTrack(baseEmbed, currentTrack);
    embed.setDescription(
      embed.data.description + `\nAdded By: ${currentTrack.addedBy}`
    );

    if (nextTrack !== undefined) {
      let nextString = '';

      let nextTrackIdentifier = _.capitalize(
        getTrackNamings(nextTrack).trackTerm
      );

      if (musicData.queueData.shuffle) {
        nextString = `🔀 Shuffled`;
        nextTrackIdentifier = 'Track';
      } else {
        // Creates a string with a hyperlink to the next track, and a hyperlink to the next track's uploader.
        // If the uploader doesn't have a URL, it will just use the uploader's name.
        // Example: [Next Track Title](<Track URL>) by [Uploader Name](<Optional Uploader URL>)

        const uploaderString = nextTrack.getArtistHyperlinks();

        nextString = `${hyperlink(
          nextTrack.title,
          nextTrack.url
        )} by ${uploaderString}`;
      }

      embed.setDescription(
        embed.data.description + `\nNext ${nextTrackIdentifier}: ${nextString}`
      );
    } else {
      embed.setFooter({
        text: 'Leaving in 5 minutes after the queue is empty.'
      });
    }

    message = { embeds: [embed] };
  } else {
    const uploaderString = currentTrack.getArtistHyperlinks();

    let text = `Now Playing:\n${hyperlink(
      currentTrack.title,
      hideLinkEmbed(currentTrack.url)
    )} | By ${uploaderString} | ${
      typeof currentTrack.duration === 'string'
        ? currentTrack.duration
        : currentTrack.duration.toFormat('m:ss')
    } | Added by ${inlineCode(currentTrack.addedBy)}`;

    if (nextTrack) {
      if (musicData.queueData.shuffle) {
        text += '\n🔀 | The next track will be randomly picked from the queue.';
      } else {
        const nextTrackIdentifier = _.capitalize(
          getTrackNamings(nextTrack).trackTerm
        );

        const nextUploaderString = nextTrack.getArtistHyperlinks();

        text += `\n\nNext ${nextTrackIdentifier}:\n${hyperlink(
          nextTrack.title,
          hideLinkEmbed(nextTrack.url)
        )} | By ${nextUploaderString}`;
      }
    } else {
      text += '\n\nLeaving in 5 minutes after the queue is empty.';
    }

    message = text;
  }

  musicData.sendUpdateMessage(message);
}

function handleTrackEnd(guildId: string) {
  const musicData = getGuildMusicData(guildId);

  if (musicData === undefined) {
    return;
  }

  const queueData = musicData.queueData;

  if (
    queueData.loop.type === 'queue' &&
    queueData.getCurrentTrack() !== undefined
  ) {
    queueData.addTracksToQueue(queueData.getCurrentTrack()!);
  }

  if (queueData.loop.type !== 'track' && !queueData.skipped) {
    queueData.advanceQueue(1, false);
  }

  const isQueueEmpty = queueData.getCurrentTrack() === undefined;

  const isVCEmpty =
    musicData.getVoiceChannel().members.filter((member) => !member.user.bot)
      .size === 0;

  // If the queue is empty or the voice channel is empty, start a timeout to leave the voice channel
  // Only start the timeout if it hasn't been started yet
  if ((isVCEmpty || isQueueEmpty) && musicData.leaveTimeout === null) {
    const embed = new EmbedBuilder().setColor(ColorPalette.Notice);

    if (isQueueEmpty) {
      embed.setTitle('Queue Empty');
      embed.setDescription(
        'No more tracks in the queue. Leaving in 5 minutes...'
      );
    } else {
      embed.setTitle('No Users in Voice Channel');
      embed.setDescription(
        'No users are inside the voice channel. Leaving in 5 minutes...'
      );
    }

    musicData.sendUpdateMessage({ embeds: [embed] });

    musicData.leaveTimeout = setTimeout(() => {
      const futureMusicData = getGuildMusicData(guildId);

      const futureQueueEmpty =
        futureMusicData?.queueData.getQueue().length === 0;

      const futureVCEmpty =
        futureMusicData === undefined ||
        futureMusicData
          .getVoiceChannel()
          .members.filter((member) => !member.user.bot).size === 0;

      const timeoutEmbed = new EmbedBuilder().setColor(ColorPalette.Error);

      if (futureQueueEmpty) {
        timeoutEmbed.setTitle('Queue Empty');
        timeoutEmbed.setDescription('No more tracks in the queue. Stopping...');
      } else if (futureVCEmpty) {
        timeoutEmbed.setTitle('No Users in Voice Channel');
        timeoutEmbed.setDescription(
          'No users are inside the voice channel. Stopping...'
        );
      }

      if (futureQueueEmpty || futureVCEmpty) {
        futureMusicData?.sendUpdateMessage({ embeds: [timeoutEmbed] });

        queueData.playing = false;
        disposeAudioPlayer(guildId);
        getVoiceConnection(guildId)?.destroy();
      }
    }, 5 * 60 * 1000);
  }

  // Do not continue if the queue is empty
  if (isQueueEmpty) {
    return;
  }

  if (queueData.shuffle && queueData.loop.type !== 'track') {
    const randomIndex = Math.floor(Math.random() * queueData.getQueue().length);

    const selectedTrack = queueData.trackQueue.splice(randomIndex, 1)[0];

    queueData.addTracksToQueue(selectedTrack);
  }

  const audioPlayer = getAudioPlayer(guildId);

  if (audioPlayer === undefined) {
    musicData.sendUpdateMessage({
      content: '❌ | An error occurred while trying to play the next track.'
    });
    return;
  }

  if (!isQueueEmpty) {
    playTrack(queueData.getCurrentTrack()!, audioPlayer, musicData);
  }
}

async function playTrack(
  track: QueuedTrackInfo | QueuedAdaptedTrackInfo,
  audioPlayer: AudioPlayer,
  musicData: GuildMusicData
) {
  if (
    track.source === 'spotify' &&
    !(track instanceof QueuedAdaptedTrackInfo)
  ) {
    const matchedTrack = await matchYTMusicToSpotify(track);

    if (matchedTrack === null) {
      const errorEmbed = new EmbedBuilder()
        .setColor(ColorPalette.Error)
        .setTitle('Match Error')
        .setDescription(
          `An error occurred while trying to match the Spotify track [${track.title}](${track.url}).`
        );

      musicData.sendUpdateMessage({
        embeds: [errorEmbed]
      });

      handleTrackEnd(musicData.guildId);

      return;
    }

    track = new QueuedAdaptedTrackInfo(
      new AdaptedTrackInfo({
        track: new TrackInfo(track),
        matchedTrack
      }),
      {
        tag: track.addedBy
      } as User
    );

    musicData.queueData.updateCurrentTrack(track);
  }

  const metadata: MusicResourceMetadata = {
    type: 'queued_track',
    data: track
  };

  let audioTrack: TrackInfo;

  if (track instanceof QueuedAdaptedTrackInfo) {
    audioTrack = track.matchedTrack;
  } else {
    audioTrack = track;
  }

  let resource: AudioResource;
  if (
    audioTrack.source === 'youtube' ||
    audioTrack.source === 'youtube_music'
  ) {
    const streamedTrack = await container.innertube.download(audioTrack.id, {
      type: 'video+audio',
      quality: 'best',
      client: 'YTMUSIC'
    });

    const readableStream = Readable.from(streamedTrack);

    resource = createAudioResource(readableStream, {
      metadata
    });
  } else {
    const streamedTrack = await playdl.stream(audioTrack.url, {
      quality: 2
    });

    streamedTrack.stream.on('error', (error) => {
      container.logger.error(error);
      audioPlayer.stop();
    });

    resource = createAudioResource(streamedTrack.stream, {
      inputType: streamedTrack.type,
      metadata
    });
  }

  audioPlayer.play(resource);

  const trackSkipped = musicData.queueData.skipped;
  const isLoopingByTrack = musicData.queueData.loop.type === 'track';

  // Do not send the now playing message if the track has looped successfully
  // This will only run when the loop type isn't 'track', or
  // When the loop type is 'track' and the track was skipped
  if (!(!trackSkipped && isLoopingByTrack)) {
    musicData.queueData.skipped = false;

    musicData.queueData.trackHistory.push(track);

    sendNowPlayingMessage(musicData);
  }
}

export function startQueuePlayback(guildId: string) {
  const playingType = getPlayingType(guildId);

  // If the bot is already playing a track from the queue, do not start queue playback
  if (playingType === 'queued_track') {
    return;
  }

  const guildMusicData = getGuildMusicData(guildId);

  if (guildMusicData === undefined) {
    throw new Error(`No guild music data exists for guild ${guildId}`);
  }

  if (guildMusicData.leaveTimeout !== null) {
    clearTimeout(guildMusicData.leaveTimeout);
    guildMusicData.leaveTimeout = null;
  }

  const queueData = guildMusicData.queueData;

  const voiceConnection = connectToVoiceChannel(
    guildMusicData.getVoiceChannel()
  );

  disposeAudioPlayer(guildId);
  let audioPlayer = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play
    }
  });

  // Handles the switch of the source of the audio player
  if (playingType === 'radio') {
    guildMusicData.sendUpdateMessage(`Disconnecting from the radio...`);

    // Disconnects the guild from the radio websocket
    disconnectGuildFromRadioWebsocket(guildId);
  }

  if (
    queueData.getCurrentTrack() === undefined &&
    queueData.getQueue().length > 0
  ) {
    queueData.advanceQueue(1, false);
  }

  audioPlayer = audioPlayer.on('error', (error) => {
    const resourceMetadata = (error.resource.metadata as MusicResourceMetadata)
      .data as QueuedTrackInfo;

    const erroredTrackTimestamp = Duration.fromMillis(
      error.resource.playbackDuration
    ).toFormat('m:ss');

    container.logger.error(
      `An error occurred while playing ${resourceMetadata.title} | ${resourceMetadata.url} in the ${erroredTrackTimestamp} mark\n${error.stack}`
    );

    const localMusicData = getGuildMusicData(guildId);

    if (localMusicData === undefined) {
      return;
    }

    const baseEmbed = new EmbedBuilder()
      .setColor(ColorPalette.Error)
      .setTitle('Playback Error');

    const embed = createFancyEmbedFromTrack(baseEmbed, resourceMetadata);

    if (resourceMetadata.duration !== 'Live Stream') {
      embed.spliceFields(2, 1, {
        name: 'Timestamp of Error',
        value: `${erroredTrackTimestamp} / ${resourceMetadata.duration.toFormat(
          'm:ss'
        )}`
      });
    }

    embed.addFields({
      name: 'Error',
      value: `${error.name}: ${error.message}`
    });

    localMusicData.sendUpdateMessage({ embeds: [embed] });
  });

  voiceConnection.subscribe(audioPlayer);

  queueData.playing = true;
  playTrack(queueData.getCurrentTrack()!, audioPlayer, guildMusicData);

  audioPlayer.on(AudioPlayerStatus.Idle, () => handleTrackEnd(guildId));
}

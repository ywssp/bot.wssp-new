'use strict';

import { container } from '@sapphire/pieces';

import { Duration } from 'luxon';

import { RadioWebsocketUpdateData } from '../../../interfaces/Music/Radio/RadioWebsocketUpdate';
import { getGuildMusicData } from '../guildMusicDataManager';
import { createFancyRadioSongEmbed } from './createFancyEmbedFromRadioSong';
import { createSimpleRadioSongEmbed } from './createSimpleEmbedFromRadioSong';

export function sendRadioUpdate(
  guildId: string,
  data: RadioWebsocketUpdateData
) {
  const guildMusicData = getGuildMusicData(guildId);

  if (guildMusicData === undefined) {
    container.logger.error(
      `Guild ${guildId} does not have music data! Removing from radio websocket!`
    );
    throw Error('Guild does not have music data!');
  }

  if (guildMusicData.announceStyle === 'embed_fancy') {
    const embed = createFancyRadioSongEmbed(data.song);

    guildMusicData.sendUpdateMessage({ embeds: [embed] });
  } else if (guildMusicData.announceStyle === 'embed_simple') {
    const embed = createSimpleRadioSongEmbed(data.song);

    guildMusicData.sendUpdateMessage({ embeds: [embed] });
  } else if (guildMusicData.announceStyle === 'text_simple') {
    const artistNames = data.song.artists
      .map((artist) => artist.name)
      .join(', ');

    let formattedDuration;
    if (data.song.duration !== 0) {
      formattedDuration = Duration.fromObject({
        seconds: data.song.duration
      }).toFormat('mm:ss');
    }

    guildMusicData.sendUpdateMessage(
      `Now playing: ${data.song.title} by ${artistNames} | ${
        formattedDuration ? formattedDuration : 'Unknown Length'
      }`
    );
  }
}

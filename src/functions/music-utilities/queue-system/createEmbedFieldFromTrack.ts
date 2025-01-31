'use strict';

import { EmbedField, hyperlink } from 'discord.js';

import { TrackInfo } from '../../../interfaces/Music/Queue System/TrackInfo';

/**
 * Creates an embed field from a track.
 * @param track The track to create the embed field from.
 * @param prefix The prefix to add to the track title.
 * @returns The embed field.
 */
export function createEmbedFieldFromTrack(
  track: TrackInfo,
  prefix?: string
): EmbedField {
  let name = '';

  if (prefix) {
    name += prefix + ' ';
  }

  name += track.title;

  const linkString = hyperlink('Link', track.url);

  const uploaderString = track.getArtistHyperlinks();

  let durationString: string;
  if (typeof track.duration === 'string') {
    durationString = track.duration;
  } else {
    durationString = track.duration.toFormat('m:ss');
  }

  const value = `${linkString} | ${durationString} | By ${uploaderString}`;

  return {
    name,
    value,
    inline: false
  };
}

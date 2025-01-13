'use strict';

import { QueuePlaylist } from '../Queue System/QueuePlaylist';
import {
  QueuedAdaptedTrackInfo,
  QueuedTrackInfo
} from '../Queue System/TrackInfo';

export type QueueItem = QueuedTrackInfo | QueuedAdaptedTrackInfo;

export class QueueSystemData {
  trackList: (QueueItem | QueuePlaylist)[];
  trackHistory: QueueItem[];
  currentTrack?: QueueItem;
  progressIndex: number;

  playing: boolean;
  /**
   * Whether the current track was skipped
   */
  skipped: boolean;
  /**
   * How the queue should loop
   * 'off' - The queue will not loop
   * 'track' - The current track will loop
   * 'queue' - The entire queue will loop
   * @default 'off'
   */
  loop:
    | { type: 'off'; emoji: '➡️' }
    | { type: 'track'; emoji: '🔂' }
    | { type: 'queue'; emoji: '🔁' };
  looped: boolean;

  constructor() {
    this.trackList = [];
    this.trackHistory = [];
    this.progressIndex = 0;

    this.playing = false;
    this.skipped = false;
    this.loop = {
      type: 'off',
      emoji: '➡️'
    };
    this.looped = false;
  }

  /**
   * Returns the track currently being played
   */
  getCurrentTrack() {
    return this.currentTrack;
  }

  /**
   * Updates the current track with the given track
   * @param track The track to update the current track with
   */
  updateCurrentTrack(track: typeof this.currentTrack) {
    this.currentTrack = track;
  }

  /**
   * Returns the array of tracks that will be played next
   */
  getQueue(): typeof this.trackList {
    return this.trackList.slice(this.progressIndex);
  }

  /**
   * Returns the array of tracks recently played
   */
  getHistory(): typeof this.trackHistory {
    return this.trackHistory;
  }

  addTracksToQueue(...track: typeof this.trackList) {
    this.trackList.push(...track);
  }

  addTracksToQueueStart(...track: typeof this.trackList) {
    this.trackList.splice(this.progressIndex, 0, ...track);
  }

  addPlaylistToQueue(playlist: QueuePlaylist) {
    this.trackList.push(playlist);
  }

  advanceQueue(amount: number, skip: boolean): QueueItem[] {
    if (skip) {
      this.markSkipped();
    }

    const skippedTracks: QueueItem[] = [];

    while (amount > 0) {
      if (this.trackList.length === this.progressIndex) {
        break;
      }

      let tracks: QueueItem[];

      const currentItem = this.trackList[this.progressIndex];

      if (currentItem instanceof QueuePlaylist) {
        const playlist = currentItem;

        tracks = playlist.advanceTrack(amount);
        amount -= tracks.length;

        const remainingTracks = playlist.getRemainingTracksCount();

        if (remainingTracks === 0) {
          this.progressIndex++;
        }
      } else {
        tracks = [currentItem];
        this.progressIndex++;
        amount--;
      }

      skippedTracks.push(...tracks);

      this.loopQueue();
    }

    this.updateCurrentTrack(skippedTracks.pop());

    return skippedTracks;
  }

  setLoopType(type: typeof this.loop.type) {
    this.loop = {
      type,
      emoji: ['➡️', '🔂', '🔁'][['off', 'track', 'queue'].indexOf(type)]
    } as typeof this.loop;

    this.loopQueue();
  }

  loopQueue() {
    if (
      this.loop.type === 'queue' &&
      this.progressIndex >= this.trackList.length
    ) {
      this.progressIndex = 0;

      for (const item of this.trackList) {
        if (item instanceof QueuePlaylist) {
          item.reinitTrackOrder();
        }
      }

      this.markLooped();
    }
  }

  /**
   * Marks the current track as skipped
   * This will cause the track to be skipped when the audio player emits the Idle event, even if the loop type is 'track'
   * This should be called when the track is skipped manually
   */
  markSkipped() {
    this.skipped = true;
  }

  markLooped() {
    this.looped = true;
  }
}

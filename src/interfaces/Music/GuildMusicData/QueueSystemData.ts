'use strict';

import {
  QueuedAdaptedTrackInfo,
  QueuedTrackInfo
} from '../Queue System/TrackInfo';

export type QueueItem = QueuedTrackInfo | QueuedAdaptedTrackInfo;

export class QueueSystemData {
  trackQueue: QueueItem[];
  trackHistory: QueueItem[];
  currentTrack?: QueueItem;

  playing: boolean;
  /**
   * Whether the current track was skipped
   */
  skipped: boolean;
  shuffle: boolean;
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

  constructor() {
    this.trackQueue = [];
    this.trackHistory = [];
    this.playing = false;
    this.skipped = false;
    this.shuffle = false;
    this.loop = {
      type: 'off',
      emoji: '➡️'
    };
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
  getQueue(): typeof this.trackQueue {
    return this.trackQueue;
  }

  /**
   * Returns the array of tracks recently played
   */
  getHistory(): typeof this.trackHistory {
    return this.trackHistory;
  }

  addTracksToQueue(...track: typeof this.trackQueue) {
    this.trackQueue.push(...track);
  }

  advanceQueue(amount: number, skip: boolean): QueueItem[] {
    if (this.loop.type === 'track' && !skip) {
      return [];
    }

    if (skip) {
      this.markSkipped();
    }

    const skippedTracks = this.trackQueue.splice(0, amount);

    this.updateCurrentTrack(skippedTracks[skippedTracks.length - 1]);

    return skippedTracks;
  }

  setLoopType(type: typeof this.loop.type) {
    this.loop = {
      type,
      emoji: ['➡️', '🔂', '🔁'][['off', 'track', 'queue'].indexOf(type)]
    } as typeof this.loop;
  }

  /**
   * Marks the current track as skipped
   * This will cause the track to be skipped when the audio player emits the Idle event, even if the loop type is 'track'
   * This should be called when the track is skipped manually
   */
  markSkipped() {
    this.skipped = true;
  }
}

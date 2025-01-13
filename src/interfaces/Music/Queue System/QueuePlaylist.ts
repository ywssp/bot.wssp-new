'use strict';

import _ from 'lodash';
import seedrandom from 'seedrandom';

import { QueueItem } from '../GuildMusicData/QueueSystemData';

export class QueuePlaylist {
  title: string;
  url: string;

  trackList: QueueItem[];
  trackOrder: number[] = [];
  trackOrderLoop: number[] = [];
  currentIndex?: number;

  shuffled: boolean;
  shuffleSeed?: string;
  queueLoop: boolean;

  constructor(
    title: typeof this.title,
    url: typeof this.url,
    trackList: typeof this.trackList,
    shuffled: typeof this.shuffled,
    loop: typeof this.queueLoop
  ) {
    this.title = title;
    this.url = url;

    this.trackList = trackList;
    this.initTrackOrder();

    this.shuffled = shuffled;
    this.queueLoop = loop;

    if (this.shuffled) {
      this.shuffle();
    }
  }

  initTrackOrder() {
    this.unshuffle();
  }

  generateSeed() {
    let generatedSeed = '';

    // Make sure the generated seed is different from the current one
    do {
      generatedSeed = Math.random().toString(36).substring(2);
    } while (generatedSeed === this.shuffleSeed);

    this.shuffleSeed = generatedSeed.substring(0, 16);
  }

  reinitTrackOrder() {
    this.currentIndex = undefined;

    const shuffled = this.shuffled;

    this.initTrackOrder();

    if (shuffled) {
      this.shuffle();
    }
  }

  reshuffle() {
    this.generateSeed();
    this.shuffle();
  }

  shuffle() {
    this.unshuffle();

    if (this.shuffleSeed === undefined) {
      this.generateSeed();
    }

    this.shuffled = true;
    const rng = seedrandom(this.shuffleSeed);

    const fullOrder = _.uniq(this.trackOrderLoop.slice().sort((a, b) => a - b));

    for (let i = fullOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [fullOrder[i], fullOrder[j]] = [fullOrder[j], fullOrder[i]];
    }

    // If there is a current track, progress the shuffled order to the current track
    if (this.currentIndex !== undefined) {
      while (fullOrder[0] !== this.currentIndex) {
        fullOrder.push(fullOrder.shift() as number);
      }

      // Remove the current track from the shuffled order
      fullOrder.shift();
    }

    this.trackOrder = fullOrder.slice();
    this.trackOrderLoop = fullOrder.slice();
  }

  unshuffle() {
    this.shuffled = false;

    const startPoint = (this.currentIndex ?? -1) + 1;
    this.trackOrder = [];
    this.trackOrderLoop = [];

    let i = startPoint;

    do {
      if (i >= startPoint) {
        this.trackOrder.push(i);
      }

      this.trackOrderLoop.push(i);

      i++;
      if (i === this.trackList.length) {
        i = 0;
      }
    } while (i !== startPoint);
  }

  getUsedQueue(): typeof this.trackOrder {
    if (this.queueLoop) {
      return this.trackOrderLoop;
    }

    return this.trackOrder;
  }

  getRemainingTracks(): (typeof this.trackList)[number][] {
    const usedQueue = this.getUsedQueue();

    return usedQueue.map((index) => this.trackList[index]);
  }

  getRemainingTracksCount(): number {
    const usedQueue = this.getUsedQueue();

    return usedQueue.length;
  }

  advanceTrack(amount: number): typeof this.trackList {
    if (amount <= 0) {
      throw new Error('Invalid amount');
    }

    // Remove indexes from both trackOrder arrays
    const originalSplice = this.trackOrder.splice(0, amount);
    const loopSplice = this.trackOrderLoop.splice(0, amount);

    const removedIndexes = this.queueLoop ? loopSplice : originalSplice;

    // Do not extend trackOrderLoop if the amount skipped is greater than the remaining tracks
    if (loopSplice.length === amount) {
      this.trackOrderLoop.push(...removedIndexes);
    }

    // If the original trackOrder becomes empty, set it to the looped one
    if (this.trackOrder.length === 0 && this.queueLoop) {
      this.trackOrder = this.trackOrderLoop.slice();
    }

    this.currentIndex = removedIndexes[removedIndexes.length - 1];

    return removedIndexes.map((index) => this.trackList[index]);
  }
}

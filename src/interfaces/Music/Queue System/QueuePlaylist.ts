'use strict';

import { QueueItem } from '../GuildMusicData/QueueSystemData';

export class QueuePlaylist {
  title: string;
  url: string;

  trackList: QueueItem[];
  trackOrder: number[] = [];
  trackOrderLoop: number[] = [];
  currentIndex?: number;

  shuffled: boolean;
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

  shuffle() {
    this.shuffled = true;

    for (let i = this.trackOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.trackOrder[i], this.trackOrder[j]] = [
        this.trackOrder[j],
        this.trackOrder[i]
      ];
    }
  }

  unshuffle() {
    this.shuffled = false;

    const startPoint = (this.currentIndex ?? -1) + 1;
    this.trackOrder = [];

    for (let i = startPoint; i < this.trackList.length; i++) {
      this.trackOrder.push(i);
    }

    this.trackOrderLoop = this.trackOrder.slice();
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

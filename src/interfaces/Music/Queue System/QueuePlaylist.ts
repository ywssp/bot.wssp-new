'use strict';

import { QueueItem } from '../GuildMusicData/QueueSystemData';

export class QueuePlaylist {
  title: string;
  url: string;

  trackList: QueueItem[];
  trackOrder: number[] = [];
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
    for (let i = this.trackOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.trackOrder[i], this.trackOrder[j]] = [
        this.trackOrder[j],
        this.trackOrder[i]
      ];
    }
  }

  unshuffle() {
    const startPoint = (this.currentIndex ?? -1) + 1;
    this.trackOrder = [];

    for (let i = startPoint; i < this.trackList.length; i++) {
      this.trackOrder.push(i);
    }
  }

  getRemainingTracks(): (typeof this.trackList)[number][] {
    return this.trackOrder.map((index) => this.trackList[index]);
  }

  getRemainingTracksCount(): number {
    return this.trackOrder.length;
  }

  advanceTrack(amount: number): typeof this.trackList {
    if (amount < 0 || amount > this.trackOrder.length) {
      throw new Error('Invalid amount');
    }

    const removedIndexes = this.trackOrder.splice(0, amount);
    this.currentIndex = removedIndexes[removedIndexes.length - 1];

    return removedIndexes.map((index) => this.trackList[index]);
  }
}

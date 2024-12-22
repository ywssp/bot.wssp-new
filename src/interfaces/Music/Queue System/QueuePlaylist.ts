'use strict';

import { QueueSystemData } from '../GuildMusicData/QueueSystemData';

export class QueuePlaylist {
  title: string;
  url: string;

  trackList: QueueSystemData['trackQueue'];
  trackOrder: number[] = [];
  shuffled: boolean;
  loop: 'off' | 'track' | 'queue';

  constructor(
    title: string,
    url: string,
    trackList: typeof this.trackList,
    shuffled: boolean,
    loop: typeof this.loop
  ) {
    this.title = title;
    this.url = url;

    this.trackList = trackList;
    this.initTrackOrder();

    this.shuffled = shuffled;
    this.loop = loop;

    if (this.shuffled) {
      this.shuffle();
    }
  }

  initTrackOrder() {
    this.trackOrder = [0];

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
    const startPoint = this.trackOrder[0];
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

  advanceTrack(amount: number, skip: boolean): (typeof this.trackList)[number] {
    if (this.loop === 'track' && !skip) {
      return this.trackList[this.trackOrder[0]];
    }

    if (amount < 0 || amount >= this.trackOrder.length) {
      throw new Error('Invalid amount');
    }

    this.trackOrder.splice(0, amount);

    return this.trackList[this.trackOrder[0]];
  }
}

'use strict';

import { container } from '@sapphire/framework';

import { BG, type BgConfig } from 'bgutils-js';
import { JSDOM } from 'jsdom';
// eslint-disable-next-line import/no-unresolved
import { Innertube, UniversalCache } from 'youtubei.js';

// Code based on example in BgUtils (https://github.com/LuanRT/BgUtils/tree/main/examples/node)
export async function innertubeSetup() {
  // Create a barebones Innertube instance so we can get a visitor data string from YouTube.
  container.innertube = await Innertube.create({ retrieve_player: false });

  const requestKey = 'O43z0dpjhgX20SCx4KAo';
  const visitorData = container.innertube.session.context.client.visitorData;

  if (!visitorData) {
    throw new Error('Could not get visitor data');
  }

  const dom = new JSDOM();

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document
  });

  const bgConfig: BgConfig = {
    fetch: (input: string | URL | globalThis.Request, init?: RequestInit) =>
      fetch(input, init),
    globalObj: globalThis,
    identifier: visitorData,
    requestKey
  };

  const bgChallenge = await BG.Challenge.create(bgConfig);

  if (!bgChallenge) {
    throw new Error('Could not get challenge');
  }

  const interpreterJavascript =
    bgChallenge.interpreterJavascript
      .privateDoNotAccessOrElseSafeScriptWrappedValue;

  if (interpreterJavascript) {
    // eslint-disable-next-line no-new-func
    new Function(interpreterJavascript)();
  } else {
    throw new Error('Could not load VM');
  }

  const poTokenResult = await BG.PoToken.generate({
    program: bgChallenge.program,
    globalName: bgChallenge.globalName,
    bgConfig
  });

  container.logger.info('Innertube Session Info Generated');

  container.innertube = await Innertube.create({
    po_token: poTokenResult.poToken,
    visitor_data: visitorData,
    cache: new UniversalCache(true),
    generate_session_locally: true
  });
}

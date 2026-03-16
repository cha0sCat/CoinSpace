const exchanges = {};

if (process.env.CHANGELLY_API_SECRET) {
  exchanges.changelly = await import('./changelly.js');
}

if (process.env.CHANGENOW_API_KEY) {
  exchanges.changenow = await import('./changenow.js');
}

export default exchanges;

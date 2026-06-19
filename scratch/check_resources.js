// Scratch: Check actual referenced resources load OK
const paths = [
  '/js/app.js',
  '/js/core/appFactory.js',
  '/styles/retro-terminal.css',
  '/styles/entry-signup-shell.css',
  '/styles/entry-signup-inline.css',
  '/styles/entry-signup-theme.css',
  '/styles/entry-auth.css',
  '/style.css',
  '/favicon.png',
  '/favicon.svg'
];

(async () => {
  for (const p of paths) {
    try {
      const res = await fetch('http://localhost:3000' + p);
      const body = await res.text();
      console.log(`${res.status} ${p} (${body.length} bytes)`);
    } catch (e) {
      console.log(`ERR ${p}: ${e.message}`);
    }
  }
})();

// Scratch: Check what resources the main HTML loads
fetch('http://localhost:3000/')
  .then(r => r.text())
  .then(html => {
    // script src
    const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
    let m;
    console.log('=== SCRIPT SRC ===');
    while ((m = scriptRe.exec(html)) !== null) console.log(m[1]);

    // link href (css)
    const linkRe = /<link[^>]+href=["']([^"']+)["']/gi;
    console.log('=== LINK HREF ===');
    while ((m = linkRe.exec(html)) !== null) console.log(m[1]);

    // inline module imports
    const importRe = /import\s+.*?from\s+["']([^"']+)["']/g;
    console.log('=== MODULE IMPORTS ===');
    while ((m = importRe.exec(html)) !== null) console.log(m[1]);

    // Check for console.error or error patterns
    console.log('\n=== HTML length:', html.length, '===');
  })
  .catch(e => console.error('FETCH ERROR:', e.message));

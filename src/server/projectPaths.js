const path = require('path');

function projectRoot(fromDir = __dirname) {
  return path.resolve(fromDir, '../..');
}

function defaultLegacyPaths(rootDir = projectRoot(__dirname)) {
  return {
    rootDir,
    legacyDir: path.join(rootDir, 'legacy'),
    legacyTxtPath: path.join(rootDir, 'legacy', 'txt'),
    menuFilePath: path.join(rootDir, 'legacy', 'hanulso.mnu'),
    newsMenuPath: path.join(rootDir, 'legacy', 'news.mnu'),
    weatherMenuPath: path.join(rootDir, 'legacy', 'weather.mnu')
  };
}

function resolveLegacyPaths(env = process.env, rootDir = projectRoot(__dirname)) {
  const defaults = defaultLegacyPaths(rootDir);
  return {
    rootDir,
    legacyDir: defaults.legacyDir,
    legacyTxtPath: env.LEGACY_TXT_PATH || defaults.legacyTxtPath,
    menuFilePath: env.MENU_FILE_PATH || defaults.menuFilePath,
    newsMenuPath: env.NEWS_MENU_FILE_PATH || defaults.newsMenuPath,
    weatherMenuPath: env.WEATHER_MENU_FILE_PATH || defaults.weatherMenuPath
  };
}

module.exports = {
  projectRoot,
  defaultLegacyPaths,
  resolveLegacyPaths
};

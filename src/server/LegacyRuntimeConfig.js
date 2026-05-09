'use strict';

const fs = require('fs');
const path = require('path');
const { projectRoot } = require('./projectPaths');
const logger = require('./logger');

const DEFAULT_LEVEL_ALIASES = {
  1: '일반회원',
  2: '특별회원',
  99: '운영자'
};

function decodeFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (utf8Error) {
    try {
      return new TextDecoder('windows-949').decode(buffer);
    } catch (cp949Error) {
      return buffer.toString('utf8');
    }
  }
}

function extractTagBlock(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = String(xml || '').match(pattern);
  return match ? match[1] : '';
}

function extractTagValues(xml, tagName) {
  const values = [];
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'ig');
  let match = null;
  while ((match = pattern.exec(String(xml || '')))) {
    values.push(String(match[1] || '').trim());
  }
  return values;
}

function parseLevelAliases(raw) {
  const aliases = {};
  for (const entry of String(raw || '').split(/[;,]/)) {
    const text = String(entry || '').trim();
    if (!text) continue;
    const match = text.match(/^(\d+)\s*[:=]\s*(.+)$/);
    if (!match) continue;
    aliases[Number(match[1])] = String(match[2] || '').trim();
  }
  return aliases;
}

function normalizeLevelAliases(levelAliases = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(levelAliases || {})) {
    const level = Number(key);
    const label = String(value || '').trim();
    if (!Number.isFinite(level) || !label) continue;
    normalized[level] = label;
  }
  if (!normalized[99]) {
    normalized[99] = DEFAULT_LEVEL_ALIASES[99];
  }
  return Object.keys(normalized)
    .map((key) => Number(key))
    .sort((left, right) => left - right)
    .reduce((acc, level) => {
      acc[level] = normalized[level];
      return acc;
    }, {});
}

function unique(values = []) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function resolveLegacyRuntimeConfig(env = process.env, rootDir = projectRoot(__dirname)) {
  const settingsPath = String(
    env.LEGACY_SETTINGS_PATH ||
    env.HANULSO_CONFIG_PATH ||
    path.join(rootDir, 'legacy', 'hanulso.cfg')
  ).trim();

  let hostName = String(env.BBS_HOST_NAME || '').trim();
  let levelAliases = { ...DEFAULT_LEVEL_ALIASES };
  let sysopUserIds = [];

  if (settingsPath && fs.existsSync(settingsPath) && fs.lstatSync(settingsPath).isFile()) {
    try {
      const xml = decodeFile(settingsPath);
      hostName = hostName || String(extractTagBlock(xml, 'name') || '').trim();
      const sysopBlock = extractTagBlock(xml, 'sysop');
      sysopUserIds = unique(extractTagValues(sysopBlock, 'user'));
      const levelBlock = extractTagBlock(xml, 'level');
      const parsedAliases = {};
      for (const alias of extractTagValues(levelBlock, 'alias')) {
        const parts = String(alias || '').split(',');
        if (parts.length < 2) continue;
        const level = Number(parts[0]);
        const label = String(parts.slice(1).join(',') || '').trim();
        if (!Number.isFinite(level) || !label) continue;
        parsedAliases[level] = label;
      }
      levelAliases = { ...levelAliases, ...parsedAliases };
    } catch (error) {
      logger.warn('failed to parse settings', { component: 'LegacyRuntimeConfig', error: error.message });
    }
  }

  levelAliases = {
    ...levelAliases,
    ...parseLevelAliases(env.BBS_LEVEL_ALIASES)
  };

  sysopUserIds = unique([
    ...sysopUserIds,
    ...String(env.BBS_ADMIN_USER_IDS || '')
      .split(',')
      .map((value) => value.trim())
  ]);

  const normalizedAliases = normalizeLevelAliases(levelAliases);
  const validLevels = Object.keys(normalizedAliases).map((value) => Number(value));

  return {
    hostName,
    levelAliases: normalizedAliases,
    validLevels,
    sysopUserIds
  };
}

module.exports = {
  DEFAULT_LEVEL_ALIASES,
  resolveLegacyRuntimeConfig
};

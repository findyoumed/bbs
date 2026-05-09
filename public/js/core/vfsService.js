/**
 * vfsService.js
 * [LOG: 20260429_0100] Evolution Mode 23/500: Virtual File System (VFS)
 * [LOG: 20260429_0210] Evolution Mode 24/500: Enhanced VFS with Metadata & Migration
 */

export function createVfsService(deps) {
  const { state, settingsService } = deps;

  // Initialize VFS if not present in state
  if (!state.vfs) {
    const rawVfs = settingsService ? settingsService.loadVfs() : {};
    state.vfs = migrateVfs(rawVfs);
  }

  /**
   * Migrate old string-based VFS to object-based with metadata.
   */
  function migrateVfs(oldVfs) {
    const newVfs = {};
    const now = Date.now();
    for (const key in oldVfs) {
      const value = oldVfs[key];
      if (typeof value === 'string') {
        newVfs[key] = {
          content: value,
          createdAt: now,
          updatedAt: now,
          size: value.length
        };
      } else {
        newVfs[key] = value;
      }
    }
    return newVfs;
  }

  function listFiles() {
    return Object.keys(state.vfs).sort().map(name => ({
      name,
      ...state.vfs[name]
    }));
  }

  function getFile(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    const file = state.vfs[key];
    return file ? file.content : null;
  }

  function getFileMeta(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    return state.vfs[key] || null;
  }

  function writeFile(name, content) {
    if (!name) return false;
    const key = name.toLowerCase();
    const now = Date.now();
    const existing = state.vfs[key];
    
    state.vfs[key] = {
      content,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      size: content.length
    };

    if (settingsService) {
      settingsService.saveVfs(state.vfs);
    }
    return true;
  }

  function appendFile(name, content) {
    if (!name) return false;
    const key = name.toLowerCase();
    const now = Date.now();
    const existing = state.vfs[key];
    
    const newContent = existing ? (existing.content + '\n' + content) : content;
    
    state.vfs[key] = {
      content: newContent,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      size: newContent.length
    };

    if (settingsService) {
      settingsService.saveVfs(state.vfs);
    }
    return true;
  }

  function removeFile(name) {
    if (!name) return false;
    const key = name.toLowerCase();
    if (state.vfs[key] !== undefined) {
      delete state.vfs[key];
      if (settingsService) {
        settingsService.saveVfs(state.vfs);
      }
      return true;
    }
    return false;
  }

  function clearVfs() {
    state.vfs = {};
    if (settingsService) {
      settingsService.saveVfs(state.vfs);
    }
  }

  /**
   * Search for a pattern within all files in the VFS.
   */
  function searchFiles(pattern) {
    const results = [];
    const regex = new RegExp(pattern, 'i');
    for (const name in state.vfs) {
      const file = state.vfs[name];
      if (regex.test(name) || regex.test(file.content)) {
        results.push({
          name,
          matches: file.content.split('\n')
            .filter(line => regex.test(line))
            .map(line => line.trim())
        });
      }
    }
    return results;
  }

  return {
    listFiles,
    getFile,
    getFileMeta,
    writeFile,
    appendFile,
    removeFile,
    clearVfs,
    searchFiles
  };
}

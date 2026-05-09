const fs = require('fs');

class MenuResolver {
  constructor(menuPath) {
    this.menuPath = menuPath;
    this.tree = null;
    this.lookup = null;
  }

  getTree() {
    if (!this.tree) {
      this.tree = this._loadTree();
      this.lookup = {};
      indexTree(this.tree, this.lookup);
    }
    return this.tree;
  }

  findByGo(go) {
    this.getTree();
    return this.lookup[go] || null;
  }

  _loadTree() {
    const xml = fs.readFileSync(this.menuPath, 'utf8');
    const parsedRoot = parseXml(xml);
    const topItem = (parsedRoot.children || []).find((child) => child.tag === 'item');
    if (!topItem) {
      throw new Error('hanulso.mnu top item not found');
    }
    return normalizeItem(topItem);
  }
}

function parseXml(xml) {
  const source = xml.replace(/<\?xml[\s\S]*?\?>/g, '');
  const tokens = source.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g) || [];
  const stack = [];
  let root = null;

  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith('<!--') || token.startsWith('<?') || token.startsWith('<!')) continue;

    if (token.startsWith('</')) {
      const node = stack.pop();
      if (!node) continue;
      if (stack.length > 0) stack[stack.length - 1].children.push(node);
      else root = node;
      continue;
    }

    if (token.startsWith('<')) {
      const selfClosing = token.endsWith('/>');
      const raw = token.slice(1, token.length - (selfClosing ? 2 : 1)).trim();
      const firstSpace = raw.indexOf(' ');
      const tag = firstSpace === -1 ? raw : raw.slice(0, firstSpace);
      const attrString = firstSpace === -1 ? '' : raw.slice(firstSpace + 1);
      const node = { tag, attrs: parseAttrs(attrString), children: [], text: '' };

      if (selfClosing) {
        if (stack.length > 0) stack[stack.length - 1].children.push(node);
        else root = node;
      } else {
        stack.push(node);
      }
      continue;
    }

    if (stack.length > 0) {
      stack[stack.length - 1].text += token;
    }
  }

  return root;
}

function parseAttrs(attrString) {
  const attrs = {};
  const regex = /([A-Za-z0-9_:-]+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(attrString))) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function normalizeItem(node) {
  const itemChildren = (node.children || []).filter((child) => child.tag === 'item').map(normalizeItem);
  return {
    type: node.attrs.type || '',
    go: node.attrs.go || '',
    id: node.attrs.id || '',
    door: node.attrs.door || '',
    text: node.attrs.text || '',
    accessLevel: Number(node.attrs.access_level || 1),
    name: cleanName(textOf(node, 'name') || node.attrs.go || node.attrs.id || ''),
    header: textOf(node, 'header'),
    footer: textOf(node, 'footer'),
    attachment: textOf(node, 'attachment'),
    reply: textOf(node, 'reply'),
    writeSysopOnly: textOf(node, 'write_sysop_only'),
    children: itemChildren
  };
}

function textOf(node, tagName) {
  const child = (node.children || []).find((entry) => entry.tag === tagName);
  return child ? String(child.text || '').trim() : '';
}

function cleanName(value) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  return compact || 'unknown';
}

function indexTree(node, lookup) {
  if (!node) return;
  if (node.go) lookup[node.go] = node;
  for (const child of node.children || []) {
    indexTree(child, lookup);
  }
}

module.exports = MenuResolver;

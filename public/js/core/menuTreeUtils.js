import { createEntryMenuNode } from './menuData.js';

export function cloneMenuTreeNode(node) {
  if (!node || typeof node !== 'object') return node;
  return {
    ...node,
    children: Array.isArray(node.children) ? node.children.map(cloneMenuTreeNode) : []
  };
}

export function getMenuNodeKey(node) {
  return String(node?.go || node?.id || '').trim();
}

export function indexMenuNodes(node, parentKey, lookup, parents) {
  const key = getMenuNodeKey(node);
  if (key) { lookup[key] = node; parents[key] = String(parentKey || '').trim(); }
  for (const child of node?.children || []) indexMenuNodes(child, key, lookup, parents);
}

export function applyRuntimeMenuOverrides(tree) {
  if (!tree || typeof tree !== 'object') return tree;
  const cloned = cloneMenuTreeNode(tree);
  if (getMenuNodeKey(cloned) !== 'top') return cloned;
  const original = Array.isArray(cloned.children) ? cloned.children : [];
  const preserved = original.filter(c => {
    const k = getMenuNodeKey(c).toLowerCase();
    return k !== 'signup' && k !== 'entry' && k !== 'log';
  });
  cloned.children = [createEntryMenuNode(), ...preserved];
  return cloned;
}

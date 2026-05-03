import { vg, vgs } from './expandgroup.js'

const _m = m

const parsedSelector = (sel) => {
  const vnode = _m(sel)
  const { className, id, ...rest } = vnode.attrs ?? {}
  return {
    tag: vnode.tag,
    classes: className ? className.split(' ') : [],
    id: id ?? null,
    attrs: rest
  }
}

const mergeSelectors = (selectors) =>
  selectors.reduce((acc, cur) => ({
    tag: acc.tag !== 'div' ? acc.tag : cur.tag,
    classes: [...acc.classes, ...cur.classes],
    id: acc.id ?? cur.id,
    attrs: { ...acc.attrs, ...cur.attrs }
  }), { tag: 'div', classes: [], id: null, attrs: {} })

const serializeSelector = ({ tag, classes, id, attrs }) => [
  tag,
  ...(id ? [`#${id}`] : []),
  ...classes.map(c => `.${c}`),
  ...Object.entries(attrs).map(([k, v]) => v === true ? `[${k}]` : `[${k}=${v}]`)
].join('')

// _.memoize.Cache = WeakMap;
const refIds = new WeakMap();
let nextId = 0;
function keyFor(value) {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    if (!refIds.has(value)) {
      refIds.set(value, ++nextId);
    }
    return `#${refIds.get(value)}`;
  }
  // Primitives (string, number, boolean, null, undefined, symbol)
  return `${typeof value}:${String(value)}`;
}
const memoize = (fn)=>_.memoize(fn, arr=>arr.map(keyFor).join('|'));

// TODO: support event handler composition
const withAttrs = (component, extraAttrs) => ({
  view: ({ attrs, children }) => {
    const mergedClass = [extraAttrs.class, attrs.class].filter(Boolean).join(' ')
    return _m(component, {
      ...extraAttrs,
      ...attrs,
      ...(mergedClass ? { class: mergedClass } : {})
    }, ...children)
  }
})

const cx = memoize((arr) => {
  const flat = arr.flat(Infinity)
  const strings = flat.filter(x => typeof x === 'string').map(vg)
  const component = flat.find(x => x && (typeof x === 'object' || typeof x === 'function'))

  const merged = mergeSelectors(strings.map(parsedSelector))

  if (!component) return serializeSelector(merged)

  const extraAttrs = {
    ...merged.attrs,
    ...(merged.id ? { id: merged.id } : {}),
    ...(merged.classes.length ? { class: merged.classes.join(' ') } : {}),
  }

  return withAttrs(component, extraAttrs)
})

window.m = (...args) => {
  if (Array.isArray(args[0])) args[0] = cx(args[0])

  if (typeof args[0] === 'string') args[0] = vgs(args[0])
  if (args[1] !== null && typeof args[1] === 'object' && !args[1].tag) {
    if (args[1].class !== undefined)
      args[1] = { ...args[1], class: vg(String(args[1].class)) }
  }

  return _m(...args)
}

Object.assign(window.m, _m)
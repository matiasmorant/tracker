window.vg = (cls) => {
  const expand = (str) => {
    const result = str
      .replace(/(\S+):\(([^)]+)\)/g, (_, variant, group) =>
        expand(group).trim().split(/\s+/).map(c => `${variant}:${c}`).join(' ')
      )
      .replace(/(\S+)-\(([^)]+)\)/g, (_, prefix, group) =>
        expand(group).trim().split(/\s+/).map(c => `${prefix}-${c}`).join(' ')
      )
    return result === str ? str : expand(result)
  }
  return expand(cls)
}

const _m = m

window.m = (...args) => {
  if (typeof args[0] === 'string') args[0] = vg(args[0])
  if (args[1]?.class) args[1] = { ...args[1], class: vg(args[1].class) }
  return _m(...args)
}

Object.assign(window.m, _m)
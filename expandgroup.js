const matchParens = (str, start) => {
  let depth = 0, i = start
  while (i < str.length) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') { if (--depth === 0) return i }
    i++
  }
  return -1
}

const selectorTokens = (sel) => {
  const tokens = []
  let i = 0, start = 0, inToken = false

  while (i < sel.length) {
    const ch = sel[i]
    if (inToken && ch === '(') {
      i = matchParens(sel, i) + 1
      continue
    }
    if (ch === '.' || ch === '#' || ch === '[') {
      if (inToken) tokens.push({ start, end: i })
      if (ch === '[') {
        inToken = false
        i = sel.indexOf(']', i) + 1
        continue
      }
      inToken = ch === '.'
      start = i + 1
    }
    i++
  }
  if (inToken) tokens.push({ start, end: i })
  return tokens
}

const vgToken = (cls) => {
  const expand = (str) => {
    let colonIdx = str.indexOf(':(')
    let hyphenIdx = str.indexOf('-(')

    if (colonIdx === -1 && hyphenIdx === -1) return str

    let idx, type
    if (colonIdx !== -1 && (hyphenIdx === -1 || colonIdx < hyphenIdx)) {
      idx = colonIdx
      type = ':'
    } else {
      idx = hyphenIdx
      type = '-'
    }

    let startIdx = idx - 1
    while (startIdx >= 0 && /\S/.test(str[startIdx])) startIdx--
    startIdx++

    const prefix = str.slice(startIdx, idx)
    const openParenIdx = idx + 1
    const closeParenIdx = matchParens(str, openParenIdx)

    if (closeParenIdx === -1) return str

    const inner = str.slice(openParenIdx + 1, closeParenIdx)
    const expandedInner = expand(inner)
    const expanded = expandedInner.split(/\s+/).map(c => prefix + type + c).join(' ')

    const result = str.slice(0, startIdx) + expanded + str.slice(closeParenIdx + 1)
    return expand(result)
  }
  return expand(cls)
}

const vg = (cls) =>
  vgToken(cls)

const vgs = (sel) => {
  const tokens = selectorTokens(sel)
  let result = sel
  for (let i = tokens.length - 1; i >= 0; i--) {
    const { start, end } = tokens[i]
    const cls = result.slice(start, end)
    const expanded = vgToken(cls).split(/\s+/).join('.')
    result = result.slice(0, start) + expanded + result.slice(end)
  }
  return result
}

export { matchParens, selectorTokens, vgToken, vg, vgs }
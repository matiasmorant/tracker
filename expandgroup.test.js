import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchParens, selectorTokens, vgToken, vg, vgs } from './expandgroup.js'

// ── matchParens ────────────────────────────────────────────────────────────

test('matchParens: simple', () => {
  assert.equal(matchParens('(abc)', 0), 4)
})

test('matchParens: nested', () => {
  assert.equal(matchParens('(a(b)c)', 0), 6)
})

test('matchParens: deeply nested', () => {
  assert.equal(matchParens('(a(b(c)d)e)', 0), 10)
})

test('matchParens: starts mid-string', () => {
  assert.equal(matchParens('xx(abc)yy', 2), 6)
})

test('matchParens: unmatched returns -1', () => {
  assert.equal(matchParens('(abc', 0), -1)
})

// ── selectorTokens ─────────────────────────────────────────────────────────

test('selectorTokens: single class', () => {
  assert.deepEqual(selectorTokens('div.px-4'), [{ start: 4, end: 8 }])
})

test('selectorTokens: multiple classes', () => {
  assert.deepEqual(selectorTokens('div.px-4.text-bold'), [
    { start: 4, end: 8 },
    { start: 9, end: 18 },
  ])
})

test('selectorTokens: ignores tag', () => {
  const tokens = selectorTokens('div')
  assert.deepEqual(tokens, [])
})

test('selectorTokens: ignores #id', () => {
  const tokens = selectorTokens('div#main.px-4')
  assert.deepEqual(tokens, [{ start: 9, end: 13 }])
})

test('selectorTokens: ignores [attr]', () => {
  const tokens = selectorTokens('div.px-4[attr=val]')
  assert.deepEqual(tokens, [{ start: 4, end: 8 }])
})

test('selectorTokens: class with parens', () => {
  assert.deepEqual(selectorTokens('div.hover:(text-white)'), [
    { start: 4, end: 22 },
  ])
})

test('selectorTokens: class with nested parens', () => {
  assert.deepEqual(selectorTokens('div.hover:(text-(white sm))'), [
    { start: 4, end: 27 },
  ])
})

test('selectorTokens: full selector', () => {
  const tokens = selectorTokens('div.px-4.hover:(text-(white sm))[attr=val]')
  assert.deepEqual(tokens, [
    { start: 4, end: 8 },
    { start: 9, end: 32 },
  ])
})

// ── vgToken ────────────────────────────────────────────────────────────────

test('vgToken: plain class passthrough', () => {
  assert.equal(vgToken('px-4'), 'px-4')
})

test('vgToken: variant group', () => {
  assert.equal(vgToken('hover:(text-white bg-black)'), 'hover:text-white hover:bg-black')
})

test('vgToken: prefix group', () => {
  assert.equal(vgToken('text-(sm md lg)'), 'text-sm text-md text-lg')
})

test('vgToken: nested variant then prefix', () => {
  assert.equal(vgToken('hover:(text-(white sm))'), 'hover:text-white hover:text-sm')
})

test('vgToken: idempotent on plain class', () => {
  assert.equal(vgToken('text-white'), 'text-white')
})

// ── vg (class strings) ─────────────────────────────────────────────────────

test('vg: no groups', () => {
  assert.equal(vg('px-4 py-2 text-white'), 'px-4 py-2 text-white')
})

test('vg: single variant group', () => {
  assert.equal(vg('px-4 hover:(text-white bg-black)'), 'px-4 hover:text-white hover:bg-black')
})

test('vg: multiple groups', () => {
  assert.equal(
    vg('px-4 hover:(text-white bg-black) focus:(outline-none ring-2)'),
    'px-4 hover:text-white hover:bg-black focus:outline-none focus:ring-2'
  )
})

test('vg: prefix group', () => {
  assert.equal(vg('text-(sm md lg)'), 'text-sm text-md text-lg')
})

test('vg: mixed variant and prefix groups', () => {
  assert.equal(vg('hover:(text-(white sm))'), 'hover:text-white hover:text-sm')
})

test('vg: preserves unrelated classes around groups', () => {
  assert.equal(vg('flex hover:(gap-2 items-center) mt-4'), 'flex hover:gap-2 hover:items-center mt-4')
})

// ── vgs (selector strings) ────────────────────────────────────────────────

test('vgs: no classes', () => {
  assert.equal(vgs('div'), 'div')
})

test('vgs: plain classes passthrough', () => {
  assert.equal(vgs('div.px-4.text-bold'), 'div.px-4.text-bold')
})

test('vgs: variant group in selector', () => {
  assert.equal(vgs('div.hover:(text-white bg-black)'), 'div.hover:text-white.hover:bg-black')
})

test('vgs: prefix group in selector', () => {
  assert.equal(vgs('div.text-(sm md)'), 'div.text-sm.text-md')
})

test('vgs: preserves #id', () => {
  assert.equal(vgs('div#main.px-4'), 'div#main.px-4')
})

test('vgs: preserves [attr]', () => {
  assert.equal(vgs('div.px-4[attr=val]'), 'div.px-4[attr=val]')
})

test('vgs: full selector with nested parens', () => {
  assert.equal(
    vgs('div.px-4.hover:(text-(white sm))[attr=val]'),
    'div.px-4.hover:text-white.hover:text-sm[attr=val]'
  )
})

test('vgs: multiple groups in selector', () => {
  assert.equal(
    vgs('div.px-4.hover:(text-white bg-black).focus:(outline-none)'),
    'div.px-4.hover:text-white.hover:bg-black.focus:outline-none'
  )
})

test('vgs: id and attr alongside groups', () => {
  assert.equal(
    vgs('input#email.hover:(text-white bg-black)[type=email]'),
    'input#email.hover:text-white.hover:bg-black[type=email]'
  )
})
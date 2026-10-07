export const T = 24
export const PIECES = 12

export const PT = []
;[150, 100, 50].forEach((r) => {
  ;[
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
  ].forEach((d) => PT.push([190 + d[0] * r, 190 + d[1] * r]))
})
export const nb = Array.from({ length: T }, () => [])
export const EDGES = []
function link(a, b) {
  nb[a].push(b)
  nb[b].push(a)
  EDGES.push([a, b])
}
for (let k = 0; k < 3; k++) for (let i = 0; i < 8; i++) link(k * 8 + i, k * 8 + ((i + 1) % 8))
for (let k = 0; k < 2; k++) for (let i = 0; i < 8; i++) link(k * 8 + i, (k + 1) * 8 + i)
export const MILLS = []
for (let k = 0; k < 3; k++)
  for (let q = 0; q < 4; q++)
    MILLS.push([k * 8 + q * 2, k * 8 + q * 2 + 1, k * 8 + ((q * 2 + 2) % 8)])
for (let i = 0; i < 8; i++) MILLS.push([i, 8 + i, 16 + i])
const millsOf = Array.from({ length: T }, () => [])
MILLS.forEach((m) => m.forEach((i) => millsOf[i].push(m)))
export function newState() {
  return {
    b: new Array(T).fill(-1),
    hand: [PIECES, PIECES],
    cur: 0,
    over: false,
    winner: -1,
    draw: false,
    reason: '',
    quiet: 0,
  }
}
export function clone(s) {
  return {
    b: s.b.slice(),
    hand: s.hand.slice(),
    cur: s.cur,
    over: s.over,
    winner: s.winner,
    draw: s.draw,
    reason: s.reason,
    quiet: s.quiet,
  }
}
export function onBoard(s, p) {
  let t = 0
  for (let i = 0; i < T; i++) if (s.b[i] === p) t++
  return t
}
export function isMill(b, i, p) {
  for (const m of millsOf[i]) if (b[m[0]] === p && b[m[1]] === p && b[m[2]] === p) return true
  return false
}
export function removables(s, o) {
  const all = [],
    free = []
  for (let i = 0; i < T; i++)
    if (s.b[i] === o) {
      all.push(i)
      if (!isMill(s.b, i, o)) free.push(i)
    }
  return free.length ? free : all
}
export function canFly(s, p) {
  return s.hand[p] === 0 && onBoard(s, p) === 3
}
export function destsFrom(s, from) {
  const p = s.b[from],
    d = []
  if (canFly(s, p)) {
    for (let i = 0; i < T; i++) if (s.b[i] === -1) d.push(i)
  } else for (const j of nb[from]) if (s.b[j] === -1) d.push(j)
  return d
}
function genBases(s) {
  const p = s.cur,
    L = []
  if (s.hand[p] > 0) {
    for (let i = 0; i < T; i++) if (s.b[i] === -1) L.push({ from: -1, to: i })
  } else
    for (let f = 0; f < T; f++)
      if (s.b[f] === p) for (const t of destsFrom(s, f)) L.push({ from: f, to: t })
  return L
}
function formsMill(s, a) {
  const p = s.cur
  if (a.from >= 0) s.b[a.from] = -1
  s.b[a.to] = p
  const m = isMill(s.b, a.to, p)
  s.b[a.to] = -1
  if (a.from >= 0) s.b[a.from] = p
  return m
}
export function genActions(s) {
  const p = s.cur,
    o = 1 - p,
    L = [],
    M = []
  for (const a of genBases(s)) {
    if (formsMill(s, a)) {
      const R = removables(s, o)
      if (R.length) for (const r of R) M.push({ from: a.from, to: a.to, rem: r })
      else M.push({ from: a.from, to: a.to, rem: -1 })
    } else L.push({ from: a.from, to: a.to, rem: -1 })
  }
  return M.concat(L)
}
function hasMove(s, p) {
  if (s.hand[p] > 0) return true
  const fly = canFly(s, p)
  for (let f = 0; f < T; f++)
    if (s.b[f] === p) {
      if (fly) {
        for (let i = 0; i < T; i++) if (s.b[i] === -1) return true
      } else for (const j of nb[f]) if (s.b[j] === -1) return true
    }
  return false
}
export function applyAction(s, a) {
  const p = s.cur,
    o = 1 - p
  if (a.from >= 0) s.b[a.from] = -1
  else s.hand[p]--
  s.b[a.to] = p
  if (a.rem >= 0) {
    s.b[a.rem] = -1
    s.quiet = 0
  } else if (a.from >= 0) s.quiet++
  else s.quiet = 0
  s.cur = o
  if (onBoard(s, o) + s.hand[o] < 3) {
    s.over = true
    s.winner = p
    s.reason = 'pieces'
    return
  }
  if (!hasMove(s, o)) {
    s.over = true
    let full = true
    for (let i = 0; i < T; i++)
      if (s.b[i] === -1) {
        full = false
        break
      }
    if (full) {
      s.draw = true
      s.reason = 'full'
    } else {
      s.winner = p
      s.reason = 'blocked'
    }
    return
  }
  if (s.quiet >= 40) {
    s.over = true
    s.draw = true
    s.reason = 'quiet'
  }
}
function mobility(s, p) {
  let t = 0
  for (let f = 0; f < T; f++) if (s.b[f] === p) for (const j of nb[f]) if (s.b[j] === -1) t++
  return t
}
function evalS(s, p) {
  const o = 1 - p
  let v = (onBoard(s, p) + s.hand[p] - onBoard(s, o) - s.hand[o]) * 100
  for (const m of MILLS) {
    let cp = 0,
      co = 0,
      ce = 0
    for (const i of m) {
      const x = s.b[i]
      if (x === p) cp++
      else if (x === o) co++
      else ce++
    }
    if (cp === 3) v += 12
    else if (co === 3) v -= 12
    else if (cp === 2 && ce === 1) v += 7
    else if (co === 2 && ce === 1) v -= 7
  }
  if (s.hand[0] === 0 && s.hand[1] === 0) v += (mobility(s, p) - mobility(s, o)) * 3
  return v
}
function nega(s, d, alpha, beta) {
  if (s.over) return s.draw ? 0 : -(100000 + d)
  if (d === 0) return evalS(s, s.cur)
  let best = -1e9
  for (const a of genActions(s)) {
    const c = clone(s)
    applyAction(c, a)
    const v = -nega(c, d - 1, -beta, -alpha)
    if (v > best) best = v
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}
export function chooseAction(s, diff) {
  const A = genActions(s)
  const rnd = (a) => a[Math.floor(Math.random() * a.length)]
  if (diff === 0) {
    const M = A.filter((a) => a.rem >= 0)
    if (M.length && Math.random() < 0.5) return rnd(M)
    return rnd(A)
  }
  const depth = diff === 1 ? 2 : s.hand[s.cur] > 0 ? 3 : 4
  let best = -1e9,
    ba = A[0]
  for (const a of A) {
    const c = clone(s)
    applyAction(c, a)
    const v = -nega(c, depth - 1, -1e9, 1e9) + Math.random() * 1.5
    if (v > best) {
      best = v
      ba = a
    }
  }
  return ba
}

export function boardAfterMove(s, a) {
  const b = s.b.slice()
  if (a.from >= 0) b[a.from] = -1
  b[a.to] = s.cur
  return b
}

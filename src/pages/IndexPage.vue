<template>
  <q-page class="trilha">
    <div class="wrap">
      <!-- MENU -->
      <template v-if="screen === 'setup'">
        <header>
          <h1>Trilha</h1>
          <p class="lede">
            O jogo dos 12 dados. Faça trilhas de três dados e retire os dados do adversário.
          </p>
        </header>

        <section class="panel">
          <h2>Como quer jogar?</h2>
          <div class="modes">
            <button
              type="button"
              class="mode"
              :aria-pressed="cfg.mode === 'ai'"
              @click="cfg.mode = 'ai'"
            >
              <b>Contra o computador</b><span>Jogue sozinho, em 3 níveis</span>
            </button>
            <button
              type="button"
              class="mode"
              :aria-pressed="cfg.mode === 'two'"
              @click="cfg.mode = 'two'"
            >
              <b>Em grupo</b><span>2 jogadores no mesmo ecrã</span>
            </button>
          </div>

          <template v-if="cfg.mode === 'ai'">
            <div class="opt-row">
              <span class="opt-label">Dificuldade</span>
              <q-btn-toggle
                v-model="cfg.diff"
                no-caps
                rounded
                unelevated
                toggle-color="dark"
                :options="[
                  { label: 'Fácil', value: 0 },
                  { label: 'Médio', value: 1 },
                  { label: 'Difícil', value: 2 },
                ]"
              />
            </div>
            <div class="opt-row">
              <span class="opt-label">Quem começa</span>
              <q-btn-toggle
                v-model="cfg.first"
                no-caps
                rounded
                unelevated
                toggle-color="dark"
                :options="[
                  { label: 'Eu', value: 'me' },
                  { label: 'Computador', value: 'pc' },
                ]"
              />
            </div>
            <p class="hint">Você joga de azul e o computador de vermelho.</p>
          </template>
          <p v-else class="hint">Dois jogadores no mesmo ecrã, à vez. Azul começa.</p>

          <button type="button" class="primary" @click="start">Começar a partida</button>

          <details>
            <summary>Regras</summary>
            <div class="rules" v-html="RULES" />
          </details>
        </section>
      </template>

      <!-- JOGO -->
      <section v-else class="game">
        <div class="topbar">
          <button type="button" class="back" aria-label="Voltar ao menu" @click="backToMenu">
            &#8592;
          </button>
          <h1>Trilha</h1>
          <button
            type="button"
            class="ghost"
            :aria-expanded="showRules"
            @click="showRules = !showRules"
          >
            Regras
          </button>
        </div>
        <div v-if="showRules" class="rulesbox rules" v-html="RULES" />

        <div class="banner">
          <span class="phase">{{ phaseText }}</span>
          <p class="msg" role="status" aria-live="polite">{{ msgText }}</p>
          <p class="note">{{ note }}</p>
        </div>

        <div class="table">
          <div class="board" role="group" aria-label="Tabuleiro com 24 pontos">
            <svg class="rails" viewBox="0 0 380 380" aria-hidden="true">
              <line
                v-for="(e, k) in EDGES"
                :key="k"
                :x1="PT[e[0]][0]"
                :y1="PT[e[0]][1]"
                :x2="PT[e[1]][0]"
                :y2="PT[e[1]][1]"
              />
            </svg>

            <button
              v-for="(p, i) in PT"
              :key="i"
              type="button"
              class="pt"
              :class="{
                owned: board[i] >= 0,
                pop: lastPlaced === i,
                sel: !pend && sel === i,
                dest: !pend && sel >= 0 && dests.includes(i),
                tgt: pend && targets.includes(i),
              }"
              :style="{
                left: p[0] / 3.8 + '%',
                top: p[1] / 3.8 + '%',
                backgroundColor: colorOf(board[i]),
              }"
              :disabled="!clickable(i)"
              :aria-label="`Ponto ${i + 1}, ${board[i] >= 0 ? 'dado de ' + players[board[i]].name : 'vazio'}`"
              @click="humanClick(i)"
            />

            <div
              v-if="ghost"
              class="ghost-disc disc"
              :style="{ left: ghost.x + '%', top: ghost.y + '%', backgroundColor: ghost.c }"
            />
          </div>
        </div>

        <div v-if="result" class="result">
          <h2>{{ result.title }}</h2>
          <p>{{ result.sub }}</p>
          <button type="button" class="primary" @click="start">Jogar outra vez</button>
        </div>

        <div class="bar">
          <div
            v-for="(pl, i) in players"
            :key="i"
            class="pcard"
            :class="{ active: !S.over && S.cur === i }"
          >
            <span class="av disc" :style="{ backgroundColor: hex(pl.col) }" aria-hidden="true">{{
              pl.name.charAt(0)
            }}</span>
            <div>
              <div class="pname">{{ pl.name }}</div>
              <div class="pstat">Na mão {{ S.hand[i] }} · Em jogo {{ onBoard(S, i) }}</div>
            </div>
            <div class="hand" aria-hidden="true">
              <i
                v-for="k in S.hand[i]"
                :key="k"
                class="hd"
                :style="{ backgroundColor: hex(pl.col) }"
              />
            </div>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="ghost" :disabled="!canUndo" @click="undo">Desfazer</button>
          <button type="button" class="ghost" @click="start">Reiniciar</button>
        </div>
      </section>

      <p class="version">Versão {{ VERSION }}</p>
    </div>
  </q-page>
</template>

<script setup>
import { ref, shallowRef, computed, nextTick, onBeforeUnmount } from 'vue'
import {
  PT,
  EDGES,
  newState,
  clone,
  onBoard,
  isMill,
  removables,
  canFly,
  destsFrom,
  boardAfterMove,
  applyAction,
  chooseAction,
} from '../game/engine'

const VERSION = 'cores-3'

const RULES = `
<p><b>Objetivo.</b> Cada jogador tem 12 dados. Deixe o adversário com menos de 3 dados ou sem jogadas possíveis.</p>
<p><b>1. Colocar.</b> Jogam à vez e colocam um dado de cada vez num ponto vazio, até os 12 dados de cada um estarem no tabuleiro.</p>
<p><b>Trilha.</b> Três dados da mesma cor em linha reta formam uma trilha. Valem os lados dos quadrados, as linhas que ligam os quadrados e as diagonais. Ao fazer uma trilha, retire um dado do adversário. Não pode retirar um dado que esteja numa trilha dele, a não ser que todos estejam.</p>
<p><b>2. Mover.</b> Depois de colocados todos os dados, mova um dado por jogada para um ponto vizinho vazio, seguindo as linhas. Abrir e voltar a fechar uma trilha conta como nova trilha.</p>
<p><b>3. Voar.</b> Com apenas 3 dados, pode saltar para qualquer ponto vazio.</p>
<p><b>Empate.</b> Se o tabuleiro ficar cheio no fim da fase de colocar, ou se houver 40 jogadas seguidas sem retirar nenhum dado.</p>`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const screen = ref('setup')
const cfg = ref({ mode: 'ai', diff: 1, first: 'me' })
const players = ref([])
const S = shallowRef(newState())
const view = ref(null)
const sel = ref(-1)
const dests = ref([])
const pend = ref(null)
const targets = ref([])
const locked = ref(true)
const note = ref('')
const ghost = ref(null)
const lastPlaced = ref(-1)
const result = ref(null)
const showRules = ref(false)
const history = shallowRef([])
let gen = 0

const board = computed(() => view.value || S.value.b)
const canUndo = computed(
  () =>
    history.value.length > 0 &&
    !locked.value &&
    !S.value.over &&
    players.value[S.value.cur]?.type === 'human' &&
    !pend.value,
)

const phaseText = computed(() => {
  const s = S.value
  if (s.over) return 'Fim da partida'
  if (s.hand[s.cur] > 0) return 'Fase 1 · Colocar dados'
  return canFly(s, s.cur) ? 'Fase 3 · Voar' : 'Fase 2 · Mover dados'
})
const msgText = computed(() => {
  const s = S.value
  const pl = players.value[s.cur]
  if (!pl) return ''
  const who = cfg.value.mode === 'two' ? `Vez do ${pl.name}. ` : ''
  if (s.over) return 'Partida terminada.'
  if (pl.type === 'ai') return 'O computador está a pensar…'
  if (pend.value) return who + 'Trilha! Toque num dado do adversário para o retirar.'
  if (s.hand[s.cur] > 0) return who + 'Coloque um dado num ponto vazio.'
  if (sel.value >= 0) return who + 'Toque no ponto de destino.'
  if (canFly(s, s.cur)) return who + 'Só tem 3 dados: escolha um e voe para qualquer ponto vazio.'
  return who + 'Escolha um dado seu e mova-o para um ponto vizinho vazio.'
})

// Cores dos dados: fortes e iguais nos modos claro e escuro.
const PALETTE = ['#0057FF', '#E60012']

function hex(col) {
  return PALETTE[col]
}

function colorOf(o) {
  return o >= 0 && players.value[o] ? hex(players.value[o].col) : 'transparent'
}

function buildPlayers() {
  if (cfg.value.mode === 'ai') {
    const me = { name: 'Você', type: 'human', col: 0 }
    const pc = { name: 'Computador', type: 'ai', col: 1 }
    return cfg.value.first === 'me' ? [me, pc] : [pc, me]
  }
  return [
    { name: 'Azul', type: 'human', col: 0 },
    { name: 'Vermelho', type: 'human', col: 1 },
  ]
}

function resetPick() {
  sel.value = -1
  dests.value = []
  pend.value = null
  targets.value = []
}

function clickable(i) {
  const s = S.value
  if (locked.value || s.over || players.value[s.cur].type !== 'human') return false
  if (pend.value) return targets.value.includes(i)
  if (s.hand[s.cur] > 0) return s.b[i] === -1
  return s.b[i] === s.cur || (sel.value >= 0 && dests.value.includes(i))
}

function describe(p, a) {
  const n = players.value[p].name
  return a.rem >= 0
    ? `${n} fez trilha e retirou um dado.`
    : a.from >= 0
      ? `${n} moveu um dado.`
      : `${n} colocou um dado.`
}

async function ghostMove(from, to, after) {
  if (from < 0 || reduced()) {
    view.value = after
    return
  }
  const c = colorOf(S.value.cur)
  ghost.value = { x: PT[from][0] / 3.8, y: PT[from][1] / 3.8, c }
  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  ghost.value = { x: PT[to][0] / 3.8, y: PT[to][1] / 3.8, c }
  await sleep(260)
  view.value = after
  await nextTick()
  ghost.value = null
}

async function turn() {
  const my = gen
  resetPick()
  view.value = null
  if (S.value.over) {
    finish()
    return
  }
  const pl = players.value[S.value.cur]
  if (pl.type === 'human') {
    locked.value = false
    return
  }
  locked.value = true
  await sleep(650)
  if (my !== gen) return
  const a = chooseAction(S.value, cfg.value.diff)
  let moved = false
  if (a.rem >= 0) {
    const after = boardAfterMove(S.value, a)
    if (a.from >= 0) {
      const pre = S.value.b.slice()
      pre[a.from] = -1
      view.value = pre
      await ghostMove(a.from, a.to, after)
      if (my !== gen) return
      moved = true
    } else {
      view.value = after
      lastPlaced.value = a.to
    }
    await sleep(450)
    if (my !== gen) return
    pend.value = { from: a.from, to: a.to }
    targets.value = [a.rem]
    await sleep(650)
    if (my !== gen) return
    resetPick()
  }
  await play(a, my, moved)
}

async function play(a, my, moved) {
  locked.value = true
  note.value = describe(S.value.cur, a)
  if (a.from >= 0 && !moved) {
    const pre = S.value.b.slice()
    pre[a.from] = -1
    view.value = pre
    await ghostMove(a.from, a.to, boardAfterMove(S.value, a))
    if (my !== gen) return
  }
  lastPlaced.value = a.from < 0 ? a.to : -1
  const next = clone(S.value)
  applyAction(next, a)
  S.value = next
  if (my !== gen) return
  await sleep(120)
  if (my !== gen) return
  turn()
}

function commit(a, moved) {
  history.value = [...history.value, clone(S.value)]
  const my = gen
  resetPick()
  play(a, my, moved)
}

async function tryBase(a) {
  const s = S.value
  const after = boardAfterMove(s, a)
  if (isMill(after, a.to, s.cur)) {
    const R = removables(s, 1 - s.cur)
    if (R.length) {
      if (a.from >= 0) {
        const my = gen
        locked.value = true
        resetPick()
        const pre = s.b.slice()
        pre[a.from] = -1
        view.value = pre
        await ghostMove(a.from, a.to, after)
        if (my !== gen) return
        locked.value = false
      } else {
        view.value = after
        lastPlaced.value = a.to
      }
      pend.value = { from: a.from, to: a.to }
      targets.value = R
      return
    }
  }
  commit({ from: a.from, to: a.to, rem: -1 })
}

function humanClick(i) {
  const s = S.value
  if (locked.value || s.over || players.value[s.cur].type !== 'human') return
  if (pend.value) {
    if (targets.value.includes(i))
      commit({ from: pend.value.from, to: pend.value.to, rem: i }, true)
    return
  }
  if (s.hand[s.cur] > 0) {
    if (s.b[i] === -1) tryBase({ from: -1, to: i })
    return
  }
  if (s.b[i] === s.cur) {
    if (sel.value === i) {
      sel.value = -1
      dests.value = []
    } else {
      sel.value = i
      dests.value = destsFrom(s, i)
    }
    return
  }
  if (sel.value >= 0 && dests.value.includes(i)) tryBase({ from: sel.value, to: i })
}

function resultText(s) {
  if (s.draw) {
    return {
      title: 'Empate',
      sub:
        s.reason === 'full'
          ? 'O tabuleiro ficou cheio no fim da fase de colocar.'
          : 'Passaram 40 jogadas seguidas sem retirar nenhum dado.',
    }
  }
  const w = s.winner
  const reason =
    s.reason === 'blocked' ? 'ficou sem jogadas possíveis' : 'ficou com menos de 3 dados'
  if (cfg.value.mode !== 'ai') {
    return {
      title: `${players.value[w].name} ganhou!`,
      sub: `${players.value[1 - w].name} ${reason}.`,
    }
  }
  if (players.value[w].type === 'human') {
    return { title: 'Ganhou!', sub: `O computador ${reason}.` }
  }
  return {
    title: 'O computador ganhou',
    sub: `Você ${reason}. Tente outra vez ou baixe a dificuldade.`,
  }
}

function finish() {
  locked.value = true
  result.value = resultText(S.value)
}

function undo() {
  if (!canUndo.value) return
  S.value = history.value[history.value.length - 1]
  history.value = history.value.slice(0, -1)
  note.value = ''
  view.value = null
  lastPlaced.value = -1
  resetPick()
}

function start() {
  gen++
  players.value = buildPlayers()
  S.value = newState()
  history.value = []
  note.value = ''
  result.value = null
  ghost.value = null
  lastPlaced.value = -1
  showRules.value = false
  locked.value = true
  screen.value = 'game'
  turn()
}

function backToMenu() {
  gen++
  locked.value = true
  ghost.value = null
  view.value = null
  screen.value = 'setup'
}

onBeforeUnmount(() => {
  gen++
})
</script>

<style>
.trilha {
  --sky1: #cde6dc;
  --sky2: #e6e4ca;
  --panel: #f6f8ef;
  --line: #b9c8ae;
  --ink: #17251e;
  --ink2: #51645a;
  --btn: #17251e;
  --btnink: #f6f8ef;
  --focus: #1f3fcb;
  --tgt: #e58a00;
  --rail: #7a1d13;
  --node: #7a1d13;
  --grass: #8cc04b;
  --grassink: #18290f;
  background: linear-gradient(180deg, var(--sky1), var(--sky2) 70%);
  color: var(--ink);
  min-height: 100vh;
  padding: 16px 16px 40px;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
}
@media (prefers-color-scheme: dark) {
  .trilha {
    --sky1: #11261f;
    --sky2: #1b2417;
    --panel: #18261e;
    --line: #35493d;
    --ink: #e7f0e6;
    --ink2: #98ad9e;
    --btn: #e7f0e6;
    --btnink: #101a15;
    --focus: #8ea2ff;
    --tgt: #fbbf24;
    --rail: #c9715f;
    --node: #c9715f;
    --grass: #355f2a;
    --grassink: #eaf4df;
  }
}
.trilha *,
.trilha *::before,
.trilha *::after {
  box-sizing: border-box;
}
.trilha button {
  font: inherit;
  color: inherit;
}
.trilha button:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
.trilha .wrap {
  max-width: 520px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}
.trilha h1 {
  font-weight: 800;
  font-size: clamp(2.6rem, 11vw, 3.8rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
  margin: 0;
}
.trilha h2 {
  font-weight: 700;
  font-size: 1.2rem;
  line-height: 1.2;
  margin: 0;
}
.trilha .lede {
  color: var(--ink2);
  margin: 10px 0 0;
  max-width: 40ch;
}
.trilha .panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 20px;
  display: grid;
  gap: 16px;
}
.trilha .modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
}
.trilha .mode {
  text-align: left;
  padding: 14px;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  min-width: 0;
}
.trilha .mode[aria-pressed='true'] {
  border-color: var(--ink);
  background: var(--sky1);
}
.trilha .mode b {
  display: block;
}
.trilha .mode span {
  color: var(--ink2);
  font-size: 0.88rem;
}
.trilha .opt-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}
.trilha .opt-label {
  color: var(--ink2);
  font-size: 0.9rem;
  min-width: 8em;
}
.trilha .hint {
  margin: 0;
  color: var(--ink2);
  font-size: 0.92rem;
}
.trilha .primary {
  background: var(--btn);
  color: var(--btnink);
  border: 0;
  border-radius: 12px;
  padding: 14px 18px;
  font-weight: 700;
  cursor: pointer;
}
.trilha .ghost {
  background: transparent;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  padding: 10px 14px;
  cursor: pointer;
}
.trilha .ghost:disabled {
  opacity: 0.4;
  cursor: default;
}
.trilha .rules p {
  margin: 8px 0 0;
  color: var(--ink2);
  font-size: 0.94rem;
}
.trilha .rules b {
  color: var(--ink);
}
.trilha details {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.trilha summary {
  cursor: pointer;
  font-weight: 600;
}
.trilha .game {
  display: grid;
  gap: 14px;
}
.trilha .topbar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.trilha .topbar h1 {
  font-size: 1.6rem;
  flex: 1;
}
.trilha .back {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.trilha .rulesbox {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px;
}
.trilha .banner {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 10px 14px;
  display: grid;
  gap: 2px;
}
.trilha .phase {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink2);
  font-weight: 700;
}
.trilha .msg {
  margin: 0;
  font-weight: 600;
}
.trilha .note {
  margin: 0;
  color: var(--ink2);
  font-size: 0.9rem;
  min-height: 1.3em;
}
.trilha .table {
  background: color-mix(in srgb, var(--panel) 60%, transparent);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 8px;
}
.trilha .board {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-width: 480px;
  margin: 0 auto;
}
.trilha .rails {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.trilha .rails line {
  stroke: var(--rail);
  stroke-width: 6;
  stroke-linecap: round;
}
.trilha .pt {
  position: absolute;
  width: 11.6%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  min-width: 0;
}
.trilha .pt::before {
  content: '';
  width: 34%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--node);
}
.trilha .pt.owned::before {
  display: none;
}
.trilha .disc,
.trilha .pt.owned {
  background-image: none !important;
  opacity: 1 !important;

  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, 0.35),
    inset 0 -4px 6px rgba(0, 0, 0, 0.25),
    0 3px 6px rgba(0, 0, 0, 0.35);

  border: 2px solid rgba(255, 255, 255, 0.85);
}
.trilha .pt:disabled {
  cursor: default;
}
.trilha .pt:not(:disabled):hover {
  outline: 3px solid var(--ink2);
  outline-offset: 1px;
}
.trilha .pt.dest::before {
  width: 46%;
  background: color-mix(in srgb, var(--focus) 22%, transparent);
  border: 3px solid var(--focus);
}
.trilha .pt.sel::after,
.trilha .pt.tgt::after {
  content: '';
  position: absolute;
  inset: -10%;
  border-radius: 50%;
  pointer-events: none;
}
.trilha .pt.sel::after {
  border: 3px dashed var(--focus);
}
.trilha .pt.tgt::after {
  border: 4px solid var(--tgt);
}
.trilha .ghost-disc {
  position: absolute;
  width: 11.6%;
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition:
    left 0.24s ease,
    top 0.24s ease;
  pointer-events: none;
  z-index: 2;
}
@media (prefers-reduced-motion: no-preference) {
  .trilha .pt.pop {
    animation: trilha-appear 0.22s ease-out;
  }
  .trilha .pt.sel::after {
    animation: trilha-spin 6s linear infinite;
  }
  .trilha .pt.tgt::after {
    animation: trilha-pulse 0.7s ease-in-out infinite alternate;
  }
}
@keyframes trilha-appear {
  from {
    transform: translate(-50%, -50%) scale(0.4);
  }
  to {
    transform: translate(-50%, -50%) scale(1);
  }
}
@keyframes trilha-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes trilha-pulse {
  to {
    transform: scale(1.12);
  }
}
.trilha .bar {
  background: var(--grass);
  color: var(--grassink);
  border-radius: 22px;
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.trilha .pcard {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  align-items: center;
  padding: 8px;
  border-radius: 14px;
  min-width: 0;
}
.trilha .pcard.active {
  background: rgba(255, 255, 255, 0.3);
  outline: 2px solid var(--grassink);
}
.trilha .av {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #fff;
  grid-row: span 2;
}
.trilha .pname {
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.trilha .pstat {
  font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
}
.trilha .hand {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  min-height: 12px;
}
.trilha .hd {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3);
}
.trilha .version {
  margin: 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--ink2);
}
.trilha .actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.trilha .result {
  background: var(--panel);
  border: 1.5px solid var(--ink);
  border-radius: 16px;
  padding: 18px;
  display: grid;
  gap: 10px;
  justify-items: start;
}
.trilha .result p {
  margin: 0;
  color: var(--ink2);
}
</style>

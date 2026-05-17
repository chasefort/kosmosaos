// ─── Narrative simulation system ──────────────────────────────────────────────
// Cycles through predefined scenarios on the graph, displaying
// floating text and updating metrics to make the demo feel alive.

interface Scenario {
  name: string
  steps: ScenarioStep[]
}

interface ScenarioStep {
  text: string
  toolCount?: number
  errorCount?: number
  durationMs: number
}

const SCENARIOS: Scenario[] = [
  {
    name: 'Analyzing codebase',
    steps: [
      { text: 'Claude analyzing repository...', durationMs: 2500 },
      { text: '⬡ tool_call: ReadFile → src/index.ts', toolCount: 1, durationMs: 1800 },
      { text: '⬡ tool_call: ReadFile → package.json', toolCount: 2, durationMs: 1500 },
      { text: '⬡ model_call: claude-opus-4', toolCount: 3, durationMs: 2200 },
      { text: '⬡ tool_call: WriteFile → src/utils.ts', toolCount: 4, durationMs: 1800 },
      { text: 'Session complete ✓', durationMs: 2000 },
    ],
  },
  {
    name: 'Build → error → retry',
    steps: [
      { text: 'Starting build pipeline...', durationMs: 2000 },
      { text: '⬡ tool_call: Bash → npm run build', toolCount: 1, durationMs: 2000 },
      { text: '✗ Build failed: TypeError in utils.ts', toolCount: 1, errorCount: 1, durationMs: 2500 },
      { text: '⬡ tool_call: ReadFile → src/utils.ts', toolCount: 2, errorCount: 1, durationMs: 1500 },
      { text: '⬡ model_call: claude-opus-4 (fixing)', toolCount: 3, errorCount: 1, durationMs: 2000 },
      { text: '⬡ tool_call: WriteFile → src/utils.ts', toolCount: 4, errorCount: 1, durationMs: 1500 },
      { text: '⬡ tool_call: Bash → npm run build', toolCount: 5, errorCount: 1, durationMs: 2000 },
      { text: '✓ Build succeeded', toolCount: 5, errorCount: 1, durationMs: 2000 },
    ],
  },
  {
    name: 'Multi-agent workflow',
    steps: [
      { text: 'User prompt received...', durationMs: 2000 },
      { text: '⬡ model_call: claude-opus-4', toolCount: 1, durationMs: 2000 },
      { text: '⬡ tool_call: ReadFile → CLAUDE.md', toolCount: 2, durationMs: 1500 },
      { text: '⬡ tool_call: ListDirectory → src/', toolCount: 3, durationMs: 1500 },
      { text: '⬡ tool_call: ReadFile → src/app.tsx', toolCount: 4, durationMs: 1500 },
      { text: '⬡ tool_call: WriteFile → src/app.tsx', toolCount: 5, durationMs: 1800 },
      { text: '⬡ tool_call: Bash → npm test', toolCount: 6, durationMs: 2000 },
      { text: 'All tests passing ✓', toolCount: 6, durationMs: 2000 },
    ],
  },
]

let currentScenario = 0
let currentStep = 0
let stepTimer: ReturnType<typeof setTimeout> | null = null
let textEl: HTMLElement | null = null
let sessionEl: HTMLElement | null = null
let statusEl: HTMLElement | null = null
let toolsEl: HTMLElement | null = null
let errorsEl: HTMLElement | null = null

export function initNarrative() {
  textEl = document.getElementById('narrative-text')
  sessionEl = document.getElementById('metric-session')
  statusEl = document.getElementById('metric-status')
  toolsEl = document.getElementById('metric-tools')
  errorsEl = document.getElementById('metric-errors')

  // Start after a short delay
  setTimeout(() => runScenario(), 3000)
}

function runScenario() {
  const scenario = SCENARIOS[currentScenario]
  currentStep = 0

  // Update session name
  if (sessionEl) sessionEl.textContent = scenario.name
  if (statusEl) statusEl.innerHTML = '● Running'
  if (toolsEl) toolsEl.textContent = '0'
  if (errorsEl) errorsEl.textContent = '0'

  advanceStep()
}

function advanceStep() {
  const scenario = SCENARIOS[currentScenario]
  if (currentStep >= scenario.steps.length) {
    // Scenario complete → pause, then start next
    if (statusEl) statusEl.innerHTML = '● Complete'
    if (textEl) {
      textEl.classList.remove('visible')
    }
    setTimeout(() => {
      currentScenario = (currentScenario + 1) % SCENARIOS.length
      runScenario()
    }, 3000)
    return
  }

  const step = scenario.steps[currentStep]

  // Update narrative text
  if (textEl) {
    textEl.textContent = step.text
    textEl.classList.add('visible')
  }

  // Update metrics
  if (step.toolCount !== undefined && toolsEl) {
    toolsEl.textContent = String(step.toolCount)
  }
  if (step.errorCount !== undefined && errorsEl) {
    errorsEl.textContent = String(step.errorCount)
  }

  currentStep++
  stepTimer = setTimeout(() => advanceStep(), step.durationMs)
}

export function stopNarrative() {
  if (stepTimer) clearTimeout(stepTimer)
}

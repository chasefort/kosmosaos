import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import gifenc from 'gifenc'
import { PNG } from 'pngjs'
import puppeteer from 'puppeteer-core'

const { GIFEncoder, applyPalette, quantize } = gifenc

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const projectDir = join(__dirname, 'hyperframes-github-demos')
const outputDir = join(root, 'docs', 'screenshots')
const tempRoot = join(tmpdir(), 'kosmos-hyperframes-gifs')

const demos = [
  {
    name: 'github-demo-launch-trust-overview',
    composition: 'compositions/launch-trust-overview.html',
    durationSeconds: 7,
  },
  {
    name: 'github-demo-live-trace-replay',
    composition: 'compositions/live-trace-replay.html',
    durationSeconds: 8,
  },
  {
    name: 'github-demo-context-audit-fix-queue',
    composition: 'compositions/context-audit-fix-queue.html',
    durationSeconds: 8,
  },
]

const fps = 8
const chromeBinary =
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ].find(candidate => existsSync(candidate)) ?? null

if (!chromeBinary) {
  console.error('Google Chrome is required to generate GitHub demo GIFs.')
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })
rmSync(tempRoot, { recursive: true, force: true })
mkdirSync(tempRoot, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chromeBinary,
  headless: 'new',
  defaultViewport: { width: 960, height: 540, deviceScaleFactor: 1 },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
})

try {
  for (const demo of demos) {
    const frameDir = join(tempRoot, demo.name)
    mkdirSync(frameDir, { recursive: true })

    console.log(`Capturing ${demo.name} from Hyperframes composition`)
    await captureFrames(browser, demo, frameDir)

    const gifPath = join(outputDir, `${demo.name}.gif`)
    encodeGif(frameDir, gifPath, Math.round(1000 / fps))
    console.log(`Wrote ${gifPath}`)
  }
} finally {
  await browser.close()
  rmSync(tempRoot, { recursive: true, force: true })
}

async function captureFrames(browser, demo, frameDir) {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(join(projectDir, demo.composition)).href, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => window.__timelines?.main, { timeout: 30_000 })
  await page.evaluate(() => {
    document.body.style.margin = '0'
    document.documentElement.style.background = '#050712'
  })
  const frameCount = Math.ceil(demo.durationSeconds * fps)
  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / fps
    await page.evaluate((nextTime) => {
      window.__timelines.main.time(nextTime)
    }, time)
    await page.screenshot({
      path: join(frameDir, `${String(frame).padStart(4, '0')}.png`),
      type: 'png',
      clip: { x: 0, y: 0, width: 960, height: 540 },
    })
  }
  await page.close()
}

function encodeGif(frameDir, gifPath, delay) {
  const frames = readdirSync(frameDir)
    .filter(file => file.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(file => join(frameDir, file))

  if (frames.length === 0) {
    throw new Error(`No PNG frames found in ${frameDir}`)
  }

  const gif = GIFEncoder({ initialCapacity: 1024 * 1024 * 32 })
  let width = 0
  let height = 0

  for (const [index, framePath] of frames.entries()) {
    if (!existsSync(framePath)) continue
    const png = PNG.sync.read(readFileSync(framePath))
    width = png.width
    height = png.height
    const palette = quantize(png.data, 256, { format: 'rgb444' })
    const indexed = applyPalette(png.data, palette, 'rgb444')
    gif.writeFrame(indexed, width, height, {
      palette,
      delay,
      repeat: index === 0 ? 0 : undefined,
    })
  }

  gif.finish()
  writeFileSync(gifPath, gif.bytes())
}

import {spawn} from 'node:child_process'
import {createReadStream, createWriteStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync} from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import {randomBytes} from 'node:crypto'
import {dirname, extname, join, normalize, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chromePort = 9333
const appPort = 9334
const outDir = process.env.ROWPORT_UI_REGRESSION_DIR || '/private/tmp/rowport-ui-regression'
const profileDir = '/private/tmp/rowport-chrome-profile'
const distDir = join(repoRoot, 'frontend/dist')
const appUrl = `http://127.0.0.1:${appPort}/`

if (!existsSync(chromePath)) {
  throw new Error(`Chrome not found at ${chromePath}. Set CHROME_PATH to the local Chrome executable.`)
}
if (!existsSync(join(distDir, 'index.html'))) {
  throw new Error('frontend/dist/index.html not found. Run `npm run build` in frontend before UI regression.')
}

mkdirSync(outDir, {recursive: true})
rmSync(profileDir, {recursive: true, force: true})

const contentTypes = new Map([
  ['.html', 'text/html;charset=utf-8'],
  ['.js', 'text/javascript;charset=utf-8'],
  ['.css', 'text/css;charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg']
])

const appServer = http.createServer((req, res) => {
  const requestedPath = normalize(decodeURIComponent(new URL(req.url || '/', appUrl).pathname)).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(distDir, requestedPath === '/' ? 'index.html' : requestedPath)
  if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
    filePath = join(distDir, 'index.html')
  }
  if (statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html')
  res.setHeader('Content-Type', contentTypes.get(extname(filePath)) || 'application/octet-stream')
  createReadStream(filePath).pipe(res)
})

await new Promise((resolve, reject) => {
  appServer.once('error', reject)
  appServer.listen(appPort, '127.0.0.1', resolve)
})

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${profileDir}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  appUrl
], {stdio: ['ignore', 'ignore', 'pipe']})

chrome.stderr.pipe(createWriteStream(join(outDir, 'chrome.log')))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function httpJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({host: '127.0.0.1', port: chromePort, path}, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(1000, () => {
      req.destroy(new Error('HTTP timeout'))
    })
  })
}

async function waitForPage() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await httpJson('/json/list')
      const page = list.find((item) => item.type === 'page')
      if (page?.webSocketDebuggerUrl) return page
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome DevTools page not available')
}

class CdpSocket {
  constructor(url) {
    const parsed = new URL(url)
    this.host = parsed.hostname
    this.port = Number(parsed.port)
    this.path = parsed.pathname + parsed.search
    this.nextId = 1
    this.pending = new Map()
    this.buffer = Buffer.alloc(0)
  }

  connect() {
    return new Promise((resolve, reject) => {
      const key = randomBytes(16).toString('base64')
      this.socket = net.createConnection({host: this.host, port: this.port}, () => {
        this.socket.write([
          `GET ${this.path} HTTP/1.1`,
          `Host: ${this.host}:${this.port}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '',
          ''
        ].join('\r\n'))
      })
      let handshake = Buffer.alloc(0)
      this.socket.on('data', (chunk) => {
        if (!this.connected) {
          handshake = Buffer.concat([handshake, chunk])
          const index = handshake.indexOf('\r\n\r\n')
          if (index === -1) return
          const head = handshake.slice(0, index).toString('utf8')
          if (!head.includes('101')) {
            reject(new Error(`WebSocket handshake failed: ${head}`))
            return
          }
          this.connected = true
          const rest = handshake.slice(index + 4)
          if (rest.length) this.receive(rest)
          resolve()
          return
        }
        this.receive(chunk)
      })
      this.socket.on('error', reject)
    })
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.buffer.length >= 2) {
      const first = this.buffer[0]
      const second = this.buffer[1]
      const opcode = first & 0x0f
      let length = second & 0x7f
      let offset = 2
      if (length === 126) {
        if (this.buffer.length < offset + 2) return
        length = this.buffer.readUInt16BE(offset)
        offset += 2
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return
        const high = this.buffer.readUInt32BE(offset)
        const low = this.buffer.readUInt32BE(offset + 4)
        length = high * 2 ** 32 + low
        offset += 8
      }
      const masked = Boolean(second & 0x80)
      let mask
      if (masked) {
        if (this.buffer.length < offset + 4) return
        mask = this.buffer.slice(offset, offset + 4)
        offset += 4
      }
      if (this.buffer.length < offset + length) return
      let payload = this.buffer.slice(offset, offset + length)
      this.buffer = this.buffer.slice(offset + length)
      if (masked) {
        payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]))
      }
      if (opcode === 1) this.handleMessage(payload.toString('utf8'))
      if (opcode === 8) this.socket.end()
    }
  }

  sendFrame(text) {
    const payload = Buffer.from(text)
    const mask = randomBytes(4)
    let header
    if (payload.length < 126) {
      header = Buffer.alloc(2)
      header[1] = 0x80 | payload.length
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4)
      header[1] = 0x80 | 126
      header.writeUInt16BE(payload.length, 2)
    } else {
      header = Buffer.alloc(10)
      header[1] = 0x80 | 127
      header.writeUInt32BE(0, 2)
      header.writeUInt32BE(payload.length, 6)
    }
    header[0] = 0x81
    const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]))
    this.socket.write(Buffer.concat([header, mask, masked]))
  }

  handleMessage(text) {
    const message = JSON.parse(text)
    if (!message.id) return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    if (message.error) pending.reject(new Error(JSON.stringify(message.error)))
    else pending.resolve(message.result)
  }

  command(method, params = {}) {
    const id = this.nextId++
    this.sendFrame(JSON.stringify({id, method, params}))
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject})
    })
  }

  close() {
    this.socket?.end()
  }
}

async function main() {
  const page = await waitForPage()
  const cdp = new CdpSocket(page.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.command('Page.enable')
  await cdp.command('Runtime.enable')
  await sleep(1200)

  async function evalJs(expression) {
    const result = await cdp.command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime exception')
    }
    return result.result?.value
  }

  async function click(label, expression) {
    const value = await evalJs(`(() => { ${expression}; return true })()`)
    await sleep(500)
    return value
  }

  async function screenshot(name) {
    const result = await cdp.command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true})
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(result.data, 'base64'))
  }

  async function assertVisible(name, selector) {
    const visible = await evalJs(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
    if (!visible) throw new Error(`${name} not visible: ${selector}`)
  }

  await assertVisible('app shell', '.ide-shell')
  await screenshot('01-initial')

  await click('open profile dialog', `const el = document.querySelector('button[title="Add"]'); if (!el) throw new Error('Add button missing'); el.click()`)
  await assertVisible('profile dialog', '.connection-dialog')
  await screenshot('02-profile-dialog-general')

  await click('switch ssh tab', `const el = [...document.querySelectorAll('.dialog-tabs button')].find((button) => button.textContent.includes('SSH')); if (!el) throw new Error('SSH tab missing'); el.click()`)
  await assertVisible('ssh tab', '.dialog-section')
  await screenshot('03-profile-dialog-ssh')

  await click('close dialog', `document.querySelector('.icon-close')?.click()`)
  await click('connect preview', `const el = document.querySelector('button[title="Connect"]'); if (!el) throw new Error('Connect button missing'); el.click()`)
  await sleep(1000)
  await assertVisible('data surface', '.data-surface')
  await assertVisible('data grid', '.data-grid')
  await screenshot('04-demo-data-grid')

  await click('open filter dialog', `const el = [...document.querySelectorAll('.filter-row button')].find((button) => button.textContent.trim() === 'Filter'); if (!el) throw new Error('Filter button missing'); el.click()`)
  await assertVisible('filter dialog', '.filter-dialog')
  await screenshot('05-filter-dialog')
  await click('close filter dialog', `document.querySelector('.icon-close')?.click()`)

  await click('select first data row', `const row = document.querySelector('.data-grid tbody tr:not(.virtual-spacer-row)'); if (!row) throw new Error('Data row missing'); row.click()`)
  await click('open edit row dialog', `const el = document.querySelector('button[title="编辑选中行"]'); if (!el) throw new Error('Selected row edit button missing'); el.click()`)
  await assertVisible('edit row dialog', '.row-dialog')
  await screenshot('06-edit-row-dialog')
  await click('close edit row dialog', `document.querySelector('.icon-close')?.click()`)

  await click('open insert row dialog', `const el = [...document.querySelectorAll('.filter-row button')].find((button) => button.textContent.trim() === '+ Row'); if (!el) throw new Error('Insert row button missing'); el.click()`)
  await assertVisible('insert row dialog', '.row-dialog')
  await screenshot('07-insert-row-dialog')

  cdp.close()
  console.log(JSON.stringify({outDir, screenshots: 7}, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => {
  chrome.kill('SIGTERM')
  appServer.close()
})

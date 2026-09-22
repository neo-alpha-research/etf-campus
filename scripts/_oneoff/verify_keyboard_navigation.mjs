import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const PORT = 3456;
const OUT_DIR = path.resolve('out');

// 1. Static file server for `out/`
function startServer() {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath.endsWith('/')) {
      reqPath += 'index.html';
    }
    let filePath = path.join(OUT_DIR, reqPath);
    if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: ' + reqPath);
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

// 2. Launch Headless Chrome with CDP
function launchChrome() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
  ]);

  return new Promise((resolve, reject) => {
    chromeProcess.on('error', reject);
    const start = Date.now();
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://127.0.0.1:9223/json/list');
        if (res.ok) {
          const list = await res.json();
          const page = list.find((item) => item.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            clearInterval(interval);
            resolve({ process: chromeProcess, wsUrl: page.webSocketDebuggerUrl });
          }
        }
      } catch {
        if (Date.now() - start > 10000) {
          clearInterval(interval);
          reject(new Error('Chrome failed to start within 10 seconds'));
        }
      }
    }, 200);
  });
}

// CDP Client Helper
class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }

  init() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result ? res.result.value : null;
  }

  async sendKey(key, code, windowsVirtualKeyCode, text = '') {
    await this.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code,
      windowsVirtualKeyCode,
      text,
      unmodifiedText: text,
    });
    if (text) {
      await this.send('Input.dispatchKeyEvent', {
        type: 'char',
        key,
        code,
        windowsVirtualKeyCode,
        text,
        unmodifiedText: text,
      });
    }
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode,
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log('[1/5] Starting static server...');
  const server = await startServer();
  console.log(`Server listening on http://127.0.0.1:${PORT}`);

  console.log('[2/5] Launching Chrome Headless with CDP...');
  const { process: chromeProcess, wsUrl } = await launchChrome();
  console.log('Chrome connected at', wsUrl);

  const cdp = new CDPClient(wsUrl);
  await cdp.init();

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    console.log('[3/5] Navigating to /guides/self-check/ ...');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/guides/self-check/` });

    // Wait for page to render checklist
    let ready = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      ready = await cdp.eval('Boolean(document.getElementById("opt-1-confirmed"))');
      if (ready) break;
    }

    if (!ready) {
      throw new Error('Checklist element #opt-1-confirmed not found in page');
    }
    console.log('Page loaded and #opt-1-confirmed is present.');

    console.log('[4/5] Executing step-by-step Keyboard Navigation assertions...');
    const results = [];

    // Helper to get active element state
    async function getActiveState() {
      return await cdp.eval(`(() => {
        const el = document.activeElement;
        const opt1Confirmed = document.getElementById("opt-1-confirmed");
        const opt1NeedsReview = document.getElementById("opt-1-needs_review");
        const opt1NotApplicable = document.getElementById("opt-1-not_applicable");
        return {
          activeId: el ? el.id : null,
          activeTagName: el ? el.tagName : null,
          activeAriaLabel: el ? el.getAttribute('aria-label') : null,
          activeType: el ? el.getAttribute('type') : null,
          activeChecked: el && el.tagName === 'INPUT' ? el.checked : null,
          item1ConfirmedChecked: opt1Confirmed ? opt1Confirmed.checked : false,
          item1NeedsReviewChecked: opt1NeedsReview ? opt1NeedsReview.checked : false,
          item1NotApplicableChecked: opt1NotApplicable ? opt1NotApplicable.checked : false,
        };
      })()`);
    }

    // Step 0: Initial Focus on first radio
    console.log('\n--- Step 0: Focus on first radio (#opt-1-confirmed) ---');
    await cdp.eval('document.getElementById("opt-1-confirmed").focus()');
    await new Promise((r) => setTimeout(r, 100));
    const step0State = await getActiveState();
    const step0 = {
      step: 0,
      action: 'Initial Focus',
      targetId: 'opt-1-confirmed',
      focusedId: step0State.activeId,
      checked: step0State.item1ConfirmedChecked,
      expected: { focusedId: 'opt-1-confirmed', checked: false },
      pass: step0State.activeId === 'opt-1-confirmed' && step0State.item1ConfirmedChecked === false,
    };
    results.push(step0);
    console.log('Step 0 result:', step0);
    if (!step0.pass) throw new Error('Step 0 failed: Initial focus mismatch');

    // Step 1: Space key to select currently focused radio (#opt-1-confirmed)
    console.log('\n--- Step 1: Press Space (select #opt-1-confirmed) ---');
    await cdp.sendKey(' ', 'Space', 32, ' ');
    await new Promise((r) => setTimeout(r, 150));
    const step1State = await getActiveState();
    const step1 = {
      step: 1,
      action: 'Press Space',
      targetId: 'opt-1-confirmed',
      focusedId: step1State.activeId,
      checked: step1State.item1ConfirmedChecked,
      expected: { focusedId: 'opt-1-confirmed', checked: true },
      pass: step1State.activeId === 'opt-1-confirmed' && step1State.item1ConfirmedChecked === true,
    };
    results.push(step1);
    console.log('Step 1 result:', step1);
    if (!step1.pass) throw new Error('Step 1 failed: Space selection mismatch');

    // Step 2: ArrowRight key to navigate to next radio in group (#opt-1-needs_review)
    console.log('\n--- Step 2: Press ArrowRight (move to #opt-1-needs_review) ---');
    await cdp.sendKey('ArrowRight', 'ArrowRight', 39);
    await new Promise((r) => setTimeout(r, 150));
    const step2State = await getActiveState();
    const step2 = {
      step: 2,
      action: 'Press ArrowRight',
      targetId: 'opt-1-needs_review',
      focusedId: step2State.activeId,
      checked: step2State.item1NeedsReviewChecked,
      expected: { focusedId: 'opt-1-needs_review', checked: true },
      pass: step2State.activeId === 'opt-1-needs_review' && step2State.item1NeedsReviewChecked === true,
    };
    results.push(step2);
    console.log('Step 2 result:', step2);
    if (!step2.pass) throw new Error('Step 2 failed: ArrowRight navigation mismatch');

    // Step 3: ArrowDown key to navigate to next radio in group (#opt-1-not_applicable)
    console.log('\n--- Step 3: Press ArrowDown (move to #opt-1-not_applicable) ---');
    await cdp.sendKey('ArrowDown', 'ArrowDown', 40);
    await new Promise((r) => setTimeout(r, 150));
    const step3State = await getActiveState();
    const step3 = {
      step: 3,
      action: 'Press ArrowDown',
      targetId: 'opt-1-not_applicable',
      focusedId: step3State.activeId,
      checked: step3State.item1NotApplicableChecked,
      expected: { focusedId: 'opt-1-not_applicable', checked: true },
      pass: step3State.activeId === 'opt-1-not_applicable' && step3State.item1NotApplicableChecked === true,
    };
    results.push(step3);
    console.log('Step 3 result:', step3);
    if (!step3.pass) throw new Error('Step 3 failed: ArrowDown navigation mismatch');

    // Step 4: ArrowLeft key to navigate back (#opt-1-needs_review)
    console.log('\n--- Step 4: Press ArrowLeft (move back to #opt-1-needs_review) ---');
    await cdp.sendKey('ArrowLeft', 'ArrowLeft', 37);
    await new Promise((r) => setTimeout(r, 150));
    const step4State = await getActiveState();
    const step4 = {
      step: 4,
      action: 'Press ArrowLeft',
      targetId: 'opt-1-needs_review',
      focusedId: step4State.activeId,
      checked: step4State.item1NeedsReviewChecked,
      expected: { focusedId: 'opt-1-needs_review', checked: true },
      pass: step4State.activeId === 'opt-1-needs_review' && step4State.item1NeedsReviewChecked === true,
    };
    results.push(step4);
    console.log('Step 4 result:', step4);
    if (!step4.pass) throw new Error('Step 4 failed: ArrowLeft navigation mismatch');

    // Step 5: ArrowUp key to navigate back to first option (#opt-1-confirmed)
    console.log('\n--- Step 5: Press ArrowUp (move back to #opt-1-confirmed) ---');
    await cdp.sendKey('ArrowUp', 'ArrowUp', 38);
    await new Promise((r) => setTimeout(r, 150));
    const step5State = await getActiveState();
    const step5 = {
      step: 5,
      action: 'Press ArrowUp',
      targetId: 'opt-1-confirmed',
      focusedId: step5State.activeId,
      checked: step5State.item1ConfirmedChecked,
      expected: { focusedId: 'opt-1-confirmed', checked: true },
      pass: step5State.activeId === 'opt-1-confirmed' && step5State.item1ConfirmedChecked === true,
    };
    results.push(step5);
    console.log('Step 5 result:', step5);
    if (!step5.pass) throw new Error('Step 5 failed: ArrowUp navigation mismatch');

    // Step 6: Tab key navigation from Item 1 radio group forward
    console.log('\n--- Step 6: Press Tab (navigate forward from Item 1 radio group) ---');
    await cdp.sendKey('Tab', 'Tab', 9);
    await new Promise((r) => setTimeout(r, 150));
    const step6State = await getActiveState();
    const step6 = {
      step: 6,
      action: 'Press Tab',
      focusedId: step6State.activeId,
      focusedTagName: step6State.activeTagName,
      focusedAriaLabel: step6State.activeAriaLabel,
      expected: { hasFocusMoved: step6State.activeId !== 'opt-1-confirmed' },
      pass: step6State.activeId !== 'opt-1-confirmed',
    };
    results.push(step6);
    console.log('Step 6 result:', step6);
    if (!step6.pass) throw new Error('Step 6 failed: Tab key focus did not move');

    // Step 7: Reset All focus restoration
    console.log('\n--- Step 7: Click "전체 초기화" and verify focus moves to #self-check-heading ---');
    await cdp.eval(`(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('전체 초기화'));
      if (resetBtn) resetBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 200));
    const step7State = await getActiveState();
    const step7 = {
      step: 7,
      action: 'Click Reset All',
      targetId: 'self-check-heading',
      focusedId: step7State.activeId,
      focusedTagName: step7State.activeTagName,
      expected: { focusedId: 'self-check-heading', focusedTagName: 'H2' },
      pass: step7State.activeId === 'self-check-heading' && step7State.activeTagName === 'H2',
    };
    results.push(step7);
    console.log('Step 7 result:', step7);
    if (!step7.pass) throw new Error('Step 7 failed: Focus not restored to #self-check-heading');

    console.log('\n[5/5] All keyboard navigation assertions PASSED successfully!');

    // Read previous observations and update keyboardNav block
    const obsPath = path.resolve('C:/Users/kibae/.gemini/antigravity/brain/24b2baf4-1af2-412c-b55b-5e5f9c377c76/browser_observations.json');
    let observations = {};
    if (fs.existsSync(obsPath)) {
      observations = JSON.parse(fs.readFileSync(obsPath, 'utf-8'));
    }

    observations.keyboardNav = {
      measurementStatus: 'verified_with_cdp_real_input',
      explanation: '이전 기록은 측정 대상·시점 오류로 추정되며, 첫 라디오(#opt-1-confirmed)에 포커스를 둔 상태에서 실제 브라우저 키 입력으로 재검증한 결과 방향키·Space·Tab 및 초점 복원이 모두 정상 동작함을 확인.',
      steps: results,
      summary: {
        allPassed: results.every((r) => r.pass),
        stepsCount: results.length,
        timestamp: new Date().toISOString(),
      },
      networkStatus: 'not_measured_in_keyboard_script'
    };

    fs.writeFileSync(obsPath, JSON.stringify(observations, null, 2), 'utf-8');
    console.log('Updated browser_observations.json successfully.');

  } finally {
    cdp.close();
    chromeProcess.kill();
    server.close();
  }
}

run().catch((err) => {
  console.error('FAILED with error:', err);
  process.exit(1);
});

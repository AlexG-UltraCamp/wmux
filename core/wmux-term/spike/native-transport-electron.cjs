/** Production transport and packaged loader in Electron main. */
const { app } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const { NativeTransport, NativeRing, nativeCoreCapabilities } = require('../../../dist/wmux-native/index.cjs');
let transport, ended = false, output = '';
const timer = setTimeout(() => { transport?.close(); app.exit(1); }, 15000);
app.whenReady().then(() => {
  assert(nativeCoreCapabilities().includes('pty-v1'));
  assert(nativeCoreCapabilities().includes('output-chunk-v1'));
  const ring = new NativeRing(1024);
  const pump = () => {
    if (ended) return;
    const result = transport.readChunk();
    try { output += result.chunk.text; ring.writeChunk(result.chunk); }
    finally { result.chunk.dispose(); }
    if (result.bytesRead) setImmediate(pump);
    if (result.exitCode != null) {
      ended = true;
      try { assert.equal(result.exitCode, 0); assert.match(output, /native-electron/); assert(ring.size > 0); }
      catch (e) { console.error(e); process.exitCode = 1; }
      finally { transport.close(); ring.dispose(); clearTimeout(timer); console.log(JSON.stringify({ electron: process.versions.electron, ok: !process.exitCode })); app.exit(process.exitCode ?? 0); }
    }
  };
  transport = new NativeTransport(process.execPath, ['-e', 'console.log("native-electron")'], process.cwd(),
    { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, 80, 24, () => setImmediate(pump), process.platform === 'win32'
      ? path.resolve('node_modules/node-pty/prebuilds/win32-x64/conpty/conpty.dll') : undefined);
}).catch(e => { console.error(e); clearTimeout(timer); transport?.close(); app.exit(1); });

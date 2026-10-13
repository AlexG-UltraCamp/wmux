// Run inside an actual PTY, not with mocked native bindings.
const mode = process.argv[2];
if (mode === 'output') {
  const count = Number(process.argv[3]);
  const write = index => {
    while (index < count) {
      const line = `ROW${String(index++).padStart(6, '0')}|한글🙂|${'x'.repeat(30)}\n`;
      if (!process.stdout.write(line)) { process.stdout.once('drain', () => write(index)); return; }
    }
    process.stdout.write('FINAL-OUTPUT\n', () => { process.exitCode = 7; });
  };
  write(0);
} else if (mode === 'input') {
  process.stdin.setRawMode(true);
  process.stdout.write('READY\n');
  let received = 0;
  const hash = require('node:crypto').createHash('sha256');
  process.stdin.on('data', data => {
    received += data.length; hash.update(data);
    if (received === Number(process.argv[3])) {
      process.stdout.write(`DIGEST:${hash.digest('hex')}\n`, () => process.exit(0));
    }
  });
} else if (mode === 'blocked-input') {
  process.stdin.setRawMode(true);
  process.stdout.write('READY\n');
  setInterval(() => {}, 1000);
} else if (mode === 'metadata') {
  process.stdout.write(JSON.stringify({ cwd: process.cwd(), value: process.env.WMUX_FIXTURE_VALUE,
    args: process.argv.slice(3), cols: process.stdout.columns, rows: process.stdout.rows }) + '\n');
} else if (mode === 'idle') {
  process.stdout.write('READY\n');
  setInterval(() => {}, 1000);
} else if (mode === 'tree') {
  const child = require('node:child_process').spawn(process.execPath, [__filename, 'idle'], { stdio: 'inherit' });
  process.stdout.write(`CHILD:${child.pid}\n`);
  setTimeout(() => process.exit(0), 100);
} else if (mode === 'resize') {
  process.stdout.write('READY\n');
  process.stdout.on('resize', () => {
    if (process.stdout.columns === 120 && process.stdout.rows === 40) process.stdout.write('RESIZED:120x40\n', () => process.exit(0));
  });
  setInterval(() => {}, 1000);
} else { throw new Error(`Unknown mode: ${mode}`); }

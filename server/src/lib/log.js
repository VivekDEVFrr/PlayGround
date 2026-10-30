const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = () => LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, message, meta) {
  if (LEVELS[level] > threshold()) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg: message,
    ...(meta || {}),
  };
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(JSON.stringify(line));
}

export const log = emit;

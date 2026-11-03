/** One JSON line per event, ready for any log collector. */
function write(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...context });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};

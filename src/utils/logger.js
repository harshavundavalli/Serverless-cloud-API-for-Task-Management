const isProd = process.env.STAGE === 'prod';

const log = (level, message, meta = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  // In production, output structured JSON for CloudWatch Logs Insights
  if (isProd) {
    console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
  } else {
    const color = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' }[level] || '';
    console.log(`${color}[${level.toUpperCase()}]\x1b[0m ${message}`, Object.keys(meta).length ? meta : '');
  }
};

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

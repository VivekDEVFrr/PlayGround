import { createHash, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { unavailable, unauthorized } from './errors.js';
import { log } from './log.js';

const digest = (value) => createHash('sha256').update(String(value)).digest();

/**
 * Bearer-token gate for every /api/admin route.
 * Token comparison is constant-time and the configured token is never logged.
 */
export function requireAdmin(req, res, next) {
  if (!config.adminToken) {
    return next(unavailable('Admin API is disabled until DASHBOARD_ADMIN_TOKEN is set'));
  }

  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return next(unauthorized('Admin token required'));

  const provided = digest(match[1].trim());
  const expected = digest(config.adminToken);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    log('warn', 'admin token rejected', { ip: req.ip });
    return next(unauthorized('Invalid admin token'));
  }

  req.admin = { via: 'bearer' };
  return next();
}

import express from 'express';
import rateLimit from 'express-rate-limit';
import { config, pterodactylEnabled, whitelistBridgeEnabled } from '../config.js';
import { requireAdmin } from '../lib/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { lookupPlayer } from '../lib/mojang.js';
import { getResources, sendPower } from '../lib/pterodactyl.js';
import { getWhitelistSummary } from '../lib/whitelist.js';

const limiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });

const generalLimit = limiter(60_000, 180, 'Too many requests. Slow down.');
const lookupLimit = limiter(60_000, 30, 'Too many player lookups. Try again in a minute.');
const adminLimit = limiter(60_000, 30, 'Too many admin requests.');

export function createApiRouter({ statusService }) {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        api: 'up',
        uptimeSeconds: Math.round(process.uptime()),
        features: {
          pterodactyl: pterodactylEnabled,
          whitelistBridge: whitelistBridgeEnabled,
          admin: Boolean(config.adminToken),
        },
      },
    });
  });

  router.get('/config', generalLimit, (_req, res) => {
    res.json({
      data: {
        brand: config.brand,
        mc: {
          host: config.mc.host,
          port: config.mc.port,
          bedrockPort: config.bedrockPort,
          version: null,
        },
        links: config.links,
        pollSeconds: config.pollSeconds,
        features: {
          pterodactyl: pterodactylEnabled,
          whitelistBridge: whitelistBridgeEnabled,
          admin: Boolean(config.adminToken),
        },
      },
    });
  });

  router.get('/status', generalLimit, async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
      res.json({ data: await statusService.getStatus() });
    } catch (err) {
      next(err);
    }
  });

  router.get('/history', generalLimit, (_req, res) => {
    res.set('Cache-Control', 'public, max-age=10');
    res.json({ data: statusService.getHistory() });
  });

  router.get('/players/:name', lookupLimit, async (req, res, next) => {
    try {
      const status = await statusService.getStatus();
      res.json({ data: await lookupPlayer(req.params.name, status) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/whitelist/summary', lookupLimit, async (_req, res, next) => {
    try {
      res.json({ data: await getWhitelistSummary() });
    } catch (err) {
      next(err);
    }
  });

  const admin = express.Router();
  admin.use(adminLimit, requireAdmin);

  admin.get('/verify', (_req, res) => {
    res.json({
      data: {
        ok: true,
        pterodactyl: pterodactylEnabled,
        scope: 'dashboard-admin',
      },
    });
  });

  admin.get('/resources', async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ data: await getResources() });
    } catch (err) {
      next(err);
    }
  });

  admin.post('/power', async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const action = String(body.action || '');
      if (!['start', 'stop', 'restart'].includes(action)) {
        throw badRequest('action must be start, stop or restart');
      }

      const result = await sendPower(action);
      // Audit trail without secrets: who (IP), what, when.
      console.log(JSON.stringify({ t: new Date().toISOString(), level: 'info', msg: 'admin power action', action, ip: req.ip }));
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  router.use('/admin', admin);

  router.use((req, _res, next) => next(notFound(`No API route for ${req.method} ${req.originalUrl}`)));

  return router;
}

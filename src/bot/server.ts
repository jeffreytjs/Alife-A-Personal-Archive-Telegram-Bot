import express, { Request, Response, NextFunction } from 'express';
import { config } from '../utils/config.js';
import { runDailyPromptBroadcast } from '../jobs/dailyPromptJob.js';

type TelegramUpdate = {
  update_id: number;
  [key: string]: unknown;
};

export class BotHttpServer {
  private app: express.Application;
  private server: ReturnType<express.Application['listen']> | undefined;
  private isRunning = false;
  private readonly webAppOrigin: string;
  private telegramUpdateProcessor?: (update: TelegramUpdate) => Promise<void> | void;

  private static readonly TELEGRAM_IP_CIDR_RANGES = ['149.154.160.0/20', '91.108.4.0/22'];

  constructor() {
    this.app = express();
    this.app.set('trust proxy', true);
    this.webAppOrigin = new URL(config.webApp.url).origin;
    this.setupMiddleware();
    this.setupRoutes();
  }

  public setTelegramUpdateProcessor(processor: (update: TelegramUpdate) => Promise<void> | void): void {
    this.telegramUpdateProcessor = processor;
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    this.app.use('/api', (req: Request, res: Response, next: NextFunction) => {
      this.applyApiCors(req, res, next);
    });
  }

  private normalizeIp(ip: string): string {
    const trimmed = ip.trim();
    if (trimmed.startsWith('::ffff:')) {
      return trimmed.slice(7);
    }
    return trimmed;
  }

  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return null;
    }

    const octets = parts.map((part) => Number.parseInt(part, 10));
    if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
      return null;
    }

    return ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [network, prefixText] = cidr.split('/');
    const prefixLength = Number.parseInt(prefixText ?? '', 10);
    const ipNumber = this.ipToNumber(ip);
    const networkNumber = network ? this.ipToNumber(network) : null;

    if (
      ipNumber === null ||
      networkNumber === null ||
      Number.isNaN(prefixLength) ||
      prefixLength < 0 ||
      prefixLength > 32
    ) {
      return false;
    }

    const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
    return (ipNumber & mask) === (networkNumber & mask);
  }

  private isTelegramSourceAllowed(req: Request): boolean {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedIps =
      typeof forwarded === 'string'
        ? forwarded.split(',').map((candidate) => this.normalizeIp(candidate))
        : [];

    const directIps = [req.ip, req.socket.remoteAddress]
      .filter((value): value is string => Boolean(value))
      .map((candidate) => this.normalizeIp(candidate));

    const candidates = Array.from(new Set([...forwardedIps, ...directIps]));

    return candidates.some((candidateIp) =>
      BotHttpServer.TELEGRAM_IP_CIDR_RANGES.some((cidr) => this.isIpInCidr(candidateIp, cidr)),
    );
  }

  private applyApiCors(req: Request, res: Response, next: NextFunction): void {
    const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : '';

    if (requestOrigin && requestOrigin !== this.webAppOrigin) {
      if (req.method === 'OPTIONS') {
        res.sendStatus(403);
        return;
      }

      res.status(403).json({
        error: 'Origin is not allowed for this endpoint',
      });
      return;
    }

    res.header('Access-Control-Allow-Origin', this.webAppOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: config.bot.displayName,
      });
    });

    this.app.get('/api/status', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        botName: config.bot.displayName,
        webAppEnabled: config.webApp.enabled,
        environment: config.app.nodeEnv,
      });
    });

    this.app.post('/telegram/webhook', express.json({ type: 'application/json' }), async (req: Request, res: Response) => {
      if (config.app.nodeEnv === 'production' && !this.isTelegramSourceAllowed(req)) {
        res.status(403).json({
          error: 'Webhook source is not allowed',
        });
        return;
      }

      if (!this.telegramUpdateProcessor) {
        res.status(503).json({
          error: 'Telegram webhook processor is not configured',
        });
        return;
      }

      const update = req.body as TelegramUpdate;
      if (!update || typeof update !== 'object' || typeof update.update_id !== 'number') {
        res.status(400).json({
          error: 'Invalid Telegram update payload',
        });
        return;
      }

      try {
        await this.telegramUpdateProcessor(update);
        res.sendStatus(200);
      } catch (error) {
        console.error('Failed to process Telegram webhook update:', error);
        res.status(500).json({
          error: 'Failed to process Telegram update',
        });
      }
    });

    if (config.app.enableDevJobEndpoint) {
      this.app.post('/internal/jobs/daily-prompt', async (_req: Request, res: Response) => {
        try {
          await runDailyPromptBroadcast();
          res.json({ ok: true });
        } catch (error) {
          console.error('Manual daily prompt job failed:', error);
          res.status(500).json({ ok: false });
        }
      });
    }

    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
      });
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(config.app.port, () => {
        console.log(`HTTP server running on port ${config.app.port}`);
        console.log(`  GET  /health`);
        console.log(`  GET  /api/status`);
        console.log(`  POST /telegram/webhook`);
        this.isRunning = true;
        resolve();
      });

      this.server.on('error', (err: Error) => {
        console.error('Failed to start HTTP server:', err);
        reject(err);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err?: Error) => {
          if (err) {
            reject(err);
          } else {
            this.isRunning = false;
            resolve();
          }
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }
}

export const botHttpServer = new BotHttpServer();

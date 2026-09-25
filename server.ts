import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const DEFAULT_PORT = 3000;

function getPort(): number {
  const configuredPort = Number(process.env.PORT ?? DEFAULT_PORT);
  return Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65536
    ? configuredPort
    : DEFAULT_PORT;
}

async function startServer() {
  const app = express();
  const port = getPort();

  // The UI and API are served from the same origin. Avoid a permissive CORS
  // policy so that browser clients from other origins cannot call the API.
  app.disable('x-powered-by');
  app.use((_, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'LeadScout - ClientHunter',
      timestamp: new Date().toISOString()
    });
  });

  // API Route for search & lead finding info
  app.get('/api/info', (req, res) => {
    res.json({
      name: 'LeadScout',
      description: 'AI-powered business lead finder for Google Maps & 2GIS',
      version: '1.0.0'
    });
  });

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`LeadScout server is running on http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

import express from 'express';
import path from 'path';

const app = express();
const port = Number(process.env.PORT || 3000);
const dotnetApiUrl = process.env.DOTNET_API_URL || 'http://localhost:5000';

app.use('/hubs', express.text({ type: '*/*' }));
app.use(express.json());

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/hubs') && !req.path.startsWith('/swagger')) {
    next();
    return;
  }

  const upstreamAbort = new AbortController();
  const abortIfClientDisconnected = () => {
    if (!res.writableFinished) upstreamAbort.abort();
  };
  res.once('close', abortIfClientDisconnected);

  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value && name.toLowerCase() !== 'host' && name.toLowerCase() !== 'content-length') {
        headers.set(name, Array.isArray(value) ? value.join(',') : value);
      }
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined;
    const response = await fetch(`${dotnetApiUrl}${req.originalUrl}`, {
      method: req.method,
      headers,
      signal: upstreamAbort.signal,
      body: hasBody
        ? typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body)
        : undefined,
    });

    res.status(response.status);
    response.headers.forEach((value, name) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });

    const responseBody = response.body;
    if (!responseBody) {
      res.end();
      return;
    }

    const reader = responseBody.getReader();
    let streamComplete = false;
    try {
      while (!res.destroyed && !res.writableEnded) {
        const chunk = await reader.read();
        if (chunk.done) {
          streamComplete = true;
          break;
        }

        if (!res.write(Buffer.from(chunk.value))) {
          await new Promise<void>((resolve) => {
            const finishWaiting = () => {
              res.off('drain', finishWaiting);
              res.off('close', finishWaiting);
              resolve();
            };
            res.once('drain', finishWaiting);
            res.once('close', finishWaiting);
          });
        }
      }

      if (!streamComplete) {
        await reader.cancel();
      } else if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (!upstreamAbort.signal.aborted) {
      console.error(`[TransitOps API Bridge] ASP.NET Core request failed at ${dotnetApiUrl}:`, error);
      if (!res.headersSent && !res.destroyed) {
        res.status(502).json({
          title: 'API unavailable',
          detail: 'The ASP.NET Core API is unavailable. Start the PostgreSQL-backed API and retry.'
        });
      } else if (!res.destroyed) {
        res.destroy(error instanceof Error ? error : new Error('The upstream API response stream failed.'));
      }
    }
  } finally {
    res.off('close', abortIfClientDisconnected);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, 'localhost', () => {
    console.log(`[TransitOps] Frontend server listening on http://localhost:${port}`);
    console.log(`[TransitOps] API requests are forwarded to ASP.NET Core at ${dotnetApiUrl}`);
  });
}

void startServer();

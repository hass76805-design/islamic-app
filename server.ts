import 'dotenv/config';
import express, {type Request, type Response} from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/aac',
]);

function normalizeMimeType(rawMime: unknown): string | null {
  if (typeof rawMime !== 'string') return null;
  const base = rawMime.split(';')[0].trim().toLowerCase();
  if (ALLOWED_AUDIO_MIME_TYPES.has(base)) {
    return base;
  }
  return null;
}

let cachedAi: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedAi) {
    cachedAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAi;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isDev = process.env.NODE_ENV === 'development';

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use(express.json({limit: '15mb'}));

  app.post('/api/transcribe-quran', async (req: Request, res: Response) => {
    try {
      const body = req.body as {audioBase64?: unknown; mimeType?: unknown} | null;
      const audioBase64 = body?.audioBase64;
      const mimeType = normalizeMimeType(body?.mimeType);

      if (
        typeof audioBase64 !== 'string' ||
        audioBase64.length < 32 ||
        audioBase64.length > 12 * 1024 * 1024 ||
        !mimeType
      ) {
        res.status(400).json({
          ok: false,
          reason: 'invalid_audio_payload',
          text: '',
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.json({
          ok: false,
          reason: 'no_api_key',
          text: '',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'استمع لتلاوة القرآن الكريم باللغة العربية الفصحى واكتب الكلمات العربية المنطوقة بدقة تامة كما نُطقت دون تشكيل أو أرقام أو تعليقات إضافية.',
            },
          ],
        },
      });

      const text = (response.text ?? '').trim();
      res.json({
        ok: true,
        text,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Transcription request failed';
      res.status(502).json({
        ok: false,
        reason: 'upstream_error',
        error: message,
        text: '',
      });
    }
  });

  if (isDev) {
    const {createServer} = await import('vite');
    const vite = await createServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        if (fs.existsSync(indexHtml)) {
          res.sendFile(indexHtml);
        } else {
          res.status(404).send('Not built');
        }
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

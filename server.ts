import 'dotenv/config';
import express, {type Request, type Response} from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI, ThinkingLevel} from '@google/genai';

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

      const audioPart = {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      };

      const transcribePrompt =
        'استمع بتركيز شديد لتلاوة القرآن الكريم باللغة العربية الفصحى حتى لو كان الصوت منخفضًا جدًا أو همسًا أو فيه ضوضاء أو لخبطة في الكلمات. استخرج كل الكلمات العربية المنطوقة كما سُمعت بالضبط بدون تشكيل أو أرقام أو تعليقات أو اعتذار.';

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [audioPart, {text: transcribePrompt}],
        },
      });

      let text = (response.text ?? '').trim();

      // Second pass for very quiet, whispered, or noisy recitation if primary pass returned sparse text
      const arabicLettersCount = (text.match(/[\u0621-\u064A]/g) || []).length;
      if (arabicLettersCount < 3) {
        try {
          const fallbackResp = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: {
              parts: [
                audioPart,
                {
                  text: 'استمع جيدًا للتسجيل الصوتي (قد يكون الصوت واطيًا أو خافتًا أو متلعثمًا في تلاوة قرآنية وسط ضوضاء). خمّن بدقة واكتب فقط الكلمات العربية القرآنية التي يُرجَّح أن القارئ نطقها أو حاول نطقها، بدون أي مقدمات أو شرح أو عبارات مثل لم أفهم.',
                },
              ],
            },
            config: {
              thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
            },
          });
          const fallbackText = (fallbackResp.text ?? '').trim();
          const fallbackLetters = (
            fallbackText.match(/[\u0621-\u064A]/g) || []
          ).length;
          if (fallbackLetters > arabicLettersCount) {
            text = fallbackText;
          }
        } catch {
          // Keep primary transcription result
        }
      }

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

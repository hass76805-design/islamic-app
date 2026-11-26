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

  app.post('/api/rafiqi-tts', async (req: Request, res: Response) => {
    try {
      const body = req.body as {text?: unknown} | null;
      const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!rawText || rawText.length > 1500) {
        res.status(400).json({
          ok: false,
          reason: 'invalid_text',
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          ok: false,
          reason: 'no_api_key',
        });
        return;
      }

      const sheikhStyle =
        'Warm, calm, compassionate, dignified mature male Egyptian/Arabic Islamic Sheikh mentor speaking gently and naturally from the heart to comfort a friend, with authentic human breathing, clear Arabic articulation, and soothing warmth — never robotic.';

      const ttsModels = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];
      let audioBase64: string | undefined;

      for (const model of ttsModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: rawText,
                    speechMetadata: {
                      style: sheikhStyle,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {voiceName: 'Charon'},
                },
              },
            },
          });

          const candidateData =
            response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (candidateData && candidateData.length > 64) {
            audioBase64 = candidateData;
            break;
          }
        } catch {
          // Try next TTS model
        }
      }

      if (!audioBase64) {
        res.status(502).json({
          ok: false,
          reason: 'tts_generation_failed',
        });
        return;
      }

      res.json({
        ok: true,
        audioBase64,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sheikh TTS request failed';
      res.status(502).json({
        ok: false,
        reason: 'upstream_error',
        error: message,
      });
    }
  });

  app.post('/api/rafiqi-sheikh-reply', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        userMessage?: unknown;
        matchedWordAr?: unknown;
        matchedSurahNameAr?: unknown;
        matchedAyahNumber?: unknown;
        matchedAyahTextAr?: unknown;
        fallbackReplyAr?: unknown;
      } | null;

      const userMessage =
        typeof body?.userMessage === 'string' ? body.userMessage.trim() : '';
      const fallbackReplyAr =
        typeof body?.fallbackReplyAr === 'string'
          ? body.fallbackReplyAr.trim()
          : '';
      const matchedSurahNameAr =
        typeof body?.matchedSurahNameAr === 'string'
          ? body.matchedSurahNameAr
          : '';
      const matchedAyahTextAr =
        typeof body?.matchedAyahTextAr === 'string'
          ? body.matchedAyahTextAr
          : '';

      if (!userMessage || userMessage.length > 1000) {
        res.status(400).json({ok: false, replyText: fallbackReplyAr});
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.json({ok: false, reason: 'no_api_key', replyText: fallbackReplyAr});
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `المستخدم يقول: "${userMessage}".\nتمت تلاوة هذه الآية الكريمة له الآن وانتهت للتو: (${matchedSurahNameAr}: "${matchedAyahTextAr}").\nاكتب كلام الشيخ البشري الحنون الذي سيقوله بصوته بعد انتهاء الآية مباشرة، بحيث يتكلم **على حسب هذه الآية الكريمة ومعناها** ويربطها بحال السائل ويطمئن قلبه بها في جملتين إلى ثلاث جمل قصيرة دافئة بالعربية الواضحة (بحد أقصى 45 كلمة)، بدون مقدمات طويلة أو رموز أو تشكيل معقد.`,
        config: {
          systemInstruction:
            'أنت شيخ إسلامي مصري وقور رحيم ورفيق إيماني قريب من القلب، تتحدث بصوتك الحنون فور انتهاء تلاوة الآية القرآنية لتشرح وتطمن قلب السائل على حسب الآية نفسها ومعناها ومناسبتها لحاله.',
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
        },
      });

      const replyText = (response.text ?? '').trim();
      res.json({
        ok: true,
        replyText: replyText || fallbackReplyAr,
      });
    } catch {
      res.json({ok: false, replyText: ''});
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
      app.use(
        express.static(distDir, {
          setHeaders(res, filePath) {
            if (
              filePath.endsWith('sw.js') ||
              filePath.endsWith('adhan-sw-ext.js') ||
              filePath.endsWith('manifest.webmanifest') ||
              filePath.endsWith('index.html')
            ) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        }),
      );
      app.get('*', (_req, res) => {
        if (fs.existsSync(indexHtml)) {
          res.setHeader('Cache-Control', 'no-cache');
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

import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { test } from 'node:test';
import { buildGeminiContents, DEFAULT_GEMINI_MODEL, getGeminiModel, handleAlfredRequest } from './alfredProxy';

function sendTestRequest(port: number): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/',
      headers: { 'content-type': 'application/json' },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end(JSON.stringify({ question: 'test request', history: [], context: {} }));
  });
}

test('Alfred proxy maps provider errors without leaking the server key', async () => {
  const testKey = 'test-key-not-valid-and-never-sent';
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  const previousFetch = globalThis.fetch;
  const capturedRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const server = createServer((req, res) => {
    void handleAlfredRequest(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    const cases = [
      { name: 'invalid key', status: 400, message: 'invalid key simulated', expected: 'HTTP 400' },
      { name: 'API disabled or restricted key', status: 403, message: 'forbidden simulated', expected: 'HTTP 403' },
      { name: 'missing model', status: 404, message: 'model not found simulated', expected: 'HTTP 404', model: 'nonexistent' },
      { name: 'quota', status: 429, message: 'quota exceeded simulated', expected: 'HTTP 429' },
      { name: 'offline', status: 0, message: '', expected: 'Network failure (HTTP 502)' },
    ];

    process.env.GEMINI_API_KEY = testKey;
    for (const testCase of cases) {
      process.env.GEMINI_MODEL = testCase.model || '';
      globalThis.fetch = async (input, init) => {
        const requestBody = typeof init?.body === 'string'
          ? JSON.parse(init.body) as Record<string, unknown>
          : {};
        capturedRequests.push({ url: String(input), body: requestBody });
        if (testCase.status === 0) throw new TypeError('simulated offline connection');
        return new Response(
          JSON.stringify({
            error: {
              code: testCase.status,
              status: testCase.status,
              message: testCase.message,
            },
          }),
          { status: testCase.status, headers: { 'content-type': 'application/json' } },
        );
      };

      const result = await sendTestRequest(address.port);
      assert.equal(result.status, testCase.status || 502, testCase.name);
      assert.equal(typeof result.body.message, 'string', testCase.name);
      assert.equal(String(result.body.message).includes(testKey), false, testCase.name);
      assert.ok(String(result.body.message).includes(testCase.expected), testCase.name);
    }

    const capturedRequest = capturedRequests.at(-1);
    assert.ok(capturedRequest);
    assert.ok(capturedRequests[0].url.includes(DEFAULT_GEMINI_MODEL));
    assert.ok(capturedRequests.some((captured) => captured.url.includes('/models/nonexistent:generateContent')));
    const requestContents = capturedRequest.body.contents as Array<{ role: string; parts: Array<{ text: string }> }>;
    assert.equal(requestContents.at(-1)?.role, 'user');
    assert.match(requestContents.at(-1)?.parts[0]?.text || '', /test request/);

    process.env.GEMINI_API_KEY = '';
    globalThis.fetch = async () => {
      throw new Error('Provider must not be called when the key is missing.');
    };
    const missingKey = await sendTestRequest(address.port);
    assert.equal(missingKey.status, 503);
    assert.equal(String(missingKey.body.message).includes(testKey), false);
    assert.match(String(missingKey.body.message), /GEMINI_API_KEY/);
    assert.match(String(missingKey.body.message), /repo-root \.env\.local/);
    assert.match(String(missingKey.body.message), /restart the dev server/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('Gemini requests always finish with the latest user turn', () => {
  const contents = buildGeminiContents([
    { role: 'user', text: 'first question' },
    { role: 'model', text: 'first answer' },
  ], 'latest question');

  assert.equal(contents.at(-1)?.role, 'user');
  assert.equal(contents.at(-1)?.parts[0]?.text, 'latest question');
});

test('Gemini model defaults to the current model and accepts a server-side override', () => {
  const previousModel = process.env.GEMINI_MODEL;
  try {
    process.env.GEMINI_MODEL = '';
    assert.equal(getGeminiModel(), 'gemini-3.5-flash-lite');
    process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite-test-override';
    assert.equal(getGeminiModel(), 'gemini-3.5-flash-lite-test-override');
  } finally {
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
  }
});

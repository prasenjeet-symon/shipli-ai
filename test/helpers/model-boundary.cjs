// Test-only boundary: no request may leave the process, including telemetry.
const { appendFileSync } = require('node:fs');
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (!target.startsWith('https://generativelanguage.googleapis.com/v1beta/models/') && target !== 'https://api.anthropic.com/v1/messages') {
    throw new Error(`Unexpected network request in offline test: ${target}`);
  }
  const body = JSON.parse(options.body);
  appendFileSync(process.env.SHIPLI_TEST_REQUEST_LOG, JSON.stringify({ url: target, body }) + '\n');
  if (process.env.SHIPLI_TEST_API_ERROR) return new Response('controlled provider failure', { status: 503 });
  const report = JSON.stringify({ summary: 'Controlled test response; no live model was called.', score: process.env.SHIPLI_TEST_SCORE || 'PASS', categories: [], recommendations: [] });
  return new Response(JSON.stringify(target.includes('anthropic')
    ? { content: [{ text: report }], usage: { input_tokens: 10, output_tokens: 10 } }
    : { candidates: [{ content: { parts: [{ text: report }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 } }), { status: 200 });
};

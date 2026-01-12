import type { StoredRequest } from './api';

function escapeSingleQuotes(value: string) {
  return value.replace(/'/g, `'"'"'`);
}

export function buildCurl(request: StoredRequest, targetUrl: string) {
  const headers = Object.entries(request.headers)
    .filter(([key]) => !['host', 'content-length'].includes(key.toLowerCase()))
    .map(([key, value]) => `-H '${escapeSingleQuotes(`${key}: ${value}`)}'`);

  const parts = [`curl -X ${request.method}`, ...headers, `'${escapeSingleQuotes(targetUrl)}'`];

  if (request.rawBody) {
    parts.splice(parts.length - 1, 0, `--data-raw '${escapeSingleQuotes(request.rawBody)}'`);
  }

  return parts.join(' \\\n  ');
}

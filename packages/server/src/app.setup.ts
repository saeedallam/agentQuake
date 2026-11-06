import type { NestExpressApplication } from '@nestjs/platform-express';

export const YAML_CONTENT_TYPES = [
  'text/yaml',
  'application/yaml',
  'application/x-yaml',
];

export const MAX_REQUEST_BODY = '10mb';

export function configureApp(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: MAX_REQUEST_BODY });
  app.useBodyParser('urlencoded', { limit: MAX_REQUEST_BODY, extended: true });
  app.useBodyParser('text', { type: YAML_CONTENT_TYPES, limit: '1mb' });
}

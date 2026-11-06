import {
  All,
  Controller,
  Logger,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { requestHeadersToForward } from './http-headers.js';
import { ProxyService } from './proxy.service.js';
import { readRequestBody } from './request-body.js';

@Controller('proxy')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(private readonly proxy: ProxyService) {}

  @All(':runId/:toolSlug/*path')
  async forward(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('toolSlug') toolSlug: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rest = req.url.slice(`/proxy/${runId}/${toolSlug}`.length);
    const queryStart = rest.indexOf('?');
    const path = queryStart === -1 ? rest : rest.slice(0, queryStart);
    const query = queryStart === -1 ? null : rest.slice(queryStart + 1);

    const result = await this.proxy.forward({
      runId,
      toolSlug,
      method: req.method,
      path,
      query,
      headers: requestHeadersToForward(req.headers),
      body: await readRequestBody(req),
    });

    res.status(result.status).set(result.headers).send(result.body);
    this.logger.log(
      `${req.method} [${toolSlug}] ${path} -> ${result.status} in ${result.durationMs}ms`,
    );
  }
}

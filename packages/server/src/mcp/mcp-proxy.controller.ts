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
import { requestHeadersToForward } from '../proxy/http-headers.js';
import { readRequestBody } from '../proxy/request-body.js';
import { McpProxyService } from './mcp-proxy.service.js';

@Controller('mcp-proxy')
export class McpProxyController {
  private readonly logger = new Logger(McpProxyController.name);

  constructor(private readonly proxy: McpProxyService) {}

  @All(':runId/:toolSlug')
  async forward(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('toolSlug') toolSlug: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.proxy.forward({
      runId,
      toolSlug,
      method: req.method,
      headers: requestHeadersToForward(req.headers),
      body: await readRequestBody(req),
    });

    res.status(result.status).set(result.headers).send(result.body);
    this.logger.log(
      `${req.method} [${toolSlug}] -> ${result.status} in ${result.durationMs}ms`,
    );
  }
}

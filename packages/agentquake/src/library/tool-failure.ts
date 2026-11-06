export class ToolFailure extends Error {
  constructor(
    readonly tool: string,
    readonly status: number,
  ) {
    super(`Tool ${tool} failed with HTTP ${status}`);
    this.name = 'ToolFailure';
  }
}

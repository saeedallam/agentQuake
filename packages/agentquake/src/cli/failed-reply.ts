export class FailedReply<Reply> extends Error {
  constructor(
    readonly reply: Reply,
    message: string,
  ) {
    super(message);
    this.name = 'FailedReply';
  }
}

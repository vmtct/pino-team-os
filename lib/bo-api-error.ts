export class BoApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly requestId: string | null,
    readonly structuredResponse = true,
  ) {
    super(message);
    this.name = "BoApiError";
  }
}

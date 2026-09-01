export class BoApiError extends Error {
  constructor(readonly status: number, message: string, readonly requestId: string | null) {
    super(message);
    this.name = "BoApiError";
  }
}

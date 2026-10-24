export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    options?: { cause?: unknown },
  ) {
    super(publicMessage, options);
    this.name = 'AppError';
  }
}

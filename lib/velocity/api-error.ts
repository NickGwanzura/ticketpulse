export class VelocityApiError extends Error {
  constructor(message: string, public readonly httpStatus: number, public readonly path: string) {
    super(message)
    this.name = "VelocityApiError"
  }
}

export function isDefinitiveRejection(error: unknown): boolean {
  return error instanceof VelocityApiError && error.httpStatus >= 400 && error.httpStatus < 500 &&
    ![408, 409, 425, 429].includes(error.httpStatus)
}

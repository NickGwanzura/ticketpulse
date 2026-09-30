import { randomUUID } from "crypto"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Reuse only canonical UUIDs so arbitrary header content cannot pollute logs. */
export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")
  return supplied && UUID_PATTERN.test(supplied) ? supplied.toLowerCase() : randomUUID()
}

export function withRequestId<T extends Response>(response: T, requestId: string): T {
  response.headers.set("x-request-id", requestId)
  return response
}

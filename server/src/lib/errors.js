export class HttpError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export const badRequest = (message = 'Invalid request') => new HttpError(400, message, 'bad_request');
export const notFound = (message = 'Not found') => new HttpError(404, message, 'not_found');
export const unauthorized = (message = 'Unauthorized') => new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'Forbidden') => new HttpError(403, message, 'forbidden');
export const unavailable = (message = 'Service unavailable') => new HttpError(503, message, 'unavailable');

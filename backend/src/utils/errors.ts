export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: ErrorDetails) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = "Authentication required") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You do not have access to this resource") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (message = "Resource not found") =>
  new AppError(404, "NOT_FOUND", message);

export const conflict = (code: string, message: string, details?: ErrorDetails) =>
  new AppError(409, code, message, details);

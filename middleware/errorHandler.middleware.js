export const HttpStatusCodes = {
  OK: 200,
  Created: 201,
  NoContent: 204,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalServerError: 500,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
};

export class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = options.details;
    this.data = options.data; // Add data property
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  const isDev = process.env.ENVIRONMENT !== "production";

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : HttpStatusCodes.InternalServerError;
  const message = err.message || "Something went wrong. Please try again later.";

  if (isDev || !isAppError) {
    console.error(" Error:", {
      message: err.message,
      stack: err.stack,
      ...(isAppError && err.details && { details: err.details }),
    });
  }

  const response = {
    success: false,
    error: {
      message,
      ...(isDev && { stack: err.stack }),
      ...(isDev && isAppError && err.details && { details: err.details }),
    },
  };

  if (err.data) {
    response.data = err.data;
  }

  res.status(statusCode).json(response);
};

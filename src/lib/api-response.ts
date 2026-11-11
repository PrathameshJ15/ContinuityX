import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiErrorPayload;
}

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode: number = 400,
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required to access this resource.") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ProjectNotFoundError extends AppError {
  constructor(message: string = "Project not found or you do not have permission to access it.") {
    super("NOT_FOUND", message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "You do not have permission to perform this action.") {
    super("FORBIDDEN", message, 403);
  }
}

export function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json({ data }, { status });
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  statusCode: number = 400,
  details?: unknown
) {
  const requestId = `req_${randomUUID().slice(0, 12)}`;
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    },
    { status: statusCode }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return jsonError(error.code, error.message, error.statusCode, error.details);
  }

  // Never leak internal stack traces or database connection messages to clients
  const requestId = `req_${randomUUID().slice(0, 12)}`;
  console.error(`[API Error ${requestId}]`, error instanceof Error ? error.stack : error);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected internal error occurred. Please try again later.",
        requestId,
      },
    },
    { status: 500 }
  );
}

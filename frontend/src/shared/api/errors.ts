import axios from "axios";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error.message ?? "Request failed";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

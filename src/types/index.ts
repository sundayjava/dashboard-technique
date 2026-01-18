/**
 * Common TypeScript types and interfaces
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export type Status = "idle" | "loading" | "success" | "error";

export interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
  statusCode?: number;
}

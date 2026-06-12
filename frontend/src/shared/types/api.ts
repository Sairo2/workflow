export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNextPage: boolean;
  };
};

export type ApiResponse<T> = {
  data: T;
};

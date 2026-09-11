const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export interface ParsedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePagination(query: Record<string, any>): ParsedPagination {
  let page = parseInt(String(query.page || DEFAULT_PAGE), 10);
  let pageSize = parseInt(String(query.pageSize || DEFAULT_PAGE_SIZE), 10);
  if (isNaN(page) || page < 1) page = DEFAULT_PAGE;
  if (isNaN(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

const ALLOWED_SORT = {
  patient: ['createdAt', 'documentNumber', 'firstName', 'lastName'],
  study: ['studyDate', 'studyTime', 'patientName', 'accessionNumber', 'studyDescription'],
  audit: ['timestamp', 'userName', 'action'],
};

export function buildOrderBy(
  entity: keyof typeof ALLOWED_SORT,
  sortBy?: string,
  sortOrder?: string,
): Record<string, 'asc' | 'desc'>[] {
  const allowed = ALLOWED_SORT[entity];
  const field = sortBy && allowed.includes(sortBy) ? sortBy : allowed[0];
  const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
  return [{ [field]: order }];
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

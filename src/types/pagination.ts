import { DicomStudy, Patient, AuditLog } from './pacs';

export type SortOrder = 'asc' | 'desc';

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface SortedQuery extends PaginationQuery {
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface PatientQuery extends SortedQuery {
  search?: string;
}

export interface StudyListQuery extends SortedQuery {
  searchTerm?: string;
  modality?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

export interface AuditLogQuery extends SortedQuery {
  action?: string;
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

import { useState, useEffect, useCallback } from 'react';
import { PaginatedResult, SortedQuery, SortOrder } from '../types/pagination';

interface UsePaginatedResourceOptions<T, Q extends SortedQuery> {
  fetcher: (query: Q) => Promise<PaginatedResult<T>>;
  defaultQuery: Q;
}

interface UsePaginatedResourceReturn<T, Q extends SortedQuery> {
  data: PaginatedResult<T> | null;
  loading: boolean;
  error: string | null;
  query: Q;
  setQuery: (patch: Partial<Q>) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sortBy: string, sortOrder: SortOrder) => void;
  reload: () => void;
}

export function usePaginatedResource<T, Q extends SortedQuery>(
  options: UsePaginatedResourceOptions<T, Q>,
): UsePaginatedResourceReturn<T, Q> {
  const { fetcher, defaultQuery } = options;
  const [query, setQueryState] = useState<Q>(defaultQuery);
  const [data, setData] = useState<PaginatedResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher(JSON.parse(queryKey) as Q)
      .then(result => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e.message || 'Error desconocido');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [queryKey, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey(k => k + 1);
  }, []);

  const setQuery = useCallback((patch: Partial<Q>) => {
    setQueryState(prev => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setQueryState(prev => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setQueryState(prev => ({ ...prev, page: 1, pageSize }));
  }, []);

  const setSort = useCallback((sortBy: string, sortOrder: SortOrder) => {
    setQueryState(prev => ({ ...prev, page: 1, sortBy, sortOrder }));
  }, []);

  return { data, loading, error, query, setQuery, setPage, setPageSize, setSort, reload };
}

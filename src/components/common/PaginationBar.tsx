import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

function getVisiblePages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  if (current <= 3) {
    pages.push(1, 2, 3, 4, 'ellipsis', total);
  } else if (current >= total - 2) {
    pages.push(1, 'ellipsis', total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total);
  }

  return pages;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}) => {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          Mostrando <span className="font-semibold text-slate-700">{from}–{to}</span> de <span className="font-semibold text-slate-700">{total}</span>
        </span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-blue-400"
        >
          {pageSizeOptions.map(opt => (
            <option key={opt} value={opt}>{opt} / pág</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {visiblePages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-2 py-1 text-xs text-slate-400 select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] h-8 rounded-md text-xs font-medium transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

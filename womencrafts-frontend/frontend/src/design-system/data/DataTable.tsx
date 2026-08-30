"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from "lucide-react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { RowSelectionState } from "@tanstack/table-core";

import { Checkbox, Pagination } from "../primitives/Navigation";
import { EmptyState, ErrorState, SkeletonTable } from "../primitives/Feedback";

/**
 * The one table in the system, built on TanStack Table v9.
 *
 * Every list screen renders through this, so sorting, filtering, paging,
 * selection and empty/loading/error states behave identically everywhere.
 * Callers supply data + column definitions and nothing else.
 *
 * Note on features: TanStack v9 makes features opt-in per table for bundle
 * size. This is a shared component used by every list in the app, so it
 * registers the full set once here rather than making each caller assemble it.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },

  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },

  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),

  rowSelectionFeature,
  columnVisibilityFeature,
});

export type DataTableFeatures = typeof dataTableFeatures;

/**
 * Typed column builder. Use this instead of importing createColumnHelper
 * directly — it pins the feature set so column types line up with the table.
 *
 *   const col = createColumns<Member>();
 *   const columns = col.columns([ col.accessor("full_name", { header: "Name" }) ]);
 */
// table-core's own RowData constraint is `Record<string, any> | Array<any>`, so
// mirroring it here is what lets a plain interface (ApiMember, ApiContent, …) be
// used as a row type. Narrowing to `unknown` would reject every interface, since
// interfaces have no implicit index signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createColumns<T extends Record<string, any>>() {
  return createColumnHelper<DataTableFeatures, T>();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error = null,
  onRetry,
  globalFilter,
  pageSize = 10,
  selectable = false,
  getRowId,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  emptyIcon = Inbox,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  toolbar,
  itemLabel = "items",
  className = "",
}: {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Search text applied across every filterable column. */
  globalFilter?: string;
  pageSize?: number;
  selectable?: boolean;
  getRowId?: (row: T) => string;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  onRowClick?: (row: T) => void;
  emptyIcon?: React.ElementType;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Slot above the table for filters and bulk actions. */
  toolbar?: ReactNode;
  /** Noun used in "Showing 1 to 8 of 34 members". */
  itemLabel?: string;
  className?: string;
}) {
  const selectionColumn = useMemo(() => {
    if (!selectable) return null;
    const col = createColumns<T>();
    return col.display({
      id: "__select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onChange={(v) => table.toggleAllPageRowsSelected(v)}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onChange={(v) => row.toggleSelected(v)}
            aria-label="Select row"
          />
        </span>
      ),
    });
  }, [selectable]);

  const allColumns = useMemo(
    () => (selectionColumn ? [selectionColumn, ...columns] : columns),
    [selectionColumn, columns]
  );

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: allColumns,
    getRowId: getRowId as never,
    initialState: { pagination: { pageIndex: 0, pageSize } },
    state: {
      ...(globalFilter !== undefined ? { globalFilter } : {}),
      ...(rowSelection !== undefined ? { rowSelection } : {}),
    },
    onRowSelectionChange: onRowSelectionChange as never,
    globalFilterFn: "includesString" as const,
    getColumnCanGlobalFilter: (column: { id: string }) =>
      column.id !== "__select" && column.id !== "actions",
  });

  if (loading) {
    return (
      <div className={className}>
        {toolbar}
        <SkeletonTable rows={pageSize > 8 ? 8 : pageSize} cols={Math.min(allColumns.length, 6)} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <ErrorState onRetry={onRetry} description="We couldn't load this list right now." />
      </div>
    );
  }

  const rows = table.getRowModel().rows;
  const totalRows = table.getFilteredRowModel?.()?.rows.length ?? data.length;
  const { pageIndex, pageSize: currentSize } = table.state.pagination ?? {
    pageIndex: 0,
    pageSize,
  };
  const from = totalRows === 0 ? 0 : pageIndex * currentSize + 1;
  const to = Math.min((pageIndex + 1) * currentSize, totalRows);

  return (
    <div className={className}>
      {toolbar}

      {rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="border-b border-line">
                    {group.headers.map((header) => {
                      const sortable = header.column.getCanSort?.();
                      const sorted = header.column.getIsSorted?.();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          className={`px-2 py-3 text-left text-2xs font-bold uppercase tracking-wide text-ink-subtle ${
                            header.id === "__select" ? "w-10" : ""
                          }`}
                        >
                          {header.isPlaceholder ? null : sortable ? (
                            <button
                              onClick={header.column.getToggleSortingHandler?.()}
                              className="inline-flex items-center gap-1.5 transition hover:text-brand-ink"
                            >
                              <table.FlexRender header={header} />
                              {sorted === "asc" ? (
                                <ArrowUp className="h-3 w-3 text-brand-ink" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="h-3 w-3 text-brand-ink" />
                              ) : (
                                <ChevronsUpDown className="h-3 w-3 opacity-40" />
                              )}
                            </button>
                          ) : (
                            <table.FlexRender header={header} />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original as T) : undefined}
                    className={`border-b border-line transition ${
                      onRowClick ? "cursor-pointer hover:bg-surface-hover" : ""
                    } ${row.getIsSelected?.() ? "bg-brand-tint/40" : ""}`}
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className="px-2 py-3 text-ink-muted">
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {table.getPageCount() > 1 && (
            <Pagination
              page={pageIndex + 1}
              pageCount={table.getPageCount()}
              onPageChange={(p) => table.setPageIndex(p - 1)}
              showing={`Showing ${from} to ${to} of ${totalRows} ${itemLabel}`}
            />
          )}
        </>
      )}
    </div>
  );
}

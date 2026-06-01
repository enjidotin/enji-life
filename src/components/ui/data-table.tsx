"use client";

import * as React from "react";
import {
  ColumnDef,
  RowData,
  Row,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Per-column styling hooks (set via `meta` on a ColumnDef).
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    headClassName?: string;
    cellClassName?: string;
  }
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  // When provided, rows become tap-to-expand and this renders the detail panel.
  renderSubRow?: (row: Row<TData>) => React.ReactNode;
  emptyText?: string;
}

export function DataTable<TData>({
  columns,
  data,
  renderSubRow,
  emptyText = "Nothing yet.",
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => !!renderSubRow,
  });

  const rows = table.getRowModel().rows;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="hover:bg-transparent">
            {hg.headers.map((header) => (
              <TableHead
                key={header.id}
                className={header.column.columnDef.meta?.headClassName}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={columns.length}
              className="py-6 text-center text-sm text-neutral-400"
            >
              {emptyText}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <React.Fragment key={row.id}>
              <TableRow
                aria-expanded={renderSubRow ? row.getIsExpanded() : undefined}
                onClick={renderSubRow ? () => row.toggleExpanded() : undefined}
                className={renderSubRow ? "cursor-pointer" : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cell.column.columnDef.meta?.cellClassName}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {renderSubRow && row.getIsExpanded() && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={row.getVisibleCells().length}
                    className="bg-neutral-50 p-0 whitespace-normal dark:bg-neutral-900/40"
                  >
                    {renderSubRow(row)}
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))
        )}
      </TableBody>
    </Table>
  );
}

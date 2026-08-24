import { useCallback, useMemo, useState } from 'react';
import { getCoreRowModel, getFilteredRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { generateOrders, type Order } from './data/generateOrders';
import { useFilterState } from './lib/urlState';
import { OrderRow } from './components/OrderRow';
import { StatusFilter } from './components/StatusFilter';
import { DetailPanel } from './components/DetailPanel';
import './index.css';

const ALL_ORDERS = generateOrders(5000);

const columns: ColumnDef<Order>[] = [
  { accessorKey: 'orderNumber' },
  { accessorKey: 'customer' },
  { accessorKey: 'status' },
  { accessorKey: 'total' },
  { accessorKey: 'date' },
];

export default function App() {
  const [filters, setFilters] = useFilterState();
  const [draft, setDraft] = useState(filters.search);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const table = useReactTable({
    data: ALL_ORDERS,
    columns,
    state: {
      globalFilter: filters.search,
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).toLowerCase();
      if (!query) return true;
      return row.original.orderNumber.toLowerCase().includes(query);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getFilteredRowModel().rows;
  const visibleOrders = useMemo(
    () => rows.filter((r) => filters.statuses.length === 0 || filters.statuses.includes(r.original.status)),
    [rows, filters.statuses],
  );

  const commitSearch = (value: string) => {
    setFilters({ ...filters, search: value });
  };

  const selectedOrder = visibleOrders.find((r) => r.original.id === openId)?.original ?? null;

  const focusRow = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    const currentIndex = visibleOrders.findIndex((r) => r.original.id === selectedId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = visibleOrders[Math.min(currentIndex + 1, visibleOrders.length - 1)] ?? visibleOrders[0];
      if (next) focusRow(next.original.id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = visibleOrders[Math.max(currentIndex - 1, 0)] ?? visibleOrders[0];
      if (prev) focusRow(prev.original.id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedId) setOpenId(selectedId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (openId) {
        const returnTo = openId;
        setOpenId(null);
        focusRow(returnTo);
      }
    }
  };

  return (
    <div className="app">
      <header className="toolbar">
        <input
          type="text"
          placeholder="Search order number…"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            commitSearch(e.target.value);
          }}
          aria-label="Search by order number"
        />
        <StatusFilter selected={filters.statuses} onChange={(statuses) => setFilters({ ...filters, statuses })} />
        <span className="count">{visibleOrders.length} orders</span>
      </header>

      <table className="order-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
            <th>Date</th>
            <th className="print-hide">Panel</th>
          </tr>
        </thead>
        <tbody onKeyDown={handleKeyDown}>
          {visibleOrders.map((r) => (
            <OrderRow
              key={r.original.id}
              order={r.original}
              isSelected={r.original.id === selectedId}
              isOpen={r.original.id === openId}
              onSelect={focusRow}
              onOpen={setOpenId}
            />
          ))}
        </tbody>
      </table>

      {selectedOrder && (
        <DetailPanel
          order={selectedOrder}
          onClose={() => {
            const returnTo = openId;
            setOpenId(null);
            if (returnTo) focusRow(returnTo);
          }}
        />
      )}
    </div>
  );
}

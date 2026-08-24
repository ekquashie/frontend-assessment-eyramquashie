import type { OrderStatus } from '../data/generateOrders';

const ALL_STATUSES: OrderStatus[] = ['NEW', 'PICKING', 'SHIPPED', 'CANCELLED'];

type Props = {
  selected: OrderStatus[];
  onChange: (statuses: OrderStatus[]) => void;
};

export function StatusFilter({ selected, onChange }: Props) {
  const toggle = (status: OrderStatus) => {
    onChange(
      selected.includes(status)
        ? selected.filter((s) => s !== status)
        : [...selected, status],
    );
  };

  return (
    <div className="status-filter" role="group" aria-label="Filter by status">
      {ALL_STATUSES.map((status) => (
        <label key={status}>
          <input
            type="checkbox"
            checked={selected.includes(status)}
            onChange={() => toggle(status)}
          />
          {status}
        </label>
      ))}
    </div>
  );
}

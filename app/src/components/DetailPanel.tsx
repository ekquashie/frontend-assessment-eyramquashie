import type { Order } from '../data/generateOrders';

type Props = {
  order: Order;
  onClose: () => void;
};

export function DetailPanel({ order, onClose }: Props) {
  return (
    <aside className="detail-panel" role="dialog" aria-label={`Order ${order.orderNumber}`}>
      <button className="detail-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>{order.orderNumber}</h2>
      <dl>
        <dt>Customer</dt>
        <dd>{order.customer}</dd>
        <dt>Status</dt>
        <dd>{order.status}</dd>
        <dt>Total</dt>
        <dd>GHS {order.total.toFixed(2)}</dd>
        <dt>Date</dt>
        <dd>{order.date}</dd>
      </dl>
    </aside>
  );
}

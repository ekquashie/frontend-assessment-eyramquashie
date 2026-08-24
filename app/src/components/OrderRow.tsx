import { memo } from 'react';
import type { Order } from '../data/generateOrders';
import { countRender } from '../lib/renderCounter';

type Props = {
  order: Order;
  isSelected: boolean;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

function OrderRowImpl({ order, isSelected, isOpen, onSelect, onOpen }: Props) {
  countRender(order.id);

  const focusIfSelected = (el: HTMLTableRowElement | null) => {
    if (el && isSelected && document.activeElement !== el) el.focus();
  };

  return (
    <tr
      ref={focusIfSelected}
      data-row-id={order.id}
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      className={isSelected ? 'row row-selected' : 'row'}
      onClick={() => onSelect(order.id)}
      onDoubleClick={() => onOpen(order.id)}
    >
      <td>{order.orderNumber}</td>
      <td>{order.customer}</td>
      <td>{order.status}</td>
      <td>GHS {order.total.toFixed(2)}</td>
      <td>{order.date}</td>
      <td className="print-hide">{isOpen ? 'Open' : ''}</td>
    </tr>
  );
}

export const OrderRow = memo(OrderRowImpl);

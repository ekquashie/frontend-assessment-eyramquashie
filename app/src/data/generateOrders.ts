export type OrderStatus = 'NEW' | 'PICKING' | 'SHIPPED' | 'CANCELLED';

export type Order = {
  id: string;
  orderNumber: string;
  customer: string;
  status: OrderStatus;
  total: number;
  date: string;
};

const STATUSES: OrderStatus[] = ['NEW', 'PICKING', 'SHIPPED', 'CANCELLED'];

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen',
  'Eyram', 'Edem', 'Sena', 'Kofi', 'Ama', 'Kwame', 'Akosua', 'Yaw',
  'Efua', 'Kwabena', 'Adjoa', 'Kojo', 'Abena', 'Selorm', 'Elikem', 'Dzifa',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin',
  'Quashie', 'Mensah', 'Owusu', 'Asante', 'Boateng', 'Amoah', 'Osei', 'Agyeman',
  'Darko', 'Appiah',
];

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateOrders(count = 5000): Order[] {
  const random = mulberry32(42);
  const orders: Order[] = [];
  const start = new Date('2025-01-01').getTime();
  const end = new Date('2026-08-24').getTime();

  for (let i = 0; i < count; i++) {
    const orderNumber = `ORD-${String(100000 + i)}`;
    const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    const status = STATUSES[Math.floor(random() * STATUSES.length)];
    const total = Math.round((random() * 490 + 10) * 100) / 100;
    const date = new Date(start + random() * (end - start)).toISOString().slice(0, 10);

    orders.push({
      id: orderNumber,
      orderNumber,
      customer: `${first} ${last}`,
      status,
      total,
      date,
    });
  }

  return orders;
}

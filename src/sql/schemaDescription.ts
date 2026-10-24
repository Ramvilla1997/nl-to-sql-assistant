export const SCHEMA_DESCRIPTION = `
customers(id integer, name text, country text)
products(id integer, name text, category text, unit_price numeric)
orders(id integer, customer_id integer -> customers.id, ordered_at timestamptz)
order_items(id integer, order_id integer -> orders.id, product_id integer -> products.id, quantity integer, unit_price numeric)
`.trim();

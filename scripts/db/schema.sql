DROP TABLE IF EXISTS order_items, orders, products, customers;

CREATE TABLE customers (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  country     text NOT NULL
);

CREATE TABLE products (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL,
  unit_price  numeric(10, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE orders (
  id           serial PRIMARY KEY,
  customer_id  integer NOT NULL REFERENCES customers (id),
  ordered_at   timestamptz NOT NULL
);

CREATE TABLE order_items (
  id          serial PRIMARY KEY,
  order_id    integer NOT NULL REFERENCES orders (id),
  product_id  integer NOT NULL REFERENCES products (id),
  quantity    integer NOT NULL CHECK (quantity > 0),
  unit_price  numeric(10, 2) NOT NULL CHECK (unit_price >= 0)
);

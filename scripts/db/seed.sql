INSERT INTO customers (name, country) VALUES
  ('Ada Labs', 'UK'),
  ('Brightline Ltd', 'US'),
  ('Cobalt Works', 'DE'),
  ('Delta Foods', 'IN'),
  ('Evergreen Clinic', 'CA'),
  ('Fjord Analytics', 'NO');

INSERT INTO products (name, category, unit_price) VALUES
  ('Starter License', 'software', 49.00),
  ('Pro License', 'software', 199.00),
  ('Onboarding Session', 'services', 350.00),
  ('Support Plan', 'services', 120.00),
  ('Sensor Kit', 'hardware', 75.50),
  ('Gateway Device', 'hardware', 640.00);

INSERT INTO orders (customer_id, ordered_at) VALUES
  (1, '2026-01-05'), (2, '2026-01-18'), (3, '2026-01-27'),
  (1, '2026-02-03'), (4, '2026-02-14'), (5, '2026-02-22'),
  (2, '2026-03-02'), (6, '2026-03-09'), (3, '2026-03-17'),
  (1, '2026-03-25'), (4, '2026-03-28'), (5, '2026-03-30');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1, 2, 2, 199.00), (1, 3, 1, 350.00),
  (2, 1, 5, 49.00),
  (3, 6, 1, 640.00), (3, 5, 4, 75.50),
  (4, 4, 1, 120.00),
  (5, 1, 3, 49.00), (5, 2, 1, 199.00),
  (6, 5, 2, 75.50),
  (7, 2, 4, 199.00), (7, 4, 2, 120.00),
  (8, 3, 1, 350.00),
  (9, 6, 2, 640.00), (9, 1, 10, 49.00),
  (10, 4, 3, 120.00),
  (11, 2, 1, 199.00), (11, 5, 6, 75.50),
  (12, 1, 2, 49.00), (12, 3, 1, 350.00);

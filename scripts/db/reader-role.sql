-- Creates the only role the API connects with. It can read four tables and
-- nothing else. Read-only transactions are the default for this role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nl_sql_reader') THEN
    CREATE ROLE nl_sql_reader LOGIN;
  END IF;
END
$$;

ALTER ROLE nl_sql_reader WITH LOGIN PASSWORD :'reader_password';
ALTER ROLE nl_sql_reader SET default_transaction_read_only = on;
ALTER ROLE nl_sql_reader SET statement_timeout = '3s';

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM nl_sql_reader;
GRANT USAGE ON SCHEMA public TO nl_sql_reader;
GRANT SELECT ON customers, products, orders, order_items TO nl_sql_reader;

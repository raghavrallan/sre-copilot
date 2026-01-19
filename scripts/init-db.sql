-- Database initialization script
-- This runs when PostgreSQL container first starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Database is already created by POSTGRES_DB environment variable
-- Just a placeholder for any initial SQL commands

SELECT 'Database initialized successfully' AS status;

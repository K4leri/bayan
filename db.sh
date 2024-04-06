#!/bin/bash

# Environment variables
export PGPASSWORD=$POSTGRES_PASSWORD

# Initial setup
max_attempts=10
attempt_no=1

# Function to check PostgreSQL readiness
check_postgres_ready() {
    echo "Attempting direct psql connection to check readiness..."
    psql -h localhost -U "postgres" -d tgclient -c "SELECT 'Direct connection test successful.';"
}

# Wait for PostgreSQL to become available
echo "Waiting for PostgreSQL to become available..."
until check_postgres_ready || [ $attempt_no -eq $max_attempts ]; do
    echo "PostgreSQL not ready, attempt $attempt_no of $max_attempts..."
    attempt_no=$((attempt_no+1))
    sleep 2
done

if [ $attempt_no -eq $max_attempts ]; then
    echo "PostgreSQL did not become ready in time."
    exit 1
else
    echo "PostgreSQL is available. Executing the SQL scripts..."
    psql -h localhost -U "postgres" -d tgclient -a -f /docker-entrypoint-initdb.d/db.sql
    echo "SQL script execution completed."
fi

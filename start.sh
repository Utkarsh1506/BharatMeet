#!/bin/sh
# Wait for the database to be ready
echo "Waiting for database to be ready..."

# Run Prisma schema migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

# Start the Next.js server
echo "Starting Next.js..."
node server.js

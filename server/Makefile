# Celestask Server - Makefile
# Commands for managing the backend server

.PHONY: start seed clean help

# Default target
.DEFAULT_GOAL := help

# Variables
NODE := node
NPM := npm
DB_FILE := db/celestask.db

# Start the server
start:
	@echo "⚙️  Starting backend server..."
	$(NPM) start

# Reseed the database (creates tables and inserts sample data)
seed:
	@echo "🌱 Seeding database..."
	$(NODE) db/seed.js
	@echo "✅ Database seeded successfully!"

# Remove node_modules
clean:
	@echo "🧹 Cleaning node_modules..."
	@if [ -d "node_modules" ]; then rm -rf node_modules; fi
	@echo "✅ Clean complete!"

# Display available commands
help:
	@echo ""
	@echo "Celestask Server - Available Commands"
	@echo "===================================="
	@echo ""
	@echo "  make start    - Start the backend server"
	@echo "  make seed     - Reseed the database with sample data"
	@echo "  make clean    - Remove node_modules"
	@echo "  make help     - Display this help message"
	@echo ""
	@echo "Database file: $(DB_FILE)"
	@echo ""
	@echo "Note: Run 'make seed' from the root directory to reset the database"
	@echo ""

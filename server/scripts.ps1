# TaskFlow Server - PowerShell Scripts
# Usage: . .\scripts.ps1   (dot-source to load functions)
# Then call any function: Start-Server, Seed-Database, etc.

# Variables
$Script:DB_FILE = "db\taskflow.db"

# Start the backend server
function Start-Server {
    Write-Host "Starting backend server..." -ForegroundColor Cyan
    npm start
}

# Reseed the database with sample data
function Seed-Database {
    Write-Host "Seeding database..." -ForegroundColor Cyan
    node db/seed.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Done!" -ForegroundColor Green
    } else {
        Write-Host "Seeding failed!" -ForegroundColor Red
    }
}

# Remove server node_modules
function Clean-Server {
    Write-Host "Cleaning node_modules..." -ForegroundColor Cyan
    if (Test-Path "node_modules") {
        Remove-Item -Path "node_modules" -Recurse -Force
        Write-Host "Done!" -ForegroundColor Green
    } else {
        Write-Host "  No node_modules directory found" -ForegroundColor Gray
    }
}

# Display available commands
function Show-Help {
    Write-Host ""
    Write-Host "TaskFlow Server - Available Commands" -ForegroundColor White
    Write-Host "====================================" -ForegroundColor White
    Write-Host ""
    Write-Host "  Start-Server     - Start the backend server" -ForegroundColor Yellow
    Write-Host "  Seed-Database    - Reseed the database with sample data" -ForegroundColor Yellow
    Write-Host "  Clean-Server     - Remove node_modules" -ForegroundColor Yellow
    Write-Host "  Show-Help        - Display this help message" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Database file: $Script:DB_FILE" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Note: Run 'Reset-Database' from the root directory to reset the database" -ForegroundColor Cyan
    Write-Host ""
}

# Display help by default when script is run directly
Show-Help

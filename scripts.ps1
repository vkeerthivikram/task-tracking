# TaskFlow Project Management Scripts
# Usage: . .\scripts.ps1   (dot-source to load functions)
# Then call any function: Install-All, Start-Dev, etc.

# Variables
$Script:DB_FILE = "server\db\taskmanager.db"

# Install all dependencies (root + server + client)
function Install-All {
    Write-Host "Installing all dependencies..." -ForegroundColor Cyan
    
    Write-Host "  Installing root dependencies..." -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Failed to install root dependencies" -ForegroundColor Red
        return
    }
    
    Write-Host "  Installing server dependencies..." -ForegroundColor Gray
    Push-Location server
    npm install
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Failed to install server dependencies" -ForegroundColor Red
        return
    }
    
    Write-Host "  Installing client dependencies..." -ForegroundColor Gray
    Push-Location client
    npm install
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Failed to install client dependencies" -ForegroundColor Red
        return
    }
    
    Write-Host "Done!" -ForegroundColor Green
}

# Start development servers (both frontend and backend)
function Start-Dev {
    Write-Host "Starting development servers..." -ForegroundColor Cyan
    npm run dev
}

# Start backend server only
function Start-Server {
    Write-Host "Starting backend server..." -ForegroundColor Cyan
    Push-Location server
    npm start
    Pop-Location
}

# Start frontend dev server only
function Start-Client {
    Write-Host "Starting frontend dev server..." -ForegroundColor Cyan
    Push-Location client
    npm run dev
    Pop-Location
}

# Build frontend for production
function Build-Production {
    Write-Host "Building frontend for production..." -ForegroundColor Cyan
    Push-Location client
    npm run build
    Pop-Location
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Done!" -ForegroundColor Green
    } else {
        Write-Host "Build failed!" -ForegroundColor Red
    }
}

# Remove node_modules from all directories
function Clean-All {
    Write-Host "Cleaning node_modules..." -ForegroundColor Cyan
    
    $directories = @(".", "server", "client")
    foreach ($dir in $directories) {
        $nodeModulesPath = Join-Path $dir "node_modules"
        if (Test-Path $nodeModulesPath) {
            Write-Host "  Removing $nodeModulesPath..." -ForegroundColor Gray
            Remove-Item -Path $nodeModulesPath -Recurse -Force
        }
    }
    
    Write-Host "Done!" -ForegroundColor Green
}

# Clean and reinstall everything
function Reinstall-All {
    Write-Host "Reinstalling all dependencies..." -ForegroundColor Cyan
    Clean-All
    Install-All
    Write-Host "Done!" -ForegroundColor Green
}

# Delete the SQLite database and reseed
function Reset-Database {
    Write-Host "Resetting database..." -ForegroundColor Cyan
    
    if (Test-Path $Script:DB_FILE) {
        Remove-Item -Path $Script:DB_FILE -Force
        Write-Host "  Database deleted" -ForegroundColor Gray
    } else {
        Write-Host "  No database file found to delete" -ForegroundColor Gray
    }
    
    Write-Host "  Seeding database..." -ForegroundColor Gray
    Push-Location server
    node db/seed.js
    Pop-Location
    
    Write-Host "Done!" -ForegroundColor Green
}

# Display available commands
function Show-Help {
    Write-Host ""
    Write-Host "TaskFlow - Available Commands" -ForegroundColor White
    Write-Host "=============================" -ForegroundColor White
    Write-Host ""
    Write-Host "  Install-All        - Install all dependencies (root + server + client)" -ForegroundColor Yellow
    Write-Host "  Start-Dev          - Start development servers (both frontend and backend)" -ForegroundColor Yellow
    Write-Host "  Start-Server       - Start backend server only" -ForegroundColor Yellow
    Write-Host "  Start-Client       - Start frontend dev server only" -ForegroundColor Yellow
    Write-Host "  Build-Production   - Build frontend for production" -ForegroundColor Yellow
    Write-Host "  Clean-All          - Remove node_modules from all directories" -ForegroundColor Yellow
    Write-Host "  Reinstall-All      - Clean and reinstall everything" -ForegroundColor Yellow
    Write-Host "  Reset-Database     - Delete the SQLite database and reseed" -ForegroundColor Yellow
    Write-Host "  Show-Help          - Display this help message" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  . .\scripts.ps1       # Load the scripts (dot-source)" -ForegroundColor White
    Write-Host "  Install-All           # First time setup" -ForegroundColor White
    Write-Host "  Start-Dev             # Start developing" -ForegroundColor White
    Write-Host "  Reset-Database        # Reset database to fresh state" -ForegroundColor White
    Write-Host ""
}

# Display help by default when script is run directly
Show-Help

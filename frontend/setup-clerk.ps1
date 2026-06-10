# Run from frontend/ folder:  .\setup-clerk.ps1
# Creates .env.local with your Clerk publishable key

$apiUrl = Read-Host "Backend API URL [https://civic-issue-api-612t.onrender.com]"
if ([string]::IsNullOrWhiteSpace($apiUrl)) {
    $apiUrl = "https://civic-issue-api-612t.onrender.com"
}

$clerkKey = Read-Host "Paste Clerk Publishable Key (pk_test_... or pk_live_...)"
if ([string]::IsNullOrWhiteSpace($clerkKey)) {
    Write-Host "No key entered. Get one from https://dashboard.clerk.com" -ForegroundColor Red
    exit 1
}

# Strip accidental $ suffix or quotes from pasted key
$clerkKey = $clerkKey.Trim().Trim('"').Trim("'").TrimEnd('$')

$content = @"
REACT_APP_API_URL=$apiUrl
REACT_APP_CLERK_PUBLISHABLE_KEY=$clerkKey
"@

Set-Content -Path ".env.local" -Value $content -Encoding UTF8
Write-Host "Created frontend/.env.local — run: npm start" -ForegroundColor Green

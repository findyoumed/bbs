$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    "d:\work\bbs\www-bbs\loop_system\ai-loop.ps1",
    [ref]$tokens,
    [ref]$errors
)

if ($errors.Count -eq 0) {
    Write-Host "SYNTAX OK - No parse errors found" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SYNTAX ERRORS FOUND:" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host ("  Line " + $e.Extent.StartLineNumber + ": " + $e.Message) -ForegroundColor Red
    }
    exit 1
}

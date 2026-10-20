# Runs the API on http://localhost:5000 against the local test database and mail catcher,
# so testing never touches the shared Supabase database or sends real email.
# Start first:  node tools\testdb\start.mjs   and   python tools\mailsink\mailsink.py
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5433;Database=transitops_test;Username=transitops;Password=transitops_local_test;SSL Mode=Disable"
$env:Email__Smtp__Host = "localhost"
$env:Email__Smtp__Port = "2525"
$env:Email__Smtp__EnableSsl = "false"
$env:Email__Smtp__UserName = "test"
$env:Email__Smtp__Password = "test"
$env:Email__Smtp__FromAddress = "noreply@transitops.test"
Get-Process TransitOps.Api -ErrorAction SilentlyContinue | Stop-Process -Force
dotnet run --project "$PSScriptRoot\..\backend\TransitOps.Api\TransitOps.Api.csproj"

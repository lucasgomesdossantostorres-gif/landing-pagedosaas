$body = @{
  answerId = 1
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/corrigir" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
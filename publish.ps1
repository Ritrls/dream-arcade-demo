param([string]$RepositoryName = 'dream-arcade-demo')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
# Keep CLI state in an ignored directory that is writable in this workspace.
$env:GH_CONFIG_DIR = Join-Path $PSScriptRoot '.local-gh'
New-Item -ItemType Directory -Force -Path $env:GH_CONFIG_DIR | Out-Null
& gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    & gh auth login --hostname github.com --git-protocol https --web --scopes workflow
    if ($LASTEXITCODE -ne 0) { throw 'GitHub login did not complete.' }
}
$login = & gh api user --jq .login
if ($LASTEXITCODE -ne 0) { throw 'Could not read the GitHub account.' }
$repository = "$login/$RepositoryName"
& gh repo view $repository --json name 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw "Repository $repository already exists. Choose a new -RepositoryName to avoid overwriting existing work." }
& npm test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
& npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
if (!(Test-Path -LiteralPath '.git')) { & git init -b main }
& git config user.name $login
& git config user.email "$login@users.noreply.github.com"
& git add .
& git commit -m 'Build RunningHub-powered Dream Arcade demo'
if ($LASTEXITCODE -ne 0) { throw 'Could not create the initial commit.' }
& gh repo create $repository --public --description '造梦街机：RunningHub AI 场景生成 + 可玩的小游戏 + 离线导出' --source . --remote origin
if ($LASTEXITCODE -ne 0) { throw 'Could not create the repository.' }
& git -c http.sslBackend=openssl -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin main
if ($LASTEXITCODE -ne 0) { throw "Repository created at https://github.com/$repository but push failed. Do not recreate it; resume the push." }
& gh api --method POST "repos/$repository/pages" -f build_type=workflow | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Code uploaded. Enable GitHub Actions in https://github.com/$repository/settings/pages and rerun the Pages workflow." }
& gh workflow run pages.yml --repo $repository
if ($LASTEXITCODE -ne 0) { throw 'Could not start deployment. Inspect the Actions page.' }
Write-Host "Repository: https://github.com/$repository"
Write-Host "Deployment: https://github.com/$repository/actions"
Write-Host "Expected URL after successful deployment: https://$login.github.io/$RepositoryName/"

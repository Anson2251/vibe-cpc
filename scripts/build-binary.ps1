$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$DistDir = Join-Path $ProjectDir "dist"
$BuildDir = Join-Path $ProjectDir "build\quickjs"
$Input = Join-Path $DistDir "vibe-cpc-quickjs.mjs"
$Output = Join-Path $DistDir "vibe-cpc.exe"
$TempC = Join-Path $DistDir "vibe-cpc-quickjs.c"

$QjsVersion = "0.14.0"
$ReleaseBase = "https://github.com/quickjs-ng/quickjs/releases/download/v${QjsVersion}"
$AmalgamUrl = "${ReleaseBase}/quickjs-amalgam.zip"

if (-not (Test-Path $Input)) {
    Write-Error "Error: $Input not found. Run 'pnpm build' first."
    exit 1
}

$cl = Get-Command cl -ErrorAction SilentlyContinue
if (-not $cl) {
    Write-Error "Error: cl.exe not found. Run this script from a Visual Studio Developer Command Prompt."
    exit 1
}

New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

# --- Download amalgam if not present ---
$AmalgamDir = Join-Path $BuildDir "amalgam"
$AmalgamC = Join-Path $AmalgamDir "quickjs-amalgam.c"
if (-not (Test-Path $AmalgamC)) {
    Write-Host "Downloading QuickJS amalgam v${QjsVersion} ..."
    $ZipPath = Join-Path $BuildDir "quickjs-amalgam.zip"
    Invoke-WebRequest -Uri $AmalgamUrl -OutFile $ZipPath

    Write-Host "Extracting amalgam ..."
    New-Item -ItemType Directory -Force -Path $AmalgamDir | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $AmalgamDir -Force
    Remove-Item $ZipPath
}

# --- Download qjsc if not present ---
$QjscExe = Join-Path $BuildDir "qjsc.exe"
if (-not (Test-Path $QjscExe)) {
    Write-Host "Downloading qjsc for Windows ..."
    $Arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    if ($Arch -eq "X86") {
        $QjscAsset = "qjsc-windows-x86.exe"
    } else {
        $QjscAsset = "qjsc-windows-x86_64.exe"
    }
    $QjscUrl = "${ReleaseBase}/${QjscAsset}"
    Invoke-WebRequest -Uri $QjscUrl -OutFile $QjscExe
}

try {
    # --- Step 1: Generate C source with qjsc ---
    Write-Host "Step 1/2: Generating C source from $Input ..."
    & $QjscExe -e -s -s -o $TempC $Input
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error: qjsc code generation failed"
        exit 1
    }

    # --- Step 2: Compile to standalone binary ---
    Write-Host "Step 2/2: Compiling $TempC -> $Output ..."
    & cl /O2 /MT /std:c17 /experimental:c11atomics /Fe:$Output /I"$AmalgamDir" /DQJS_BUILD_LIBC $AmalgamC $TempC /link /STACK:8388608
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error: C compilation failed"
        exit 1
    }

    Write-Host "Done: $Output"
} finally {
    if (Test-Path $TempC) {
        Remove-Item $TempC
    }
}

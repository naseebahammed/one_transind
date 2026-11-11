# Preview only: reads the monthly ERP P&L .xls files and writes CSVs. It never touches the database.
# Needs Excel installed (reads the old .xls format). Usage:
#   powershell -File scripts\preview-erp-pnl.ps1 -Folder "C:\...\OneDrive_1_11-11-2026" -Out "C:\temp\erp-preview"
param([Parameter(Mandatory)][string]$Folder, [Parameter(Mandatory)][string]$Out)

$months = 'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'
$num = { param($x) if ($null -eq $x -or "$x" -eq '') { $null } elseif ($x -is [double]) { [math]::Round($x, 2) } else { [double]("$x" -replace ',', '') } }
New-Item -ItemType Directory -Force $Out | Out-Null
$lines = New-Object System.Collections.Generic.List[object]
$problems = New-Object System.Collections.Generic.List[string]
$summary = New-Object System.Collections.Generic.List[object]

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
try {
  foreach ($f in Get-ChildItem $Folder -Recurse -Filter *.xls | Sort-Object FullName) {
    if ($f.BaseName -notmatch '^(\w{3})\w*\s+(\d{4})$') { $problems.Add("$($f.Name): cannot read month and year from the file name"); continue }
    $month = [array]::IndexOf($months, $Matches[1].ToLower()) + 1; $year = [int]$Matches[2]
    if ($month -lt 1) { $problems.Add("$($f.Name): unknown month"); continue }
    $wb = $xl.Workbooks.Open($f.FullName, 0, $true)
    $ur = $wb.Worksheets.Item(1).UsedRange
    $v = $ur.Value2; $rows = $ur.Rows.Count; $cols = $ur.Columns.Count; $startRow = $ur.Row; $startCol = $ur.Column
    $wb.Close($false)
    if ($startRow -ne 1 -or $startCol -ne 1) { $problems.Add("$($f.Name): sheet does not start at A1"); continue }

    # Each company is a block of 5 columns: Actuals, Budget, Variance %, Last year, Last year variance %.
    $companies = @(); $name = ''
    for ($c = 3; $c -le $cols; $c += 5) {
      if ("$($v[2,$c])" -notmatch '^Actuals of') { break }
      if ($v[1,$c]) { $name = "$($v[1,$c])" }
      if ("$($v[2,($c+1)])" -notmatch '^Budget of' -or "$($v[2,($c+3)])" -notmatch '^Actuals of') { $problems.Add("$($f.Name): unexpected headers for $name at column $c") }
      if ("$($v[2,$c])" -notmatch "-$year$") { $problems.Add("$($f.Name): header '$($v[2,$c])' does not match the file name") }
      $companies += [pscustomobject]@{ Name = $name; Col = $c }
    }

    $count = 0; $mismatch = 0
    foreach ($co in $companies) {
      $c = $co.Col; $accountSum = @{}; $parentTotal = @{}; $grand = $null
      for ($r = 3; $r -le $rows; $r++) {
        $parent = "$($v[$r,1])"; $account = "$($v[$r,2])"
        $actual = & $num $v[$r,$c]; $budget = & $num $v[$r,($c+1)]; $lastYear = & $num $v[$r,($c+3)]
        if ($parent -eq 'Total') { $grand = $actual; continue }
        if ($account -eq 'Total') { $parentTotal[$parent] = $actual; continue }
        if ($null -eq $actual -and $null -eq $budget -and $null -eq $lastYear) { continue }
        $accountSum[$parent] = [double]$accountSum[$parent] + [double]$actual
        $lines.Add([pscustomobject]@{ Year = $year; Month = $month; Company = $co.Name; Parent = $parent; Account = $account; Actual = $actual; Budget = $budget; LastYear = $lastYear }); $count++
      }
      # Check: the accounts of each group add up to the group's own Total row, and the groups add up to the sheet's final Total.
      foreach ($p in $parentTotal.Keys) { if ([math]::Abs([double]$parentTotal[$p] - [double]$accountSum[$p]) -gt 0.05) { $mismatch++; $problems.Add("$($f.Name) | $($co.Name) | $p : accounts add to $($accountSum[$p]) but Total row says $($parentTotal[$p])") } }
      $all = ($parentTotal.Values | Measure-Object -Sum).Sum
      if ($null -ne $grand -and [math]::Abs([double]$grand - [double]$all) -gt 0.05) { $mismatch++; $problems.Add("$($f.Name) | $($co.Name) : group Totals add to $all but final Total says $grand") }
    }
    $summary.Add([pscustomobject]@{ File = $f.Name; Companies = $companies.Count; Rows = $count; Mismatches = $mismatch })
    Write-Host "$($f.Name): $($companies.Count) companies, $count rows, $mismatch mismatches"
  }
} finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }

$lines | Export-Csv "$Out\erp-pnl-lines.csv" -NoTypeInformation -Encoding UTF8
$summary | Export-Csv "$Out\erp-pnl-files.csv" -NoTypeInformation -Encoding UTF8
$lines | Group-Object Company | Sort-Object Name | ForEach-Object { [pscustomobject]@{ Company = $_.Name; Rows = $_.Count; From = ($_.Group | ForEach-Object { $_.Year * 100 + $_.Month } | Measure-Object -Minimum).Minimum; To = ($_.Group | ForEach-Object { $_.Year * 100 + $_.Month } | Measure-Object -Maximum).Maximum } } | Export-Csv "$Out\erp-pnl-companies.csv" -NoTypeInformation -Encoding UTF8
$lines | Group-Object Parent, Account | Sort-Object Name | ForEach-Object { [pscustomobject]@{ Parent = $_.Group[0].Parent; Account = $_.Group[0].Account; Rows = $_.Count } } | Export-Csv "$Out\erp-pnl-accounts.csv" -NoTypeInformation -Encoding UTF8
[IO.File]::WriteAllLines("$Out\erp-pnl-problems.txt", [string[]]$problems.ToArray()) # Set-Content would leave an old file in place when there are no problems
Write-Host "`n$($lines.Count) rows, $($problems.Count) problems. Files written to $Out"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Windows.Forms

$fbd = New-Object System.Windows.Forms.FolderBrowserDialog
$fbd.Description = "Chọn thư mục chứa giáo án các môn của Thầy/Cô"
$fbd.ShowNewFolderButton = $false

if ($args.Count -gt 0 -and (Test-Path $args[0])) {
    $fbd.SelectedPath = $args[0]
}

$topForm = New-Object System.Windows.Forms.Form
$topForm.TopMost = $true
$topForm.Visible = $false

$result = $fbd.ShowDialog($topForm)
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.WriteLine($fbd.SelectedPath)
} else {
    [Console]::Out.WriteLine("")
}
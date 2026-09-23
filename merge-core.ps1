[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

param(
    [Parameter(Mandatory=$true)]
    [string]$ConfigFile
)

function Write-ProgressJson($obj) {
    $json = $obj | ConvertTo-Json -Compress
    [Console]::Out.WriteLine(">>JSON_EVENT>>" + $json)
}

if (!(Test-Path $ConfigFile)) {
    Write-ProgressJson @{ type = "error"; message = "Không tìm thấy file cấu hình: $ConfigFile" }
    exit 1
}

try {
    $rawConfig = [System.IO.File]::ReadAllText($ConfigFile, [System.Text.Encoding]::UTF8)
    $config = $rawConfig | ConvertFrom-Json
} catch {
    Write-ProgressJson @{ type = "error"; message = "Lỗi đọc file cấu hình JSON: $($_.Exception.Message)" }
    exit 1
}

$tasks = $config.tasks
$options = $config.options
$breakType = if ($options.breakType) { $options.breakType } else { "section" }
$addTitleBanner = [bool]($options.addTitleBanner)
$bannerTextPattern = if ($options.bannerTextPattern) { $options.bannerTextPattern } else { "TUẦN {week} - MÔN: {subject}" }

# Hằng số Word COM
$wdStory = 6
$wdSectionBreakNextPage = 2
$wdPageBreak = 7
$wdFormatDocumentDefault = 16 # docx
$wdDoNotSaveChanges = 0

Write-ProgressJson @{ type = "init"; message = "Đang khởi tạo dịch vụ Microsoft Word..."; totalTasks = $tasks.Count }

$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
} catch {
    Write-ProgressJson @{ type = "error"; message = "Không thể khởi động Microsoft Word: $($_.Exception.Message)" }
    exit 1
}

$successCount = 0
$failedCount = 0

try {
    for ($i = 0; $i -lt $tasks.Count; $i++) {
        $task = $tasks[$i]
        $week = $task.week
        $outputFile = $task.outputFile
        $items = $task.items # Mảng các { subject, filePath }
        
        Write-ProgressJson @{ 
            type = "start_week"; 
            week = $week; 
            index = $i + 1; 
            total = $tasks.Count; 
            itemCount = $items.Count;
            message = "Bắt đầu ghép Tuần $week..."
        }
        
        # Lọc các file thực sự tồn tại
        $validItems = @()
        foreach ($it in $items) {
            if ($it.filePath -and (Test-Path $it.filePath)) {
                $validItems += $it
            } else {
                Write-ProgressJson @{ 
                    type = "warning"; 
                    week = $week; 
                    subject = $it.subject; 
                    message = "Không tìm thấy file: $($it.filePath)" 
                }
            }
        }
        
        if ($validItems.Count -eq 0) {
            Write-ProgressJson @{ 
                type = "week_skipped"; 
                week = $week; 
                message = "Tuần $week không có file nào hợp lệ, bỏ qua." 
            }
            $failedCount++
            continue
        }
        
        # Đảm bảo thư mục lưu file đầu ra tồn tại
        $outDir = [System.IO.Path]::GetDirectoryName($outputFile)
        if ($outDir -and !(Test-Path $outDir)) {
            New-Item -ItemType Directory -Path $outDir -Force | Out-Null
        }
        
        try {
            $firstItem = $validItems[0]
            
            # Mở file đầu tiên làm gốc
            $doc = $word.Documents.Open([string]$firstItem.filePath, $false, $true) # Open ReadOnly
            # Lưu ra file mới
            $doc.SaveAs2([string]$outputFile, $wdFormatDocumentDefault)
            $doc.Close($wdDoNotSaveChanges)
            
            # Mở file mới để tiếp tục ghép
            $mergedDoc = $word.Documents.Open([string]$outputFile)
            
            # Ghép các file tiếp theo
            for ($j = 1; $j -lt $validItems.Count; $j++) {
                $nextItem = $validItems[$j]
                
                # Di chuyển đến cuối tài liệu
                $word.Selection.EndKey($wdStory)
                
                # Chèn ngắt trang hoặc ngắt Section
                if ($breakType -eq "page") {
                    $word.Selection.InsertBreak($wdPageBreak)
                } else {
                    $word.Selection.InsertBreak($wdSectionBreakNextPage)
                }
                
                # Nếu người dùng muốn chèn dải banner tiêu đề phân môn
                if ($addTitleBanner) {
                    $bannerStr = $bannerTextPattern -replace '\{week\}', "$week" -replace '\{subject\}', "$($nextItem.subject.ToUpper())"
                    $word.Selection.Font.Name = "Times New Roman"
                    $word.Selection.Font.Size = 13
                    $word.Selection.Font.Bold = $true
                    $word.Selection.TypeText("$bannerStr`n")
                    $word.Selection.Font.Bold = $false
                }
                
                # Chèn nội dung file Word tiếp theo
                $word.Selection.InsertFile([string]$nextItem.filePath)
            }
            
            $mergedDoc.Save()
            $mergedDoc.Close($wdDoNotSaveChanges)
            
            $successCount++
            Write-ProgressJson @{ 
                type = "end_week"; 
                week = $week; 
                outputFile = $outputFile; 
                mergedCount = $validItems.Count;
                message = "Đã ghép thành công Tuần $week ($($validItems.Count) môn) -> $outputFile"
            }
        } catch {
            $failedCount++
            Write-ProgressJson @{ 
                type = "week_error"; 
                week = $week; 
                error = $_.Exception.Message;
                message = "Lỗi khi ghép Tuần $week: $($_.Exception.Message)"
            }
        }
    }
} finally {
    if ($word) {
        $word.Quit($wdDoNotSaveChanges)
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
        $word = $null
    }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-ProgressJson @{ 
    type = "complete"; 
    successCount = $successCount; 
    failedCount = $failedCount; 
    message = "Quá trình hoàn tất! Thành công: $successCount tuần, Lỗi/Bỏ qua: $failedCount tuần."
}
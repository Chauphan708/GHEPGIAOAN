const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const DocxMerger = require('docx-merger');

const { scanFolder } = require('./scanner');
const { generateSignatureDocxBuffer, fixContinuousPageNumbers } = require('./signature');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(__dirname, 'config.json');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

function safeReadFile(filePath) {
    try {
        return fs.readFileSync(filePath);
    } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EACCES') {
            const tempCopy = filePath + '.temp_' + Date.now();
            try {
                fs.copyFileSync(filePath, tempCopy);
                const buf = fs.readFileSync(tempCopy);
                fs.unlinkSync(tempCopy);
                return buf;
            } catch (copyErr) {
                throw new Error(`File đang bị khóa: ${path.basename(filePath)}`);
            }
        }
        throw err;
    }
}

function getSavedSettings() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        } catch (e) {}
    }
    return {
        signature: {
            enabled: true,
            placeDate: "Trung Nhứt, ngày     tháng     năm 202...",
            bghRole: "HIỆU TRƯỞNG",
            bghName: "",
            ttRole: "TỔ TRƯỞNG",
            ttName: "",
            gvRole: "GIÁO VIÊN",
            gvName: ""
        },
        naming: {
            pattern: "KHBD_Tuan_{week}_Lop_{lop}.docx",
            lop: "5"
        },
        options: {
            continuousPageNumbering: true,
            pageBreak: true
        }
    };
}

function saveSettings(data) {
    const current = getSavedSettings();
    const updated = {
        signature: { ...current.signature, ...(data.signature || {}) },
        naming: { ...current.naming, ...(data.naming || {}) },
        options: { ...current.options, ...(data.options || {}) }
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 1. API Cấu hình lưu trữ (Settings)
    if (pathname === '/api/settings') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, settings: getSavedSettings() }));
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const saved = saveSettings(data);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, settings: saved }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }
    }

    // 2. API Chọn Thư Mục Windows
    if (pathname === '/api/browse-folder' && req.method === 'POST') {
        const scriptPath = path.join(__dirname, 'browse-folder.ps1');
        const child = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]);
        let output = '';
        child.stdout.on('data', data => { output += data.toString(); });
        child.on('close', () => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ folderPath: output.trim() || '' }));
        });
        return;
    }

    // 3. API Mở Thư Mục Bằng Explorer
    if (pathname === '/api/open-folder' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                if (data.folderPath && fs.existsSync(data.folderPath)) {
                    execFile('explorer.exe', [data.folderPath]);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Thư mục không tồn tại' }));
                }
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // 4. API Quét Thư Mục
    if (pathname === '/api/scan' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                if (!data.folderPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Vui lòng cung cấp đường dẫn thư mục' }));
                    return;
                }
                const result = scanFolder(data.folderPath);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, ...result }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // 5. API Ghép File Word
    if (pathname === '/api/merge' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const config = JSON.parse(body || '{}');
                const {
                    inputFolder,
                    outputFolder,
                    selectedWeeks,
                    subjectOrder,
                    pageBreak = true,
                    continuousPageNumbering = true,
                    namingPattern = 'KHBD_Tuan_{week}_Lop_{lop}.docx',
                    lopName = '5',
                    signatureInfo = null
                } = config;

                if (!inputFolder || !selectedWeeks || selectedWeeks.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Thiếu thông tin cấu hình ghép' }));
                    return;
                }

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no'
                });

                function sendEvent(data) {
                    res.write(`data: ${JSON.stringify(data)}\n\n`);
                }

                sendEvent({
                    type: 'start',
                    total: selectedWeeks.length,
                    message: `Bắt đầu xử lý ghép ${selectedWeeks.length} tuần...`
                });

                const outDir = outputFolder || path.join(inputFolder, 'Giao_An_Tong_Hop_35_Tuan');
                if (!fs.existsSync(outDir)) {
                    fs.mkdirSync(outDir, { recursive: true });
                }

                const scanData = scanFolder(inputFolder);
                const weeksMap = scanData.weeks;

                let successCount = 0;
                let skippedCount = 0;
                let errorCount = 0;

                // Tạo buffer chữ ký trước nếu có bật
                let signatureBuffer = null;
                if (signatureInfo && signatureInfo.enabled) {
                    try {
                        signatureBuffer = await generateSignatureDocxBuffer(signatureInfo);
                    } catch (sigErr) {
                        console.error('Lỗi tạo chữ ký:', sigErr);
                    }
                }

                for (let i = 0; i < selectedWeeks.length; i++) {
                    const week = selectedWeeks[i];
                    const weekData = weeksMap[week];
                    const index = i + 1;
                    const percent = Math.round((index / selectedWeeks.length) * 100);

                    sendEvent({
                        type: 'progress',
                        week,
                        index,
                        total: selectedWeeks.length,
                        percent,
                        message: `Đang xử lý Tuần ${week} (${index}/${selectedWeeks.length})...`
                    });

                    if (!weekData || weekData.count === 0) {
                        skippedCount++;
                        sendEvent({
                            type: 'week_skipped',
                            week,
                            index,
                            percent,
                            message: `⚠️ Tuần ${week}: Không tìm thấy file nào của các môn, bỏ qua.`
                        });
                        continue;
                    }

                    const filesToMerge = [];
                    const mergedSubjects = [];

                    for (const subName of subjectOrder) {
                        const fPath = weekData.files[subName];
                        if (fPath && fs.existsSync(fPath)) {
                            filesToMerge.push(fPath);
                            mergedSubjects.push(subName);
                        }
                    }

                    for (const [subName, fPath] of Object.entries(weekData.files)) {
                        if (!subjectOrder.includes(subName) && fs.existsSync(fPath)) {
                            filesToMerge.push(fPath);
                            mergedSubjects.push(subName);
                        }
                    }

                    if (filesToMerge.length === 0) {
                        skippedCount++;
                        sendEvent({
                            type: 'week_skipped',
                            week,
                            index,
                            percent,
                            message: `⚠️ Tuần ${week}: Các môn đã chọn không có file hợp lệ.`
                        });
                        continue;
                    }

                    try {
                        const weekPad = String(week).padStart(2, '0');
                        const cleanLop = (lopName || '').trim();

                        let outFileName = namingPattern
                            .replace(/\{week\}/g, weekPad)
                            .replace(/\{w\}/g, String(week))
                            .replace(/\{lop\}/g, cleanLop)
                            .replace(/\{mon\}/g, 'Tong_Hop');

                        if (!outFileName.toLowerCase().endsWith('.docx')) {
                            outFileName += '.docx';
                        }
                        outFileName = outFileName.replace(/[<>:"/\\|?*]/g, '_');
                        const finalOutPath = path.join(outDir, outFileName);

                        const buffers = filesToMerge.map(fp => safeReadFile(fp));
                        if (signatureBuffer) {
                            buffers.push(signatureBuffer);
                        }

                        let finalDataBuffer;
                        if (buffers.length === 1 && !signatureBuffer) {
                            finalDataBuffer = buffers[0];
                        } else {
                            const merger = new DocxMerger({ pageBreak: !!pageBreak }, buffers);
                            finalDataBuffer = await new Promise((resolve, reject) => {
                                merger.save('nodebuffer', data => {
                                    if (data) resolve(data);
                                    else reject(new Error('Lỗi tạo buffer tài liệu'));
                                });
                            });
                        }

                        if (continuousPageNumbering) {
                            finalDataBuffer = await fixContinuousPageNumbers(finalDataBuffer);
                        }

                        fs.writeFileSync(finalOutPath, finalDataBuffer);

                        successCount++;
                        sendEvent({
                            type: 'week_success',
                            week,
                            index,
                            percent,
                            outputFile: finalOutPath,
                            fileName: outFileName,
                            mergedSubjects,
                            hasSignature: !!signatureBuffer,
                            message: `✅ Ghép thành công Tuần ${week}: ${mergedSubjects.length} môn (${mergedSubjects.join(', ')})${signatureBuffer ? ' + Kèm bảng chữ ký BGH-TT-GV' : ''}`
                        });

                    } catch (err) {
                        errorCount++;
                        sendEvent({
                            type: 'week_error',
                            week,
                            index,
                            percent,
                            error: err.message,
                            message: `❌ Lỗi khi ghép Tuần ${week}: ${err.message}`
                        });
                    }
                }

                sendEvent({
                    type: 'complete',
                    successCount,
                    skippedCount,
                    errorCount,
                    total: selectedWeeks.length,
                    outputFolder: outDir,
                    message: `🎉 ĐÃ HOÀN TẤT! Thành công: ${successCount} tuần | Bỏ qua: ${skippedCount} | Lỗi: ${errorCount}`
                });

                res.end();
            } catch (fatalErr) {
                res.write(`data: ${JSON.stringify({ type: 'fatal_error', error: fatalErr.message })}\n\n`);
                res.end();
            }
        });
        return;
    }

    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Cấm truy cập');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Không tìm thấy tài nguyên');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });

        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n======================================================`);
    console.log(`📚 PHẦN MỀM GHÉP GIÁO ÁN / KẾ HOẠCH BÀI DẠY 35 TUẦN (V2)`);
    console.log(`🌐 Đang chạy Offline Local tại: http://localhost:${PORT}`);
    console.log(`📁 Thư mục phục vụ: ${__dirname}`);
    console.log(`======================================================\n`);
});
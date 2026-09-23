// ==========================================================================
// CLI & Drag-and-Drop Runner for Merging Lesson Plans (35 Weeks) - Bản V2
// ==========================================================================

const fs = require('fs');
const path = require('path');
const DocxMerger = require('docx-merger');

const { scanFolder } = require('./scanner');
const { generateSignatureDocxBuffer, fixContinuousPageNumbers } = require('./signature');

const CONFIG_FILE = path.join(__dirname, 'config.json');

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

async function runMerge(inputDir, outputDir) {
    console.log('\n=============================================================');
    console.log('   ỨNG DỤNG GHÉP GIÁO ÁN / KẾ HOẠCH BÀI DẠY 35 TUẦN (V2)');
    console.log('=============================================================\n');

    if (!inputDir || !fs.existsSync(inputDir)) {
        console.error('❌ Lỗi: Thư mục nguồn không hợp lệ hoặc không tồn tại!');
        return;
    }

    const finalOutDir = outputDir || path.join(inputDir, 'Giao_An_Tong_Hop_35_Tuan');
    if (!fs.existsSync(finalOutDir)) {
        fs.mkdirSync(finalOutDir, { recursive: true });
    }

    const settings = getSavedSettings();
    const sigInfo = settings.signature || {};
    const naming = settings.naming || {};
    const options = settings.options || {};

    console.log(`📁 Thư mục nguồn: ${inputDir}`);
    console.log(`📁 Thư mục kết quả: ${finalOutDir}`);
    console.log(`🏷️  Mẫu đặt tên: ${naming.pattern || 'KHBD_Tuan_{week}_Lop_{lop}.docx'} (Lớp: ${naming.lop || '5'})`);
    console.log(`✍️  Chèn chữ ký BGH-TT-GV: ${sigInfo.enabled ? 'BẬT' : 'TẮT'}`);
    console.log(`📄 Đánh số trang liên tục: ${options.continuousPageNumbering ? 'BẬT' : 'TẮT'}\n`);
    console.log('🔍 Đang quét cấu trúc môn học và các tuần...');

    const scanData = scanFolder(inputDir);
    const detectedSubjects = scanData.subjects.map(s => s.name);
    const weeksMap = scanData.weeks;

    console.log(`✅ Tìm thấy ${detectedSubjects.length} môn học: ${detectedSubjects.join(', ')}`);
    console.log(`📋 Thứ tự ghép: ${detectedSubjects.join(' → ')}\n`);

    let signatureBuffer = null;
    if (sigInfo.enabled) {
        try {
            signatureBuffer = await generateSignatureDocxBuffer(sigInfo);
            console.log('📝 Đã nạp khối chữ ký 3 cột (BGH - Tổ trưởng - Giáo viên)\n');
        } catch (sigErr) {
            console.error('Lỗi tạo chữ ký:', sigErr);
        }
    }

    let successCount = 0;
    let skippedCount = 0;

    for (let w = 1; w <= 35; w++) {
        const weekFilesMap = weeksMap[w] ? weeksMap[w].files : {};
        const filesToMerge = [];
        const subjectsInWeek = [];

        for (const sub of detectedSubjects) {
            if (weekFilesMap[sub] && fs.existsSync(weekFilesMap[sub])) {
                filesToMerge.push(weekFilesMap[sub]);
                subjectsInWeek.push(sub);
            }
        }

        if (filesToMerge.length === 0) {
            skippedCount++;
            continue;
        }

        const weekPad = String(w).padStart(2, '0');
        const pattern = naming.pattern || 'KHBD_Tuan_{week}_Lop_{lop}.docx';
        const lop = (naming.lop || '5').trim();

        let outFileName = pattern
            .replace(/\{week\}/g, weekPad)
            .replace(/\{w\}/g, String(w))
            .replace(/\{lop\}/g, lop)
            .replace(/\{mon\}/g, 'Tong_Hop');

        if (!outFileName.toLowerCase().endsWith('.docx')) {
            outFileName += '.docx';
        }
        outFileName = outFileName.replace(/[<>:"/\\|?*]/g, '_');
        const outFilePath = path.join(finalOutDir, outFileName);

        process.stdout.write(`⏳ Đang ghép Tuần ${weekPad} (${subjectsInWeek.length} môn)... `);

        try {
            const buffers = filesToMerge.map(fp => safeReadFile(fp));
            if (signatureBuffer) {
                buffers.push(signatureBuffer);
            }

            let finalDataBuffer;
            if (buffers.length === 1 && !signatureBuffer) {
                finalDataBuffer = buffers[0];
            } else {
                const merger = new DocxMerger({ pageBreak: options.pageBreak !== false }, buffers);
                finalDataBuffer = await new Promise((resolve, reject) => {
                    merger.save('nodebuffer', data => {
                        if (data) resolve(data);
                        else reject(new Error('Lỗi tạo buffer tài liệu'));
                    });
                });
            }

            if (options.continuousPageNumbering !== false) {
                finalDataBuffer = await fixContinuousPageNumbers(finalDataBuffer);
            }

            fs.writeFileSync(outFilePath, finalDataBuffer);
            console.log(`✅ Xong [${subjectsInWeek.join(', ')}] -> ${outFileName}`);
            successCount++;
        } catch (err) {
            console.log(`❌ Lỗi: ${err.message}`);
        }
    }

    console.log('\n=============================================================');
    console.log(`🎉 HOÀN TẤT QUÁ TRÌNH GHÉP!`);
    console.log(`   - Ghép thành công: ${successCount} tuần`);
    console.log(`   - Tuần không có file: ${skippedCount} tuần`);
    console.log(`   - Thư mục chứa kết quả: ${finalOutDir}`);
    console.log('=============================================================\n');

    const { exec } = require('child_process');
    exec(`explorer "${finalOutDir}"`);
}

const args = process.argv.slice(2);
const inputArg = args[0] || path.join(__dirname, 'Du_Lieu_Mau');
const outputArg = args[1];

runMerge(inputArg, outputArg).catch(console.error);
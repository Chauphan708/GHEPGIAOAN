const fs = require('fs');
const path = require('path');

function isIgnoredFolder(folderName) {
    const fn = folderName.toLowerCase().trim();
    if (fn.startsWith('.') || fn === 'node_modules' || fn === 'public' || fn === 'css' || fn === 'js') return true;
    if (fn.includes('giao_an_tong_hop') || fn.includes('ket_qua') || fn.includes('output') || fn.includes('temp')) return true;
    return false;
}

function cleanCustomSubject(str) {
    if (!str) return '';
    let s = str.trim();
    s = s.replace(/\.(docx|doc)$/i, '');
    s = s.replace(/(?:tu[aàầáảãạ]n|tuan|week|w|t)[\s_.-]*0*([12]\d|3[0-5]|[1-9])(?=[^\d]|$)/gi, ' ');
    s = s.replace(/[-_.]0*([12]\d|3[0-5]|[1-9])[-_.]/g, ' ');
    s = s.replace(/(?:l[oớơ]p|khoi|lop)[\s_.-]*\d+[a-zA-Z]?/gi, ' ');
    s = s.replace(/(?:ti[eế]t|tiet|bai|b)[\s_.-]*\d+/gi, ' ');
    s = s.replace(/^[_\-.\s]+|[_\-.\s]+$/g, '').replace(/[\s_\-]+/g, ' ').trim();
    return s;
}

const STANDARD_SUBJECT_NAMES = [
    'Tiếng Việt', 'Toán', 'Đạo đức', 'Tự nhiên và Xã hội', 'Khoa học', 'Lịch sử và Địa lí',
    'Tin học và Công nghệ', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học',
    'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất', 'Tiếng Anh', 'Lịch báo giảng'
];

function canonicalSubject(name) {
    if (!name) return 'Môn khác';
    const raw = (name || '').trim();
    const withoutExt = raw.replace(/\.(docx|doc)$/i, '');
    const norm = withoutExt.replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // 1. Tiếng Việt
    if (norm.includes('tieng viet') || norm.includes('tiengviet') || /(?:^|[\s_.\-])tv(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Tiếng Việt';

    // 2. Toán
    if (norm.includes('toan')) return 'Toán';

    // 3. Tự nhiên và Xã hội (TNXH - Môn học trọng tâm Lớp 1, 2, 3)
    if (norm.includes('tu nhien') || norm.includes('xa hoi') || norm.includes('tnxh') || /(?:^|[\s_.\-])(tnxh|tn[\s_\-&]*xh)(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Tự nhiên và Xã hội';

    // 4. Khoa học (Lớp 4, 5)
    if (norm.includes('khoa hoc') || norm.includes('khoahoc') || norm.includes('khtn') || /(?:^|[\s_.\-])kh(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Khoa học';

    // 5. Lịch sử và Địa lí (Lớp 4, 5)
    if (norm.includes('lich su') || norm.includes('dia li') || norm.includes('dia ly') || /(?:^|[\s_.\-])(lsdl|ls[\s_\-&]*dl)(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Lịch sử và Địa lí';

    // 6. Đạo đức
    if (norm.includes('dao duc') || norm.includes('daoduc') || /(?:^|[\s_.\-])dd(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Đạo đức';

    // 7. Tin học và Công nghệ
    if (norm.includes('tin hoc va cong nghe') || norm.includes('th&cn') || norm.includes('th-cn') || norm.includes('th_cn')) return 'Tin học và Công nghệ';

    // 8. Công nghệ
    if (norm.includes('cong nghe') || norm.includes('congnghe') || /(?:^|[\s_.\-])cn(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Công nghệ';

    // 9. Hoạt động trải nghiệm
    if (norm.includes('trai nghiem') || norm.includes('hoat dong trai nghiem') || /(?:^|[\s_.\-])(hdtn|hdtnhn|hd[\s_\-&]*tn)(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Hoạt động trải nghiệm';

    // 10. Tin học
    if (norm.includes('tin hoc') || norm.includes('tinhoc') || /(?:^|[\s_.\-])tin(?=[0-9\s_.\-]|$)/i.test(norm) || (/(?:^|[\s_.\-])th(?=[0-9\s_.\-]|$)/i.test(norm) && !norm.includes('tieu hoc') && !norm.includes('thcs') && !norm.includes('thpt'))) return 'Tin học';

    // 11. Âm nhạc
    if (norm.includes('am nhac') || norm.includes('amnhac') || norm.includes('nhac') || /(?:^|[\s_.\-])an(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Âm nhạc';

    // 12. Mĩ thuật
    if (norm.includes('mi thuat') || norm.includes('my thuat') || /(?:^|[\s_.\-])mt(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Mĩ thuật';

    // 13. Giáo dục thể chất
    if (norm.includes('the chat') || norm.includes('the duc') || /(?:^|[\s_.\-])(gdtc|td)(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Giáo dục thể chất';

    // 14. Tiếng Anh
    if (norm.includes('tieng anh') || norm.includes('tienganh') || norm.includes('english') || norm.includes('ngoai ngu') || /(?:^|[\s_.\-])(ta|eng)(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Tiếng Anh';

    // 15. Lịch báo giảng
    if (norm.includes('bao giang') || norm.includes('baogiang') || norm.includes('lich bao') || /(?:^|[\s_.\-])lbg(?=[0-9\s_.\-]|$)/i.test(norm)) return 'Lịch báo giảng';

    const cleaned = cleanCustomSubject(name);
    return cleaned || raw || 'Môn khác';
}

function detectSubject(filename, parentFolderName) {
    // 1. Ưu tiên kiểm tra tên file
    const subFromName = canonicalSubject(filename);
    if (STANDARD_SUBJECT_NAMES.includes(subFromName)) {
        return subFromName;
    }

    // 2. Kiểm tra thư mục cha (nếu có)
    if (parentFolderName) {
        const subFromParent = canonicalSubject(parentFolderName);
        if (STANDARD_SUBJECT_NAMES.includes(subFromParent)) {
            return subFromParent;
        }
    }

    // 3. Nếu là môn học tự tạo ngoài danh mục chuẩn: làm sạch từ tên file
    const customFromName = cleanCustomSubject(filename);
    if (customFromName && customFromName.length >= 2) {
        return customFromName;
    }

    // 4. Hoặc từ thư mục cha
    if (parentFolderName) {
        const customFromParent = cleanCustomSubject(parentFolderName);
        if (customFromParent && customFromParent.length >= 2) {
            return customFromParent;
        }
    }

    return subFromName || 'Môn khác';
}

function extractWeekNumber(filename) {
    const patterns = [
        /(?:tu[aàầáảãạ]n|tuan|week|w|t)[\s_.-]*0*([12]\d|3[0-5]|[1-9])(?=[^\d]|$)/i,
        /[-_.]0*([12]\d|3[0-5]|[1-9])[-_.]/,
        /\b0*([12]\d|3[0-5]|[1-9])\.(?:docx|doc)$/i
    ];

    for (const p of patterns) {
        const m = filename.match(p);
        if (m && m[1]) {
            const w = parseInt(m[1], 10);
            if (w >= 1 && w <= 35) return w;
        }
    }

    const fallbackMatch = filename.match(/\b0*([12]\d|3[0-5]|[1-9])\b/);
    if (fallbackMatch) {
        const w = parseInt(fallbackMatch[1], 10);
        if (w >= 1 && w <= 35) return w;
    }

    return null;
}

function scanFolder(rootPath) {
    if (!fs.existsSync(rootPath)) {
        throw new Error(`Thư mục không tồn tại: ${rootPath}`);
    }

    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    const subdirs = entries.filter(e => e.isDirectory() && !isIgnoredFolder(e.name));

    const subjectsMap = new Map();
    const weeksMap = {};

    for (let w = 1; w <= 35; w++) {
        weeksMap[w] = { files: {}, count: 0 };
    }

    function addFileToScan(filePath, fileName, parentFolderName) {
        if (fileName.startsWith('~$')) return;
        const ext = path.extname(fileName).toLowerCase();
        if (ext !== '.docx' && ext !== '.doc') return;

        const canon = detectSubject(fileName, parentFolderName);
        const week = extractWeekNumber(fileName) || (parentFolderName ? extractWeekNumber(parentFolderName) : null);

        let subjectEntry = subjectsMap.get(canon);
        if (!subjectEntry) {
            subjectEntry = {
                name: canon,
                originalNames: [parentFolderName || canon],
                folderPath: path.dirname(filePath),
                filesByWeek: {}
            };
            subjectsMap.set(canon, subjectEntry);
        } else if (parentFolderName && !subjectEntry.originalNames.includes(parentFolderName)) {
            subjectEntry.originalNames.push(parentFolderName);
        }

        if (week && week >= 1 && week <= 35) {
            subjectEntry.filesByWeek[week] = filePath;
            weeksMap[week].files[canon] = filePath;
        }
    }

    if (subdirs.length > 0) {
        for (const dir of subdirs) {
            const folderName = dir.name;
            const fullDir = path.join(rootPath, folderName);
            const files = fs.readdirSync(fullDir);
            for (const f of files) {
                addFileToScan(path.join(fullDir, f), f, folderName);
            }
        }
    }

    // Đồng thời quét các file ở thư mục gốc (rootPath) nếu có
    const rootFiles = entries.filter(e => e.isFile());
    for (const fileEnt of rootFiles) {
        addFileToScan(path.join(rootPath, fileEnt.name), fileEnt.name, '');
    }

    const subjectList = Array.from(subjectsMap.values()).map(s => ({
        name: s.name,
        totalFiles: Object.keys(s.filesByWeek).length,
        originalNames: s.originalNames
    }));

    const DEFAULT_PRIORITY = [
        'Tiếng Việt', 'Toán', 'Đạo đức', 'Tự nhiên và Xã hội', 'Khoa học', 'Lịch sử và Địa lí',
        'Tin học và Công nghệ', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh',
        'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất', 'Lịch báo giảng'
    ];

    subjectList.sort((a, b) => {
        let idxA = DEFAULT_PRIORITY.indexOf(a.name);
        let idxB = DEFAULT_PRIORITY.indexOf(b.name);
        if (idxA === -1) idxA = 99;
        if (idxB === -1) idxB = 99;
        return idxA - idxB;
    });

    let totalFilesFound = 0;
    let totalWeeksWithFiles = 0;

    for (let w = 1; w <= 35; w++) {
        const count = Object.keys(weeksMap[w].files).length;
        weeksMap[w].count = count;
        totalFilesFound += count;

        if (count > 0) totalWeeksWithFiles++;

        if (subjectList.length > 0 && count >= subjectList.length) {
            weeksMap[w].status = 'full';
        } else if (count > 0) {
            weeksMap[w].status = 'partial';
        } else {
            weeksMap[w].status = 'empty';
        }

        weeksMap[w].missing = subjectList
            .map(s => s.name)
            .filter(name => !weeksMap[w].files[name]);
    }

    return {
        rootPath,
        subjects: subjectList,
        weeks: weeksMap,
        summary: {
            totalSubjects: subjectList.length,
            totalWeeksFound: totalWeeksWithFiles,
            totalFilesFound
        }
    };
}

module.exports = {
    canonicalSubject,
    cleanCustomSubject,
    detectSubject,
    extractWeekNumber,
    scanFolder
};

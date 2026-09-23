const fs = require('fs');
const path = require('path');

function isIgnoredFolder(folderName) {
    const fn = folderName.toLowerCase().trim();
    if (fn.startsWith('.') || fn === 'node_modules' || fn === 'public' || fn === 'css' || fn === 'js') return true;
    if (fn.includes('giao_an_tong_hop') || fn.includes('ket_qua') || fn.includes('output') || fn.includes('temp')) return true;
    return false;
}

function canonicalSubject(folderName) {
    const raw = folderName.trim();
    const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    if (norm.includes('tieng viet') || norm === 'tv') return 'Tiếng Việt';
    if (norm.includes('toan')) return 'Toán';
    if (norm.includes('khoa hoc') || norm === 'kh') return 'Khoa học';
    if (norm.includes('lich su') || norm.includes('dia li') || norm.includes('lsdl') || norm.includes('ls&dl')) return 'Lịch sử và Địa lí';
    if (norm.includes('dao duc') || norm === 'dd') return 'Đạo đức';
    if (norm.includes('cong nghe') || norm === 'cn') return 'Công nghệ';
    if (norm.includes('trai nghiem') || norm.includes('hdtn')) return 'Hoạt động trải nghiệm';
    if (norm.includes('tin hoc') || norm === 'tin') return 'Tin học';
    if (norm.includes('am nhac')) return 'Âm nhạc';
    if (norm.includes('mi thuat') || norm.includes('my thuat')) return 'Mĩ thuật';
    if (norm.includes('the duc') || norm.includes('gdtc') || norm.includes('the chat')) return 'Giáo dục thể chất';
    if (norm.includes('tieng anh') || norm.includes('english')) return 'Tiếng Anh';

    return raw;
}

function extractWeekNumber(filename) {
    const patterns = [
        /(?:tu[aàầáảãạ]n|tuan|week|w|t)[\s_\-\.]*0*([1-9]|[1-3][0-5])\b/i,
        /[_\-\.](0*[1-9]|[1-3][0-5])[_\-\.]/,
        /\b(?:0*([1-9]|[1-3][0-5]))\.(?:docx|doc)$/i
    ];

    for (const p of patterns) {
        const m = filename.match(p);
        if (m && m[1]) {
            const w = parseInt(m[1], 10);
            if (w >= 1 && w <= 35) return w;
        }
    }

    const fallbackMatch = filename.match(/\b0*([1-9]|[1-3][0-5])\b/);
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

    if (subdirs.length > 0) {
        for (const dir of subdirs) {
            const folderName = dir.name;
            const canon = canonicalSubject(folderName);
            const fullDir = path.join(rootPath, folderName);

            let subjectEntry = subjectsMap.get(canon);
            if (!subjectEntry) {
                subjectEntry = {
                    name: canon,
                    originalNames: [folderName],
                    folderPath: fullDir,
                    filesByWeek: {}
                };
                subjectsMap.set(canon, subjectEntry);
            } else {
                subjectEntry.originalNames.push(folderName);
            }

            const files = fs.readdirSync(fullDir);
            for (const f of files) {
                if (f.startsWith('~$')) continue;
                const ext = path.extname(f).toLowerCase();
                if (ext !== '.docx' && ext !== '.doc') continue;

                const week = extractWeekNumber(f);
                if (week) {
                    const filePath = path.join(fullDir, f);
                    subjectEntry.filesByWeek[week] = filePath;
                    weeksMap[week].files[canon] = filePath;
                }
            }
        }
    } else {
        const files = entries.filter(e => e.isFile());
        for (const fileEnt of files) {
            const f = fileEnt.name;
            if (f.startsWith('~$')) continue;
            const ext = path.extname(f).toLowerCase();
            if (ext !== '.docx' && ext !== '.doc') continue;

            const canon = canonicalSubject(f);
            let subjectEntry = subjectsMap.get(canon);
            if (!subjectEntry) {
                subjectEntry = {
                    name: canon,
                    originalNames: [canon],
                    folderPath: rootPath,
                    filesByWeek: {}
                };
                subjectsMap.set(canon, subjectEntry);
            }

            const week = extractWeekNumber(f);
            if (week) {
                const filePath = path.join(rootPath, f);
                subjectEntry.filesByWeek[week] = filePath;
                weeksMap[week].files[canon] = filePath;
            }
        }
    }

    const subjectList = Array.from(subjectsMap.values()).map(s => ({
        name: s.name,
        totalFiles: Object.keys(s.filesByWeek).length,
        originalNames: s.originalNames
    }));

    const DEFAULT_PRIORITY = [
        'Tiếng Việt', 'Toán', 'Đạo đức', 'Khoa học', 'Lịch sử và Địa lí',
        'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh',
        'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất'
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
    extractWeekNumber,
    scanFolder
};
document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // State Store
    // ==========================================================================
    const state = {
        currentMode: 'giaoan', // 'giaoan' | 'freemerge'
        exportMode: 'per-week', // 'per-week' | 'bundle'
        bundleSigPos: 'last',   // 'last' | 'each'
        sigLayout: '3col',     // '1col' | '2col' | '3col'
        coverConfig: null,     // Dynamic Cover Configuration
        filesMap: new Map(), // key: relativePath or filename, value: { file, name, subject, week }
        subjectsList: [],   // [ { name, enabled, count } ]
        weeksMap: {},       // { 1..35: { files: { [subject]: File }, count, status, missing } }
        selectedWeeks: new Set(),
        mergedResults: {},   // { [fileName]: Uint8Array }
        freeFiles: [],       // [ { id, file, name, size } ]
        freeMergedResult: null,
        freeMergedFileName: ''
    };

    const escapeXml = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const escapeHtml = s => (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // ==========================================================================
    // Canonical Subjects & Week Extraction
    // ==========================================================================
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
        const fallback = filename.match(/\b0*([12]\d|3[0-5]|[1-9])\b/);
        if (fallback) {
            const w = parseInt(fallback[1], 10);
            if (w >= 1 && w <= 35) return w;
        }
        return null;
    }

    // ==========================================================================
    // DOM Elements
    // ==========================================================================
    // Mode Switcher Elements
    const btnModeGiaoAn = document.getElementById('btn-mode-giaoan');
    const btnModeFreeMerge = document.getElementById('btn-mode-freemerge');
    const viewModeGiaoAn = document.getElementById('view-mode-giaoan');
    const viewModeFreeMerge = document.getElementById('view-mode-freemerge');
    const freeFileCountBadge = document.getElementById('free-file-count-badge');

    // Free Merge Elements
    const freeUploadHero = document.getElementById('free-upload-hero');
    const inputFreeFiles = document.getElementById('input-free-files');
    const inputFreeFolder = document.getElementById('input-free-folder');
    const inputFreeAddMore = document.getElementById('input-free-add-more');
    const btnFreePickFiles = document.getElementById('btn-free-pick-files');
    const btnFreePickFolder = document.getElementById('btn-free-pick-folder');
    const btnFreeAddMore = document.getElementById('btn-free-add-more');
    const btnFreeClearAll = document.getElementById('btn-free-clear-all');
    const freeQueueSection = document.getElementById('free-queue-section');
    const statFreeCount = document.getElementById('stat-free-count');
    const statFreeSize = document.getElementById('stat-free-size');
    const btnFreeSortAz = document.getElementById('btn-free-sort-az');
    const btnFreeSortZa = document.getElementById('btn-free-sort-za');
    const btnFreeReverse = document.getElementById('btn-free-reverse');
    const freeDocList = document.getElementById('free-doc-list');

    const freeSettingsSection = document.getElementById('free-settings-section');
    const inputFreeOutputName = document.getElementById('input-free-output-name');
    const previewFreeFilename = document.getElementById('preview-free-filename');
    const btnFreeChips = document.querySelectorAll('.btn-free-chip');
    const chkFreePageBreak = document.getElementById('chk-free-page-break');
    const chkFreeContinuousPage = document.getElementById('chk-free-continuous-page');
    const chkFreeAutoCompress = document.getElementById('chk-free-auto-compress');
    const selectFreeCompressMode = document.getElementById('select-free-compress-mode');
    const chkFreeEnableSig = document.getElementById('chk-free-enable-sig');
    const btnFreeSaveSettings = document.getElementById('btn-free-save-settings');
    const freeSaveMsgToast = document.getElementById('free-save-msg-toast');
    const freeSigFormWrapper = document.getElementById('free-sig-form-wrapper');
    const freeSigPlaceDate = document.getElementById('free-sig-place-date');
    const freeSigBghRole = document.getElementById('free-sig-bgh-role');
    const freeSigBghName = document.getElementById('free-sig-bgh-name');
    const freeSigTtRole = document.getElementById('free-sig-tt-role');
    const freeSigTtName = document.getElementById('free-sig-tt-name');
    const freeSigGvRole = document.getElementById('free-sig-gv-role');
    const freeSigGvName = document.getElementById('free-sig-gv-name');

    const freeExecutionSection = document.getElementById('free-execution-section');
    const btnFreeStartMerge = document.getElementById('btn-free-start-merge');
    const freeProgressBarFill = document.getElementById('free-progress-bar-fill');
    const freeProgressStatusMsg = document.getElementById('free-progress-status-msg');
    const freeProgressPercentVal = document.getElementById('free-progress-percent-val');
    const freeLogConsole = document.getElementById('free-log-console');
    const btnFreeClearLog = document.getElementById('btn-free-clear-log');
    const freeCompletionBanner = document.getElementById('free-completion-banner');
    const freeCompletionDesc = document.getElementById('free-completion-desc');
    const btnFreeDownload = document.getElementById('btn-free-download');
    const btnFreeSaveFolder = document.getElementById('btn-free-save-folder');

    const navTabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const tabFileCountBadge = document.getElementById('tab-file-count-badge');

    const uploadHeroZone = document.getElementById('upload-hero-zone');
    const inputFolderPicker = document.getElementById('input-folder-picker');
    const inputFilesPicker = document.getElementById('input-files-picker');
    const inputAddMore = document.getElementById('input-add-more');
    const btnTopReset = document.getElementById('btn-top-reset');
    const btnTopGuide = document.getElementById('btn-top-guide');
    const modalGuideOverlay = document.getElementById('modal-guide-overlay');
    const btnCloseGuideModal = document.getElementById('btn-close-guide-modal');
    const btnConfirmGuideModal = document.getElementById('btn-confirm-guide-modal');

    const fullscreenDragOverlay = document.getElementById('fullscreen-drag-overlay');
    const scanningModal = document.getElementById('scanning-modal');
    const scanningTitle = document.getElementById('scanning-title');
    const scanningDesc = document.getElementById('scanning-desc');
    const toastBar = document.getElementById('toast-bar');
    const toastMsg = document.getElementById('toast-msg');

    const sequenceFlowBox = document.getElementById('sequence-flow-box');
    const sequenceFlowPills = document.getElementById('sequence-flow-pills');

    const dataSummaryBar = document.getElementById('data-summary-bar');
    const statTotalFiles = document.getElementById('stat-total-files');
    const statTotalSubjects = document.getElementById('stat-total-subjects');
    const statTotalWeeks = document.getElementById('stat-total-weeks');
    const btnNextToSettings = document.getElementById('btn-next-to-settings');

    const workspaceGrid = document.getElementById('workspace-grid');
    const subjectListContainer = document.getElementById('subject-list-container');
    const inputNewSubject = document.getElementById('input-new-subject');
    const btnAddSubject = document.getElementById('btn-add-subject');
    const presetTvFirst = document.getElementById('preset-tv-first');
    const presetToanFirst = document.getElementById('preset-toan-first');
    const presetAlpha = document.getElementById('preset-alpha');

    const weeksMatrixContainer = document.getElementById('weeks-matrix-container');
    const btnMatrixAll = document.getElementById('btn-matrix-all');
    const btnMatrixFull = document.getElementById('btn-matrix-full');
    const btnMatrixHk1 = document.getElementById('btn-matrix-hk1');
    const btnMatrixHk2 = document.getElementById('btn-matrix-hk2');
    const btnMatrixNone = document.getElementById('btn-matrix-none');
    const barSelectedWeeksCount = document.getElementById('bar-selected-weeks-count');

    // V3 Export Mode Elements
    const cardModePerWeek = document.getElementById('card-mode-per-week');
    const cardModeBundle = document.getElementById('card-mode-bundle');
    const modeExportPerWeek = document.getElementById('mode-export-per-week');
    const modeExportBundle = document.getElementById('mode-export-bundle');
    const bundleSettingsWrapper = document.getElementById('bundle-settings-wrapper');
    const singleWeekNamingCard = document.getElementById('single-week-naming-card');
    const inputBundleTenGv = document.getElementById('input-bundle-tengv');
    const inputBundlePattern = document.getElementById('input-bundle-pattern');
    const inputBundleLop = document.getElementById('input-bundle-lop');
    const previewBundleFilenameText = document.getElementById('preview-bundle-filename-text');
    const btnBundleTagChips = document.querySelectorAll('.btn-bundle-tag-chip');
    const radBundleSigLast = document.getElementById('rad-bundle-sig-last');
    const radBundleSigEach = document.getElementById('rad-bundle-sig-each');

    // Single Week Naming Elements
    const inputTenGv = document.getElementById('input-tengv');
    const inputNamingPattern = document.getElementById('input-naming-pattern');
    const inputLopName = document.getElementById('input-lop-name');
    const previewFilenameText = document.getElementById('preview-filename-text');
    const btnTagChips = document.querySelectorAll('.btn-tag-chip');

    // V3 Cover Page Elements (Tab 2)
    const chkEnableCover = document.getElementById('chk-enable-cover');
    const coverFormWrapper = document.getElementById('cover-form-wrapper');
    const btnSaveCover = document.getElementById('btn-save-cover');
    const saveCoverMsgToast = document.getElementById('save-cover-msg-toast');

    // Dynamic Cover Builder Containers & Action Buttons (Tab 2)
    const coverFieldsContainerTab2 = document.getElementById('cover-fields-container-tab2');
    const btnAddCoverLineTab2 = document.getElementById('btn-add-cover-line-tab2');
    const btnResetCoverTab2 = document.getElementById('btn-reset-cover-tab2');

    // Cover Page Miniature Preview Elements (Tab 2)
    const coverPrevParentVal = document.getElementById('cover-prev-parent-val');
    const coverPrevSchoolVal = document.getElementById('cover-prev-school-val');
    const coverPrevSepVal = document.getElementById('cover-prev-sep-val');
    const coverPrevTitleVal = document.getElementById('cover-prev-title-val');
    const coverPrevSubtitleVal = document.getElementById('cover-prev-subtitle-val');
    const coverPrevDecoVal = document.getElementById('cover-prev-deco-val');
    const coverPrevInfoList = document.getElementById('cover-prev-info-list');
    const coverPrevBottomVal = document.getElementById('cover-prev-bottom-val');

    // V3 Quick Cover Buttons & Modal Elements
    const btnQuickCover = document.getElementById('btn-quick-cover');
    const btnFreeQuickCover = document.getElementById('btn-free-quick-cover');
    const chkFreeEnableCover = document.getElementById('chk-free-enable-cover');
    const modalCoverOverlay = document.getElementById('modal-cover-overlay');
    const btnCloseCoverModal = document.getElementById('btn-close-cover-modal');
    const btnCancelCoverModal = document.getElementById('btn-cancel-cover-modal');
    const btnConfirmCoverModal = document.getElementById('btn-confirm-cover-modal');
    const modalChkEnableCover = document.getElementById('modal-chk-enable-cover');

    // Dynamic Cover Builder Containers & Action Buttons (Modal)
    const coverFieldsContainerModal = document.getElementById('cover-fields-container-modal');
    const btnAddCoverLineModal = document.getElementById('btn-add-cover-line-modal');
    const btnResetCoverModal = document.getElementById('btn-reset-cover-modal');

    // Modal Preview Elements
    const modalCoverPrevParentVal = document.getElementById('modal-cover-prev-parent-val');
    const modalCoverPrevSchoolVal = document.getElementById('modal-cover-prev-school-val');
    const modalCoverPrevSepVal = document.getElementById('modal-cover-prev-sep-val');
    const modalCoverPrevTitleVal = document.getElementById('modal-cover-prev-title-val');
    const modalCoverPrevSubtitleVal = document.getElementById('modal-cover-prev-subtitle-val');
    const modalCoverPrevDecoVal = document.getElementById('modal-cover-prev-deco-val');
    const modalCoverPrevInfoList = document.getElementById('modal-cover-prev-info-list');
    const modalCoverPrevBottomVal = document.getElementById('modal-cover-prev-bottom-val');

    const chkPageBreak = document.getElementById('chk-page-break');
    const chkContinuousPage = document.getElementById('chk-continuous-page');
    const chkAutoCompress = document.getElementById('chk-auto-compress');
    const selectCompressMode = document.getElementById('select-compress-mode');
    const chkEnableSignature = document.getElementById('chk-enable-signature');
    const sigFormWrapper = document.getElementById('sig-form-wrapper');
    const sigPlaceDate = document.getElementById('sig-place-date');
    const sigBghRole = document.getElementById('sig-bgh-role');
    const sigBghName = document.getElementById('sig-bgh-name');
    const sigTtRole = document.getElementById('sig-tt-role');
    const sigTtName = document.getElementById('sig-tt-name');
    const sigGvRole = document.getElementById('sig-gv-role');
    const sigGvName = document.getElementById('sig-gv-name');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const saveMsgToast = document.getElementById('save-msg-toast');

    const btnStartMerge = document.getElementById('btn-start-merge');
    const btnStartMergeBottom = document.getElementById('btn-start-merge-bottom');
    const btnNextToProcess = document.getElementById('btn-next-to-process');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressStatusMsg = document.getElementById('progress-status-msg');
    const progressPercentVal = document.getElementById('progress-percent-val');
    const executionLogConsole = document.getElementById('execution-log-console');
    const btnClearLog = document.getElementById('btn-clear-log');
    const completionBannerBox = document.getElementById('completion-banner-box');
    const completionDescText = document.getElementById('completion-desc-text');
    const btnExportZip = document.getElementById('btn-export-zip');
    const btnExportFolder = document.getElementById('btn-export-folder');
    const btnExportSingleDocx = document.getElementById('btn-export-single-docx');
    const btnExportSingleLabel = document.getElementById('btn-export-single-label');

    const modalSubjectDetails = document.getElementById('modal-subject-details');
    const modalDetailsTitle = document.getElementById('modal-details-title');
    const modalListPresent = document.getElementById('modal-list-present');
    const modalListMissing = document.getElementById('modal-list-missing');
    const btnCloseDetailsModal = document.getElementById('btn-close-details-modal');
    const btnConfirmDetailsModal = document.getElementById('btn-confirm-details-modal');

    // ==========================================================================
    // Navigation & Tabs
    // ==========================================================================
    function switchTab(tabId) {
        navTabButtons.forEach(btn => {
            const match = btn.getAttribute('data-tab') === tabId;
            btn.classList.toggle('active', match);
        });
        tabPanels.forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== tabId);
        });
    }

    navTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-tab'));
        });
    });

    if (btnNextToSettings) btnNextToSettings.addEventListener('click', () => switchTab('tab-settings'));
    if (btnNextToProcess) btnNextToProcess.addEventListener('click', () => switchTab('tab-process'));

    // Mode Switcher (Ghép Giáo Án vs Ghép Tự Do)
    function switchMode(mode) {
        state.currentMode = mode;
        if (mode === 'giaoan') {
            if (btnModeGiaoAn) btnModeGiaoAn.classList.add('active');
            if (btnModeFreeMerge) btnModeFreeMerge.classList.remove('active');
            if (viewModeGiaoAn) viewModeGiaoAn.classList.remove('hidden');
            if (viewModeFreeMerge) viewModeFreeMerge.classList.add('hidden');
        } else {
            if (btnModeFreeMerge) btnModeFreeMerge.classList.add('active');
            if (btnModeGiaoAn) btnModeGiaoAn.classList.remove('active');
            if (viewModeFreeMerge) viewModeFreeMerge.classList.remove('hidden');
            if (viewModeGiaoAn) viewModeGiaoAn.classList.add('hidden');
            renderFreeQueue();
        }
    }

    if (btnModeGiaoAn) btnModeGiaoAn.addEventListener('click', () => switchMode('giaoan'));
    if (btnModeFreeMerge) btnModeFreeMerge.addEventListener('click', () => switchMode('freemerge'));

    // ==========================================================================
    // Logging Console & Toast Notifications
    // ==========================================================================
    function appendLog(msg, type = 'info') {
        const time = new Date().toLocaleTimeString('vi-VN');
        const div = document.createElement('div');
        div.className = `log-line ${type}`;
        div.textContent = `[${time}] ${msg}`;
        executionLogConsole.appendChild(div);
        executionLogConsole.scrollTop = executionLogConsole.scrollHeight;
    }

    let toastTimer = null;
    function showToast(msg, type = 'success') {
        if (!toastBar || !toastMsg) return;
        const toastIcon = document.getElementById('toast-icon');
        if (toastIcon) {
            toastIcon.textContent = type === 'warn' ? '⚠' : (type === 'error' ? '✕' : '✓');
        }
        toastMsg.textContent = msg;
        toastBar.classList.remove('hidden');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastBar.classList.add('hidden');
        }, 4000);
    }

    // ==========================================================================
    // Load & Save Settings (localStorage)
    // ==========================================================================
    function setSigLayout(layout) {
        if (!['1col', '2col', '3col'].includes(layout)) layout = '3col';
        state.sigLayout = layout;

        // Cập nhật trạng thái active cho các nút chọn số cột
        document.querySelectorAll('.btn-sig-layout').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-layout') === layout);
        });
        document.querySelectorAll('.btn-free-sig-layout').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-layout') === layout);
        });

        // Cập nhật class grid
        const grids = [
            document.getElementById('sig-block-grid'),
            document.getElementById('free-sig-block-grid')
        ];
        grids.forEach(grid => {
            if (!grid) return;
            grid.classList.remove('layout-1col', 'layout-2col', 'layout-3col');
            grid.classList.add(`layout-${layout}`);
        });

        // Cập nhật hiển thị cột và nhãn
        const bghCols = [document.getElementById('col-sig-bgh'), document.getElementById('col-free-sig-bgh')];
        const ttCols = [document.getElementById('col-sig-tt'), document.getElementById('col-free-sig-tt')];
        const gvCols = [document.getElementById('col-sig-gv'), document.getElementById('col-free-sig-gv')];

        const dateLabels = [document.getElementById('lbl-sig-place-date'), document.getElementById('lbl-free-sig-place-date')];
        const ttHeaders = [document.getElementById('header-sig-tt'), document.getElementById('header-free-sig-tt')];
        const gvHeaders = [document.getElementById('header-sig-gv'), document.getElementById('header-free-sig-gv')];

        if (layout === '1col') {
            bghCols.forEach(col => col && col.classList.add('hidden'));
            ttCols.forEach(col => col && col.classList.add('hidden'));
            gvCols.forEach(col => col && col.classList.remove('hidden'));

            dateLabels.forEach(lbl => lbl && (lbl.textContent = 'Dòng địa danh & ngày tháng (Hiển thị phía trên chữ ký):'));
            gvHeaders.forEach(hdr => hdr && (hdr.textContent = 'Người ký: Giáo Viên (Bên phải)'));
        } else if (layout === '2col') {
            bghCols.forEach(col => col && col.classList.add('hidden'));
            ttCols.forEach(col => col && col.classList.remove('hidden'));
            gvCols.forEach(col => col && col.classList.remove('hidden'));

            dateLabels.forEach(lbl => lbl && (lbl.textContent = 'Dòng địa danh & ngày tháng (Hiển thị phía trên cột Giáo viên):'));
            ttHeaders.forEach(hdr => hdr && (hdr.textContent = '1. Cột Trái: Tổ Trưởng'));
            gvHeaders.forEach(hdr => hdr && (hdr.textContent = '2. Cột Phải: Giáo Viên'));
        } else { // '3col'
            bghCols.forEach(col => col && col.classList.remove('hidden'));
            ttCols.forEach(col => col && col.classList.remove('hidden'));
            gvCols.forEach(col => col && col.classList.remove('hidden'));

            dateLabels.forEach(lbl => lbl && (lbl.textContent = 'Dòng địa danh & ngày tháng (Hiển thị phía trên cột Giáo viên):'));
            ttHeaders.forEach(hdr => hdr && (hdr.textContent = '2. Cột Giữa: Tổ Trưởng'));
            gvHeaders.forEach(hdr => hdr && (hdr.textContent = '3. Cột Phải: Giáo Viên'));
        }

        renderSequenceFlow();
    }

    // Gắn sự kiện click cho các nút chuyển đổi số cột chữ ký
    document.querySelectorAll('.btn-sig-layout').forEach(btn => {
        btn.addEventListener('click', () => {
            setSigLayout(btn.getAttribute('data-layout'));
        });
    });
    document.querySelectorAll('.btn-free-sig-layout').forEach(btn => {
        btn.addEventListener('click', () => {
            setSigLayout(btn.getAttribute('data-layout'));
        });
    });

    // ==========================================================================
    // V3 Export Mode & Bundle Naming Logic
    // ==========================================================================
    function setExportMode(mode) {
        state.exportMode = mode;
        if (cardModePerWeek) cardModePerWeek.classList.toggle('active', mode === 'per-week');
        if (cardModeBundle) cardModeBundle.classList.toggle('active', mode === 'bundle');
        if (modeExportPerWeek) modeExportPerWeek.checked = (mode === 'per-week');
        if (modeExportBundle) modeExportBundle.checked = (mode === 'bundle');

        if (bundleSettingsWrapper) bundleSettingsWrapper.classList.toggle('hidden', mode !== 'bundle');
        if (singleWeekNamingCard) singleWeekNamingCard.classList.toggle('hidden', mode === 'bundle');

        updateBundleNamingPreview();
    }

    if (cardModePerWeek) {
        cardModePerWeek.addEventListener('click', () => setExportMode('per-week'));
    }
    if (cardModeBundle) {
        cardModeBundle.addEventListener('click', () => setExportMode('bundle'));
    }
    if (modeExportPerWeek) {
        modeExportPerWeek.addEventListener('change', () => setExportMode('per-week'));
    }
    if (modeExportBundle) {
        modeExportBundle.addEventListener('change', () => setExportMode('bundle'));
    }

    function updateBundleNamingPreview() {
        if (!previewBundleFilenameText || !inputBundlePattern) return;
        const pattern = inputBundlePattern.value.trim() || '{tengv}_KHBD_Tuan_{startWeek}_den_{endWeek}_Lop_{lop}.docx';
        const tengv = (inputBundleTenGv ? inputBundleTenGv.value.trim() : '') || 'Chau';
        const lop = (inputBundleLop ? inputBundleLop.value.trim() : '') || '5';

        const weeksArray = Array.from(state.selectedWeeks).sort((a, b) => a - b);
        let startW = '01';
        let endW = '04';
        if (weeksArray.length > 0) {
            const minW = weeksArray[0];
            const maxW = weeksArray[weeksArray.length - 1];
            startW = minW < 10 ? '0' + minW : String(minW);
            endW = maxW < 10 ? '0' + maxW : String(maxW);
        }

        let preview = pattern
            .replace(/\{tengv\}/gi, tengv)
            .replace(/\{startWeek\}/g, startW)
            .replace(/\{endWeek\}/g, endW)
            .replace(/\{lop\}/g, lop);
        if (!preview.toLowerCase().endsWith('.docx')) preview += '.docx';
        previewBundleFilenameText.textContent = preview;
    }

    if (inputBundleTenGv) inputBundleTenGv.addEventListener('input', updateBundleNamingPreview);
    if (inputBundlePattern) inputBundlePattern.addEventListener('input', updateBundleNamingPreview);
    if (inputBundleLop) inputBundleLop.addEventListener('input', updateBundleNamingPreview);

    btnBundleTagChips.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            if (!inputBundlePattern) return;
            const pos = inputBundlePattern.selectionStart || inputBundlePattern.value.length;
            const val = inputBundlePattern.value;
            inputBundlePattern.value = val.slice(0, pos) + tag + val.slice(pos);
            inputBundlePattern.focus();
            updateBundleNamingPreview();
        });
    });

    if (radBundleSigLast) {
        radBundleSigLast.addEventListener('change', () => {
            if (radBundleSigLast.checked) state.bundleSigPos = 'last';
        });
    }
    if (radBundleSigEach) {
        radBundleSigEach.addEventListener('change', () => {
            if (radBundleSigEach.checked) state.bundleSigPos = 'each';
        });
    }

    // ==========================================================================
    // V3 Cover Page Logic & Dynamic Builder (Ẩn/Hiện, Thêm, Sửa, Xóa + Auto-sync)
    // ==========================================================================
    const STANDARD_COVER_FIELDS = [
        { key: 'parentOrg', hasLabel: false },
        { key: 'schoolName', hasLabel: false },
        { key: 'title', hasLabel: false },
        { key: 'subtitle', hasLabel: false },
        { key: 'teacher', hasLabel: true },
        { key: 'className', hasLabel: true },
        { key: 'schoolYear', hasLabel: true },
        { key: 'bottomLocation', hasLabel: false }
    ];

    function createDefaultCoverConfig() {
        return {
            parentOrg: {
                enabled: true,
                title: 'Cơ quan cấp trên / UBND Phường',
                value: 'ỦY BAN NHÂN DÂN PHƯỜNG TRUNG NHỨT',
                placeholder: 'ỦY BAN NHÂN DÂN PHƯỜNG TRUNG NHỨT'
            },
            schoolName: {
                enabled: true,
                title: 'Tên trường Tiểu học',
                value: 'TRƯỜNG TIỂU HỌC TRUNG NHỨT',
                placeholder: 'TRƯỜNG TIỂU HỌC TRUNG NHỨT'
            },
            title: {
                enabled: true,
                title: 'Tên của bìa (Tiêu đề chính)',
                value: 'KẾ HOẠCH BÀI DẠY',
                placeholder: 'KẾ HOẠCH BÀI DẠY'
            },
            subtitle: {
                enabled: true,
                title: 'Tiêu đề phụ / Lớp môn (nếu có)',
                value: 'LỚP 5A2',
                placeholder: 'LỚP 5A2'
            },
            teacher: {
                enabled: true,
                title: 'Họ và tên Giáo viên',
                label: 'Giáo viên:',
                value: 'Phan Thái Châu',
                placeholder: 'Phan Thái Châu'
            },
            className: {
                enabled: true,
                title: 'Lớp học',
                label: 'Lớp:',
                value: '5A2',
                placeholder: '5A2'
            },
            schoolYear: {
                enabled: true,
                title: 'Năm học',
                label: 'Năm học:',
                value: '2026 - 2027',
                placeholder: '2026 - 2027'
            },
            bottomLocation: {
                enabled: true,
                title: 'Dòng địa danh / năm chân trang bìa',
                value: 'NĂM HỌC 2026 - 2027',
                placeholder: 'NĂM HỌC 2026 - 2027'
            },
            customLines: []
        };
    }

    // Initialize default coverConfig in state
    state.coverConfig = createDefaultCoverConfig();

    function getCoverInfo() {
        const isEnabled = (chkEnableCover ? chkEnableCover.checked : true);
        const cfg = state.coverConfig || createDefaultCoverConfig();
        return {
            enabled: isEnabled,
            ...cfg,
            // Backward-compatible properties for loggers and legacy callers
            title: (typeof cfg.title === 'object' ? cfg.title.value : cfg.title) || 'KẾ HOẠCH BÀI DẠY',
            subTitle: (typeof cfg.subtitle === 'object' ? cfg.subtitle.value : cfg.subtitle) || '',
            teacherName: (typeof cfg.teacher === 'object' ? cfg.teacher.value : cfg.teacherName) || '',
            classNameVal: (typeof cfg.className === 'object' ? cfg.className.value : cfg.className) || '',
            schoolYearVal: (typeof cfg.schoolYear === 'object' ? cfg.schoolYear.value : cfg.schoolYear) || '',
            bottomLocationVal: (typeof cfg.bottomLocation === 'object' ? cfg.bottomLocation.value : cfg.bottomLocation) || ''
        };
    }

    function renderCoverBuilder(container, isModal) {
        if (!container) return;
        const cfg = state.coverConfig || createDefaultCoverConfig();

        let html = '';

        // Standard 8 Fields
        STANDARD_COVER_FIELDS.forEach(itemMeta => {
            const key = itemMeta.key;
            const item = cfg[key];
            if (!item) return;
            const isEnabled = item.enabled !== false;

            if (itemMeta.hasLabel) {
                html += `
                <div class="cover-field-card ${isEnabled ? '' : 'is-disabled'}" data-key="${key}">
                    <div class="cover-field-header">
                        <label class="cover-field-toggle-label">
                            <input type="checkbox" class="cover-field-toggle-chk" data-key="${key}" ${isEnabled ? 'checked' : ''}>
                            <span class="cover-field-name">${escapeHtml(item.title)}</span>
                        </label>
                        <div class="cover-field-actions">
                            <span class="cover-field-status ${isEnabled ? 'status-on' : 'status-off'}">${isEnabled ? 'Đang hiện' : 'Đã ẩn'}</span>
                            <button type="button" class="btn-field-del" data-action="delete" data-key="${key}" title="Xóa nội dung / Ẩn dòng này">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="cover-field-body cover-field-body-dual">
                        <input type="text" class="form-input cover-label-input" data-key="${key}" data-type="label" value="${escapeHtml(item.label || '')}" placeholder="Nhãn (VD: Lớp:)" title="Tiền tố / Nhãn hiển thị" ${isEnabled ? '' : 'disabled'}>
                        <input type="text" class="form-input cover-value-input" data-key="${key}" data-type="value" value="${escapeHtml(item.value || '')}" placeholder="${escapeHtml(item.placeholder || '')}" title="Giá trị nội dung" ${isEnabled ? '' : 'disabled'}>
                    </div>
                </div>`;
            } else {
                html += `
                <div class="cover-field-card ${isEnabled ? '' : 'is-disabled'}" data-key="${key}">
                    <div class="cover-field-header">
                        <label class="cover-field-toggle-label">
                            <input type="checkbox" class="cover-field-toggle-chk" data-key="${key}" ${isEnabled ? 'checked' : ''}>
                            <span class="cover-field-name">${escapeHtml(item.title)}</span>
                        </label>
                        <div class="cover-field-actions">
                            <span class="cover-field-status ${isEnabled ? 'status-on' : 'status-off'}">${isEnabled ? 'Đang hiện' : 'Đã ẩn'}</span>
                            <button type="button" class="btn-field-del" data-action="delete" data-key="${key}" title="Xóa nội dung / Ẩn dòng này">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="cover-field-body">
                        <input type="text" class="form-input cover-field-input" data-key="${key}" data-type="value" value="${escapeHtml(item.value || '')}" placeholder="${escapeHtml(item.placeholder || '')}" ${isEnabled ? '' : 'disabled'}>
                    </div>
                </div>`;
            }
        });

        // Custom Lines
        if (Array.isArray(cfg.customLines)) {
            cfg.customLines.forEach((customItem, idx) => {
                const isEnabled = customItem.enabled !== false;
                const cKey = customItem.id || `cust_${idx}`;
                html += `
                <div class="cover-field-card ${isEnabled ? '' : 'is-disabled'}" data-key="${cKey}" data-custom="true">
                    <div class="cover-field-header">
                        <label class="cover-field-toggle-label">
                            <input type="checkbox" class="cover-field-toggle-chk" data-key="${cKey}" data-custom="true" ${isEnabled ? 'checked' : ''}>
                            <span class="cover-field-name">${escapeHtml(customItem.title || 'Dòng thông tin tự chọn #' + (idx + 1))}</span>
                        </label>
                        <div class="cover-field-actions">
                            <span class="cover-field-status ${isEnabled ? 'status-on' : 'status-off'}">${isEnabled ? 'Đang hiện' : 'Đã ẩn'}</span>
                            <button type="button" class="btn-field-del" data-action="delete" data-key="${cKey}" data-custom="true" title="Xóa hoàn toàn dòng này">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="cover-field-body cover-field-body-dual">
                        <input type="text" class="form-input cover-label-input" data-key="${cKey}" data-custom="true" data-type="label" value="${escapeHtml(customItem.label || '')}" placeholder="Nhãn (VD: Tổ:)" title="Tiền tố / Nhãn hiển thị" ${isEnabled ? '' : 'disabled'}>
                        <input type="text" class="form-input cover-value-input" data-key="${cKey}" data-custom="true" data-type="value" value="${escapeHtml(customItem.value || '')}" placeholder="Nội dung thông tin..." title="Giá trị nội dung" ${isEnabled ? '' : 'disabled'}>
                    </div>
                </div>`;
            });
        }

        container.innerHTML = html;
    }

    function refreshAllCoverBuilders() {
        renderCoverBuilder(coverFieldsContainerTab2, false);
        renderCoverBuilder(coverFieldsContainerModal, true);
    }

    function attachCoverBuilderListeners(container) {
        if (!container) return;

        // Real-time typing sync & auto-save
        container.addEventListener('input', (e) => {
            const input = e.target;
            const key = input.getAttribute('data-key');
            const type = input.getAttribute('data-type');
            const isCustom = input.getAttribute('data-custom') === 'true';
            if (!key || !type) return;

            const val = input.value;

            if (isCustom) {
                const item = state.coverConfig.customLines.find(x => x.id === key);
                if (item) {
                    if (type === 'value') item.value = val;
                    else if (type === 'label') item.label = val;
                }
            } else {
                const item = state.coverConfig[key];
                if (item) {
                    if (type === 'value') item.value = val;
                    else if (type === 'label') item.label = val;
                }
            }

            // Mirror directly to the sibling container without re-rendering to keep keyboard focus!
            const siblingContainer = (container === coverFieldsContainerTab2) ? coverFieldsContainerModal : coverFieldsContainerTab2;
            if (siblingContainer) {
                const siblingInput = siblingContainer.querySelector(`[data-key="${key}"][data-type="${type}"]`);
                if (siblingInput && siblingInput.value !== val) {
                    siblingInput.value = val;
                }
            }

            updateCoverPreview();
            saveCoverSettingsToStorage();
        });

        // Show/Hide toggle checkbox
        container.addEventListener('change', (e) => {
            if (!e.target.classList.contains('cover-field-toggle-chk')) return;
            const chk = e.target;
            const key = chk.getAttribute('data-key');
            const isCustom = chk.getAttribute('data-custom') === 'true';
            const checked = chk.checked;

            if (isCustom) {
                const item = state.coverConfig.customLines.find(x => x.id === key);
                if (item) item.enabled = checked;
            } else {
                const item = state.coverConfig[key];
                if (item) item.enabled = checked;
            }

            refreshAllCoverBuilders();
            updateCoverPreview();
            saveCoverSettingsToStorage();
            renderSequenceFlow();
        });

        // Delete / Clear button
        container.addEventListener('click', (e) => {
            const delBtn = e.target.closest('[data-action="delete"]');
            if (!delBtn) return;
            const key = delBtn.getAttribute('data-key');
            const isCustom = delBtn.getAttribute('data-custom') === 'true';

            if (isCustom) {
                state.coverConfig.customLines = state.coverConfig.customLines.filter(x => x.id !== key);
                showToast('✓ Đã xóa dòng thông tin tùy chỉnh!', 'success');
            } else {
                const item = state.coverConfig[key];
                if (item) {
                    item.value = '';
                    item.enabled = false;
                }
                showToast('✓ Đã xóa nội dung và ẩn dòng này!', 'success');
            }

            refreshAllCoverBuilders();
            updateCoverPreview();
            saveCoverSettingsToStorage();
            renderSequenceFlow();
        });
    }

    attachCoverBuilderListeners(coverFieldsContainerTab2);
    attachCoverBuilderListeners(coverFieldsContainerModal);

    function addCustomCoverLine() {
        if (!state.coverConfig) state.coverConfig = createDefaultCoverConfig();
        if (!Array.isArray(state.coverConfig.customLines)) state.coverConfig.customLines = [];

        const newId = 'cust_' + Date.now();
        const count = state.coverConfig.customLines.length + 1;
        state.coverConfig.customLines.push({
            id: newId,
            enabled: true,
            title: `Dòng bổ sung #${count}`,
            label: 'Thông tin:',
            value: ''
        });

        refreshAllCoverBuilders();
        updateCoverPreview();
        saveCoverSettingsToStorage();

        setTimeout(() => {
            const activeContainer = (modalCoverOverlay && !modalCoverOverlay.classList.contains('hidden'))
                ? coverFieldsContainerModal
                : coverFieldsContainerTab2;
            if (activeContainer) {
                const input = activeContainer.querySelector(`[data-key="${newId}"][data-type="value"]`);
                if (input) input.focus();
            }
        }, 60);

        showToast('✓ Đã thêm 1 dòng thông tin mới vào Trang Bìa!', 'success');
    }

    if (btnAddCoverLineTab2) btnAddCoverLineTab2.addEventListener('click', addCustomCoverLine);
    if (btnAddCoverLineModal) btnAddCoverLineModal.addEventListener('click', addCustomCoverLine);

    function resetCoverToDefault() {
        state.coverConfig = createDefaultCoverConfig();
        refreshAllCoverBuilders();
        updateCoverPreview();
        saveCoverSettingsToStorage();
        renderSequenceFlow();
        showToast('✓ Đã khôi phục mẫu Trang Bìa chuẩn ban đầu!', 'success');
    }

    if (btnResetCoverTab2) btnResetCoverTab2.addEventListener('click', resetCoverToDefault);
    if (btnResetCoverModal) btnResetCoverModal.addEventListener('click', resetCoverToDefault);

    function updateCoverPreview() {
        const cfg = state.coverConfig || createDefaultCoverConfig();

        const parentVal = (cfg.parentOrg && cfg.parentOrg.enabled && cfg.parentOrg.value) ? cfg.parentOrg.value.trim().toUpperCase() : '';
        const schoolVal = (cfg.schoolName && cfg.schoolName.enabled && cfg.schoolName.value) ? cfg.schoolName.value.trim().toUpperCase() : '';
        const titleVal = (cfg.title && cfg.title.enabled && cfg.title.value) ? cfg.title.value.trim().toUpperCase() : '';
        const subtitleVal = (cfg.subtitle && cfg.subtitle.enabled && cfg.subtitle.value) ? cfg.subtitle.value.trim().toUpperCase() : '';
        const bottomVal = (cfg.bottomLocation && cfg.bottomLocation.enabled && cfg.bottomLocation.value) ? cfg.bottomLocation.value.trim().toUpperCase() : '';

        // Standard & custom info lines
        const infoLines = [];
        if (cfg.teacher && cfg.teacher.enabled && (cfg.teacher.value || cfg.teacher.label)) {
            infoLines.push({ label: cfg.teacher.label || 'Giáo viên:', value: cfg.teacher.value || '' });
        }
        if (cfg.className && cfg.className.enabled && (cfg.className.value || cfg.className.label)) {
            infoLines.push({ label: cfg.className.label || 'Lớp:', value: cfg.className.value || '' });
        }
        if (cfg.schoolYear && cfg.schoolYear.enabled && (cfg.schoolYear.value || cfg.schoolYear.label)) {
            infoLines.push({ label: cfg.schoolYear.label || 'Năm học:', value: cfg.schoolYear.value || '' });
        }
        if (Array.isArray(cfg.customLines)) {
            cfg.customLines.forEach(c => {
                if (c.enabled !== false && (c.value || c.label)) {
                    infoLines.push({ label: c.label || '', value: c.value || '' });
                }
            });
        }

        const infoListHtml = infoLines.map(line =>
            `<div><strong>${escapeHtml(line.label ? line.label + ' ' : '')}</strong><span>${escapeHtml(line.value)}</span></div>`
        ).join('');

        const updatePreviewSheet = (pParent, pSchool, pSep, pTitle, pSub, pDeco, pInfoList, pBottom) => {
            if (pParent) {
                pParent.textContent = parentVal;
                pParent.style.display = parentVal ? 'block' : 'none';
            }
            if (pSchool) {
                pSchool.textContent = schoolVal;
                pSchool.style.display = schoolVal ? 'block' : 'none';
            }
            if (pSep) {
                pSep.style.display = (parentVal || schoolVal) ? 'block' : 'none';
            }
            if (pTitle) {
                pTitle.textContent = titleVal;
                pTitle.style.display = titleVal ? 'block' : 'none';
            }
            if (pSub) {
                pSub.textContent = subtitleVal;
                pSub.style.display = subtitleVal ? 'block' : 'none';
            }
            if (pDeco) {
                pDeco.style.display = titleVal ? 'block' : 'none';
            }
            if (pInfoList) {
                pInfoList.innerHTML = infoListHtml;
                pInfoList.style.display = infoLines.length > 0 ? 'block' : 'none';
            }
            if (pBottom) {
                pBottom.textContent = bottomVal;
                pBottom.style.display = bottomVal ? 'block' : 'none';
            }
        };

        // Update Tab 2 Preview
        updatePreviewSheet(
            coverPrevParentVal, coverPrevSchoolVal, coverPrevSepVal,
            coverPrevTitleVal, coverPrevSubtitleVal, coverPrevDecoVal,
            coverPrevInfoList, coverPrevBottomVal
        );

        // Update Modal Preview
        updatePreviewSheet(
            modalCoverPrevParentVal, modalCoverPrevSchoolVal, modalCoverPrevSepVal,
            modalCoverPrevTitleVal, modalCoverPrevSubtitleVal, modalCoverPrevDecoVal,
            modalCoverPrevInfoList, modalCoverPrevBottomVal
        );
    }

    function saveCoverSettingsToStorage() {
        try {
            const saved = localStorage.getItem('giao_an_desktop_v3_settings') || localStorage.getItem('giao_an_desktop_v2_settings');
            let cfg = {};
            if (saved) {
                try { cfg = JSON.parse(saved); } catch (_) {}
            }
            cfg.enableCover = chkEnableCover ? chkEnableCover.checked : true;
            cfg.coverConfig = state.coverConfig;

            // Backward compatibility flat keys
            if (state.coverConfig) {
                cfg.coverParentOrg = state.coverConfig.parentOrg?.value || '';
                cfg.coverSchoolName = state.coverConfig.schoolName?.value || '';
                cfg.coverTitle = state.coverConfig.title?.value || '';
                cfg.coverSubtitle = state.coverConfig.subtitle?.value || '';
                cfg.coverTeacherName = state.coverConfig.teacher?.value || '';
                cfg.coverClassName = state.coverConfig.className?.value || '';
                cfg.coverSchoolYear = state.coverConfig.schoolYear?.value || '';
                cfg.coverBottomLoc = state.coverConfig.bottomLocation?.value || '';
            }

            localStorage.setItem('giao_an_desktop_v3_settings', JSON.stringify(cfg));
            localStorage.setItem('giao_an_desktop_v2_settings', JSON.stringify(cfg));
        } catch (e) {
            console.warn('Lỗi khi tự động lưu cấu hình trang bìa:', e);
        }
    }

    function openCoverModal() {
        if (modalChkEnableCover && chkEnableCover) {
            modalChkEnableCover.checked = chkEnableCover.checked;
        }
        refreshAllCoverBuilders();
        updateCoverPreview();
        if (modalCoverOverlay) modalCoverOverlay.classList.remove('hidden');
    }

    function closeCoverModal() {
        if (modalCoverOverlay) modalCoverOverlay.classList.add('hidden');
    }

    if (chkEnableCover) {
        chkEnableCover.addEventListener('change', () => {
            if (coverFormWrapper) {
                coverFormWrapper.classList.toggle('hidden', !chkEnableCover.checked);
            }
            if (modalChkEnableCover) modalChkEnableCover.checked = chkEnableCover.checked;
            if (chkFreeEnableCover) chkFreeEnableCover.checked = chkEnableCover.checked;
            updateCoverPreview();
            renderSequenceFlow();
            saveCoverSettingsToStorage();
        });
    }

    if (modalChkEnableCover) {
        modalChkEnableCover.addEventListener('change', () => {
            if (chkEnableCover) {
                chkEnableCover.checked = modalChkEnableCover.checked;
                if (coverFormWrapper) coverFormWrapper.classList.toggle('hidden', !chkEnableCover.checked);
            }
            if (chkFreeEnableCover) chkFreeEnableCover.checked = modalChkEnableCover.checked;
            updateCoverPreview();
            renderSequenceFlow();
            saveCoverSettingsToStorage();
        });
    }

    if (chkFreeEnableCover) {
        chkFreeEnableCover.addEventListener('change', () => {
            if (chkEnableCover) chkEnableCover.checked = chkFreeEnableCover.checked;
            if (modalChkEnableCover) modalChkEnableCover.checked = chkFreeEnableCover.checked;
            saveCoverSettingsToStorage();
        });
    }

    if (btnQuickCover) {
        btnQuickCover.addEventListener('click', openCoverModal);
    }
    if (btnFreeQuickCover) {
        btnFreeQuickCover.addEventListener('click', openCoverModal);
    }
    if (btnCloseCoverModal) {
        btnCloseCoverModal.addEventListener('click', closeCoverModal);
    }
    if (btnCancelCoverModal) {
        btnCancelCoverModal.addEventListener('click', closeCoverModal);
    }
    if (btnConfirmCoverModal) {
        btnConfirmCoverModal.addEventListener('click', () => {
            saveCoverSettingsToStorage();
            closeCoverModal();
            renderSequenceFlow();
            showToast('✓ Đã cập nhật và lưu cấu hình Trang Bìa thành công!', 'success');
        });
    }

    if (btnSaveCover) {
        btnSaveCover.addEventListener('click', () => {
            saveCoverSettingsToStorage();
            if (saveCoverMsgToast) {
                saveCoverMsgToast.classList.remove('hidden');
                setTimeout(() => saveCoverMsgToast.classList.add('hidden'), 3500);
            }
            showToast('✓ Đã lưu nội dung Trang Bìa thành công!', 'success');
        });
    }

    function loadSavedSettings() {
        try {
            const saved = localStorage.getItem('giao_an_desktop_v3_settings') || localStorage.getItem('giao_an_desktop_v2_settings');
            if (saved) {
                const cfg = JSON.parse(saved);
                if (cfg.tengv && inputTenGv) inputTenGv.value = cfg.tengv;
                if (cfg.namingPattern) inputNamingPattern.value = cfg.namingPattern;
                if (cfg.lopName) inputLopName.value = cfg.lopName;
                if (cfg.continuousPage !== undefined) chkContinuousPage.checked = cfg.continuousPage;
                if (cfg.pageBreak !== undefined) chkPageBreak.checked = cfg.pageBreak;
                if (cfg.autoCompress !== undefined && chkAutoCompress) chkAutoCompress.checked = cfg.autoCompress;
                if (cfg.compressMode && selectCompressMode) selectCompressMode.value = cfg.compressMode;
                if (cfg.sigLayout) {
                    setSigLayout(cfg.sigLayout);
                } else {
                    setSigLayout('3col');
                }
                if (cfg.enableSig !== undefined) {
                    chkEnableSignature.checked = cfg.enableSig;
                    sigFormWrapper.classList.toggle('hidden', !cfg.enableSig);
                    if (chkFreeEnableSig) {
                        chkFreeEnableSig.checked = cfg.enableSig;
                        if (freeSigFormWrapper) freeSigFormWrapper.classList.toggle('hidden', !cfg.enableSig);
                    }
                }
                if (cfg.placeDate) {
                    sigPlaceDate.value = cfg.placeDate;
                    if (freeSigPlaceDate) freeSigPlaceDate.value = cfg.placeDate;
                }
                if (cfg.bghRole) {
                    sigBghRole.value = cfg.bghRole;
                    if (freeSigBghRole) freeSigBghRole.value = cfg.bghRole;
                }
                if (cfg.bghName) {
                    sigBghName.value = cfg.bghName;
                    if (freeSigBghName) freeSigBghName.value = cfg.bghName;
                }
                if (cfg.ttRole) {
                    sigTtRole.value = cfg.ttRole;
                    if (freeSigTtRole) freeSigTtRole.value = cfg.ttRole;
                }
                if (cfg.ttName) {
                    sigTtName.value = cfg.ttName;
                    if (freeSigTtName) freeSigTtName.value = cfg.ttName;
                }
                if (cfg.gvRole) {
                    sigGvRole.value = cfg.gvRole;
                    if (freeSigGvRole) freeSigGvRole.value = cfg.gvRole;
                }
                if (cfg.gvName) {
                    sigGvName.value = cfg.gvName;
                    if (freeSigGvName) freeSigGvName.value = cfg.gvName;
                }

                // V3 Export Mode & Bundle Settings
                if (cfg.exportMode) {
                    setExportMode(cfg.exportMode);
                } else {
                    setExportMode('per-week');
                }
                if (cfg.bundlePattern && inputBundlePattern) inputBundlePattern.value = cfg.bundlePattern;
                if (cfg.bundleTenGv && inputBundleTenGv) inputBundleTenGv.value = cfg.bundleTenGv;
                if (cfg.bundleLop && inputBundleLop) inputBundleLop.value = cfg.bundleLop;
                if (cfg.bundleSigPos) {
                    state.bundleSigPos = cfg.bundleSigPos;
                    if (radBundleSigLast) radBundleSigLast.checked = (cfg.bundleSigPos === 'last');
                    if (radBundleSigEach) radBundleSigEach.checked = (cfg.bundleSigPos === 'each');
                }

                // V3 Cover Page Settings
                const enableCoverSetting = (cfg.enableCover !== undefined) ? cfg.enableCover : true;
                if (chkEnableCover) {
                    chkEnableCover.checked = enableCoverSetting;
                    if (coverFormWrapper) coverFormWrapper.classList.toggle('hidden', !enableCoverSetting);
                }
                if (modalChkEnableCover) modalChkEnableCover.checked = enableCoverSetting;
                if (chkFreeEnableCover) chkFreeEnableCover.checked = enableCoverSetting;

                if (cfg.coverConfig && typeof cfg.coverConfig === 'object') {
                    const def = createDefaultCoverConfig();
                    state.coverConfig = {
                        ...def,
                        ...cfg.coverConfig,
                        parentOrg: { ...def.parentOrg, ...(cfg.coverConfig.parentOrg || {}) },
                        schoolName: { ...def.schoolName, ...(cfg.coverConfig.schoolName || {}) },
                        title: { ...def.title, ...(cfg.coverConfig.title || {}) },
                        subtitle: { ...def.subtitle, ...(cfg.coverConfig.subtitle || {}) },
                        teacher: { ...def.teacher, ...(cfg.coverConfig.teacher || {}) },
                        className: { ...def.className, ...(cfg.coverConfig.className || {}) },
                        schoolYear: { ...def.schoolYear, ...(cfg.coverConfig.schoolYear || {}) },
                        bottomLocation: { ...def.bottomLocation, ...(cfg.coverConfig.bottomLocation || {}) },
                        customLines: Array.isArray(cfg.coverConfig.customLines) ? cfg.coverConfig.customLines : []
                    };
                    if (state.coverConfig.teacher && (state.coverConfig.teacher.value === 'Phan Thị Thùy Châu' || !state.coverConfig.teacher.value)) {
                        state.coverConfig.teacher.value = 'Phan Thái Châu';
                    }
                } else {
                    state.coverConfig = createDefaultCoverConfig();
                    if (cfg.coverParentOrg !== undefined) state.coverConfig.parentOrg.value = cfg.coverParentOrg;
                    if (cfg.coverSchoolName !== undefined) state.coverConfig.schoolName.value = cfg.coverSchoolName;
                    if (cfg.coverTitle !== undefined) state.coverConfig.title.value = cfg.coverTitle;
                    if (cfg.coverSubtitle !== undefined) state.coverConfig.subtitle.value = cfg.coverSubtitle;
                    if (cfg.coverTeacherName !== undefined) state.coverConfig.teacher.value = cfg.coverTeacherName;
                    if (cfg.coverClassName !== undefined) state.coverConfig.className.value = cfg.coverClassName;
                    if (cfg.coverSchoolYear !== undefined) state.coverConfig.schoolYear.value = cfg.coverSchoolYear;
                    if (cfg.coverBottomLoc !== undefined) state.coverConfig.bottomLocation.value = cfg.coverBottomLoc;
                }
            } else {
                setSigLayout('3col');
                setExportMode('per-week');
                if (chkEnableCover) {
                    chkEnableCover.checked = true;
                    if (coverFormWrapper) coverFormWrapper.classList.remove('hidden');
                }
                if (modalChkEnableCover) modalChkEnableCover.checked = true;
                if (chkFreeEnableCover) chkFreeEnableCover.checked = true;
                state.coverConfig = createDefaultCoverConfig();
            }
        } catch(e) {
            setSigLayout('3col');
            setExportMode('per-week');
            if (chkEnableCover) {
                chkEnableCover.checked = true;
                if (coverFormWrapper) coverFormWrapper.classList.remove('hidden');
            }
            if (modalChkEnableCover) modalChkEnableCover.checked = true;
            if (chkFreeEnableCover) chkFreeEnableCover.checked = true;
            state.coverConfig = createDefaultCoverConfig();
        }
        refreshAllCoverBuilders();
        updateNamingPreview();
        updateBundleNamingPreview();
        updateCoverPreview();
        updateFreeNamingPreview();
    }

    btnSaveSettings.addEventListener('click', () => {
        const cfg = {
            tengv: inputTenGv ? inputTenGv.value.trim() : '',
            namingPattern: inputNamingPattern.value.trim(),
            lopName: inputLopName.value.trim(),
            continuousPage: chkContinuousPage.checked,
            pageBreak: chkPageBreak.checked,
            autoCompress: chkAutoCompress ? chkAutoCompress.checked : true,
            compressMode: selectCompressMode ? selectCompressMode.value : 'deep',
            enableSig: chkEnableSignature.checked,
            sigLayout: state.sigLayout || '3col',
            placeDate: sigPlaceDate.value.trim(),
            bghRole: sigBghRole.value.trim(),
            bghName: sigBghName.value.trim(),
            ttRole: sigTtRole.value.trim(),
            ttName: sigTtName.value.trim(),
            gvRole: sigGvRole.value.trim(),
            gvName: sigGvName.value.trim(),

            // V3 Settings
            exportMode: state.exportMode || 'per-week',
            bundlePattern: inputBundlePattern ? inputBundlePattern.value.trim() : '',
            bundleTenGv: inputBundleTenGv ? inputBundleTenGv.value.trim() : '',
            bundleLop: inputBundleLop ? inputBundleLop.value.trim() : '',
            bundleSigPos: state.bundleSigPos || 'last',

            enableCover: chkEnableCover ? chkEnableCover.checked : false,
            coverConfig: state.coverConfig,
            coverParentOrg: state.coverConfig?.parentOrg?.value || '',
            coverSchoolName: state.coverConfig?.schoolName?.value || '',
            coverTitle: state.coverConfig?.title?.value || '',
            coverSubtitle: state.coverConfig?.subtitle?.value || '',
            coverTeacherName: state.coverConfig?.teacher?.value || '',
            coverClassName: state.coverConfig?.className?.value || '',
            coverSchoolYear: state.coverConfig?.schoolYear?.value || '',
            coverBottomLoc: state.coverConfig?.bottomLocation?.value || ''
        };
        localStorage.setItem('giao_an_desktop_v3_settings', JSON.stringify(cfg));
        localStorage.setItem('giao_an_desktop_v2_settings', JSON.stringify(cfg));

        if (chkFreeEnableSig) chkFreeEnableSig.checked = cfg.enableSig;
        if (chkFreeAutoCompress && chkAutoCompress) chkFreeAutoCompress.checked = chkAutoCompress.checked;
        if (selectFreeCompressMode && selectCompressMode) selectFreeCompressMode.value = selectCompressMode.value;
        if (freeSigFormWrapper) freeSigFormWrapper.classList.toggle('hidden', !cfg.enableSig);
        if (freeSigPlaceDate) freeSigPlaceDate.value = cfg.placeDate;
        if (freeSigBghRole) freeSigBghRole.value = cfg.bghRole;
        if (freeSigBghName) freeSigBghName.value = cfg.bghName;
        if (freeSigTtRole) freeSigTtRole.value = cfg.ttRole;
        if (freeSigTtName) freeSigTtName.value = cfg.ttName;
        if (freeSigGvRole) freeSigGvRole.value = cfg.gvRole;
        if (freeSigGvName) freeSigGvName.value = cfg.gvName;

        saveMsgToast.classList.remove('hidden');
        setTimeout(() => saveMsgToast.classList.add('hidden'), 3500);
        showToast('✓ Đã lưu toàn bộ cấu hình V3 thành công!');
    });

    chkEnableSignature.addEventListener('change', () => {
        sigFormWrapper.classList.toggle('hidden', !chkEnableSignature.checked);
        renderSequenceFlow();
    });

    // ==========================================================================
    // Naming pattern & Chips
    // ==========================================================================
    function updateNamingPreview() {
        const pattern = inputNamingPattern.value.trim() || '{tengv}_KHBD_Tuan_{week}_Lop_{lop}.docx';
        const tengv = (inputTenGv ? inputTenGv.value.trim() : '') || 'Chau';
        const lop = inputLopName.value.trim() || '5';
        let preview = pattern
            .replace(/\{tengv\}/gi, tengv)
            .replace(/\{week\}/g, '01')
            .replace(/\{w\}/g, '1')
            .replace(/\{lop\}/g, lop)
            .replace(/\{mon\}/g, 'Tong_Hop');
        if (!preview.toLowerCase().endsWith('.docx')) preview += '.docx';
        previewFilenameText.textContent = preview;
    }

    if (inputTenGv) inputTenGv.addEventListener('input', updateNamingPreview);
    inputNamingPattern.addEventListener('input', updateNamingPreview);
    inputLopName.addEventListener('input', updateNamingPreview);

    btnTagChips.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            const pos = inputNamingPattern.selectionStart || inputNamingPattern.value.length;
            const val = inputNamingPattern.value;
            inputNamingPattern.value = val.slice(0, pos) + tag + val.slice(pos);
            inputNamingPattern.focus();
            updateNamingPreview();
        });
    });

    // ==========================================================================
    // File Ingestion Logic (Folder, Multiple Files, Drag & Drop with Live Visuals)
    // ==========================================================================
    const btnPickFolder = document.getElementById('btn-pick-folder');
    const btnPickFiles = document.getElementById('btn-pick-files');
    const btnPickAddMore = document.getElementById('btn-pick-add-more');

    if (btnPickFolder) {
        btnPickFolder.addEventListener('click', (e) => {
            e.stopPropagation();
            inputFolderPicker.click();
        });
    }
    if (btnPickFiles) {
        btnPickFiles.addEventListener('click', (e) => {
            e.stopPropagation();
            inputFilesPicker.click();
        });
    }
    if (btnPickAddMore) {
        btnPickAddMore.addEventListener('click', (e) => {
            e.stopPropagation();
            inputAddMore.click();
        });
    }

    // Window-level Drag and Drop feedback (Visual Overlay)
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if (fullscreenDragOverlay) fullscreenDragOverlay.classList.remove('hidden');
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (fullscreenDragOverlay) fullscreenDragOverlay.classList.add('hidden');
        }
    });

    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        dragCounter = 0;
        if (fullscreenDragOverlay) fullscreenDragOverlay.classList.add('hidden');

        const items = e.dataTransfer.items;
        const dtFiles = e.dataTransfer.files;
        if ((items && items.length > 0) || (dtFiles && dtFiles.length > 0)) {
            await handleIncomingEntriesOrFiles(items, dtFiles);
        }
    });

    async function handleIncomingEntriesOrFiles(items, dtFiles) {
        if (scanningModal) {
            scanningModal.classList.remove('hidden');
            if (scanningTitle) scanningTitle.textContent = 'Đang quét và tiếp nhận tập tin...';
            if (scanningDesc) scanningDesc.textContent = 'Phần mềm đang đọc và phân loại giáo án vào từng môn...';
        }

        // Allow browser repaint for spinner
        await new Promise(r => setTimeout(r, 40));

        const files = [];
        try {
            if (items && items.length > 0 && items[0].webkitGetAsEntry) {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.webkitGetAsEntry) {
                        const entry = item.webkitGetAsEntry();
                        if (entry) await scanEntryRecursive(entry, files);
                    }
                }
            } else if (dtFiles && dtFiles.length > 0) {
                files.push(...Array.from(dtFiles));
            }
        } catch (err) {
            console.error("Lỗi khi đọc file kéo thả:", err);
        }

        if (state.currentMode === 'freemerge') {
            const addedCount = addFreeFiles(files);
            if (scanningModal) scanningModal.classList.add('hidden');
            if (addedCount > 0) {
                const msg = `✓ Đã tiếp nhận thành công ${addedCount} file vào danh sách ghép tự do!`;
                showToast(msg, 'success');
                appendFreeLog(msg, 'success');
            } else {
                const msg = 'Không tìm thấy file Word (.docx) hợp lệ trong tệp vừa nạp.';
                showToast(msg, 'warn');
                appendFreeLog(msg, 'warn');
            }
            return;
        }

        const addedCount = addFilesToState(files);

        if (scanningModal) scanningModal.classList.add('hidden');

        if (addedCount > 0) {
            const msg = `✓ Đã tiếp nhận thành công ${addedCount} file giáo án (${state.subjectsList.length} môn)!`;
            showToast(msg, 'success');
            appendLog(msg, 'success');
        } else {
            const msg = 'Không tìm thấy file Word (.docx) hợp lệ trong tệp vừa kéo thả.';
            showToast(msg, 'warn');
            appendLog(msg, 'warn');
        }
    }

    async function handleInputPickerChange(e) {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        if (scanningModal) {
            scanningModal.classList.remove('hidden');
            if (scanningTitle) scanningTitle.textContent = 'Đang tiếp nhận tập tin...';
            if (scanningDesc) scanningDesc.textContent = `Đang xử lý ${fileList.length} tệp tin...`;
        }

        await new Promise(r => setTimeout(r, 40));

        const addedCount = addFilesToState(Array.from(fileList));
        e.target.value = ''; // Reset input to allow re-selection

        if (scanningModal) scanningModal.classList.add('hidden');

        if (addedCount > 0) {
            const msg = `✓ Đã tiếp nhận thành công ${addedCount} file giáo án (${state.subjectsList.length} môn)!`;
            showToast(msg, 'success');
            appendLog(msg, 'success');
        } else {
            const msg = 'Không tìm thấy file Word (.docx) hợp lệ trong tệp vừa chọn.';
            showToast(msg, 'warn');
            appendLog(msg, 'warn');
        }
    }

    inputFolderPicker.addEventListener('change', handleInputPickerChange);
    inputFilesPicker.addEventListener('change', handleInputPickerChange);
    inputAddMore.addEventListener('change', handleInputPickerChange);

    async function scanEntryRecursive(entry, fileList) {
        if (entry.isFile) {
            const file = await new Promise((res, rej) => entry.file(res, rej));
            file.customRelativePath = entry.fullPath ? entry.fullPath.replace(/^\//, '') : file.name;
            fileList.push(file);
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const readAllEntries = async () => {
                let entries = [];
                let batch;
                do {
                    batch = await new Promise((res, rej) => reader.readEntries(res, rej));
                    entries = entries.concat(batch);
                } while (batch.length > 0);
                return entries;
            };
            const entries = await readAllEntries();
            for (const sub of entries) {
                await scanEntryRecursive(sub, fileList);
            }
        }
    }

    function addFilesToState(newFiles) {
        let addedCount = 0;
        for (const file of newFiles) {
            const name = file.name;
            if (name.startsWith('~$') || !name.toLowerCase().endsWith('.docx')) continue;

            const relPath = file.customRelativePath || file.webkitRelativePath || file.name;
            const pathParts = relPath.split(/[\/\\]/);

            const parentFolder = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '';
            const subject = detectSubject(name, parentFolder);
            const week = extractWeekNumber(name) || (parentFolder ? extractWeekNumber(parentFolder) : null);

            state.filesMap.set(relPath, { file, name, subject, week });
            addedCount++;
        }

        rebuildMatrixAndSubjects();
        return addedCount;
    }

    function rebuildMatrixAndSubjects() {
        // Build subjects map
        const subjectsMap = new Map();
        // Init 35 weeks
        state.weeksMap = {};
        for (let w = 1; w <= 35; w++) {
            state.weeksMap[w] = { files: {}, count: 0, status: 'empty', missing: [] };
        }

        for (const item of state.filesMap.values()) {
            if (!subjectsMap.has(item.subject)) {
                subjectsMap.set(item.subject, { name: item.subject, count: 0 });
            }
            subjectsMap.get(item.subject).count++;

            if (item.week && item.week >= 1 && item.week <= 35) {
                if (!state.weeksMap[item.week].files[item.subject]) {
                    state.weeksMap[item.week].files[item.subject] = [];
                }
                state.weeksMap[item.week].files[item.subject].push(item.file);
            }
        }

        // Sắp xếp tự nhiên các file trong cùng một môn của mỗi tuần (Tiết 1, Tiết 2...)
        for (let w = 1; w <= 35; w++) {
            for (const sub of Object.keys(state.weeksMap[w].files)) {
                if (Array.isArray(state.weeksMap[w].files[sub])) {
                    state.weeksMap[w].files[sub].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                }
            }
        }

        // Maintain existing ordering if possible
        const existingNames = state.subjectsList.map(s => s.name);
        const newSubjects = [];
        
        // Add existing in order
        existingNames.forEach(name => {
            if (subjectsMap.has(name)) {
                const prev = state.subjectsList.find(s => s.name === name);
                newSubjects.push({
                    name: name,
                    enabled: prev ? prev.enabled : true,
                    count: subjectsMap.get(name).count
                });
                subjectsMap.delete(name);
            }
        });

        // Append newly detected subjects
        const DEFAULT_ORDER = [
            'Tiếng Việt', 'Toán', 'Đạo đức', 'Tự nhiên và Xã hội', 'Khoa học', 'Lịch sử và Địa lí',
            'Tin học và Công nghệ', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh',
            'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất', 'Lịch báo giảng'
        ];
        const remaining = Array.from(subjectsMap.values()).map(s => ({ name: s.name, enabled: true, count: s.count }));
        remaining.sort((a, b) => {
            let iA = DEFAULT_ORDER.indexOf(a.name);
            let iB = DEFAULT_ORDER.indexOf(b.name);
            if (iA === -1) iA = 99;
            if (iB === -1) iB = 99;
            return iA - iB;
        });
        newSubjects.push(...remaining);
        state.subjectsList = newSubjects;

        // Calculate week statuses
        let totalWeeksFound = 0;
        const totalSubs = state.subjectsList.length;

        for (let w = 1; w <= 35; w++) {
            const presentSubs = Object.keys(state.weeksMap[w].files);
            const count = presentSubs.length;
            state.weeksMap[w].count = count;

            if (count > 0) {
                totalWeeksFound++;
                state.selectedWeeks.add(w);
            }

            if (totalSubs > 0 && count >= totalSubs) {
                state.weeksMap[w].status = 'full';
            } else if (count > 0) {
                state.weeksMap[w].status = 'partial';
            } else {
                state.weeksMap[w].status = 'empty';
            }

            state.weeksMap[w].missing = state.subjectsList
                .filter(s => s.enabled)
                .map(s => s.name)
                .filter(name => !state.weeksMap[w].files[name]);
        }

        renderUI();
    }

    // ==========================================================================
    // Render Software UI (Subjects List, 35-Week Matrix, Sequence Flow)
    // ==========================================================================
    function renderUI() {
        const totalFiles = state.filesMap.size;
        tabFileCountBadge.textContent = totalFiles + ' tệp';

        if (totalFiles > 0) {
            uploadHeroZone.classList.add('hidden');
            dataSummaryBar.classList.remove('hidden');
            workspaceGrid.classList.remove('hidden');

            statTotalFiles.textContent = totalFiles + ' tệp';
            statTotalSubjects.textContent = state.subjectsList.length + ' môn';
            
            let weeksFound = 0;
            for (let w = 1; w <= 35; w++) {
                if (state.weeksMap[w] && state.weeksMap[w].count > 0) weeksFound++;
            }
            statTotalWeeks.textContent = weeksFound + ' / 35 tuần';
        } else {
            uploadHeroZone.classList.remove('hidden');
            dataSummaryBar.classList.add('hidden');
            workspaceGrid.classList.add('hidden');
        }

        renderSubjects();
        renderWeeksMatrix();
        renderSequenceFlow();
    }

    // Hiển thị trực quan thứ tự các môn và khối chữ ký trước khi xuất file
    function renderSequenceFlow() {
        if (!sequenceFlowBox || !sequenceFlowPills) return;
        const totalFiles = state.filesMap.size;
        if (totalFiles === 0) {
            sequenceFlowBox.classList.add('hidden');
            return;
        }
        sequenceFlowBox.classList.remove('hidden');
        sequenceFlowPills.innerHTML = '';

        const activeSubs = state.subjectsList.filter(s => s.enabled);
        if (activeSubs.length === 0) {
            sequenceFlowPills.innerHTML = '<span style="color:var(--danger); font-size:0.8rem; font-style:italic;">Chưa chọn môn học nào để ghép!</span>';
            return;
        }

        if (chkEnableCover && chkEnableCover.checked) {
            const coverPill = document.createElement('span');
            coverPill.className = 'flow-pill pill-sig';
            coverPill.style.background = '#e0f2fe';
            coverPill.style.color = '#0369a1';
            coverPill.style.borderColor = '#bae6fd';
            coverPill.style.cursor = 'pointer';
            coverPill.title = 'Nhấn vào đây để xem và chỉnh sửa nội dung Trang Bìa';
            coverPill.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                [Trang Bìa Giáo Án ✎ Sửa]
            `;
            coverPill.addEventListener('click', openCoverModal);
            sequenceFlowPills.appendChild(coverPill);

            const arrow = document.createElement('span');
            arrow.className = 'flow-arrow';
            arrow.textContent = '➔';
            sequenceFlowPills.appendChild(arrow);
        } else {
            const coverPill = document.createElement('span');
            coverPill.className = 'flow-pill';
            coverPill.style.background = '#f8fafc';
            coverPill.style.color = '#64748b';
            coverPill.style.borderColor = '#cbd5e1';
            coverPill.style.borderStyle = 'dashed';
            coverPill.style.cursor = 'pointer';
            coverPill.title = 'Nhấn vào đây để bật và tùy chỉnh Trang Bìa';
            coverPill.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                [+ Thêm Trang Bìa]
            `;
            coverPill.addEventListener('click', () => {
                if (chkEnableCover) chkEnableCover.checked = true;
                if (modalChkEnableCover) modalChkEnableCover.checked = true;
                if (coverFormWrapper) coverFormWrapper.classList.remove('hidden');
                openCoverModal();
                renderSequenceFlow();
                saveCoverSettingsToStorage();
            });
            sequenceFlowPills.appendChild(coverPill);

            const arrow = document.createElement('span');
            arrow.className = 'flow-arrow';
            arrow.textContent = '➔';
            sequenceFlowPills.appendChild(arrow);
        }

        activeSubs.forEach((sub, idx) => {
            const pill = document.createElement('span');
            pill.className = 'flow-pill';
            pill.innerHTML = `<strong>${idx + 1}.</strong> ${escapeXml(sub.name)}`;
            sequenceFlowPills.appendChild(pill);

            const arrow = document.createElement('span');
            arrow.className = 'flow-arrow';
            arrow.textContent = '➔';
            sequenceFlowPills.appendChild(arrow);
        });

        if (chkEnableSignature.checked) {
            const sigPill = document.createElement('span');
            sigPill.className = 'flow-pill pill-sig';
            let layoutLabel = '3 Cột: BGH - TT - GV';
            if (state.sigLayout === '1col') layoutLabel = '1 Cột: Giáo Viên';
            else if (state.sigLayout === '2col') layoutLabel = '2 Cột: Tổ Trưởng - GV';

            sigPill.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                [Khối Chữ Ký ${layoutLabel}]
            `;
            sequenceFlowPills.appendChild(sigPill);
        } else {
            // Xóa mũi tên dư thừa ở cuối nếu không có khối chữ ký
            if (sequenceFlowPills.lastElementChild && sequenceFlowPills.lastElementChild.classList.contains('flow-arrow')) {
                sequenceFlowPills.removeChild(sequenceFlowPills.lastElementChild);
            }
        }
    }

    function renderSubjects() {
        subjectListContainer.innerHTML = '';
        state.subjectsList.forEach((sub, idx) => {
            const item = document.createElement('div');
            item.className = 'subject-item';
            item.innerHTML = `
                <div class="subject-left">
                    <span class="subject-order-num">${idx + 1}</span>
                    <input type="checkbox" id="chk-sub-${idx}" ${sub.enabled ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary); cursor:pointer;">
                    <label for="chk-sub-${idx}" class="subject-name" title="${escapeXml(sub.name)}" style="cursor:pointer;">${escapeXml(sub.name)}</label>
                    <span class="subject-count-tag">${sub.count} file</span>
                </div>
                <div class="subject-actions">
                    <button type="button" class="btn-icon btn-up" title="Chuyển lên" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button type="button" class="btn-icon btn-down" title="Chuyển xuống" ${idx === state.subjectsList.length - 1 ? 'disabled' : ''}>▼</button>
                    <button type="button" class="btn-icon btn-danger-icon btn-del" title="Xóa môn này">✕</button>
                </div>
            `;

            item.querySelector(`#chk-sub-${idx}`).addEventListener('change', (e) => {
                sub.enabled = e.target.checked;
                recalculateWeeksMissing();
                renderWeeksMatrix();
                renderSequenceFlow();
            });

            item.querySelector('.btn-up').addEventListener('click', () => {
                if (idx > 0) {
                    const temp = state.subjectsList[idx];
                    state.subjectsList[idx] = state.subjectsList[idx - 1];
                    state.subjectsList[idx - 1] = temp;
                    renderSubjects();
                    renderSequenceFlow();
                }
            });

            item.querySelector('.btn-down').addEventListener('click', () => {
                if (idx < state.subjectsList.length - 1) {
                    const temp = state.subjectsList[idx];
                    state.subjectsList[idx] = state.subjectsList[idx + 1];
                    state.subjectsList[idx + 1] = temp;
                    renderSubjects();
                    renderSequenceFlow();
                }
            });

            item.querySelector('.btn-del').addEventListener('click', () => {
                if (confirm(`Bạn có chắc muốn xóa môn "${sub.name}" khỏi danh sách ghép?`)) {
                    state.subjectsList.splice(idx, 1);
                    // Remove from filesMap
                    for (const [key, val] of state.filesMap.entries()) {
                        if (val.subject === sub.name) state.filesMap.delete(key);
                    }
                    rebuildMatrixAndSubjects();
                }
            });

            subjectListContainer.appendChild(item);
        });
    }

    btnAddSubject.addEventListener('click', () => {
        const name = inputNewSubject.value.trim();
        if (!name) return;
        if (state.subjectsList.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            alert('Môn học này đã có trong danh sách!');
            return;
        }
        state.subjectsList.push({ name: name, enabled: true, count: 0 });
        inputNewSubject.value = '';
        renderSubjects();
        recalculateWeeksMissing();
        renderWeeksMatrix();
        renderSequenceFlow();
    });

    if (presetTvFirst) {
        presetTvFirst.addEventListener('click', () => {
            const TV_FIRST = ['Tiếng Việt', 'Toán', 'Đạo đức', 'Tự nhiên và Xã hội', 'Khoa học', 'Lịch sử và Địa lí', 'Tin học và Công nghệ', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh', 'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất', 'Lịch báo giảng'];
            state.subjectsList.sort((a, b) => {
                let iA = TV_FIRST.indexOf(a.name);
                let iB = TV_FIRST.indexOf(b.name);
                if (iA === -1) iA = 99;
                if (iB === -1) iB = 99;
                return iA - iB;
            });
            renderSubjects();
            renderSequenceFlow();
            showToast('Đã xếp thứ tự: Tiếng Việt lên đầu.');
        });
    }

    if (presetToanFirst) {
        presetToanFirst.addEventListener('click', () => {
            const TOAN_FIRST = ['Toán', 'Tiếng Việt', 'Đạo đức', 'Tự nhiên và Xã hội', 'Khoa học', 'Lịch sử và Địa lí', 'Tin học và Công nghệ', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh', 'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất', 'Lịch báo giảng'];
            state.subjectsList.sort((a, b) => {
                let iA = TOAN_FIRST.indexOf(a.name);
                let iB = TOAN_FIRST.indexOf(b.name);
                if (iA === -1) iA = 99;
                if (iB === -1) iB = 99;
                return iA - iB;
            });
            renderSubjects();
            renderSequenceFlow();
            showToast('Đã xếp thứ tự: Toán lên đầu.');
        });
    }

    if (presetAlpha) {
        presetAlpha.addEventListener('click', () => {
            state.subjectsList.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
            renderSubjects();
            renderSequenceFlow();
            showToast('Đã xếp thứ tự theo bảng chữ cái A-Z.');
        });
    }

    function recalculateWeeksMissing() {
        const activeSubjectNames = state.subjectsList.filter(s => s.enabled).map(s => s.name);
        for (let w = 1; w <= 35; w++) {
            const wInfo = state.weeksMap[w];
            if (!wInfo) continue;
            wInfo.missing = activeSubjectNames.filter(n => !wInfo.files[n]);
            if (activeSubjectNames.length > 0 && wInfo.count >= activeSubjectNames.length) {
                wInfo.status = 'full';
            } else if (wInfo.count > 0) {
                wInfo.status = 'partial';
            } else {
                wInfo.status = 'empty';
            }
        }
    }

    function renderWeeksMatrix() {
        weeksMatrixContainer.innerHTML = '';
        const enabledSubsCount = state.subjectsList.filter(s => s.enabled).length;

        for (let w = 1; w <= 35; w++) {
            const wInfo = state.weeksMap[w] || { count: 0, status: 'empty', missing: [], files: {} };
            const isSelected = state.selectedWeeks.has(w);
            const card = document.createElement('div');
            card.className = `week-card ${isSelected ? 'selected' : ''}`;

            let statusHtml = '<span class="week-status-badge status-empty">Chưa có file</span>';
            if (wInfo.status === 'full') {
                statusHtml = `<span class="week-status-badge status-full">✓ Đủ ${wInfo.count} môn</span>`;
            } else if (wInfo.status === 'partial') {
                statusHtml = `
                    <span class="week-status-badge status-partial">
                        ${wInfo.count}/${enabledSubsCount} môn
                        <button type="button" class="btn-detail-link btn-view-missing" data-week="${w}">[Xem]</button>
                    </span>
                `;
            }

            card.innerHTML = `
                <div class="week-card-head">
                    <span class="week-number">Tuần ${w < 10 ? '0' + w : w}</span>
                    <input type="checkbox" class="week-checkbox" ${isSelected ? 'checked' : ''}>
                </div>
                ${statusHtml}
            `;

            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-view-missing')) {
                    openSubjectDetailsModal(w, wInfo);
                    return;
                }
                if (state.selectedWeeks.has(w)) {
                    state.selectedWeeks.delete(w);
                } else {
                    state.selectedWeeks.add(w);
                }
                updateSelectedWeeksBar();
                renderWeeksMatrix();
            });

            weeksMatrixContainer.appendChild(card);
        }

        updateSelectedWeeksBar();
    }

    function updateSelectedWeeksBar() {
        if (barSelectedWeeksCount) {
            barSelectedWeeksCount.textContent = state.selectedWeeks.size;
        }
    }

    btnMatrixAll.addEventListener('click', () => {
        for (let w = 1; w <= 35; w++) state.selectedWeeks.add(w);
        renderWeeksMatrix();
    });

    btnMatrixFull.addEventListener('click', () => {
        state.selectedWeeks.clear();
        for (let w = 1; w <= 35; w++) {
            if (state.weeksMap[w] && state.weeksMap[w].status === 'full') state.selectedWeeks.add(w);
        }
        renderWeeksMatrix();
    });

    btnMatrixHk1.addEventListener('click', () => {
        state.selectedWeeks.clear();
        for (let w = 1; w <= 18; w++) {
            if (state.weeksMap[w] && state.weeksMap[w].count > 0) state.selectedWeeks.add(w);
        }
        renderWeeksMatrix();
    });

    btnMatrixHk2.addEventListener('click', () => {
        state.selectedWeeks.clear();
        for (let w = 19; w <= 35; w++) {
            if (state.weeksMap[w] && state.weeksMap[w].count > 0) state.selectedWeeks.add(w);
        }
        renderWeeksMatrix();
    });

    btnMatrixNone.addEventListener('click', () => {
        state.selectedWeeks.clear();
        renderWeeksMatrix();
    });

    // ==========================================================================
    // Modal chi tiết môn
    // ==========================================================================
    function openSubjectDetailsModal(week, wInfo) {
        modalDetailsTitle.textContent = `Chi tiết các môn học - Tuần ${week < 10 ? '0' + week : week}`;
        const present = Object.keys(wInfo.files || {});
        modalListPresent.innerHTML = present.length > 0
            ? present.map(s => {
                const subFiles = wInfo.files[s];
                const countBadge = (Array.isArray(subFiles) && subFiles.length > 1) ? ` (${subFiles.length} tiết)` : '';
                return `<span class="tag-present">✓ ${escapeXml(s)}${countBadge}</span>`;
            }).join('')
            : '<span style="color:var(--text-muted); font-size:0.8rem;">Chưa có môn nào</span>';

        const missing = wInfo.missing || [];
        modalListMissing.innerHTML = missing.length > 0
            ? missing.map(s => `<span class="tag-missing">⚠ ${escapeXml(s)}</span>`).join('')
            : '<span style="color:var(--success); font-size:0.8rem;">Đã đủ tất cả các môn!</span>';

        modalSubjectDetails.classList.remove('hidden');
    }

    function closeDetailsModal() { modalSubjectDetails.classList.add('hidden'); }
    btnCloseDetailsModal.addEventListener('click', closeDetailsModal);
    btnConfirmDetailsModal.addEventListener('click', closeDetailsModal);
    modalSubjectDetails.addEventListener('click', (e) => {
        if (e.target === modalSubjectDetails) closeDetailsModal();
    });

    function openGuideModal() {
        if (modalGuideOverlay) modalGuideOverlay.classList.remove('hidden');
    }
    function closeGuideModal() {
        if (modalGuideOverlay) modalGuideOverlay.classList.add('hidden');
    }
    if (btnTopGuide) btnTopGuide.addEventListener('click', openGuideModal);
    if (btnCloseGuideModal) btnCloseGuideModal.addEventListener('click', closeGuideModal);
    if (btnConfirmGuideModal) btnConfirmGuideModal.addEventListener('click', closeGuideModal);
    if (modalGuideOverlay) {
        modalGuideOverlay.addEventListener('click', (e) => {
            if (e.target === modalGuideOverlay) closeGuideModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeGuideModal();
            closeDetailsModal();
        }
    });

    btnTopReset.addEventListener('click', () => {
        if (state.currentMode === 'freemerge') {
            if (confirm('Bạn có chắc muốn làm mới và xóa tất cả tập tin trong danh sách ghép tự do?')) {
                state.freeFiles = [];
                state.freeMergedResult = null;
                state.freeMergedFileName = '';
                if (freeCompletionBanner) freeCompletionBanner.classList.add('hidden');
                if (freeProgressBarFill) freeProgressBarFill.style.width = '0%';
                if (freeProgressPercentVal) freeProgressPercentVal.textContent = '0%';
                if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = 'Sẵn sàng để ghép tài liệu...';
                if (freeLogConsole) {
                    freeLogConsole.innerHTML = '<div class="log-line info">[Sẵn sàng] Đã làm mới danh sách và xóa nhật ký. Vui lòng thêm file Word (.docx) để bắt đầu.</div>';
                }
                renderFreeQueue();
                showToast('Đã làm mới danh sách ghép tự do.');
            }
        } else {
            if (confirm('Bạn có chắc muốn làm mới và xóa tất cả tập tin đang nạp?')) {
                state.filesMap.clear();
                state.subjectsList = [];
                state.weeksMap = {};
                state.selectedWeeks.clear();
                state.mergedResults = {};
                if (completionBannerBox) completionBannerBox.classList.add('hidden');
                if (progressBarFill) progressBarFill.style.width = '0%';
                if (progressPercentVal) progressPercentVal.textContent = '0%';
                if (progressStatusMsg) progressStatusMsg.textContent = 'Sẵn sàng để ghép tài liệu...';
                if (executionLogConsole) {
                    executionLogConsole.innerHTML = '<div class="log-line info">[Sẵn sàng] Đã làm mới dữ liệu và xóa nhật ký. Vui lòng nạp giáo án để bắt đầu.</div>';
                }
                renderUI();
                showToast('Đã xóa dữ liệu và trở về trạng thái ban đầu.');
            }
        }
    });

    // ==========================================================================
    // Merge Engine & Execution (Chuẩn OpenXML ISO/IEC 29500)
    // ==========================================================================
    const standardNamespaces = {
        'wpc': 'http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas',
        'cx': 'http://schemas.microsoft.com/office/drawing/2014/chartex',
        'cx1': 'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex',
        'cx2': 'http://schemas.microsoft.com/office/drawing/2015/10/21/chartex',
        'cx3': 'http://schemas.microsoft.com/office/drawing/2016/5/9/chartex',
        'cx4': 'http://schemas.microsoft.com/office/drawing/2016/5/10/chartex',
        'cx5': 'http://schemas.microsoft.com/office/drawing/2016/5/11/chartex',
        'cx6': 'http://schemas.microsoft.com/office/drawing/2016/5/12/chartex',
        'cx7': 'http://schemas.microsoft.com/office/drawing/2016/5/13/chartex',
        'cx8': 'http://schemas.microsoft.com/office/drawing/2016/5/14/chartex',
        'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
        'aink': 'http://schemas.microsoft.com/office/drawing/2016/ink',
        'am3d': 'http://schemas.microsoft.com/office/drawing/2017/model3d',
        'o': 'urn:schemas-microsoft-com:office:office',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math',
        'v': 'urn:schemas-microsoft-com:vml',
        'wp14': 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing',
        'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
        'w10': 'urn:schemas-microsoft-com:office:word',
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
        'w15': 'http://schemas.microsoft.com/office/word/2012/wordml',
        'w16cex': 'http://schemas.microsoft.com/office/word/2018/wordml/cex',
        'w16cid': 'http://schemas.microsoft.com/office/word/2016/wordml/cid',
        'w16': 'http://schemas.microsoft.com/office/word/2018/wordml',
        'w16se': 'http://schemas.microsoft.com/office/word/2015/wordml/symex',
        'wpg': 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup',
        'wpi': 'http://schemas.microsoft.com/office/word/2010/wordprocessingInk',
        'wne': 'http://schemas.microsoft.com/office/word/2006/wordml',
        'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'a14': 'http://schemas.microsoft.com/office/drawing/2010/main',
        'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture'
    };

    function buildRootDocumentTag(allNamespacesMap) {
        let nsAttrs = '';
        for (const [k, v] of Object.entries(allNamespacesMap)) {
            nsAttrs += ` xmlns:${k}="${v}"`;
        }
        nsAttrs += ` mc:Ignorable="w14 w15 w16se w16cid w16 w16cex wp14"`;
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document${nsAttrs}>`;
    }

    function fixContentTypes(ctXml, zip) {
        const defaultsToAdd = [
            '<Default Extension="png" ContentType="image/png"/>',
            '<Default Extension="jpeg" ContentType="image/jpeg"/>',
            '<Default Extension="jpg" ContentType="image/jpeg"/>',
            '<Default Extension="gif" ContentType="image/gif"/>',
            '<Default Extension="emf" ContentType="image/x-emf"/>',
            '<Default Extension="wmf" ContentType="image/x-wmf"/>',
            '<Default Extension="svg" ContentType="image/svg+xml"/>',
            '<Default Extension="tif" ContentType="image/tiff"/>',
            '<Default Extension="tiff" ContentType="image/tiff"/>'
        ];
        defaultsToAdd.forEach(def => {
            const extMatch = def.match(/Extension="([^"]+)"/);
            if (extMatch && !ctXml.includes(`Extension="${extMatch[1]}"`)) {
                ctXml = ctXml.replace('</Types>', `  ${def}\n</Types>`);
            }
        });

        if (zip.file('word/numbering.xml') && !ctXml.includes('PartName="/word/numbering.xml"')) {
            ctXml = ctXml.replace('</Types>', '  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>\n</Types>');
        }
        return ctXml;
    }

    function buildCoverPageXml(info) {
        if (!info || !info.enabled) return '';

        const getField = (key, fallbackVal, fallbackLabel) => {
            if (info[key] && typeof info[key] === 'object') {
                return {
                    enabled: info[key].enabled !== false,
                    value: (info[key].value !== undefined ? info[key].value : (fallbackVal || '')).trim(),
                    label: (info[key].label !== undefined ? info[key].label : (fallbackLabel || '')).trim()
                };
            }
            const val = (info[key] !== undefined ? String(info[key]) : (fallbackVal || '')).trim();
            return {
                enabled: !!val,
                value: val,
                label: (fallbackLabel || '').trim()
            };
        };

        const parentOrg = getField('parentOrg', 'ỦY BAN NHÂN DÂN PHƯỜNG TRUNG NHỨT');
        const schoolName = getField('schoolName', 'TRƯỜNG TIỂU HỌC TRUNG NHỨT');
        const title = getField('title', 'KẾ HOẠCH BÀI DẠY');
        const subtitle = getField('subtitle', info.subTitle || 'LỚP 5A2');
        const teacher = getField('teacher', info.teacherName || 'Phan Thái Châu', 'Giáo viên:');
        const className = getField('className', '5A2', 'Lớp:');
        const schoolYear = getField('schoolYear', '2026 - 2027', 'Năm học:');
        const bottomLoc = getField('bottomLocation', 'NĂM HỌC 2026 - 2027');

        let topXml = '';
        if (parentOrg.enabled && parentOrg.value) {
            topXml += `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                    <w:spacing w:before="300" w:after="80" w:line="260" w:lineRule="auto"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:b/>
                        <w:sz w:val="26"/>
                        <w:szCs w:val="26"/>
                        <w:color w:val="1E293B"/>
                    </w:rPr>
                    <w:t>${escapeXml(parentOrg.value.toUpperCase())}</w:t>
                </w:r>
            </w:p>`;
        }
        if (schoolName.enabled && schoolName.value) {
            topXml += `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                    <w:spacing w:before="0" w:after="160" w:line="260" w:lineRule="auto"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:b/>
                        <w:sz w:val="28"/>
                        <w:szCs w:val="28"/>
                        <w:color w:val="1E293B"/>
                    </w:rPr>
                    <w:t>${escapeXml(schoolName.value.toUpperCase())}</w:t>
                </w:r>
            </w:p>`;
        }
        if ((parentOrg.enabled && parentOrg.value) || (schoolName.enabled && schoolName.value)) {
            topXml += `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                    <w:spacing w:before="0" w:after="1000"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:b/>
                        <w:sz w:val="24"/>
                        <w:color w:val="64748B"/>
                    </w:rPr>
                    <w:t>*** -------------------- ***</w:t>
                </w:r>
            </w:p>`;
        }

        let midXml = '';
        if (title.enabled && title.value) {
            midXml += `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                    <w:spacing w:before="800" w:after="300" w:line="360" w:lineRule="auto"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:b/>
                        <w:sz w:val="56"/>
                        <w:szCs w:val="56"/>
                        <w:color w:val="0F172A"/>
                    </w:rPr>
                    <w:t>${escapeXml(title.value.toUpperCase())}</w:t>
                </w:r>
            </w:p>`;
        }
        if (subtitle.enabled && subtitle.value) {
            midXml += `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                    <w:spacing w:before="100" w:after="300"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:b/>
                        <w:sz w:val="36"/>
                        <w:szCs w:val="36"/>
                        <w:color w:val="1E3A8A"/>
                    </w:rPr>
                    <w:t>${escapeXml(subtitle.value.toUpperCase())}</w:t>
                </w:r>
            </w:p>`;
        }
        if (title.enabled && title.value) {
            midXml += `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                    <w:spacing w:before="400" w:after="1400"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:sz w:val="36"/>
                        <w:color w:val="3B82F6"/>
                    </w:rPr>
                    <w:t>✦ ✧ ✦</w:t>
                </w:r>
            </w:p>`;
        }

        // Standard & Custom Info Lines
        const allInfoLines = [];
        if (teacher.enabled && (teacher.value || teacher.label)) allInfoLines.push(teacher);
        if (className.enabled && (className.value || className.label)) allInfoLines.push(className);
        if (schoolYear.enabled && (schoolYear.value || schoolYear.label)) allInfoLines.push(schoolYear);

        if (Array.isArray(info.customLines)) {
            info.customLines.forEach(c => {
                if (c.enabled !== false) {
                    const cVal = (c.value || '').trim();
                    const cLbl = (c.label || '').trim();
                    if (cVal || cLbl) {
                        allInfoLines.push({ value: cVal, label: cLbl });
                    }
                }
            });
        }

        let infoXml = '';
        allInfoLines.forEach((line, index) => {
            const isLast = (index === allInfoLines.length - 1);
            const afterSpacing = isLast ? '1400' : '140';
            infoXml += `
            <w:p>
                <w:pPr>
                    <w:ind w:left="2400"/>
                    <w:spacing w:before="0" w:after="${afterSpacing}" w:line="280" w:lineRule="auto"/>
                </w:pPr>
                ${line.label ? `
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:b/>
                        <w:sz w:val="28"/>
                        <w:szCs w:val="28"/>
                        <w:color w:val="1E293B"/>
                    </w:rPr>
                    <w:t xml:space="preserve">${escapeXml(line.label + ' ')}</w:t>
                </w:r>` : ''}
                ${line.value ? `
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:b/>
                        <w:sz w:val="28"/>
                        <w:szCs w:val="28"/>
                        <w:color w:val="0F172A"/>
                    </w:rPr>
                    <w:t>${escapeXml(line.value)}</w:t>
                </w:r>` : ''}
            </w:p>`;
        });

        let bottomXml = '';
        if (bottomLoc.enabled && bottomLoc.value) {
            bottomXml += `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                    <w:spacing w:before="1000" w:after="300"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
                        <w:b/>
                        <w:sz w:val="26"/>
                        <w:szCs w:val="26"/>
                        <w:color w:val="1E293B"/>
                    </w:rPr>
                    <w:t>${escapeXml(bottomLoc.value.toUpperCase())}</w:t>
                </w:r>
            </w:p>`;
        }

        return `
        <w:tbl>
            <w:tblPr>
                <w:tblW w:w="0" w:type="auto"/>
                <w:jc w:val="center"/>
                <w:tblBorders>
                    <w:top w:val="double" w:sz="18" w:space="0" w:color="1A365D"/>
                    <w:left w:val="double" w:sz="18" w:space="0" w:color="1A365D"/>
                    <w:bottom w:val="double" w:sz="18" w:space="0" w:color="1A365D"/>
                    <w:right w:val="double" w:sz="18" w:space="0" w:color="1A365D"/>
                </w:tblBorders>
                <w:tblCellMar>
                    <w:top w:w="720" w:type="dxa"/>
                    <w:left w:w="850" w:type="dxa"/>
                    <w:bottom w:w="720" w:type="dxa"/>
                    <w:right w:w="850" w:type="dxa"/>
                </w:tblCellMar>
            </w:tblPr>
            <w:tblGrid>
                <w:gridCol w:w="9350"/>
            </w:tblGrid>
            <w:tr>
                <w:trPr>
                    <w:cantSplit/>
                </w:trPr>
                <w:tc>
                    <w:tcPr>
                        <w:tcW w:w="9350" w:type="dxa"/>
                        <w:vAlign w:val="center"/>
                    </w:tcPr>
                    ${topXml}
                    ${midXml}
                    ${infoXml}
                    ${bottomXml}
                </w:tc>
            </w:tr>
        </w:tbl>
        <w:p><w:r><w:br w:type="page"/></w:r></w:p>
        `;
    }

    function buildSignatureXml(sigInfo) {
        if (!sigInfo || !sigInfo.enabled || sigInfo.layout === 'none') return '';
        const placeDate = sigInfo.placeDate || "Trung Nhứt, ngày     tháng     năm 202...";
        const bghRole = (sigInfo.bghRole || "HIỆU TRƯỞNG").toUpperCase();
        const bghName = sigInfo.bghName || "";
        const ttRole = (sigInfo.ttRole || "TỔ TRƯỞNG").toUpperCase();
        const ttName = sigInfo.ttName || "";
        const gvRole = (sigInfo.gvRole || "GIÁO VIÊN").toUpperCase();
        const gvName = sigInfo.gvName || "";

        // 1 cột: Người lập biểu / Giáo viên
        if (sigInfo.layout === '1col') {
            return `
                <w:p><w:pPr><w:spacing w:before="360" w:after="200"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
                <w:tbl>
                    <w:tblPr>
                        <w:tblW w:w="9360" w:type="dxa"/>
                        <w:tblBorders>
                            <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                        </w:tblBorders>
                    </w:tblPr>
                    <w:tblGrid>
                        <w:gridCol w:w="4680"/>
                        <w:gridCol w:w="4680"/>
                    </w:tblGrid>
                    <w:tr>
                        <w:tc><w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr><w:p><w:pPr/><w:r><w:t></w:t></w:r></w:p></w:tc>
                        <w:tc>
                            <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
                            <w:p>
                                <w:pPr><w:jc w:val="center"/></w:pPr>
                                <w:r>
                                    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:i/><w:sz w:val="24"/></w:rPr>
                                    <w:t xml:space="preserve">${escapeXml(placeDate)}</w:t>
                                </w:r>
                            </w:p>
                        </w:tc>
                    </w:tr>
                    <w:tr>
                        <w:tc><w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr><w:p><w:pPr/><w:r><w:t></w:t></w:r></w:p></w:tc>
                        <w:tc>
                            <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
                            <w:p>
                                <w:pPr><w:jc w:val="center"/></w:pPr>
                                <w:r>
                                    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                    <w:t>${escapeXml(gvRole)}</w:t>
                                </w:r>
                            </w:p>
                            <w:p><w:pPr><w:spacing w:before="800"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
                            <w:p>
                                <w:pPr><w:jc w:val="center"/></w:pPr>
                                <w:r>
                                    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                    <w:t>${escapeXml(gvName)}</w:t>
                                </w:r>
                            </w:p>
                        </w:tc>
                    </w:tr>
                </w:tbl>
            `;
        }

        // 2 cột: Tổ trưởng & Giáo viên
        if (sigInfo.layout === '2col') {
            return `
                <w:p><w:pPr><w:spacing w:before="360" w:after="200"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
                <w:tbl>
                    <w:tblPr>
                        <w:tblW w:w="9360" w:type="dxa"/>
                        <w:tblBorders>
                            <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                            <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                        </w:tblBorders>
                    </w:tblPr>
                    <w:tblGrid>
                        <w:gridCol w:w="4680"/>
                        <w:gridCol w:w="4680"/>
                    </w:tblGrid>
                    <w:tr>
                        <w:tc><w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr><w:p><w:pPr/><w:r><w:t></w:t></w:r></w:p></w:tc>
                        <w:tc>
                            <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
                            <w:p>
                                <w:pPr><w:jc w:val="center"/></w:pPr>
                                <w:r>
                                    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:i/><w:sz w:val="24"/></w:rPr>
                                    <w:t xml:space="preserve">${escapeXml(placeDate)}</w:t>
                                </w:r>
                            </w:p>
                        </w:tc>
                    </w:tr>
                    <w:tr>
                        <w:tc>
                            <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
                            <w:p>
                                <w:pPr><w:jc w:val="center"/></w:pPr>
                                <w:r>
                                    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                    <w:t>${escapeXml(ttRole)}</w:t>
                                </w:r>
                            </w:p>
                            <w:p><w:pPr><w:spacing w:before="800"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
                            <w:p>
                                <w:pPr><w:jc w:val="center"/></w:pPr>
                                <w:r>
                                    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                    <w:t>${escapeXml(ttName)}</w:t>
                                </w:r>
                            </w:p>
                        </w:tc>
                        <w:tc>
                            <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
                            <w:p>
                                <w:pPr><w:jc w:val="center"/></w:pPr>
                                <w:r>
                                    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                    <w:t>${escapeXml(gvRole)}</w:t>
                                </w:r>
                            </w:p>
                            <w:p><w:pPr><w:spacing w:before="800"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
                            <w:p>
                                <w:pPr><w:jc w:val="center"/></w:pPr>
                                <w:r>
                                    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                    <w:t>${escapeXml(gvName)}</w:t>
                                </w:r>
                            </w:p>
                        </w:tc>
                    </w:tr>
                </w:tbl>
            `;
        }

        // 3 cột chuẩn: BGH - Tổ Trưởng - Giáo Viên (Mặc định)
        return `
            <w:p><w:pPr><w:spacing w:before="360" w:after="200"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
            <w:tbl>
                <w:tblPr>
                    <w:tblW w:w="9360" w:type="dxa"/>
                    <w:tblBorders>
                        <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                        <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                        <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                        <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                        <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                        <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
                    </w:tblBorders>
                </w:tblPr>
                <w:tblGrid>
                    <w:gridCol w:w="2800"/>
                    <w:gridCol w:w="2800"/>
                    <w:gridCol w:w="3760"/>
                </w:tblGrid>
                <w:tr>
                    <w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/></w:tcPr><w:p><w:pPr/><w:r><w:t></w:t></w:r></w:p></w:tc>
                    <w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/></w:tcPr><w:p><w:pPr/><w:r><w:t></w:t></w:r></w:p></w:tc>
                    <w:tc>
                        <w:tcPr><w:tcW w:w="3760" w:type="dxa"/></w:tcPr>
                        <w:p>
                            <w:pPr><w:jc w:val="center"/></w:pPr>
                            <w:r>
                                <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:i/><w:sz w:val="24"/></w:rPr>
                                <w:t xml:space="preserve">${escapeXml(placeDate)}</w:t>
                            </w:r>
                        </w:p>
                    </w:tc>
                </w:tr>
                <w:tr>
                    <w:tc>
                        <w:tcPr><w:tcW w:w="2800" w:type="dxa"/></w:tcPr>
                        <w:p>
                            <w:pPr><w:jc w:val="center"/></w:pPr>
                            <w:r>
                                <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                <w:t>${escapeXml(bghRole)}</w:t>
                            </w:r>
                        </w:p>
                        <w:p><w:pPr><w:spacing w:before="800"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
                        <w:p>
                            <w:pPr><w:jc w:val="center"/></w:pPr>
                            <w:r>
                                <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                <w:t>${escapeXml(bghName)}</w:t>
                            </w:r>
                        </w:p>
                    </w:tc>
                    <w:tc>
                        <w:tcPr><w:tcW w:w="2800" w:type="dxa"/></w:tcPr>
                        <w:p>
                            <w:pPr><w:jc w:val="center"/></w:pPr>
                            <w:r>
                                <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                <w:t>${escapeXml(ttRole)}</w:t>
                            </w:r>
                        </w:p>
                        <w:p><w:pPr><w:spacing w:before="800"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
                        <w:p>
                            <w:pPr><w:jc w:val="center"/></w:pPr>
                            <w:r>
                                <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                <w:t>${escapeXml(ttName)}</w:t>
                            </w:r>
                        </w:p>
                    </w:tc>
                    <w:tc>
                        <w:tcPr><w:tcW w:w="3760" w:type="dxa"/></w:tcPr>
                        <w:p>
                            <w:pPr><w:jc w:val="center"/></w:pPr>
                            <w:r>
                                <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                <w:t>${escapeXml(gvRole)}</w:t>
                            </w:r>
                        </w:p>
                        <w:p><w:pPr><w:spacing w:before="800"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
                        <w:p>
                            <w:pPr><w:jc w:val="center"/></w:pPr>
                            <w:r>
                                <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>
                                <w:t>${escapeXml(gvName)}</w:t>
                            </w:r>
                        </w:p>
                    </w:tc>
                </w:tr>
            </w:tbl>
        `;
    }

    // Trích xuất phần thân nội dung của file Word an toàn, không làm đứt đoạn thẻ paragraph
    function extractBodyContent(docXml) {
        const bodyStartTag = '<w:body>';
        const startIdx = docXml.indexOf(bodyStartTag);
        const endIdx = docXml.lastIndexOf('</w:body>');
        if (startIdx === -1 || endIdx === -1) return '';
        let body = docXml.substring(startIdx + bodyStartTag.length, endIdx);

        // Loại bỏ sectPr cuối cùng của văn bản để nối các môn liền mạch
        const lastSectIdx = body.lastIndexOf('<w:sectPr');
        if (lastSectIdx !== -1) {
            const beforeSect = body.substring(0, lastSectIdx);
            const lastPIdx = beforeSect.lastIndexOf('<w:p');
            const lastPCloseIdx = beforeSect.lastIndexOf('</w:p>');
            if (lastPIdx !== -1 && lastPIdx > lastPCloseIdx) {
                body = beforeSect.substring(0, lastPIdx);
            } else {
                body = beforeSect;
            }
        }
        return body;
    }

    // ==========================================================================
    // BỘ NÉN & TỐI ƯU HÓA HÌNH ẢNH FILE WORD (.DOCX) CHUYÊN SÂU
    // ==========================================================================
    const COMPRESS_PRESETS = {
        deep: {
            quality: 0.70,
            maxWidth: 1200,
            pngStrategy: 'auto-jpg',
            colorMode: 'color',
            removeThumbnail: true,
            maxZip: true
        },
        standard: {
            quality: 0.82,
            maxWidth: 1600,
            pngStrategy: 'keep-png',
            colorMode: 'color',
            removeThumbnail: false,
            maxZip: true
        },
        ultra: {
            quality: 0.50,
            maxWidth: 800,
            pngStrategy: 'force-jpg',
            colorMode: 'color',
            removeThumbnail: true,
            maxZip: true
        },
        grayscale: {
            quality: 0.58,
            maxWidth: 1000,
            pngStrategy: 'force-jpg',
            colorMode: 'grayscale',
            removeThumbnail: true,
            maxZip: true
        }
    };

    async function compressDocxBytes(inputBuffer, modeKey = 'deep', onProgress) {
        const config = COMPRESS_PRESETS[modeKey] || COMPRESS_PRESETS.deep;
        try {
            const zip = await JSZip.loadAsync(inputBuffer);

            // 1. Xóa thumbnail ẩn nếu có
            if (config.removeThumbnail) {
                zip.remove("docProps/thumbnail.emf");
                zip.remove("docProps/thumbnail.wmf");
                zip.remove("docProps/thumbnail.jpeg");
                const rootRels = zip.file("_rels/.rels");
                if (rootRels) {
                    let text = await rootRels.async("string");
                    text = text.replace(/<Relationship[^>]+Target="docProps\/thumbnail\.[^"]+"[^>]*\/>/g, '');
                    zip.file("_rels/.rels", text);
                }
            }

            // 2. Tìm tất cả ảnh trong word/media/
            const mediaEntries = [];
            zip.forEach((relPath, entry) => {
                if (!entry.dir && relPath.toLowerCase().startsWith("word/media/")) {
                    mediaEntries.push(entry);
                }
            });

            if (mediaEntries.length === 0) {
                return inputBuffer;
            }

            const renamedMap = new Map();
            let count = 0;

            for (const entry of mediaEntries) {
                count++;
                if (onProgress) {
                    onProgress(`Đang tối ưu ảnh ${count}/${mediaEntries.length}...`);
                }
                const match = entry.name.match(/word\/media\/(.+)$/i);
                const simpleName = match ? match[1] : '';
                const extMatch = entry.name.match(/\.([a-zA-Z0-9]+)$/);
                const ext = extMatch ? extMatch[1].toLowerCase() : '';

                if (['jpg', 'jpeg', 'png'].includes(ext)) {
                    const rawBytes = await entry.async("uint8array");
                    // Nén nếu ảnh >= 20KB
                    if (rawBytes.byteLength >= 20480) {
                        const res = await compressSingleImage(rawBytes, ext, config);
                        if (res && res.bytes) {
                            if (res.targetFormat === 'jpg' && ext === 'png') {
                                const newSimpleName = simpleName.replace(/\.png$/i, '.jpg');
                                const newFullPath = `word/media/${newSimpleName}`;
                                zip.remove(entry.name);
                                zip.file(newFullPath, res.bytes);
                                renamedMap.set(simpleName, newSimpleName);
                            } else if (res.bytes.byteLength < rawBytes.byteLength) {
                                zip.file(entry.name, res.bytes);
                            }
                        }
                    }
                }
            }

            // 3. Cập nhật mối liên kết XML nếu có ảnh chuyển từ PNG -> JPG
            if (renamedMap.size > 0) {
                const relsEntries = [];
                zip.forEach((path, entry) => {
                    if (!entry.dir && path.toLowerCase().endsWith(".rels")) {
                        relsEntries.push(entry);
                    }
                });
                for (const relsEntry of relsEntries) {
                    let content = await relsEntry.async("string");
                    let modified = false;
                    for (const [oldName, newName] of renamedMap.entries()) {
                        if (content.includes(oldName)) {
                            content = content.replaceAll(oldName, newName);
                            modified = true;
                        }
                    }
                    if (modified) zip.file(relsEntry.name, content);
                }

                const ctEntry = zip.file("[Content_Types].xml");
                if (ctEntry) {
                    let ct = await ctEntry.async("string");
                    if (!ct.includes('Extension="jpg"')) {
                        ct = ct.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>');
                    }
                    for (const [oldName, newName] of renamedMap.entries()) {
                        if (ct.includes(oldName)) {
                            ct = ct.replaceAll(oldName, newName);
                            ct = ct.replaceAll(`PartName="/word/media/${newName}" ContentType="image/png"`, `PartName="/word/media/${newName}" ContentType="image/jpeg"`);
                        }
                    }
                    zip.file("[Content_Types].xml", ct);
                }
            }

            // 4. Đóng gói lại ZIP với mức nén tối đa (Deflate Level 9)
            return await zip.generateAsync({
                type: "uint8array",
                compression: "DEFLATE",
                compressionOptions: { level: config.maxZip ? 9 : 6 }
            });
        } catch (err) {
            console.warn('Lỗi trong quá trình nén ảnh DOCX:', err);
            return inputBuffer; // Trả về bản gốc nếu có bất kỳ lỗi nào, an toàn 100%
        }
    }

    function compressSingleImage(bytes, ext, config) {
        return new Promise((resolve) => {
            try {
                if (typeof Image === 'undefined' || typeof document === 'undefined') {
                    resolve(null);
                    return;
                }
                const origMime = ext === 'png' ? 'image/png' : 'image/jpeg';
                const blob = new Blob([bytes], { type: origMime });
                const img = new Image();
                const url = URL.createObjectURL(blob);

                img.onload = () => {
                    URL.revokeObjectURL(url);
                    let width = img.naturalWidth || img.width;
                    let height = img.naturalHeight || img.height;

                    const maxDim = config.maxWidth;
                    if (width > maxDim || height > maxDim) {
                        if (width >= height) {
                            height = Math.round(height * (maxDim / width));
                            width = maxDim;
                        } else {
                            width = Math.round(width * (maxDim / height));
                            height = maxDim;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let targetFormat = ext === 'png' ? 'png' : 'jpg';
                    if (ext === 'png') {
                        if (config.pngStrategy === 'force-jpg') {
                            targetFormat = 'jpg';
                        } else if (config.pngStrategy === 'auto-jpg') {
                            let hasAlpha = false;
                            try {
                                const imgData = ctx.getImageData(0, 0, width, height).data;
                                for (let i = 3; i < imgData.length; i += 16) {
                                    if (imgData[i] < 240) { hasAlpha = true; break; }
                                }
                            } catch (e) {}
                            if (!hasAlpha) targetFormat = 'jpg';
                        }
                    }

                    if (targetFormat === 'jpg') {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.fillStyle = '#ffffff';
                        tempCtx.fillRect(0, 0, width, height);
                        tempCtx.drawImage(canvas, 0, 0);
                        ctx.clearRect(0, 0, width, height);
                        ctx.drawImage(tempCanvas, 0, 0);
                    }

                    if (config.colorMode === 'grayscale') {
                        const imgData = ctx.getImageData(0, 0, width, height);
                        const d = imgData.data;
                        for (let i = 0; i < d.length; i += 4) {
                            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                            d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
                        }
                        ctx.putImageData(imgData, 0, 0);
                    }

                    const exportMime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
                    canvas.toBlob((newBlob) => {
                        if (!newBlob) { resolve(null); return; }
                        newBlob.arrayBuffer().then(buf => {
                            resolve({
                                bytes: new Uint8Array(buf),
                                targetFormat: targetFormat
                            });
                        });
                    }, exportMime, targetFormat === 'jpg' ? config.quality : undefined);
                };

                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve(null);
                };
                img.src = url;
            } catch (e) {
                resolve(null);
            }
        });
    }

    // Ghép tài liệu Word an toàn tuyệt đối, hỗ trợ cả 1 môn và nhiều môn (Chuẩn OpenXML ISO/IEC 29500)
    async function mergeWordDocuments(buffers, options = {}) {
        const {
            pageBreak = true,
            continuousPage = true,
            sigInfo = null,
            coverInfo = null
        } = options;
        if (!buffers || buffers.length === 0) throw new Error('Không có file nào để ghép');

        const PAGE_BREAK_XML = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        const coverXml = (coverInfo && coverInfo.enabled) ? buildCoverPageXml(coverInfo) : '';
        const sigXml = (sigInfo && sigInfo.enabled) ? buildSignatureXml(sigInfo) : '';

        // Lập bản đồ namespace tổng hợp từ tất cả buffers + standard
        const allNamespaces = Object.assign({}, standardNamespaces);
        for (const buf of buffers) {
            try {
                const z = await JSZip.loadAsync(buf);
                const dXml = await z.file('word/document.xml').async('string');
                const rootSub = dXml.substring(0, dXml.indexOf('<w:body>'));
                const nsRegex = /xmlns:([a-zA-Z0-9_\-]+)="([^"]+)"/g;
                let m;
                while ((m = nsRegex.exec(rootSub)) !== null) {
                    allNamespaces[m[1]] = m[2];
                }
            } catch (_) {}
        }

        // Trường hợp 1 file duy nhất (ghép 1 môn cho tuần):
        if (buffers.length === 1) {
            const zip = await JSZip.loadAsync(buffers[0]);
            let docXml = await zip.file('word/document.xml').async('string');

            // Bổ sung đầy đủ namespace tránh lỗi prefix undeclared
            const bodyStart = docXml.indexOf('<w:body>');
            docXml = buildRootDocumentTag(allNamespaces) + docXml.substring(bodyStart);

            // Chèn trang bìa nếu có
            if (coverXml) {
                const bodyIdx = docXml.indexOf('<w:body>') + '<w:body>'.length;
                docXml = docXml.substring(0, bodyIdx) + coverXml + docXml.substring(bodyIdx);
            }

            // Chèn khối chữ ký nếu có
            if (sigXml) {
                const bodyEnd = docXml.lastIndexOf('</w:body>');
                const lastSect = docXml.lastIndexOf('<w:sectPr');
                if (lastSect !== -1 && lastSect > docXml.indexOf('<w:body>')) {
                    const before = docXml.substring(0, lastSect);
                    const lastP = before.lastIndexOf('<w:p');
                    const lastPClose = before.lastIndexOf('</w:p>');
                    let insertPoint = lastSect;
                    if (lastP !== -1 && lastP > lastPClose) {
                        insertPoint = lastP;
                    }
                    docXml = docXml.substring(0, insertPoint) + sigXml + docXml.substring(insertPoint);
                } else if (bodyEnd !== -1) {
                    docXml = docXml.substring(0, bodyEnd) + sigXml + docXml.substring(bodyEnd);
                }
            }

            if (continuousPage) {
                docXml = docXml.replace(/(<w:pgNumType\b[^>]*?)\s+w:start="[^"]*"/gi, '$1');
            }

            // Fix [Content_Types].xml
            let ctXml = await zip.file('[Content_Types].xml').async('string');
            ctXml = fixContentTypes(ctXml, zip);
            zip.file('[Content_Types].xml', ctXml);

            zip.file('word/document.xml', docXml);
            return await zip.generateAsync({ type: 'uint8array' });
        }

        // Trường hợp nhiều file: lấy file đầu tiên làm template gốc
        const baseZip = await JSZip.loadAsync(buffers[0]);
        let baseDocXml = await baseZip.file('word/document.xml').async('string');

        // Trích xuất sectPr cuối cùng của base file
        const lastSectIdx = baseDocXml.lastIndexOf('<w:sectPr');
        let finalSectPr = '<w:sectPr/>';
        if (lastSectIdx !== -1) {
            const sectEndIdx = baseDocXml.indexOf('</w:sectPr>', lastSectIdx);
            if (sectEndIdx !== -1) {
                finalSectPr = baseDocXml.substring(lastSectIdx, sectEndIdx + 11);
            } else {
                const selfCloseIdx = baseDocXml.indexOf('/>', lastSectIdx);
                if (selfCloseIdx !== -1) {
                    finalSectPr = baseDocXml.substring(lastSectIdx, selfCloseIdx + 2);
                }
            }
        }

        let baseRelsFile = baseZip.file('word/_rels/document.xml.rels');
        let baseRelsXml = baseRelsFile ? await baseRelsFile.async('string') : null;

        let combinedBody = extractBodyContent(baseDocXml);

        for (let i = 1; i < buffers.length; i++) {
            const nextZip = await JSZip.loadAsync(buffers[i]);
            let nextDocXml = await nextZip.file('word/document.xml').async('string');
            let nextRelsFile = nextZip.file('word/_rels/document.xml.rels');
            let nextRelsXml = nextRelsFile ? await nextRelsFile.async('string') : null;

            // Xử lý quan hệ hình ảnh & media tránh xung đột rId và đè hình ảnh
            if (nextRelsXml && baseRelsXml) {
                const relRegex = /<Relationship\b([^>]*?)\/?>/gi;
                let match;
                const idMap = new Map();
                const newRelsToAdd = [];

                while ((match = relRegex.exec(nextRelsXml)) !== null) {
                    const attrStr = match[1];
                    const idM = attrStr.match(/Id="([^"]+)"/);
                    const typeM = attrStr.match(/Type="([^"]+)"/);
                    const targetM = attrStr.match(/Target="([^"]+)"/);
                    const targetModeM = attrStr.match(/TargetMode="([^"]+)"/);

                    if (idM && typeM && targetM) {
                        const oldId = idM[1];
                        const type = typeM[1];
                        const target = targetM[1];
                        const targetMode = targetModeM ? targetModeM[1] : null;

                        const isImage = type.includes('/image') || target.startsWith('media/') || target.startsWith('../media/');
                        const isHyperlink = type.includes('/hyperlink');

                        if (isImage) {
                            let cleanTarget = target.replace(/^(\.\.\/)+/, '').replace(/^word\//, '');
                            const mediaZipPath = 'word/' + (cleanTarget.startsWith('media/') ? cleanTarget : 'media/' + cleanTarget);
                            const mFile = nextZip.file(mediaZipPath);
                            if (mFile) {
                                const fileNameOnly = cleanTarget.split('/').pop();
                                const newTargetName = `media/doc${i}_${fileNameOnly}`;
                                const newZipPath = `word/${newTargetName}`;
                                const mdata = await mFile.async('uint8array');
                                baseZip.file(newZipPath, mdata);

                                const newId = `rIdDoc${i}_${oldId}`;
                                idMap.set(oldId, newId);
                                const targetModeAttr = targetMode ? ` TargetMode="${targetMode}"` : '';
                                newRelsToAdd.push(`<Relationship Id="${newId}" Type="${type}" Target="${newTargetName}"${targetModeAttr}/>`);
                            }
                        } else if (isHyperlink) {
                            const newId = `rIdDoc${i}_${oldId}`;
                            idMap.set(oldId, newId);
                            const targetModeAttr = targetMode ? ` TargetMode="${targetMode}"` : '';
                            newRelsToAdd.push(`<Relationship Id="${newId}" Type="${type}" Target="${escapeXml(target)}"${targetModeAttr}/>`);
                        }
                    }
                }

                // Cập nhật các tham chiếu rId trong XML tài liệu tiếp theo
                for (const [oldId, newId] of idMap.entries()) {
                    const embedRegex = new RegExp(`(r:embed="|r:id="|r:link=")(${oldId})(")`, 'g');
                    nextDocXml = nextDocXml.replace(embedRegex, `$1${newId}$3`);
                }

                // Bổ sung các Relationship mới vào baseRelsXml
                if (newRelsToAdd.length > 0) {
                    const relsEndIdx = baseRelsXml.lastIndexOf('</Relationships>');
                    if (relsEndIdx !== -1) {
                        baseRelsXml = baseRelsXml.substring(0, relsEndIdx) + newRelsToAdd.join('') + '</Relationships>';
                    }
                }
            } else {
                // Fallback nếu không có rels: copy media thô
                const mediaFiles = nextZip.file(/^word\/media\//);
                for (const mf of mediaFiles) {
                    if (!baseZip.file(mf.name)) {
                        const mdata = await mf.async('uint8array');
                        baseZip.file(mf.name, mdata);
                    }
                }
            }

            // Gộp numbering.xml nếu base chưa có
            if (nextZip.file('word/numbering.xml') && !baseZip.file('word/numbering.xml')) {
                const numData = await nextZip.file('word/numbering.xml').async('uint8array');
                baseZip.file('word/numbering.xml', numData);
                if (baseRelsXml && !baseRelsXml.includes('relationships/numbering')) {
                    const numRel = `<Relationship Id="rIdNumbering_${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`;
                    const relsEndIdx = baseRelsXml.lastIndexOf('</Relationships>');
                    if (relsEndIdx !== -1) {
                        baseRelsXml = baseRelsXml.substring(0, relsEndIdx) + numRel + '</Relationships>';
                    }
                }
            }

            let nextBody = extractBodyContent(nextDocXml);
            // Bỏ header/footer reference rời rạc ở giữa các file tránh lỗi
            nextBody = nextBody.replace(/<w:headerReference\b[^>]*\/>/gi, '');
            nextBody = nextBody.replace(/<w:footerReference\b[^>]*\/>/gi, '');

            if (pageBreak) {
                combinedBody += PAGE_BREAK_XML;
            }
            combinedBody += nextBody;
        }

        if (baseRelsXml && baseRelsFile) {
            baseZip.file('word/_rels/document.xml.rels', baseRelsXml);
        }

        // Bổ sung Cover Page nếu có
        if (coverXml) {
            combinedBody = coverXml + combinedBody;
        }

        // Bổ sung Signature nếu có
        if (sigXml) {
            combinedBody += sigXml;
        }

        const docHeader = buildRootDocumentTag(allNamespaces) + '<w:body>';
        let finalDocXml = docHeader + combinedBody + finalSectPr + '</w:body></w:document>';

        if (continuousPage) {
            finalDocXml = finalDocXml.replace(/(<w:pgNumType\b[^>]*?)\s+w:start="[^"]*"/gi, '$1');
        }

        // Fix [Content_Types].xml
        let ctXml = await baseZip.file('[Content_Types].xml').async('string');
        ctXml = fixContentTypes(ctXml, baseZip);
        baseZip.file('[Content_Types].xml', ctXml);

        baseZip.file('word/document.xml', finalDocXml);
        return await baseZip.generateAsync({ type: 'uint8array' });
    }

    function setGiaoAnButtonsLoading(loading) {
        const btns = [btnStartMerge, btnStartMergeBottom].filter(Boolean);
        btns.forEach(b => {
            b.disabled = loading;
            b.style.opacity = loading ? '0.5' : '';
            b.style.cursor = loading ? 'not-allowed' : '';
            if (loading) {
                b.innerHTML = `
                    <span class="spinner-loader" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>
                    ĐANG GHÉP TÀI LIỆU...
                `;
            } else {
                b.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    BẮT ĐẦU GHÉP TÀI LIỆU
                `;
            }
        });
    }

    async function executeGiaoAnMerge() {
        if (!state.selectedWeeks || state.selectedWeeks.size === 0) {
            alert('Vui lòng chọn ít nhất một tuần để tiến hành ghép!');
            switchTab('tab-files');
            return;
        }

        const enabledSubjectNames = state.subjectsList.filter(s => s.enabled).map(s => s.name);
        if (enabledSubjectNames.length === 0) {
            alert('Vui lòng bật ít nhất một môn học trong danh sách ghép!');
            switchTab('tab-files');
            return;
        }

        // Khóa và làm mờ cả 2 nút ghép khi đang chạy
        setGiaoAnButtonsLoading(true);

        try {
            switchTab('tab-process');
            if (completionBannerBox) completionBannerBox.classList.add('hidden');
            if (btnExportSingleDocx) btnExportSingleDocx.classList.add('hidden');

            if (executionLogConsole) {
                executionLogConsole.innerHTML = '';
            }

            if (progressBarFill) progressBarFill.style.width = '0%';
            if (progressPercentVal) progressPercentVal.textContent = '0%';
            if (progressStatusMsg) progressStatusMsg.textContent = 'Đang khởi động ghép tài liệu...';

            state.mergedResults = {};
            const weeksArray = Array.from(state.selectedWeeks).sort((a, b) => a - b);
            const totalWeeks = weeksArray.length;

            const sigInfo = {
                enabled: chkEnableSignature ? chkEnableSignature.checked : false,
                layout: state.sigLayout || '3col',
                placeDate: sigPlaceDate ? sigPlaceDate.value.trim() : '',
                bghRole: sigBghRole ? sigBghRole.value.trim() : '',
                bghName: sigBghName ? sigBghName.value.trim() : '',
                ttRole: sigTtRole ? sigTtRole.value.trim() : '',
                ttName: sigTtName ? sigTtName.value.trim() : '',
                gvRole: sigGvRole ? sigGvRole.value.trim() : '',
                gvName: sigGvName ? sigGvName.value.trim() : ''
            };

            const coverInfo = getCoverInfo();

            const tengv = (inputTenGv ? inputTenGv.value.trim() : '') || 'Chau';
            const pattern = (inputNamingPattern ? inputNamingPattern.value.trim() : '') || '{tengv}_KHBD_Tuan_{week}_Lop_{lop}.docx';
            const bundlePattern = (inputBundlePattern ? inputBundlePattern.value.trim() : '') || '{tengv}_KHBD_Tuan_{min_week}_den_{max_week}_Lop_{lop}.docx';
            const lop = (inputLopName ? inputLopName.value.trim() : '') || '5';
            const pageBreak = chkPageBreak ? chkPageBreak.checked : true;
            const continuousPage = chkContinuousPage ? chkContinuousPage.checked : true;

            if (state.exportMode === 'bundle') {
                // ==============================================================
                // BẢN V3: CHẾ ĐỘ GỘP NHIỀU TUẦN THÀNH 1 FILE DUY NHẤT
                // ==============================================================
                appendLog(`[BẢN V3] Bắt đầu gộp ${totalWeeks} tuần thành 1 FILE DUY NHẤT...`, 'info');
                if (coverInfo.enabled) {
                    appendLog(`✓ Trang bìa: ĐÃ BẬT ("${coverInfo.title}" - GV: ${coverInfo.teacherName})`, 'info');
                } else {
                    appendLog(`- Trang bìa: Không kích hoạt`, 'info');
                }

                const minW = weeksArray[0];
                const maxW = weeksArray[weeksArray.length - 1];
                const minWPad = minW < 10 ? '0' + minW : String(minW);
                const maxWPad = maxW < 10 ? '0' + maxW : String(maxW);

                let bundleFileName = bundlePattern
                    .replace(/\{tengv\}/gi, tengv)
                    .replace(/\{min_week\}/gi, minWPad)
                    .replace(/\{max_week\}/gi, maxWPad)
                    .replace(/\{min_w\}/gi, String(minW))
                    .replace(/\{max_w\}/gi, String(maxW))
                    .replace(/\{count_weeks\}/gi, String(totalWeeks))
                    .replace(/\{lop\}/gi, lop);
                if (!bundleFileName.toLowerCase().endsWith('.docx')) bundleFileName += '.docx';
                bundleFileName = bundleFileName.replace(/[<>:"/\\|?*]/g, '_');

                if (state.bundleSigPos === 'each') {
                    // Chữ ký đặt ở CUỐI MỖI TUẦN: ghép từng tuần (có chữ ký tuần), sau đó nối lại kèm bìa
                    appendLog(`Chế độ chữ ký: Đặt ở CUỐI MỖI TUẦN (${totalWeeks} khối chữ ký)`, 'info');
                    const weeklyMergedBuffers = [];

                    for (let idx = 0; idx < totalWeeks; idx++) {
                        const week = weeksArray[idx];
                        const weekPad = week < 10 ? '0' + week : String(week);
                        if (progressStatusMsg) progressStatusMsg.textContent = `Đang xử lý Tuần ${weekPad} (${idx + 1}/${totalWeeks})...`;

                        const wFilesMap = (state.weeksMap[week] && state.weeksMap[week].files) || {};
                        const filesToMerge = [];
                        for (const subName of enabledSubjectNames) {
                            const subFiles = wFilesMap[subName];
                            if (subFiles) {
                                if (Array.isArray(subFiles)) filesToMerge.push(...subFiles);
                                else filesToMerge.push(subFiles);
                            }
                        }

                        if (filesToMerge.length === 0) {
                            appendLog(`Tuần ${weekPad}: Không có file nào, bỏ qua.`, 'warn');
                            continue;
                        }

                        appendLog(`Tuần ${weekPad}: Chuẩn bị ${filesToMerge.length} file môn học...`, 'info');
                        const wBuffers = [];
                        for (const f of filesToMerge) {
                            wBuffers.push(await f.arrayBuffer());
                        }

                        const wBytes = await mergeWordDocuments(wBuffers, {
                            pageBreak: pageBreak,
                            continuousPage: continuousPage,
                            sigInfo: sigInfo,
                            coverInfo: null
                        });
                        weeklyMergedBuffers.push(wBytes);

                        const pct = Math.round(((idx + 1) / totalWeeks) * 85);
                        if (progressBarFill) progressBarFill.style.width = pct + '%';
                        if (progressPercentVal) progressPercentVal.textContent = pct + '%';
                    }

                    if (weeklyMergedBuffers.length === 0) {
                        throw new Error('Không tìm thấy tài liệu nào trong các tuần đã chọn!');
                    }

                    if (progressStatusMsg) progressStatusMsg.textContent = 'Đang gộp tất cả các tuần thành 1 file hoàn chỉnh...';
                    appendLog(`Đang liên kết tất cả các tuần thành file "${bundleFileName}"...`, 'info');

                    const finalBundleBytes = await mergeWordDocuments(weeklyMergedBuffers, {
                        pageBreak: pageBreak,
                        continuousPage: continuousPage,
                        sigInfo: null, // Đã có trong từng tuần
                        coverInfo: coverInfo
                    });

                    state.mergedResults[bundleFileName] = finalBundleBytes;

                } else {
                    // Chữ ký đặt DUY NHẤT Ở CUỐI TOÀN BỘ FILE GỘP (mặc định)
                    appendLog(`Chế độ chữ ký: Đặt DUY NHẤT ở cuối toàn bộ file gộp`, 'info');
                    const allFilesOverall = [];

                    for (let idx = 0; idx < totalWeeks; idx++) {
                        const week = weeksArray[idx];
                        const weekPad = week < 10 ? '0' + week : String(week);
                        if (progressStatusMsg) progressStatusMsg.textContent = `Đang đọc tài liệu Tuần ${weekPad} (${idx + 1}/${totalWeeks})...`;

                        const wFilesMap = (state.weeksMap[week] && state.weeksMap[week].files) || {};
                        const filesToMerge = [];
                        for (const subName of enabledSubjectNames) {
                            const subFiles = wFilesMap[subName];
                            if (subFiles) {
                                if (Array.isArray(subFiles)) filesToMerge.push(...subFiles);
                                else filesToMerge.push(subFiles);
                            }
                        }

                        if (filesToMerge.length === 0) {
                            appendLog(`Tuần ${weekPad}: Không có file nào, bỏ qua.`, 'warn');
                            continue;
                        }

                        appendLog(`Tuần ${weekPad}: Gom ${filesToMerge.length} file môn học.`, 'info');
                        for (const f of filesToMerge) {
                            allFilesOverall.push(f);
                        }

                        const pct = Math.round(((idx + 1) / totalWeeks) * 60);
                        if (progressBarFill) progressBarFill.style.width = pct + '%';
                        if (progressPercentVal) progressPercentVal.textContent = pct + '%';
                    }

                    if (allFilesOverall.length === 0) {
                        throw new Error('Không tìm thấy tài liệu nào trong các tuần đã chọn!');
                    }

                    appendLog(`Tổng cộng gom được ${allFilesOverall.length} file môn học từ ${totalWeeks} tuần. Bắt đầu ghép...`, 'info');
                    const allBuffers = [];
                    for (let i = 0; i < allFilesOverall.length; i++) {
                        const f = allFilesOverall[i];
                        allBuffers.push(await f.arrayBuffer());
                        const pct = 60 + Math.round(((i + 1) / allFilesOverall.length) * 30);
                        if (progressBarFill) progressBarFill.style.width = pct + '%';
                        if (progressPercentVal) progressPercentVal.textContent = pct + '%';
                    }

                    if (progressStatusMsg) progressStatusMsg.textContent = 'Đang xử lý chuẩn OpenXML và hoàn tất file gộp...';
                    const finalBundleBytes = await mergeWordDocuments(allBuffers, {
                        pageBreak: pageBreak,
                        continuousPage: continuousPage,
                        sigInfo: sigInfo,
                        coverInfo: coverInfo
                    });

                    state.mergedResults[bundleFileName] = finalBundleBytes;
                }

                // Tự động nén & tối ưu dung lượng file gộp nhiều tuần nếu được chọn
                if (chkAutoCompress && chkAutoCompress.checked && state.mergedResults[bundleFileName]) {
                    const modeKey = selectCompressMode ? selectCompressMode.value : 'deep';
                    const origSize = state.mergedResults[bundleFileName].byteLength;
                    appendLog(`Đang tự động nén tối ưu hóa hình ảnh cho file gộp "${bundleFileName}"...`, 'info');
                    if (progressStatusMsg) progressStatusMsg.textContent = 'Đang tự động nén ảnh tối ưu dung lượng...';
                    state.mergedResults[bundleFileName] = await compressDocxBytes(state.mergedResults[bundleFileName], modeKey, (msg) => {
                        if (progressStatusMsg) progressStatusMsg.textContent = msg;
                    });
                    const newSize = state.mergedResults[bundleFileName].byteLength;
                    const savedPct = origSize > 0 ? Math.round((1 - newSize / origSize) * 100) : 0;
                    appendLog(`✓ Nén ảnh thành công "${bundleFileName}": ${formatFileSize(origSize)} → ${formatFileSize(newSize)} (Tiết kiệm ${savedPct}%)`, 'success');
                }

                if (progressBarFill) progressBarFill.style.width = '100%';
                if (progressPercentVal) progressPercentVal.textContent = '100%';
                if (progressStatusMsg) progressStatusMsg.textContent = 'Hoàn tất gộp giáo án nhiều tuần!';
                appendLog(`🎉 THÀNH CÔNG RỰC RỠ: Đã gộp ${totalWeeks} tuần vào 1 FILE DUY NHẤT: "${bundleFileName}" (${formatFileSize(state.mergedResults[bundleFileName].byteLength)})`, 'success');

                if (completionDescText) {
                    completionDescText.textContent = `Đã gộp thành công ${totalWeeks} tuần (từ Tuần ${minWPad} đến Tuần ${maxWPad}) vào 1 FILE DUY NHẤT: "${bundleFileName}". Thầy/Cô có thể tải trực tiếp file Word này về máy tính.`;
                }
                if (btnExportSingleDocx) {
                    btnExportSingleDocx.classList.remove('hidden');
                    if (btnExportSingleLabel) {
                        btnExportSingleLabel.textContent = `Tải Về File Word Gộp: ${bundleFileName}`;
                    }
                }
                if (completionBannerBox) completionBannerBox.classList.remove('hidden');
                showToast(`🎉 Gộp thành công ${totalWeeks} tuần thành 1 file Word!`, 'success');

            } else {
                // ==============================================================
                // CHẾ ĐỘ XUẤT RIÊNG TỪNG TUẦN (MẶC ĐỊNH)
                // ==============================================================
                appendLog(`Khởi động ghép tài liệu cho ${totalWeeks} tuần được chọn (chế độ xuất riêng từng tuần)...`, 'info');
                if (coverInfo.enabled) {
                    appendLog(`✓ Trang bìa: ĐÃ BẬT cho từng tuần`, 'info');
                }
                let processedWeeks = 0;
                let successCount = 0;

                for (const week of weeksArray) {
                    const weekPad = week < 10 ? '0' + week : String(week);
                    if (progressStatusMsg) progressStatusMsg.textContent = `Đang ghép Tuần ${weekPad}...`;
                    appendLog(`--- Xử lý Tuần ${weekPad} ---`, 'info');

                    const wFilesMap = (state.weeksMap[week] && state.weeksMap[week].files) || {};
                    const filesToMerge = [];
                    const subjectsFound = [];

                    for (const subName of enabledSubjectNames) {
                        const subFiles = wFilesMap[subName];
                        if (subFiles) {
                            if (Array.isArray(subFiles)) {
                                filesToMerge.push(...subFiles);
                                subjectsFound.push(subName + (subFiles.length > 1 ? ` (${subFiles.length} tiết)` : ''));
                            } else {
                                filesToMerge.push(subFiles);
                                subjectsFound.push(subName);
                            }
                        }
                    }

                    if (filesToMerge.length === 0) {
                        appendLog(`Tuần ${weekPad}: Không tìm thấy file môn học nào, bỏ qua.`, 'warn');
                        processedWeeks++;
                        const pct = Math.round((processedWeeks / totalWeeks) * 100);
                        if (progressBarFill) progressBarFill.style.width = pct + '%';
                        if (progressPercentVal) progressPercentVal.textContent = pct + '%';
                        continue;
                    }

                    appendLog(`Tuần ${weekPad}: Gom ${filesToMerge.length} file môn học (${subjectsFound.join(', ')})`, 'info');

                    try {
                        const buffers = [];
                        for (const f of filesToMerge) {
                            const buf = await f.arrayBuffer();
                            buffers.push(buf);
                        }

                        // Ghép tài liệu Word an toàn qua lõi OpenXML chuẩn
                        const mergedBytes = await mergeWordDocuments(buffers, {
                            pageBreak: pageBreak,
                            continuousPage: continuousPage,
                            sigInfo: sigInfo,
                            coverInfo: coverInfo
                        });

                        let outFileName = pattern
                            .replace(/\{tengv\}/gi, tengv)
                            .replace(/\{week\}/g, weekPad)
                            .replace(/\{w\}/g, String(week))
                            .replace(/\{lop\}/g, lop)
                            .replace(/\{mon\}/g, subjectsFound.length === 1 ? subjectsFound[0].replace(/\s*\(\d+\s*tiết\)/g, '') : 'Tong_Hop');
                        if (!outFileName.toLowerCase().endsWith('.docx')) outFileName += '.docx';
                        outFileName = outFileName.replace(/[<>:"/\\|?*]/g, '_');

                        let finalMerged = mergedBytes;
                        if (chkAutoCompress && chkAutoCompress.checked) {
                            const modeKey = selectCompressMode ? selectCompressMode.value : 'deep';
                            const origSize = mergedBytes.byteLength;
                            if (progressStatusMsg) progressStatusMsg.textContent = `Đang nén tối ưu ảnh Tuần ${weekPad}...`;
                            finalMerged = await compressDocxBytes(mergedBytes, modeKey);
                            const newSize = finalMerged.byteLength;
                            const savedPct = origSize > 0 ? Math.round((1 - newSize / origSize) * 100) : 0;
                            appendLog(`  ↳ Nén ảnh Tuần ${weekPad}: ${formatFileSize(origSize)} → ${formatFileSize(newSize)} (Tiết kiệm ${savedPct}%)`, 'success');
                        }

                        state.mergedResults[outFileName] = finalMerged;
                        successCount++;
                        appendLog(`✓ Ghép thành công Tuần ${weekPad} -> ${outFileName}`, 'success');
                    } catch (err) {
                        console.error(err);
                        appendLog(`✕ Lỗi khi ghép Tuần ${weekPad}: ${err.message || err}`, 'error');
                    }

                    processedWeeks++;
                    const pct = Math.round((processedWeeks / totalWeeks) * 100);
                    if (progressBarFill) progressBarFill.style.width = pct + '%';
                    if (progressPercentVal) progressPercentVal.textContent = pct + '%';
                }

                if (progressStatusMsg) progressStatusMsg.textContent = 'Hoàn tất ghép tài liệu!';
                appendLog(`🎉 TỔNG KẾT: Đã ghép thành công ${successCount} / ${totalWeeks} tuần được chọn.`, 'success');

                if (successCount > 0) {
                    if (completionDescText) {
                        completionDescText.textContent = `Đã ghép thành công ${successCount} file Word theo tuần. Thầy/Cô có thể tải file ZIP hoặc lưu trực tiếp vào thư mục trên máy tính.`;
                    }
                    if (btnExportSingleDocx) {
                        if (successCount === 1) {
                            const singleName = Object.keys(state.mergedResults)[0];
                            btnExportSingleDocx.classList.remove('hidden');
                            if (btnExportSingleLabel) btnExportSingleLabel.textContent = `Tải Về: ${singleName}`;
                        } else {
                            btnExportSingleDocx.classList.add('hidden');
                        }
                    }
                    if (completionBannerBox) completionBannerBox.classList.remove('hidden');
                    showToast(`🎉 Ghép hoàn tất ${successCount} file tuần thành công!`);
                }
            }
        } catch (globalErr) {
            console.error(globalErr);
            appendLog(`✕ Lỗi khi thực hiện ghép: ${globalErr.message || globalErr}`, 'error');
            showToast('Lỗi khi ghép: ' + (globalErr.message || globalErr), 'error');
        } finally {
            setGiaoAnButtonsLoading(false);
        }
    }

    if (btnStartMerge) btnStartMerge.addEventListener('click', executeGiaoAnMerge);
    if (btnStartMergeBottom) btnStartMergeBottom.addEventListener('click', executeGiaoAnMerge);

    // ==========================================================================
    // Xuất file: Tải ZIP, Tải 1 file Word trực tiếp & Lưu thư mục
    // ==========================================================================
    if (btnExportSingleDocx) {
        btnExportSingleDocx.addEventListener('click', () => {
            const fileNames = Object.keys(state.mergedResults);
            if (fileNames.length === 0) {
                alert('Chưa có file nào được ghép!');
                return;
            }
            const fname = fileNames[0];
            const bytes = state.mergedResults[fname];
            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            appendLog(`✓ Đã tải xuống trực tiếp file: ${fname}`, 'success');
            showToast(`✓ Đã tải xuống file: ${fname}`, 'success');
        });
    }

    btnExportZip.addEventListener('click', async () => {
        const fileNames = Object.keys(state.mergedResults);
        if (fileNames.length === 0) {
            alert('Chưa có file nào được ghép!');
            return;
        }

        const zip = new JSZip();
        for (const fname of fileNames) {
            zip.file(fname, state.mergedResults[fname]);
        }

        appendLog(`Đang nén ${fileNames.length} file tuần thành file ZIP...`, 'info');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Giao_An_Tong_Hop_35_Tuan.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        appendLog('✓ Đã tải xuống file: Giao_An_Tong_Hop_35_Tuan.zip', 'success');
    });

    btnExportFolder.addEventListener('click', async () => {
        const fileNames = Object.keys(state.mergedResults);
        if (fileNames.length === 0) {
            alert('Chưa có file nào được ghép!');
            return;
        }

        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                let savedCount = 0;
                for (const fname of fileNames) {
                    const fileHandle = await dirHandle.getFileHandle(fname, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(state.mergedResults[fname]);
                    await writable.close();
                    savedCount++;
                }
                appendLog(`✓ Đã lưu trực tiếp ${savedCount} file vào thư mục máy tính đã chọn!`, 'success');
                alert(`Đã lưu thành công ${savedCount} file Word vào thư mục máy tính của Thầy/Cô!`);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error(e);
                    alert('Lỗi khi lưu vào thư mục: ' + e.message);
                }
            }
        } else {
            alert('Trình duyệt hiện tại không hỗ trợ API chọn thư mục trực tiếp (File System Access). Hệ thống chuyển sang tải về trọn bộ file ZIP.');
            btnExportZip.click();
        }
    });

    // ==========================================================================
    // Free Merge Controllers & Event Handlers
    // ==========================================================================
    function appendFreeLog(msg, type = 'info') {
        if (!freeLogConsole) return;
        const time = new Date().toLocaleTimeString('vi-VN');
        const div = document.createElement('div');
        div.className = `log-line ${type}`;
        div.textContent = `[${time}] ${msg}`;
        freeLogConsole.appendChild(div);
        freeLogConsole.scrollTop = freeLogConsole.scrollHeight;
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function addFreeFiles(files) {
        let count = 0;
        for (const f of files) {
            const name = f.name || '';
            if (name.startsWith('~$') || !name.toLowerCase().endsWith('.docx')) continue;
            state.freeFiles.push({
                id: 'ff_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                file: f,
                name: f.name,
                size: f.size
            });
            count++;
        }
        if (count > 0) {
            if (state.freeMergedResult) {
                state.freeMergedResult = null;
                state.freeMergedFileName = '';
                if (freeCompletionBanner) freeCompletionBanner.classList.add('hidden');
                if (freeProgressBarFill) freeProgressBarFill.style.width = '0%';
                if (freeProgressPercentVal) freeProgressPercentVal.textContent = '0%';
                if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = 'Danh sách tài liệu đã cập nhật. Sẵn sàng ghép lại.';
            }
            renderFreeQueue();
        }
        return count;
    }

    function renderFreeQueue() {
        const total = state.freeFiles.length;
        if (freeFileCountBadge) freeFileCountBadge.textContent = `${total} file`;

        if (total === 0) {
            if (freeUploadHero) freeUploadHero.classList.remove('hidden');
            if (freeQueueSection) freeQueueSection.classList.add('hidden');
            if (freeSettingsSection) freeSettingsSection.classList.add('hidden');
            if (freeExecutionSection) freeExecutionSection.classList.add('hidden');
            return;
        }

        if (freeUploadHero) freeUploadHero.classList.add('hidden');
        if (freeQueueSection) freeQueueSection.classList.remove('hidden');
        if (freeSettingsSection) freeSettingsSection.classList.remove('hidden');
        if (freeExecutionSection) freeExecutionSection.classList.remove('hidden');

        let totalBytes = 0;
        state.freeFiles.forEach(f => { totalBytes += (f.size || 0); });

        if (statFreeCount) statFreeCount.textContent = `${total} tệp`;
        if (statFreeSize) statFreeSize.textContent = `(~${formatFileSize(totalBytes)})`;

        if (!freeDocList) return;
        freeDocList.innerHTML = '';

        state.freeFiles.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'free-doc-item';
            row.innerHTML = `
                <div class="free-doc-left">
                    <span class="free-doc-index">${idx + 1}</span>
                    <span class="free-doc-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </span>
                    <div class="free-doc-info">
                        <span class="free-doc-name" title="${escapeXml(item.name)}">${escapeXml(item.name)}</span>
                        <span class="free-doc-size">${formatFileSize(item.size)}</span>
                    </div>
                </div>
                <div class="free-doc-actions">
                    <button type="button" class="btn-free-action btn-up" title="Chuyển lên" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button type="button" class="btn-free-action btn-down" title="Chuyển xuống" ${idx === total - 1 ? 'disabled' : ''}>▼</button>
                    <button type="button" class="btn-free-action btn-top" title="Đưa lên đầu danh sách" ${idx === 0 ? 'disabled' : ''}>⤒</button>
                    <button type="button" class="btn-free-action btn-bottom" title="Đưa xuống cuối danh sách" ${idx === total - 1 ? 'disabled' : ''}>⤓</button>
                    <button type="button" class="btn-free-action btn-free-del" title="Xóa tài liệu này">✕</button>
                </div>
            `;

            row.querySelector('.btn-up').addEventListener('click', () => {
                if (idx > 0) {
                    const temp = state.freeFiles[idx];
                    state.freeFiles[idx] = state.freeFiles[idx - 1];
                    state.freeFiles[idx - 1] = temp;
                    renderFreeQueue();
                }
            });

            row.querySelector('.btn-down').addEventListener('click', () => {
                if (idx < state.freeFiles.length - 1) {
                    const temp = state.freeFiles[idx];
                    state.freeFiles[idx] = state.freeFiles[idx + 1];
                    state.freeFiles[idx + 1] = temp;
                    renderFreeQueue();
                }
            });

            row.querySelector('.btn-top').addEventListener('click', () => {
                if (idx > 0) {
                    const [target] = state.freeFiles.splice(idx, 1);
                    state.freeFiles.unshift(target);
                    renderFreeQueue();
                }
            });

            row.querySelector('.btn-bottom').addEventListener('click', () => {
                if (idx < state.freeFiles.length - 1) {
                    const [target] = state.freeFiles.splice(idx, 1);
                    state.freeFiles.push(target);
                    renderFreeQueue();
                }
            });

            row.querySelector('.btn-free-del').addEventListener('click', () => {
                state.freeFiles.splice(idx, 1);
                if (state.freeMergedResult) {
                    state.freeMergedResult = null;
                    state.freeMergedFileName = '';
                    if (freeCompletionBanner) freeCompletionBanner.classList.add('hidden');
                    if (freeProgressBarFill) freeProgressBarFill.style.width = '0%';
                    if (freeProgressPercentVal) freeProgressPercentVal.textContent = '0%';
                    if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = 'Danh sách tài liệu đã thay đổi.';
                }
                renderFreeQueue();
            });

            freeDocList.appendChild(row);
        });

        updateFreeNamingPreview();
    }

    if (btnFreeSortAz) {
        btnFreeSortAz.addEventListener('click', () => {
            state.freeFiles.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
            renderFreeQueue();
            showToast('Đã sắp xếp danh sách theo thứ tự A → Z.');
        });
    }

    if (btnFreeSortZa) {
        btnFreeSortZa.addEventListener('click', () => {
            state.freeFiles.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
            renderFreeQueue();
            showToast('Đã sắp xếp danh sách theo thứ tự Z → A.');
        });
    }

    if (btnFreeReverse) {
        btnFreeReverse.addEventListener('click', () => {
            state.freeFiles.reverse();
            renderFreeQueue();
            showToast('Đã đảo chiều thứ tự danh sách.');
        });
    }

    if (btnFreeClearAll) {
        btnFreeClearAll.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn xóa tất cả tài liệu trong danh sách ghép tự do?')) {
                state.freeFiles = [];
                state.freeMergedResult = null;
                state.freeMergedFileName = '';
                if (freeCompletionBanner) freeCompletionBanner.classList.add('hidden');
                if (freeProgressBarFill) freeProgressBarFill.style.width = '0%';
                if (freeProgressPercentVal) freeProgressPercentVal.textContent = '0%';
                if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = 'Sẵn sàng để ghép tài liệu...';
                if (freeLogConsole) {
                    freeLogConsole.innerHTML = '<div class="log-line info">[Sẵn sàng] Đã làm trống danh sách và xóa sạch nhật ký. Vui lòng nạp file để bắt đầu.</div>';
                }
                renderFreeQueue();
                showToast('Đã làm trống danh sách ghép tự do.');
            }
        });
    }

    if (btnFreeClearLog) {
        btnFreeClearLog.addEventListener('click', () => {
            if (freeLogConsole) {
                freeLogConsole.innerHTML = '<div class="log-line info">[Sẵn sàng] Đã xóa nhật ký. Vui lòng bấm "BẮT ĐẦU GHÉP TÀI LIỆU TỰ DO" để thực hiện.</div>';
                showToast('Đã xóa sạch nhật ký.');
            }
        });
    }

    if (btnClearLog) {
        btnClearLog.addEventListener('click', () => {
            if (executionLogConsole) {
                executionLogConsole.innerHTML = '<div class="log-line info">[Sẵn sàng] Đã xóa nhật ký. Vui lòng bấm "BẮT ĐẦU GHÉP TÀI LIỆU" để xử lý.</div>';
                showToast('Đã xóa sạch nhật ký.');
            }
        });
    }

    if (btnFreePickFiles) {
        btnFreePickFiles.addEventListener('click', (e) => {
            e.stopPropagation();
            inputFreeFiles.click();
        });
    }
    if (btnFreePickFolder) {
        btnFreePickFolder.addEventListener('click', (e) => {
            e.stopPropagation();
            inputFreeFolder.click();
        });
    }
    if (btnFreeAddMore) {
        btnFreeAddMore.addEventListener('click', (e) => {
            e.stopPropagation();
            inputFreeAddMore.click();
        });
    }

    if (inputFreeFiles) {
        inputFreeFiles.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
                const added = addFreeFiles(files);
                showToast(`✓ Đã tiếp nhận ${added} file vào danh sách!`, 'success');
                appendFreeLog(`Đã tiếp nhận ${added} tài liệu từ máy tính.`, 'success');
                inputFreeFiles.value = '';
            }
        });
    }

    if (inputFreeFolder) {
        inputFreeFolder.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
                const added = addFreeFiles(files);
                showToast(`✓ Đã tiếp nhận ${added} file từ thư mục!`, 'success');
                appendFreeLog(`Đã tiếp nhận ${added} tài liệu từ thư mục.`, 'success');
                inputFreeFolder.value = '';
            }
        });
    }

    if (inputFreeAddMore) {
        inputFreeAddMore.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
                const added = addFreeFiles(files);
                showToast(`✓ Đã nạp thêm ${added} file!`, 'success');
                appendFreeLog(`Đã nạp thêm ${added} tài liệu.`, 'success');
                inputFreeAddMore.value = '';
            }
        });
    }

    function updateFreeNamingPreview() {
        if (!inputFreeOutputName || !previewFreeFilename) return;
        let pattern = inputFreeOutputName.value.trim() || 'Tai_Lieu_Tong_Hop.docx';
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const countStr = String(state.freeFiles.length || 0);
        const gvName = (inputTenGv ? inputTenGv.value.trim() : '') || 'Chau';

        let preview = pattern
            .replace(/\{date\}/gi, dateStr)
            .replace(/\{count\}/gi, countStr)
            .replace(/\{tengv\}/gi, gvName);

        if (!preview.toLowerCase().endsWith('.docx')) preview += '.docx';
        previewFreeFilename.textContent = preview;
    }

    if (inputFreeOutputName) {
        inputFreeOutputName.addEventListener('input', updateFreeNamingPreview);
    }

    btnFreeChips.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            const pos = inputFreeOutputName.selectionStart || inputFreeOutputName.value.length;
            const val = inputFreeOutputName.value;
            inputFreeOutputName.value = val.slice(0, pos) + tag + val.slice(pos);
            inputFreeOutputName.focus();
            updateFreeNamingPreview();
        });
    });

    if (chkFreeEnableSig && freeSigFormWrapper) {
        chkFreeEnableSig.addEventListener('change', () => {
            freeSigFormWrapper.classList.toggle('hidden', !chkFreeEnableSig.checked);
        });
    }

    if (btnFreeSaveSettings) {
        btnFreeSaveSettings.addEventListener('click', () => {
            const placeDate = freeSigPlaceDate ? freeSigPlaceDate.value.trim() : '';
            const bghRole = freeSigBghRole ? freeSigBghRole.value.trim() : '';
            const bghName = freeSigBghName ? freeSigBghName.value.trim() : '';
            const ttRole = freeSigTtRole ? freeSigTtRole.value.trim() : '';
            const ttName = freeSigTtName ? freeSigTtName.value.trim() : '';
            const gvRole = freeSigGvRole ? freeSigGvRole.value.trim() : '';
            const gvName = freeSigGvName ? freeSigGvName.value.trim() : '';
            const enableSig = chkFreeEnableSig ? chkFreeEnableSig.checked : true;

            // Sync to Giao An inputs
            if (sigPlaceDate) sigPlaceDate.value = placeDate;
            if (sigBghRole) sigBghRole.value = bghRole;
            if (sigBghName) sigBghName.value = bghName;
            if (sigTtRole) sigTtRole.value = ttRole;
            if (sigTtName) sigTtName.value = ttName;
            if (sigGvRole) sigGvRole.value = gvRole;
            if (sigGvName) sigGvName.value = gvName;
            if (chkEnableSignature) {
                chkEnableSignature.checked = enableSig;
                if (sigFormWrapper) sigFormWrapper.classList.toggle('hidden', !enableSig);
            }

            let cfg = {};
            try {
                const saved = localStorage.getItem('giao_an_desktop_v2_settings');
                if (saved) cfg = JSON.parse(saved);
            } catch(e) {}

            cfg.enableSig = enableSig;
            cfg.sigLayout = state.sigLayout || '3col';
            cfg.placeDate = placeDate;
            cfg.bghRole = bghRole;
            cfg.bghName = bghName;
            cfg.ttRole = ttRole;
            cfg.ttName = ttName;
            cfg.gvRole = gvRole;
            cfg.gvName = gvName;

            localStorage.setItem('giao_an_desktop_v2_settings', JSON.stringify(cfg));
            if (freeSaveMsgToast) {
                freeSaveMsgToast.classList.remove('hidden');
                setTimeout(() => freeSaveMsgToast.classList.add('hidden'), 3500);
            }
            showToast('Đã lưu cấu hình chữ ký thành công!');
        });
    }

    if (btnFreeStartMerge) {
        btnFreeStartMerge.addEventListener('click', async () => {
            if (!state.freeFiles || state.freeFiles.length === 0) {
                alert('Vui lòng chọn ít nhất 1 file Word để ghép!');
                return;
            }

            btnFreeStartMerge.disabled = true;
            btnFreeStartMerge.style.opacity = '0.5';
            btnFreeStartMerge.style.cursor = 'not-allowed';
            btnFreeStartMerge.innerHTML = `
                <span class="spinner-loader" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>
                ĐANG GHÉP TÀI LIỆU...
            `;

            try {
                if (freeLogConsole) {
                    freeLogConsole.innerHTML = '';
                }
                state.freeMergedResult = null;
                state.freeMergedFileName = '';
                if (freeCompletionBanner) freeCompletionBanner.classList.add('hidden');
                if (freeProgressBarFill) freeProgressBarFill.style.width = '0%';
                if (freeProgressPercentVal) freeProgressPercentVal.textContent = '0%';
                if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = 'Đang khởi động ghép tài liệu...';
                appendFreeLog(`Bắt đầu ghép ${state.freeFiles.length} tài liệu theo thứ tự đã định...`, 'info');

                const total = state.freeFiles.length;
                const buffers = [];
                for (let i = 0; i < total; i++) {
                    const item = state.freeFiles[i];
                    if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = `Đang đọc file ${i + 1}/${total}: ${item.name}...`;
                    const buf = await item.file.arrayBuffer();
                    buffers.push(buf);
                    const pct = Math.round(((i + 0.5) / total) * 80);
                    if (freeProgressBarFill) freeProgressBarFill.style.width = pct + '%';
                    if (freeProgressPercentVal) freeProgressPercentVal.textContent = pct + '%';
                }

                if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = 'Đang xử lý chuẩn OpenXML và kết nối nội dung...';

                const sigInfo = {
                    enabled: chkFreeEnableSig ? chkFreeEnableSig.checked : false,
                    layout: state.sigLayout || '3col',
                    placeDate: freeSigPlaceDate ? freeSigPlaceDate.value.trim() : '',
                    bghRole: freeSigBghRole ? freeSigBghRole.value.trim() : '',
                    bghName: freeSigBghName ? freeSigBghName.value.trim() : '',
                    ttRole: freeSigTtRole ? freeSigTtRole.value.trim() : '',
                    ttName: freeSigTtName ? freeSigTtName.value.trim() : '',
                    gvRole: freeSigGvRole ? freeSigGvRole.value.trim() : '',
                    gvName: freeSigGvName ? freeSigGvName.value.trim() : ''
                };

                const pageBreak = chkFreePageBreak ? chkFreePageBreak.checked : true;
                const continuousPage = chkFreeContinuousPage ? chkFreeContinuousPage.checked : true;
                const freeCoverInfo = (chkFreeEnableCover && chkFreeEnableCover.checked) ? getCoverInfo() : null;
                if (freeCoverInfo && freeCoverInfo.enabled) {
                    appendFreeLog(`✓ Trang bìa: ĐÃ BẬT ("${freeCoverInfo.title}" - GV: ${freeCoverInfo.teacherName})`, 'info');
                } else {
                    appendFreeLog(`- Trang bìa: Không kích hoạt`, 'info');
                }

                const mergedBytes = await mergeWordDocuments(buffers, {
                    pageBreak: pageBreak,
                    continuousPage: continuousPage,
                    sigInfo: sigInfo,
                    coverInfo: freeCoverInfo
                });

                updateFreeNamingPreview();
                let outName = previewFreeFilename ? previewFreeFilename.textContent.trim() : 'Tai_Lieu_Tong_Hop.docx';
                if (!outName.toLowerCase().endsWith('.docx')) outName += '.docx';
                outName = outName.replace(/[<>:"/\\|?*]/g, '_');

                let finalFreeBytes = mergedBytes;
                if (chkFreeAutoCompress && chkFreeAutoCompress.checked) {
                    const modeKey = selectFreeCompressMode ? selectFreeCompressMode.value : 'deep';
                    const origSize = mergedBytes.byteLength;
                    appendFreeLog(`Đang tự động nén tối ưu hóa hình ảnh cho file "${outName}"...`, 'info');
                    if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = 'Đang nén ảnh tối ưu dung lượng...';
                    finalFreeBytes = await compressDocxBytes(mergedBytes, modeKey, (msg) => {
                        if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = msg;
                    });
                    const newSize = finalFreeBytes.byteLength;
                    const savedPct = origSize > 0 ? Math.round((1 - newSize / origSize) * 100) : 0;
                    appendFreeLog(`✓ Nén ảnh thành công: ${formatFileSize(origSize)} → ${formatFileSize(newSize)} (Tiết kiệm ${savedPct}%)`, 'success');
                }

                state.freeMergedResult = finalFreeBytes;
                state.freeMergedFileName = outName;

                if (freeProgressBarFill) freeProgressBarFill.style.width = '100%';
                if (freeProgressPercentVal) freeProgressPercentVal.textContent = '100%';
                if (freeProgressStatusMsg) freeProgressStatusMsg.textContent = 'Hoàn tất ghép tài liệu tự do!';

                appendFreeLog(`🎉 Ghép thành công ${total} tài liệu thành file: ${outName} (${formatFileSize(mergedBytes.byteLength)})`, 'success');

                if (freeCompletionDesc) {
                    freeCompletionDesc.textContent = `File tổng hợp "${outName}" (${formatFileSize(mergedBytes.byteLength)}) đã sẵn sàng để lưu về máy tính.`;
                }
                if (freeCompletionBanner) freeCompletionBanner.classList.remove('hidden');
                showToast(`🎉 Ghép thành công ${total} tài liệu thành 1 file Word!`, 'success');
            } catch (err) {
                console.error(err);
                appendFreeLog(`✕ Lỗi khi ghép tài liệu: ${err.message || err}`, 'error');
                showToast('Lỗi khi ghép: ' + (err.message || err), 'error');
            } finally {
                btnFreeStartMerge.disabled = false;
                btnFreeStartMerge.style.opacity = '';
                btnFreeStartMerge.style.cursor = '';
                btnFreeStartMerge.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    BẮT ĐẦU GHÉP TÀI LIỆU TỰ DO
                `;
            }
        });
    }

    if (btnFreeDownload) {
        btnFreeDownload.addEventListener('click', () => {
            if (!state.freeMergedResult) {
                alert('Chưa có dữ liệu file đã ghép!');
                return;
            }
            const blob = new Blob([state.freeMergedResult], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = state.freeMergedFileName || 'Tai_Lieu_Tong_Hop.docx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            appendFreeLog(`✓ Đã tải xuống file: ${state.freeMergedFileName}`, 'success');
        });
    }

    if (btnFreeSaveFolder) {
        btnFreeSaveFolder.addEventListener('click', async () => {
            if (!state.freeMergedResult) {
                alert('Chưa có dữ liệu file đã ghép!');
                return;
            }
            const fname = state.freeMergedFileName || 'Tai_Lieu_Tong_Hop.docx';
            if ('showDirectoryPicker' in window) {
                try {
                    const dirHandle = await window.showDirectoryPicker();
                    const fileHandle = await dirHandle.getFileHandle(fname, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(state.freeMergedResult);
                    await writable.close();
                    appendFreeLog(`✓ Đã lưu file ${fname} trực tiếp vào thư mục máy tính!`, 'success');
                    alert(`Đã lưu thành công file "${fname}" vào thư mục máy tính của Thầy/Cô!`);
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        console.error(e);
                        alert('Lỗi khi lưu vào thư mục: ' + e.message);
                    }
                }
            } else {
                btnFreeDownload.click();
            }
        });
    }

    // Initialize
    loadSavedSettings();
    renderUI();
});
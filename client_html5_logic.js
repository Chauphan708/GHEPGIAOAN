document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // State Store
    // ==========================================================================
    const state = {
        currentMode: 'giaoan', // 'giaoan' | 'freemerge'
        sigLayout: '3col',     // '1col' | '2col' | '3col'
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

    // ==========================================================================
    // Canonical Subjects & Week Extraction
    // ==========================================================================
    function canonicalSubject(name) {
        const raw = (name || '').trim();
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
        return raw || 'Môn khác';
    }

    function extractWeekNumber(filename) {
        const patterns = [
            /(?:tu[aàầáảãạ]n|tuan|week|w|t)[\s_\-\.]*0*([12]\d|3[0-5]|[1-9])\b/i,
            /[_\-\.]0*([12]\d|3[0-5]|[1-9])[_\-\.]/,
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

    const inputTenGv = document.getElementById('input-tengv');
    const inputNamingPattern = document.getElementById('input-naming-pattern');
    const inputLopName = document.getElementById('input-lop-name');
    const previewFilenameText = document.getElementById('preview-filename-text');
    const btnTagChips = document.querySelectorAll('.btn-tag-chip');

    const chkPageBreak = document.getElementById('chk-page-break');
    const chkContinuousPage = document.getElementById('chk-continuous-page');
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

    function loadSavedSettings() {
        try {
            const saved = localStorage.getItem('giao_an_desktop_v2_settings');
            if (saved) {
                const cfg = JSON.parse(saved);
                if (cfg.tengv && inputTenGv) inputTenGv.value = cfg.tengv;
                if (cfg.namingPattern) inputNamingPattern.value = cfg.namingPattern;
                if (cfg.lopName) inputLopName.value = cfg.lopName;
                if (cfg.continuousPage !== undefined) chkContinuousPage.checked = cfg.continuousPage;
                if (cfg.pageBreak !== undefined) chkPageBreak.checked = cfg.pageBreak;
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
            } else {
                setSigLayout('3col');
            }
        } catch(e) {
            setSigLayout('3col');
        }
        updateNamingPreview();
        updateFreeNamingPreview();
    }

    btnSaveSettings.addEventListener('click', () => {
        const cfg = {
            tengv: inputTenGv ? inputTenGv.value.trim() : '',
            namingPattern: inputNamingPattern.value.trim(),
            lopName: inputLopName.value.trim(),
            continuousPage: chkContinuousPage.checked,
            pageBreak: chkPageBreak.checked,
            enableSig: chkEnableSignature.checked,
            sigLayout: state.sigLayout || '3col',
            placeDate: sigPlaceDate.value.trim(),
            bghRole: sigBghRole.value.trim(),
            bghName: sigBghName.value.trim(),
            ttRole: sigTtRole.value.trim(),
            ttName: sigTtName.value.trim(),
            gvRole: sigGvRole.value.trim(),
            gvName: sigGvName.value.trim()
        };
        localStorage.setItem('giao_an_desktop_v2_settings', JSON.stringify(cfg));
        if (chkFreeEnableSig) chkFreeEnableSig.checked = cfg.enableSig;
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
        showToast('Đã lưu các cấu hình thành công!');
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

            let subjectRaw = '';
            if (pathParts.length > 1) {
                subjectRaw = pathParts[pathParts.length - 2];
            } else {
                subjectRaw = name;
            }

            const subject = canonicalSubject(subjectRaw);
            const week = extractWeekNumber(name);

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
        const DEFAULT_ORDER = ['Tiếng Việt', 'Toán', 'Đạo đức', 'Khoa học', 'Lịch sử và Địa lí', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh', 'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất'];
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
            const TV_FIRST = ['Tiếng Việt', 'Toán', 'Khoa học', 'Lịch sử và Địa lí', 'Đạo đức', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh', 'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất'];
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
            const TOAN_FIRST = ['Toán', 'Tiếng Việt', 'Khoa học', 'Lịch sử và Địa lí', 'Đạo đức', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh', 'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất'];
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

    // Ghép tài liệu Word an toàn tuyệt đối, hỗ trợ cả 1 môn và nhiều môn
    async function mergeWordDocuments(buffers, options = {}) {
        const { pageBreak = true, continuousPage = true, sigInfo = null } = options;
        if (!buffers || buffers.length === 0) throw new Error('Không có file nào để ghép');

        const PAGE_BREAK_XML = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        const sigXml = (sigInfo && sigInfo.enabled) ? buildSignatureXml(sigInfo) : '';

        // Trường hợp 1 file duy nhất (ghép 1 môn cho tuần):
        if (buffers.length === 1) {
            const zip = await JSZip.loadAsync(buffers[0]);
            let docXml = await zip.file('word/document.xml').async('string');

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

            zip.file('word/document.xml', docXml);
            return await zip.generateAsync({ type: 'uint8array' });
        }

        // Trường hợp nhiều môn: lấy file đầu tiên làm template gốc
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

            const nextBody = extractBodyContent(nextDocXml);

            if (pageBreak) {
                combinedBody += PAGE_BREAK_XML;
            }
            combinedBody += nextBody;
        }

        if (baseRelsXml && baseRelsFile) {
            baseZip.file('word/_rels/document.xml.rels', baseRelsXml);
        }

        if (sigXml) {
            combinedBody += sigXml;
        }

        const bodyStartIdx = baseDocXml.indexOf('<w:body>');
        const docHeader = baseDocXml.substring(0, bodyStartIdx + 8);
        let finalDocXml = docHeader + combinedBody + finalSectPr + '</w:body></w:document>';

        if (continuousPage) {
            finalDocXml = finalDocXml.replace(/(<w:pgNumType\b[^>]*?)\s+w:start="[^"]*"/gi, '$1');
        }

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

        // Làm mờ và khóa cả 2 nút ghép tài liệu khi đang chạy
        setGiaoAnButtonsLoading(true);

        try {
            // Chuyển sang tab tiến trình
            switchTab('tab-process');
            if (completionBannerBox) completionBannerBox.classList.add('hidden');

            if (executionLogConsole) {
                executionLogConsole.innerHTML = '';
            }

            if (progressBarFill) progressBarFill.style.width = '0%';
            if (progressPercentVal) progressPercentVal.textContent = '0%';
            if (progressStatusMsg) progressStatusMsg.textContent = 'Đang khởi động ghép tài liệu...';
            appendLog(`Khởi động ghép tài liệu cho ${state.selectedWeeks.size} tuần được chọn...`, 'info');

            state.mergedResults = {};
            const weeksArray = Array.from(state.selectedWeeks).sort((a, b) => a - b);
            const totalWeeks = weeksArray.length;
            let processedWeeks = 0;
            let successCount = 0;

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

            const tengv = (inputTenGv ? inputTenGv.value.trim() : '') || 'Chau';
            const pattern = (inputNamingPattern ? inputNamingPattern.value.trim() : '') || '{tengv}_KHBD_Tuan_{week}_Lop_{lop}.docx';
            const lop = (inputLopName ? inputLopName.value.trim() : '') || '5';
            const pageBreak = chkPageBreak ? chkPageBreak.checked : true;
            const continuousPage = chkContinuousPage ? chkContinuousPage.checked : true;

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
                        sigInfo: sigInfo
                    });

                    let outFileName = pattern
                        .replace(/\{tengv\}/gi, tengv)
                        .replace(/\{week\}/g, weekPad)
                        .replace(/\{w\}/g, String(week))
                        .replace(/\{lop\}/g, lop)
                        .replace(/\{mon\}/g, subjectsFound.length === 1 ? subjectsFound[0].replace(/\s*\(\d+\s*tiết\)/g, '') : 'Tong_Hop');
                    if (!outFileName.toLowerCase().endsWith('.docx')) outFileName += '.docx';
                    outFileName = outFileName.replace(/[<>:"/\\|?*]/g, '_');

                    state.mergedResults[outFileName] = mergedBytes;
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
                if (completionBannerBox) completionBannerBox.classList.remove('hidden');
                showToast(`🎉 Ghép hoàn tất ${successCount} file tuần thành công!`);
            }
        } finally {
            // Khôi phục trạng thái cả 2 nút bấm khi hoàn tất hoặc lỗi
            setGiaoAnButtonsLoading(false);
        }
    }

    if (btnStartMerge) btnStartMerge.addEventListener('click', executeGiaoAnMerge);
    if (btnStartMergeBottom) btnStartMergeBottom.addEventListener('click', executeGiaoAnMerge);

    // ==========================================================================
    // Xuất file: Tải ZIP & Lưu thư mục
    // ==========================================================================
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

                const mergedBytes = await mergeWordDocuments(buffers, {
                    pageBreak: pageBreak,
                    continuousPage: continuousPage,
                    sigInfo: sigInfo
                });

                updateFreeNamingPreview();
                let outName = previewFreeFilename ? previewFreeFilename.textContent.trim() : 'Tai_Lieu_Tong_Hop.docx';
                if (!outName.toLowerCase().endsWith('.docx')) outName += '.docx';
                outName = outName.replace(/[<>:"/\\|?*]/g, '_');

                state.freeMergedResult = mergedBytes;
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
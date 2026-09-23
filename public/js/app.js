// ==========================================================================
// JavaScript Điều Khiển Giao Diện Phần Mềm Ghép Giáo Án 35 Tuần (Bản V2)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const state = {
        scanData: null,
        orderedSubjects: [],
        selectedWeeks: new Set(),
        outputFolder: '',
        isMerging: false
    };

    // DOM Elements
    const inputFolderPath = document.getElementById('input-folder-path');
    const btnBrowseFolder = document.getElementById('btn-browse-folder');
    const btnScan = document.getElementById('btn-scan');
    const btnUseSample = document.getElementById('btn-use-sample');

    const scanSummaryBar = document.getElementById('scan-summary-bar');
    const sumSubjectCount = document.getElementById('sum-subject-count');
    const sumWeekCount = document.getElementById('sum-week-count');
    const sumFileCount = document.getElementById('sum-file-count');

    const sectionStep2 = document.getElementById('section-step2');
    const subjectListEl = document.getElementById('subject-list');

    const sectionStep3 = document.getElementById('section-step3');
    const weeksGridEl = document.getElementById('weeks-grid');

    const sectionStep4 = document.getElementById('section-step4');
    const inputOutputFolder = document.getElementById('input-output-folder');
    const btnBrowseOutputFolder = document.getElementById('btn-browse-output-folder');
    
    // Naming pattern inputs & preview
    const inputNamingPattern = document.getElementById('input-naming-pattern');
    const inputLopName = document.getElementById('input-lop-name');
    const namingPreviewText = document.getElementById('naming-preview-text');
    const btnChipTags = document.querySelectorAll('.btn-chip-tag');

    // Options
    const chkPageBreak = document.getElementById('chk-page-break');
    const chkContinuousPage = document.getElementById('chk-continuous-page');

    // Signature inputs
    const chkEnableSignature = document.getElementById('chk-enable-signature');
    const signatureFormFields = document.getElementById('signature-form-fields');
    const sigPlaceDate = document.getElementById('sig-place-date');
    const sigBghRole = document.getElementById('sig-bgh-role');
    const sigBghName = document.getElementById('sig-bgh-name');
    const sigTtRole = document.getElementById('sig-tt-role');
    const sigTtName = document.getElementById('sig-tt-name');
    const sigGvRole = document.getElementById('sig-gv-role');
    const sigGvName = document.getElementById('sig-gv-name');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const saveSettingsMsg = document.getElementById('save-settings-msg');

    const btnStartMerge = document.getElementById('btn-start-merge');

    // Progress elements
    const sectionProgress = document.getElementById('section-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressPercentLabel = document.getElementById('progress-percentage-label');
    const progressStatusText = document.getElementById('progress-status-text');
    const logConsole = document.getElementById('log-console');
    const btnClearLog = document.getElementById('btn-clear-log');
    const completionBox = document.getElementById('completion-box');
    const completionDetails = document.getElementById('completion-details');
    const btnOpenResultFolder = document.getElementById('btn-open-result-folder');

    // Modal elements
    const modalMissing = document.getElementById('modal-missing-subjects');
    const modalTitle = document.getElementById('modal-title');
    const modalPresentList = document.getElementById('modal-present-list');
    const modalMissingList = document.getElementById('modal-missing-list');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnModalOk = document.getElementById('btn-modal-ok');

    // 1. Tải Cấu Hình Đã Lưu (Settings) khi mở ứng dụng
    async function loadSavedSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.success && data.settings) {
                applySettingsToForm(data.settings);
            }
        } catch (e) {
            // Fallback localStorage
            const local = localStorage.getItem('ghao_an_settings');
            if (local) {
                try { applySettingsToForm(JSON.parse(local)); } catch (err) {}
            }
        }
    }

    function applySettingsToForm(settings) {
        if (settings.naming) {
            if (settings.naming.pattern) inputNamingPattern.value = settings.naming.pattern;
            if (settings.naming.lop) inputLopName.value = settings.naming.lop;
        }
        if (settings.options) {
            if (settings.options.pageBreak !== undefined) chkPageBreak.checked = settings.options.pageBreak;
            if (settings.options.continuousPageNumbering !== undefined) chkContinuousPage.checked = settings.options.continuousPageNumbering;
        }
        if (settings.signature) {
            const sig = settings.signature;
            if (sig.enabled !== undefined) {
                chkEnableSignature.checked = sig.enabled;
                signatureFormFields.classList.toggle('hidden', !sig.enabled);
            }
            if (sig.placeDate) sigPlaceDate.value = sig.placeDate;
            if (sig.bghRole) sigBghRole.value = sig.bghRole;
            if (sig.bghName) sigBghName.value = sig.bghName;
            if (sig.ttRole) sigTtRole.value = sig.ttRole;
            if (sig.ttName) sigTtName.value = sig.ttName;
            if (sig.gvRole) sigGvRole.value = sig.gvRole;
            if (sig.gvName) sigGvName.value = sig.gvName;
        }
        updateNamingPreview();
    }

    loadSavedSettings();

    // 2. Cập nhật Xem Trước Tên File Mẫu
    function updateNamingPreview() {
        const pattern = inputNamingPattern.value.trim() || 'KHBD_Tuan_{week}_Lop_{lop}.docx';
        const lop = inputLopName.value.trim() || '5';
        let preview = pattern
            .replace(/\{week\}/g, '01')
            .replace(/\{w\}/g, '1')
            .replace(/\{lop\}/g, lop)
            .replace(/\{mon\}/g, 'Tong_Hop');

        if (!preview.toLowerCase().endsWith('.docx')) {
            preview += '.docx';
        }
        namingPreviewText.textContent = preview;
    }

    inputNamingPattern.addEventListener('input', updateNamingPreview);
    inputLopName.addEventListener('input', updateNamingPreview);

    // Chèn nhanh các tag vào cấu trúc tên file
    btnChipTags.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            const pos = inputNamingPattern.selectionStart || inputNamingPattern.value.length;
            const val = inputNamingPattern.value;
            inputNamingPattern.value = val.slice(0, pos) + tag + val.slice(pos);
            inputNamingPattern.focus();
            updateNamingPreview();
        });
    });

    // 3. Ẩn/Hiện form chữ ký
    chkEnableSignature.addEventListener('change', () => {
        signatureFormFields.classList.toggle('hidden', !chkEnableSignature.checked);
    });

    // 4. Lưu cấu hình làm mặc định
    btnSaveSettings.addEventListener('click', async () => {
        const settingsToSave = {
            signature: {
                enabled: chkEnableSignature.checked,
                placeDate: sigPlaceDate.value.trim(),
                bghRole: sigBghRole.value.trim(),
                bghName: sigBghName.value.trim(),
                ttRole: sigTtRole.value.trim(),
                ttName: sigTtName.value.trim(),
                gvRole: sigGvRole.value.trim(),
                gvName: sigGvName.value.trim()
            },
            naming: {
                pattern: inputNamingPattern.value.trim(),
                lop: inputLopName.value.trim()
            },
            options: {
                pageBreak: chkPageBreak.checked,
                continuousPageNumbering: chkContinuousPage.checked
            }
        };

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsToSave)
            });
            localStorage.setItem('ghao_an_settings', JSON.stringify(settingsToSave));

            saveSettingsMsg.classList.remove('hidden');
            setTimeout(() => {
                saveSettingsMsg.classList.add('hidden');
            }, 3000);
        } catch (e) {
            alert('Lỗi lưu cài đặt: ' + e.message);
        }
    });

    // 5. Nhật ký trực tiếp (Log)
    function appendLog(message, type = 'info') {
        const timeStr = new Date().toLocaleTimeString('vi-VN');
        const line = document.createElement('div');
        line.className = `log-line log-${type}`;
        line.innerHTML = `<span class="log-time">[${timeStr}]</span> ${escapeHtml(message)}`;
        logConsole.appendChild(line);
        logConsole.scrollTop = logConsole.scrollHeight;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    btnClearLog.addEventListener('click', () => {
        logConsole.innerHTML = '';
    });

    // 6. Chọn thư mục nguồn qua hộp thoại Windows
    btnBrowseFolder.addEventListener('click', async () => {
        btnBrowseFolder.disabled = true;
        btnBrowseFolder.innerHTML = 'Đang mở...';

        try {
            const res = await fetch('/api/browse-folder', { method: 'POST' });
            const data = await res.json();
            if (data.folderPath) {
                inputFolderPath.value = data.folderPath;
                await performScan(data.folderPath);
            }
        } catch (err) {
            alert('Lỗi mở hộp thoại chọn thư mục: ' + err.message);
        } finally {
            btnBrowseFolder.disabled = false;
            btnBrowseFolder.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> Chọn thư mục...`;
        }
    });

    // 7. Thử nghiệm với dữ liệu mẫu
    btnUseSample.addEventListener('click', async () => {
        inputFolderPath.value = 'Du_Lieu_Mau';
        await performScan('Du_Lieu_Mau');
    });

    // 8. Quét thư mục
    btnScan.addEventListener('click', async () => {
        const pathVal = inputFolderPath.value.trim();
        if (!pathVal) {
            alert('Vui lòng nhập hoặc chọn thư mục chứa giáo án!');
            inputFolderPath.focus();
            return;
        }
        await performScan(pathVal);
    });

    async function performScan(folderPath) {
        btnScan.disabled = true;
        btnScan.innerHTML = 'Đang quét...';

        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath })
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Quét thư mục thất bại');
            }

            state.scanData = data;
            state.orderedSubjects = data.subjects.map(s => ({
                name: s.name,
                enabled: true,
                totalFiles: s.totalFiles
            }));

            state.selectedWeeks = new Set();
            for (let w = 1; w <= 35; w++) {
                if (data.weeks[w] && data.weeks[w].count > 0) {
                    state.selectedWeeks.add(w);
                }
            }

            const defaultOutDir = data.rootPath ? `${data.rootPath}\\Giao_An_Tong_Hop_35_Tuan` : 'Giao_An_Tong_Hop_35_Tuan';
            inputOutputFolder.value = defaultOutDir;
            state.outputFolder = defaultOutDir;

            sumSubjectCount.textContent = `${data.summary.totalSubjects} môn`;
            sumWeekCount.textContent = `${data.summary.totalWeeksFound} / 35 tuần`;
            sumFileCount.textContent = `${data.summary.totalFilesFound} tệp Word`;
            scanSummaryBar.classList.remove('hidden');

            renderStep2Subjects();
            renderStep3Weeks();

            sectionStep2.classList.remove('hidden');
            sectionStep3.classList.remove('hidden');
            sectionStep4.classList.remove('hidden');

            sectionStep2.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            alert('Không thể quét thư mục: ' + err.message);
        } finally {
            btnScan.disabled = false;
            btnScan.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Quét thư mục`;
        }
    }

    // 9. Render Bước 2: Danh Sách Môn Học
    function renderStep2Subjects() {
        subjectListEl.innerHTML = '';
        if (state.orderedSubjects.length === 0) {
            subjectListEl.innerHTML = '<p class="text-muted">Không tìm thấy môn học nào trong thư mục.</p>';
            return;
        }

        state.orderedSubjects.forEach((sub, idx) => {
            const item = document.createElement('div');
            item.className = 'subject-item';

            item.innerHTML = `
                <div class="subject-left">
                    <span class="subject-order-num">${idx + 1}</span>
                    <input type="checkbox" id="chk-sub-${idx}" ${sub.enabled ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
                    <label for="chk-sub-${idx}" class="subject-name" style="cursor: pointer;">${escapeHtml(sub.name)}</label>
                    <span class="subject-count-tag">${sub.totalFiles} tệp</span>
                </div>
                <div class="subject-actions">
                    <button type="button" class="btn-icon btn-move-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Đưa lên trên">▲</button>
                    <button type="button" class="btn-icon btn-move-down" data-idx="${idx}" ${idx === state.orderedSubjects.length - 1 ? 'disabled' : ''} title="Đưa xuống dưới">▼</button>
                </div>
            `;

            item.querySelector(`#chk-sub-${idx}`).addEventListener('change', (e) => {
                sub.enabled = e.target.checked;
            });

            item.querySelector('.btn-move-up').addEventListener('click', () => {
                if (idx > 0) {
                    const temp = state.orderedSubjects[idx];
                    state.orderedSubjects[idx] = state.orderedSubjects[idx - 1];
                    state.orderedSubjects[idx - 1] = temp;
                    renderStep2Subjects();
                }
            });

            item.querySelector('.btn-move-down').addEventListener('click', () => {
                if (idx < state.orderedSubjects.length - 1) {
                    const temp = state.orderedSubjects[idx];
                    state.orderedSubjects[idx] = state.orderedSubjects[idx + 1];
                    state.orderedSubjects[idx + 1] = temp;
                    renderStep2Subjects();
                }
            });

            subjectListEl.appendChild(item);
        });
    }

    // Các mẫu sắp xếp thứ tự môn
    document.getElementById('preset-default').addEventListener('click', () => {
        const DEFAULT_ORDER = ['Tiếng Việt', 'Toán', 'Đạo đức', 'Khoa học', 'Lịch sử và Địa lí', 'Công nghệ', 'Hoạt động trải nghiệm', 'Tin học', 'Tiếng Anh', 'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất'];
        state.orderedSubjects.sort((a, b) => {
            let iA = DEFAULT_ORDER.indexOf(a.name);
            let iB = DEFAULT_ORDER.indexOf(b.name);
            if (iA === -1) iA = 99;
            if (iB === -1) iB = 99;
            return iA - iB;
        });
        renderStep2Subjects();
    });

    document.getElementById('preset-toan-first').addEventListener('click', () => {
        const TOAN_ORDER = ['Toán', 'Tiếng Việt', 'Khoa học', 'Lịch sử và Địa lí', 'Đạo đức', 'Công nghệ', 'Hoạt động trải nghiệm'];
        state.orderedSubjects.sort((a, b) => {
            let iA = TOAN_ORDER.indexOf(a.name);
            let iB = TOAN_ORDER.indexOf(b.name);
            if (iA === -1) iA = 99;
            if (iB === -1) iB = 99;
            return iA - iB;
        });
        renderStep2Subjects();
    });

    document.getElementById('preset-alpha').addEventListener('click', () => {
        state.orderedSubjects.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        renderStep2Subjects();
    });

    // 10. Render Bước 3: 35 Ô Tuần & Xem Chi Tiết Môn Thiếu
    function renderStep3Weeks() {
        weeksGridEl.innerHTML = '';
        const weeksData = state.scanData.weeks;
        const totalSubs = state.scanData.subjects.length;

        for (let w = 1; w <= 35; w++) {
            const wInfo = weeksData[w] || { count: 0, status: 'empty', missing: [], files: {} };
            const card = document.createElement('div');
            card.className = `week-card status-${wInfo.status}`;
            if (state.selectedWeeks.has(w)) {
                card.classList.add('selected');
            }

            let statusText = 'Chưa có file';
            if (wInfo.status === 'full') {
                statusText = `Đủ ${wInfo.count} môn`;
            } else if (wInfo.status === 'partial') {
                statusText = `${wInfo.count}/${totalSubs} môn (Xem thiếu)`;
            }

            const title = `Tuần ${w < 10 ? '0' + w : w}`;
            card.innerHTML = `
                <div class="week-card-title">${title}</div>
                <div class="week-card-status">${statusText}</div>
            `;

            card.addEventListener('click', (e) => {
                // Nếu là tuần thiếu môn (partial) và click vào dòng trạng thái -> Mở modal chi tiết
                if (wInfo.status === 'partial' && e.target.classList.contains('week-card-status')) {
                    openMissingModal(w, wInfo);
                    return;
                }

                if (state.selectedWeeks.has(w)) {
                    state.selectedWeeks.delete(w);
                    card.classList.remove('selected');
                } else {
                    state.selectedWeeks.add(w);
                    card.classList.add('selected');
                }
            });

            weeksGridEl.appendChild(card);
        }
    }

    // Modal chi tiết môn thiếu
    function openMissingModal(week, wInfo) {
        modalTitle.textContent = `Chi tiết các môn - Tuần ${week < 10 ? '0' + week : week}`;
        
        const presentSubs = Object.keys(wInfo.files || {});
        modalPresentList.innerHTML = presentSubs.length > 0 
            ? presentSubs.map(s => `<span class="modal-tag tag-present">${escapeHtml(s)}</span>`).join('')
            : '<span style="font-size:0.8125rem; color:var(--text-light);">Chưa có môn nào</span>';

        const missingSubs = wInfo.missing || [];
        modalMissingList.innerHTML = missingSubs.length > 0
            ? missingSubs.map(s => `<span class="modal-tag tag-missing">${escapeHtml(s)}</span>`).join('')
            : '<span style="font-size:0.8125rem; color:var(--success);">Đã đủ tất cả các môn!</span>';

        modalMissing.classList.remove('hidden');
    }

    function closeModal() {
        modalMissing.classList.add('hidden');
    }

    btnCloseModal.addEventListener('click', closeModal);
    btnModalOk.addEventListener('click', closeModal);
    modalMissing.addEventListener('click', (e) => {
        if (e.target === modalMissing) closeModal();
    });

    // Nút lọc tuần
    document.getElementById('btn-select-all-weeks').addEventListener('click', () => {
        for (let w = 1; w <= 35; w++) state.selectedWeeks.add(w);
        renderStep3Weeks();
    });

    document.getElementById('btn-select-full-weeks').addEventListener('click', () => {
        state.selectedWeeks.clear();
        for (let w = 1; w <= 35; w++) {
            if (state.scanData.weeks[w] && state.scanData.weeks[w].status === 'full') {
                state.selectedWeeks.add(w);
            }
        }
        renderStep3Weeks();
    });

    document.getElementById('btn-select-hk1').addEventListener('click', () => {
        state.selectedWeeks.clear();
        for (let w = 1; w <= 18; w++) {
            if (state.scanData.weeks[w] && state.scanData.weeks[w].count > 0) {
                state.selectedWeeks.add(w);
            }
        }
        renderStep3Weeks();
    });

    document.getElementById('btn-select-hk2').addEventListener('click', () => {
        state.selectedWeeks.clear();
        for (let w = 19; w <= 35; w++) {
            if (state.scanData.weeks[w] && state.scanData.weeks[w].count > 0) {
                state.selectedWeeks.add(w);
            }
        }
        renderStep3Weeks();
    });

    document.getElementById('btn-deselect-all-weeks').addEventListener('click', () => {
        state.selectedWeeks.clear();
        renderStep3Weeks();
    });

    // 11. Chọn Thư Mục Đầu Ra
    btnBrowseOutputFolder.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/browse-folder', { method: 'POST' });
            const data = await res.json();
            if (data.folderPath) {
                inputOutputFolder.value = data.folderPath;
                state.outputFolder = data.folderPath;
            }
        } catch (err) {
            alert('Lỗi chọn thư mục kết quả: ' + err.message);
        }
    });

    // 12. Bắt Đầu Ghép Tài Liệu
    btnStartMerge.addEventListener('click', async () => {
        if (state.isMerging) return;

        const weeksToProcess = Array.from(state.selectedWeeks).sort((a, b) => a - b);
        if (weeksToProcess.length === 0) {
            alert('Vui lòng chọn ít nhất một tuần để ghép!');
            return;
        }

        const activeSubjects = state.orderedSubjects
            .filter(s => s.enabled)
            .map(s => s.name);

        if (activeSubjects.length === 0) {
            alert('Vui lòng chọn ít nhất một môn học để ghép!');
            return;
        }

        const outDir = inputOutputFolder.value.trim();
        if (!outDir) {
            alert('Vui lòng nhập thư mục lưu kết quả!');
            return;
        }

        state.isMerging = true;
        btnStartMerge.disabled = true;
        btnStartMerge.innerHTML = 'Đang tiến hành ghép...';

        sectionProgress.classList.remove('hidden');
        completionBox.classList.add('hidden');
        progressBar.style.width = '0%';
        progressPercentLabel.textContent = '0%';
        progressStatusText.textContent = `Đang bắt đầu ghép ${weeksToProcess.length} tuần...`;
        sectionProgress.scrollIntoView({ behavior: 'smooth' });

        appendLog(`Bắt đầu ghép ${weeksToProcess.length} tuần: [${weeksToProcess.join(', ')}]`, 'info');
        appendLog(`Thứ tự môn áp dụng: ${activeSubjects.join(' → ')}`, 'info');
        appendLog(`Cấu trúc tên file: ${inputNamingPattern.value.trim()} (Lớp: ${inputLopName.value.trim()})`, 'info');
        appendLog(`Đánh số trang liên tục: ${chkContinuousPage.checked ? 'BẬT' : 'TẮT'} | Chữ ký BGH-TT-GV: ${chkEnableSignature.checked ? 'BẬT' : 'TẮT'}`, 'info');
        appendLog(`Thư mục đích: ${outDir}`, 'info');

        try {
            const payload = {
                inputFolder: state.scanData.rootPath,
                outputFolder: outDir,
                selectedWeeks: weeksToProcess,
                subjectOrder: activeSubjects,
                pageBreak: chkPageBreak.checked,
                continuousPageNumbering: chkContinuousPage.checked,
                namingPattern: inputNamingPattern.value.trim() || 'KHBD_Tuan_{week}_Lop_{lop}.docx',
                lopName: inputLopName.value.trim() || '5',
                signatureInfo: {
                    enabled: chkEnableSignature.checked,
                    placeDate: sigPlaceDate.value.trim(),
                    bghRole: sigBghRole.value.trim(),
                    bghName: sigBghName.value.trim(),
                    ttRole: sigTtRole.value.trim(),
                    ttName: sigTtName.value.trim(),
                    gvRole: sigGvRole.value.trim(),
                    gvName: sigGvName.value.trim()
                }
            };

            const response = await fetch('/api/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Máy chủ báo lỗi HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.substring(6));
                            handleMergeEvent(event, outDir);
                        } catch (parseErr) {
                            console.error('Lỗi parse SSE:', parseErr, line);
                        }
                    }
                }
            }

        } catch (err) {
            appendLog(`Lỗi xử lý: ${err.message}`, 'error');
            progressStatusText.textContent = `Đã dừng do lỗi: ${err.message}`;
        } finally {
            state.isMerging = false;
            btnStartMerge.disabled = false;
            btnStartMerge.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> BẮT ĐẦU GHÉP TÀI LIỆU`;
        }
    });

    // 13. Xử Lý Sự Kiện Server Trả Về
    function handleMergeEvent(event, outDir) {
        if (event.percent !== undefined) {
            progressBar.style.width = `${event.percent}%`;
            progressPercentLabel.textContent = `${event.percent}%`;
        }

        if (event.type === 'progress') {
            progressStatusText.textContent = event.message;
        } else if (event.type === 'week_success') {
            appendLog(event.message, 'success');
        } else if (event.type === 'week_skipped') {
            appendLog(event.message, 'warning');
        } else if (event.type === 'week_error') {
            appendLog(event.message, 'error');
        } else if (event.type === 'complete') {
            progressBar.style.width = '100%';
            progressPercentLabel.textContent = '100%';
            progressStatusText.textContent = event.message;
            appendLog(event.message, 'success');

            completionDetails.textContent = `Đã ghép thành công ${event.successCount} tuần. File lưu tại: ${outDir}`;
            completionBox.classList.remove('hidden');

            btnOpenResultFolder.onclick = () => {
                fetch('/api/open-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderPath: outDir })
                });
            };
        }
    }
});
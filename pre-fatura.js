/**
 * Pré-Fatura — Proceda PREFAT Layout Reader
 * Client-side parser for Proceda EDI PREFAT text files.
 * No backend required — all processing happens in the browser.
 */
(function () {
    'use strict';

    // ===== State =====
    let parsedData = null;
    let selectedFile = null;

    // ===== DOM Elements =====
    const btnImport = document.getElementById('btn-import');
    const btnSavePdf = document.getElementById('btn-save-pdf');
    const modalOverlay = document.getElementById('pf-modal-overlay');
    const modalBackdrop = document.getElementById('pf-modal-backdrop');
    const modalClose = document.getElementById('pf-modal-close');
    const btnCancel = document.getElementById('pf-btn-cancel');
    const btnProcess = document.getElementById('pf-btn-process');
    const dropZone = document.getElementById('pf-drop-zone');
    const fileInput = document.getElementById('pf-file-input');
    const filePreview = document.getElementById('pf-file-preview');
    const fileName = document.getElementById('pf-file-name');
    const fileSize = document.getElementById('pf-file-size');
    const fileRemove = document.getElementById('pf-file-remove');
    const summarySection = document.getElementById('pf-summary');
    const tableSection = document.getElementById('pf-table-section');
    const tableBody = document.getElementById('pf-table-body');
    const emptyState = document.getElementById('pf-empty-state');
    const toast = document.getElementById('pf-toast');
    const toastMessage = document.getElementById('pf-toast-message');

    // Summary elements
    const pfNumber = document.getElementById('pf-number');
    const pfDocCount = document.getElementById('pf-doc-count');
    const pfTotalValue = document.getElementById('pf-total-value');
    const pfPeriod = document.getElementById('pf-period');
    const pfResultsCount = document.getElementById('pf-results-count');

    // ===== Modal Control =====
    function openModal() {
        modalOverlay.style.display = 'flex';
        resetModalFile();
    }

    function closeModal() {
        modalOverlay.style.display = 'none';
        resetModalFile();
    }

    function resetModalFile() {
        selectedFile = null;
        fileInput.value = '';
        filePreview.style.display = 'none';
        dropZone.style.display = '';
        btnProcess.disabled = true;
    }

    function setFile(file) {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'txt') {
            showToast('Formato inválido. Selecione um arquivo .TXT', true);
            return;
        }
        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        filePreview.style.display = 'flex';
        dropZone.style.display = 'none';
        btnProcess.disabled = false;
    }

    btnImport.addEventListener('click', openModal);
    modalBackdrop.addEventListener('click', closeModal);
    modalClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    // Drop zone events
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            setFile(fileInput.files[0]);
        }
    });
    fileRemove.addEventListener('click', resetModalFile);

    // Process button
    btnProcess.addEventListener('click', () => {
        if (!selectedFile) return;
        processFile(selectedFile);
    });

    // ===== File Processing =====
    function processFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const text = e.target.result;
                parsedData = parseProcedaPrefat(text);
                renderData(parsedData);
                closeModal();
                showToast('Arquivo processado com sucesso! ' + parsedData.documents.length + ' documentos encontrados.');
            } catch (err) {
                console.error('Erro ao processar arquivo:', err);
                showToast('Erro ao processar o arquivo. Verifique o formato.', true);
            }
        };
        reader.onerror = function () {
            showToast('Erro ao ler o arquivo.', true);
        };
        reader.readAsText(file, 'ISO-8859-1');
    }

    // ===== Proceda PREFAT Parser =====
    function parseProcedaPrefat(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        const data = {
            carrierCode: '',
            carrierName: '',
            prefatNumber: '',
            emitterCNPJ: '',
            totalQty: 0,
            totalValue: 0,
            periodStart: '',
            periodEnd: '',
            documents: []
        };

        let currentDoc = null;

        for (const line of lines) {
            const recordId = line.substring(0, 3);

            switch (recordId) {
                case '000':
                    // Header: carrier code & name
                    data.carrierCode = line.substring(3, 13).trim();
                    data.carrierName = line.substring(46, 86).trim();
                    break;

                case '390':
                    // Pre-invoice header
                    {
                        const prefatContent = line.substring(3).trim();
                        if (prefatContent.startsWith('PREFATA')) {
                            data.prefatNumber = prefatContent.substring(7).trim();
                        } else {
                            data.prefatNumber = prefatContent;
                        }
                    }
                    break;

                case '391':
                    // Emitter CNPJ
                    data.emitterCNPJ = line.substring(3, 17).trim();
                    break;

                case '392':
                    // Totals and dates
                    {
                        data.totalQty = parseInt(line.substring(39, 43), 10) || 0;
                        const rawTotal = line.substring(43, 58).trim();
                        data.totalValue = parseProcdaValue(rawTotal);
                        const dateStr1 = line.substring(23, 31);
                        const dateStr2 = line.substring(31, 39);
                        data.periodStart = formatProcdaDate(dateStr1);
                        data.periodEnd = formatProcdaDate(dateStr2);
                    }
                    break;

                case '393':
                    // Fiscal document detail
                    {
                        currentDoc = parseRecord393(line);
                        data.documents.push(currentDoc);
                    }
                    break;

                case '396':
                    // CTe references for the current document
                    if (currentDoc) {
                        const ctes = parseRecord396(line);
                        currentDoc.ctes = currentDoc.ctes.concat(ctes);
                    }
                    break;
            }
        }

        return data;
    }

    function parseRecord393(line) {
        // Record 393 layout:
        // 0-2: 393
        // 3-16: Emitter CNPJ (14 chars)
        // 23-50: Doc type description
        // 56-61: Doc number
        // 68-75: Emission date (DDMMYYYY)
        // 76-89: Dest CNPJ (14 chars)
        // 106+: Values (1 char flag + 3x 15 chars values)
        
        const emitterCNPJ = line.substring(3, 17).trim();
        const docType = line.substring(23, 51).trim();
        const docNumber = line.substring(56, 62).trim();
        
        const emissionDateRaw = line.substring(68, 76).trim();
        const emissionDate = formatProcdaDate(emissionDateRaw);
        
        const destCNPJ = line.substring(76, 90).trim();
        const carrierCNPJ = line.substring(91, 105).trim();
        
        // Values section starts at 106. We found in test it's length 47.
        // Format: 1 char flag, then 2 or 3 value fields of 15 or 16 chars...
        // Wait, the safest parsing based on tests: value strings ending at specific positions
        // Since different lines might have slight offset issues for the 3rd column, we parse:
        // V1: pos 107 to 121 (15 chars)
        // V2: pos 123 to 137 (15 chars, wait test showed pos 122-136)
        
        // Safe fixed positions based on analysis
        const rawMerchandise = line.substring(107, 122).trim();
        const merchandiseValue = parseProcdaValue(rawMerchandise);
        
        const rawFreight = line.substring(122, 137).trim();
        const freightValue = parseProcdaValue(rawFreight);
        
        // Final value is strictly 15 chars starting at 137
        const rawAccessory = line.substring(137, 152).trim();
        const accessoryValue = parseProcdaValue(rawAccessory);

        return {
            emitterCNPJ,
            docType,
            docNumber,
            emissionDate,
            destCNPJ,
            carrierCNPJ,
            merchandiseValue,
            freightValue,
            accessoryValue,
            ctes: []
        };
    }

    function parseRecord396(line) {
        // Record 396: CTe references
        // Each CTe reference is a block: 2-char identifier + 10-char number
        const ctes = [];
        const content = line.substring(3).trimEnd();
        
        // Parse blocks of CTe references
        // Format: "21 XXXXXXXXXX" repeating
        let pos = 0;
        while (pos < content.length) {
            const block = content.substring(pos, pos + 12).trim();
            if (block.length > 0) {
                // Extract the CTe number (skip the 2-char type prefix and space)
                const cteNum = block.substring(2).trim();
                if (cteNum.length > 0) {
                    ctes.push(cteNum);
                }
            }
            pos += 12;
        }
        return ctes;
    }

    function parseProcdaValue(raw) {
        if (!raw || raw.length === 0) return 0;
        // Remove leading zeros and non-numeric chars
        const numStr = raw.replace(/\D/g, '');
        if (numStr.length === 0) return 0;
        // Last 2 digits are decimals
        const intPart = parseInt(numStr, 10);
        return intPart / 100;
    }

    function formatProcdaDate(raw) {
        if (!raw || raw.length < 8) return '—';
        const cleanDate = raw.replace(/\D/g, '');
        if (cleanDate.length < 8) return '—';
        const day = cleanDate.substring(0, 2);
        const month = cleanDate.substring(2, 4);
        const year = cleanDate.substring(4, 8);
        if (day === '00' || month === '00' || year === '0000') return '—';
        return `${day}/${month}/${year}`;
    }

    function formatCNPJ(cnpj) {
        if (!cnpj || cnpj.length < 14) return cnpj || '—';
        const c = cnpj.padStart(14, '0');
        return `${c.substr(0, 2)}.${c.substr(2, 3)}.${c.substr(5, 3)}/${c.substr(8, 4)}-${c.substr(12, 2)}`;
    }

    function formatCurrency(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // ===== Render Data =====
    function renderData(data) {
        // Hide empty state, show data
        emptyState.style.display = 'none';
        summarySection.style.display = '';
        tableSection.style.display = '';
        btnSavePdf.style.display = '';

        // Summary
        pfNumber.textContent = data.prefatNumber || '—';
        pfDocCount.textContent = data.documents.length;
        
        // Calculate total freight from documents
        const totalFreight = data.documents.reduce((sum, d) => sum + d.freightValue, 0);
        pfTotalValue.textContent = formatCurrency(totalFreight);
        
        // Calculate Period from actual documents
        const validDocs = data.documents.filter(d => d.emissionDate && d.emissionDate !== '—');
        
        if (validDocs.length > 0) {
            // Map dates to sortable format YYYYMMDD
            const mappedDates = validDocs.map(d => {
                const parts = d.emissionDate.split('/');
                return { raw: d.emissionDate, val: parts.length === 3 ? parts[2] + parts[1] + parts[0] : '' };
            }).filter(d => d.val !== '').sort((a, b) => a.val.localeCompare(b.val));
            
            if (mappedDates.length > 0) {
                const minDate = mappedDates[0].raw;
                const maxDate = mappedDates[mappedDates.length - 1].raw;
                pfPeriod.textContent = minDate === maxDate ? minDate : `${minDate} a ${maxDate}`;
                // Set a title so full text is visible on hover just in case it overflows
                pfPeriod.title = minDate === maxDate ? minDate : `${minDate} a ${maxDate}`;
            } else {
                pfPeriod.textContent = '—';
                pfPeriod.title = '';
            }
        } else {
            pfPeriod.textContent = '—';
            pfPeriod.title = '';
        }

        pfResultsCount.textContent = data.documents.length + ' registro' + (data.documents.length !== 1 ? 's' : '');

        // Table
        tableBody.innerHTML = '';
        data.documents.forEach((doc, i) => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td class="text-center row-number">${i + 1}</td>
                <td class="doc-number">${doc.docNumber}</td>
                <td>${doc.emissionDate}</td>
                <td class="cnpj-cell">${formatCNPJ(doc.emitterCNPJ)}</td>
                <td class="text-right">${formatCurrency(doc.freightValue)}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ===== PDF Export =====
    btnSavePdf.addEventListener('click', () => {
        const printArea = document.getElementById('printable-area');
        if (!printArea || !parsedData) return;

        // Add a class specifically for the PDF export to strip out styling
        printArea.classList.add('pdf-export');

        const opt = {
            margin: [10, 10, 10, 10],
            filename: 'PreFatura_' + (parsedData.prefatNumber || 'export') + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff' // White background for PDF
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'landscape'
            }
        };

        showToast('Gerando PDF...');
        html2pdf().set(opt).from(printArea).save().then(() => {
            showToast('PDF salvo com sucesso!');
        }).catch(() => {
            showToast('Erro ao gerar PDF.', true);
        }).finally(() => {
            // Remove the class after the PDF is processed
            printArea.classList.remove('pdf-export');
        });
    });

    // ===== Toast =====
    let toastTimeout = null;
    function showToast(message, isError) {
        if (toastTimeout) clearTimeout(toastTimeout);
        toastMessage.textContent = message;
        toast.querySelector('i').className = isError ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
        toast.style.borderColor = isError ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)';
        toast.style.color = isError ? '#e74c3c' : '#2ecc71';
        toast.classList.add('show');
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }

    // ===== Cache Cleanup on Navigation =====
    function clearData() {
        parsedData = null;
        selectedFile = null;
        if (tableBody) tableBody.innerHTML = '';
    }

    // Cleanup when navigating away
    window.addEventListener('beforeunload', clearData);

    // Cleanup on sidebar link clicks
    document.querySelectorAll('.sidebar nav a:not(.logout-link):not(.active)').forEach(link => {
        link.addEventListener('click', () => {
            clearData();
        });
    });

    // Keyboard: ESC to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.style.display !== 'none') {
            closeModal();
        }
    });

})();

// ===========================================================================
// OCR DANFE - Frontend Logic (Vanilla JS)
// Ported from Next.js React component (page.tsx)
// ===========================================================================

(function () {
    'use strict';

    // ---- State ----
    let queue = [];
    let results = [];
    let isProcessing = false;
    let dragCounter = 0;
    let toastTimer = null;

    // ---- DOM References ----
    const dropZone = document.getElementById('ocr-drop-zone');
    const dropTitle = document.getElementById('drop-title');
    const dropIconWrapper = document.getElementById('drop-icon-wrapper');
    const fileInput = document.getElementById('ocr-file-input');
    const queueSection = document.getElementById('ocr-queue-section');
    const queueGrid = document.getElementById('queue-grid');
    const queueBadges = document.getElementById('queue-badges');
    const btnClearQueue = document.getElementById('btn-clear-queue');
    const shimmerBar = document.getElementById('shimmer-bar');
    const resultsSection = document.getElementById('ocr-results-section');
    const resultsBody = document.getElementById('ocr-results-body');
    const resultsCount = document.getElementById('results-count');
    const emptyState = document.getElementById('ocr-empty-state');
    const toast = document.getElementById('ocr-toast');

    // ---- Helpers ----

    function generateId() {
        return Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    }

    function formatCurrency(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatDate(date) {
        if (!date || date === 'N/A') return date;
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return date;
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return date;
        }
    }

    function formatChave(chave) {
        return chave.replace(/(\d{4})(?=\d)/g, '$1 ');
    }

    function extractNFNumber(chave) {
        if (!chave || chave.length !== 44) return '—';
        const raw = chave.substring(25, 34);
        return parseInt(raw, 10).toString();
    }

    function showToast() {
        if (toastTimer) clearTimeout(toastTimer);
        toast.classList.add('visible');
        toastTimer = setTimeout(function () {
            toast.classList.remove('visible');
        }, 2000);
    }

    function copyChave(chave) {
        navigator.clipboard.writeText(chave).then(function () {
            showToast();
        });
    }

    // ---- Drag & Drop ----

    dropZone.addEventListener('dragenter', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('dragging');
            dropTitle.textContent = 'Solte as imagens aqui';
        }
    });

    dropZone.addEventListener('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter === 0) {
            dropZone.classList.remove('dragging');
            dropTitle.textContent = 'Arraste e solte imagens de DANFEs';
        }
    });

    dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });

    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragging');
        dropTitle.textContent = 'Arraste e solte imagens de DANFEs';
        dragCounter = 0;

        var files = Array.from(e.dataTransfer.files).filter(function (f) {
            return f.type.startsWith('image/');
        });
        if (files.length > 0) {
            addFilesToQueue(files);
        }
    });

    dropZone.addEventListener('click', function () {
        fileInput.click();
    });

    fileInput.addEventListener('change', function (e) {
        var files = Array.from(e.target.files || []);
        if (files.length > 0) {
            addFilesToQueue(files);
        }
        fileInput.value = '';
    });

    // ---- Queue Management ----

    function createThumbnail(file) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function (e) {
                resolve(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }

    async function addFilesToQueue(files) {
        var newItems = [];

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var thumbnail = await createThumbnail(file);
            newItems.push({
                id: generateId(),
                file: file,
                thumbnail: thumbnail,
                status: 'pending',
                statusMessage: 'Na fila...',
                result: null
            });
        }

        queue = queue.concat(newItems);
        renderQueue();
        processQueue(newItems);
    }

    function removeQueueItem(id) {
        queue = queue.filter(function (item) { return item.id !== id; });
        renderQueue();
    }

    function updateQueueItem(id, updates) {
        queue = queue.map(function (item) {
            if (item.id === id) {
                return Object.assign({}, item, updates);
            }
            return item;
        });
        renderQueue();
    }

    function clearCompleted() {
        queue = queue.filter(function (item) {
            return item.status !== 'done' && item.status !== 'error';
        });
        renderQueue();
    }

    btnClearQueue.addEventListener('click', clearCompleted);

    // ---- Processing ----

    async function processQueue(items) {
        isProcessing = true;
        renderQueue();

        for (var i = 0; i < items.length; i++) {
            var item = items[i];

            try {
                // Status: uploading
                updateQueueItem(item.id, { status: 'uploading', statusMessage: 'Enviando imagem...' });
                await new Promise(function (r) { setTimeout(r, 400); });

                // Status: OCR
                updateQueueItem(item.id, { status: 'ocr', statusMessage: 'Lendo com Cloud Vision...' });

                var formData = new FormData();
                formData.append('files', item.file);

                // Optimistic NSDocs update
                var nsdocsTimer = setTimeout(function () {
                    updateQueueItem(item.id, { status: 'nsdocs', statusMessage: 'Consultando NSDocs...' });
                }, 2000);

                var response = await fetch('/api/ocr-process', {
                    method: 'POST',
                    body: formData
                });

                clearTimeout(nsdocsTimer);

                if (!response.ok) {
                    var errorData = await response.json();
                    throw new Error(errorData.error || 'HTTP ' + response.status);
                }

                var data = await response.json();
                var result = data.results && data.results[0];

                if (result && result.success) {
                    updateQueueItem(item.id, {
                        status: 'done',
                        statusMessage: 'Concluído ✓',
                        result: result
                    });
                    results.push(result);
                    renderResults();
                } else {
                    updateQueueItem(item.id, {
                        status: 'error',
                        statusMessage: (result && result.error) || 'Erro no processamento',
                        result: result
                    });
                    if (result && result.chaveAcesso) {
                        results.push(result);
                        renderResults();
                    }
                }
            } catch (error) {
                var message = error instanceof Error ? error.message : 'Erro desconhecido';
                updateQueueItem(item.id, { status: 'error', statusMessage: message });
            }
        }

        isProcessing = false;
        renderQueue();
    }

    // ---- Download ----

    function downloadFile(chave, tipo) {
        var url = '/api/ocr-process?chave=' + encodeURIComponent(chave) + '&tipo=' + encodeURIComponent(tipo);
        window.open(url, '_blank');
    }

    // ---- Rendering ----

    function renderQueue() {
        var completedCount = queue.filter(function (i) { return i.status === 'done'; }).length;
        var errorCount = queue.filter(function (i) { return i.status === 'error'; }).length;
        var pendingCount = queue.filter(function (i) { return i.status !== 'done' && i.status !== 'error'; }).length;

        // Show/hide queue section
        if (queue.length > 0) {
            queueSection.style.display = '';
        } else {
            queueSection.style.display = 'none';
        }

        // Badges
        var badgesHtml = '';
        if (pendingCount > 0) {
            badgesHtml += '<span class="q-badge q-badge-processing"><i class="fas fa-spinner fa-spin"></i> ' + pendingCount + '</span>';
        }
        if (completedCount > 0) {
            badgesHtml += '<span class="q-badge q-badge-success"><i class="fas fa-check-circle"></i> ' + completedCount + '</span>';
        }
        if (errorCount > 0) {
            badgesHtml += '<span class="q-badge q-badge-error"><i class="fas fa-times-circle"></i> ' + errorCount + '</span>';
        }
        queueBadges.innerHTML = badgesHtml;

        // Clear button
        btnClearQueue.style.display = (completedCount > 0 || errorCount > 0) ? '' : 'none';

        // Shimmer
        shimmerBar.style.display = isProcessing ? '' : 'none';

        // Queue items
        queueGrid.innerHTML = '';
        queue.forEach(function (item) {
            var statusClass = '';
            if (item.status === 'done') statusClass = 'status-done';
            else if (item.status === 'error') statusClass = 'status-error';

            var overlayClass = '';
            var overlayIcon = '';
            if (item.status === 'done') {
                overlayClass = 'done';
                overlayIcon = '<i class="fas fa-check-circle"></i>';
            } else if (item.status === 'error') {
                overlayClass = 'error';
                overlayIcon = '<i class="fas fa-times-circle"></i>';
            } else if (item.status !== 'pending' || item.status === 'pending') {
                // For pending, uploading, ocr, nsdocs — show spinner only if not pending
                if (item.status !== 'pending') {
                    overlayClass = 'processing';
                    overlayIcon = '<i class="fas fa-spinner"></i>';
                }
            }

            var textClass = 'text-processing';
            if (item.status === 'done') textClass = 'text-done';
            else if (item.status === 'error') textClass = 'text-error';

            var removeBtn = '';
            if (item.status === 'done' || item.status === 'error') {
                removeBtn = '<button class="queue-item-remove" data-id="' + item.id + '" title="Remover"><i class="fas fa-times-circle"></i></button>';
            }

            var el = document.createElement('div');
            el.className = 'queue-item ' + statusClass;
            el.innerHTML =
                '<div class="queue-thumb">' +
                '<img src="' + item.thumbnail + '" alt="' + item.file.name + '">' +
                (overlayClass ? '<div class="queue-thumb-overlay ' + overlayClass + '">' + overlayIcon + '</div>' : '') +
                '</div>' +
                '<div class="queue-item-info">' +
                '<div class="queue-item-name">' + escapeHtml(item.file.name) + '</div>' +
                '<div class="queue-item-status ' + textClass + '">' + escapeHtml(item.statusMessage) + '</div>' +
                '</div>' +
                removeBtn;

            queueGrid.appendChild(el);
        });

        // Bind remove buttons
        var removeBtns = queueGrid.querySelectorAll('.queue-item-remove');
        removeBtns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                removeQueueItem(btn.getAttribute('data-id'));
            });
        });

        // Empty state
        updateEmptyState();
    }

    function renderResults() {
        if (results.length === 0) {
            resultsSection.style.display = 'none';
            updateEmptyState();
            return;
        }

        resultsSection.style.display = '';
        resultsCount.textContent = results.length + ' ' + (results.length === 1 ? 'nota' : 'notas');

        resultsBody.innerHTML = '';
        results.forEach(function (r) {
            var tr = document.createElement('tr');

            // Chave de Acesso
            var tdChave = document.createElement('td');
            if (r.chaveAcesso) {
                var chaveSpan = document.createElement('span');
                chaveSpan.className = 'chave-cell';
                chaveSpan.title = 'Clique para copiar a chave de acesso';
                chaveSpan.innerHTML = escapeHtml(formatChave(r.chaveAcesso)) + ' <i class="fas fa-copy copy-icon"></i>';
                chaveSpan.addEventListener('click', function () { copyChave(r.chaveAcesso); });
                tdChave.appendChild(chaveSpan);
            } else {
                tdChave.innerHTML = '<span class="chave-error"><i class="fas fa-exclamation-triangle"></i> Não encontrada</span>';
            }
            tr.appendChild(tdChave);

            // Nº NF
            var tdNF = document.createElement('td');
            tdNF.className = 'text-center';
            tdNF.innerHTML = '<span class="nf-number">' + (r.chaveAcesso ? extractNFNumber(r.chaveAcesso) : '—') + '</span>';
            tr.appendChild(tdNF);

            // CNPJ
            var tdCNPJ = document.createElement('td');
            var cnpj = r.nfeData && r.nfeData.cnpjEmitente && r.nfeData.cnpjEmitente !== 'N/A' ? r.nfeData.cnpjEmitente : '—';
            tdCNPJ.innerHTML = '<span class="cnpj-cell">' + escapeHtml(cnpj) + '</span>';
            tr.appendChild(tdCNPJ);

            // Valor NF
            var tdValor = document.createElement('td');
            tdValor.className = 'text-right';
            tdValor.innerHTML = '<span class="valor-cell">' + (r.nfeData && r.nfeData.valorNF ? formatCurrency(r.nfeData.valorNF) : '—') + '</span>';
            tr.appendChild(tdValor);

            // Data Emissão
            var tdData = document.createElement('td');
            tdData.innerHTML = '<span class="date-cell">' + (r.nfeData && r.nfeData.dataEmissao ? formatDate(r.nfeData.dataEmissao) : '—') + '</span>';
            tr.appendChild(tdData);

            // Status
            var tdStatus = document.createElement('td');
            if (r.success) {
                tdStatus.innerHTML = '<span class="status-badge badge-success"><i class="fas fa-check-circle"></i> ' + escapeHtml(r.nfeData && r.nfeData.status ? r.nfeData.status : 'Autorizado') + '</span>';
            } else if (r.chaveAcesso) {
                var warnLabel = r.errorStep === 'nsdocs' ? 'Erro NSDocs' : 'Parcial';
                tdStatus.innerHTML = '<span class="status-badge badge-warning"><i class="fas fa-exclamation-triangle"></i> ' + warnLabel + '</span>';
            } else {
                var errLabel = r.errorStep === 'ocr' ? 'Erro OCR' : r.errorStep === 'regex' ? 'Chave não encontrada' : 'Erro';
                tdStatus.innerHTML = '<span class="status-badge badge-error"><i class="fas fa-times-circle"></i> ' + errLabel + '</span>';
            }
            tr.appendChild(tdStatus);

            // Download
            var tdDownload = document.createElement('td');
            var actionsDiv = document.createElement('div');
            actionsDiv.className = 'download-actions';

            // XML button
            var btnXml = document.createElement('button');
            btnXml.className = 'btn-download btn-xml';
            btnXml.title = 'Download XML';
            btnXml.disabled = !r.chaveAcesso || !r.success;
            btnXml.innerHTML = '<i class="fas fa-file-code"></i>';
            btnXml.addEventListener('click', (function (chave) {
                return function () { if (chave) downloadFile(chave, 'xml'); };
            })(r.chaveAcesso));
            actionsDiv.appendChild(btnXml);

            // PDF button
            var btnPdf = document.createElement('button');
            btnPdf.className = 'btn-download btn-pdf';
            btnPdf.title = 'Download PDF (DANFE)';
            btnPdf.disabled = !r.chaveAcesso || !r.success;
            btnPdf.innerHTML = '<span class="pdf-icon-box">PDF</span>';
            btnPdf.addEventListener('click', (function (chave) {
                return function () { if (chave) downloadFile(chave, 'pdf'); };
            })(r.chaveAcesso));
            actionsDiv.appendChild(btnPdf);

            tdDownload.appendChild(actionsDiv);
            tr.appendChild(tdDownload);

            resultsBody.appendChild(tr);
        });

        updateEmptyState();
    }

    function updateEmptyState() {
        if (queue.length === 0 && results.length === 0) {
            emptyState.style.display = '';
        } else {
            emptyState.style.display = 'none';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---- Init ----
    renderQueue();
    renderResults();
})();

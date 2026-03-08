document.addEventListener('DOMContentLoaded', function() {
    const SUPABASE_URL = 'https://xmgykunzqneldwokzfvi.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZ3lrdW56cW5lbGR3b2t6ZnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzMDM1OTEsImV4cCI6MjA2MTg3OTU5MX0.3282Te3Dvridl9jq5COdzgcUXGvcqTXJ4xLBwxipBaQ';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const uploadResults = document.getElementById('upload-results');

    fileInput.addEventListener('change', updateFileList);
    uploadBtn.addEventListener('click', processFiles);

    // Add drag and drop functionality
    const fileUploadArea = document.getElementById('file-upload-area');
    
    if (fileUploadArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            fileUploadArea.classList.add('highlight');
        }

        function unhighlight(e) {
            fileUploadArea.classList.remove('highlight');
        }

        fileUploadArea.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files && files.length > 0) {
                fileInput.files = files;
                updateFileList();
            }
        }
        
        // Allow clicking the area to select files
        fileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }

    function updateFileList() {
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';

        if (fileInput.files.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'file-list';
            Array.from(fileInput.files).forEach(file => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-file-excel"></i> ${file.name} <span class="file-size">(${formatFileSize(file.size)})</span>`;
                ul.appendChild(li);
            });
            fileList.appendChild(ul);
            uploadBtn.style.display = 'block';
        } else {
            uploadBtn.style.display = 'none';
        }
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // Move updateProgress function before processFiles
    function updateProgress(percent, message) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
        if (message) progressText.textContent = message;
    }

    async function processFiles() {
        if (fileInput.files.length === 0) {
            showMessage('Por favor, selecione pelo menos um arquivo.', 'error');
            return;
        }

        progressContainer.style.display = 'block';
        uploadResults.innerHTML = '';
        const files = Array.from(fileInput.files);

        for (const file of files) {
            try {
                updateProgress(0, `Processando ${file.name}...`);
                const content = await readFileContent(file);
                const workbook = XLSX.read(content, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                const headers = ['CNPJ', 'Remetente', 'NF', 'SerieNF', 'CTE', 'DataCTE', 'TotalCTE', 'Shipment', 'TipoCTE'];
                const records = jsonData.slice(1).map(row => {
                    const record = {};
                    headers.forEach((header, index) => {
                        // Handle empty values
                        if (row[index] === undefined || row[index] === null) {
                            record[header] = '';
                            return;
                        }
                        
                        // Special handling for DataCTE field
                        if (header === 'DataCTE') {
                            // If it's a number (Excel date serial)
                            if (typeof row[index] === 'number') {
                                // Convert Excel date serial to JS date - CORREÇÃO DO PROBLEMA DE DATA
                                // Excel usa um sistema de data diferente, precisamos ajustar o fuso horário
                                const excelDate = new Date((row[index] - 25569) * 86400 * 1000);
                                // Ajuste para o fuso horário local para evitar perda de um dia
                                const utcDate = new Date(excelDate.getTime() + excelDate.getTimezoneOffset() * 60000);
                                const year = utcDate.getFullYear();
                                const month = String(utcDate.getMonth() + 1).padStart(2, '0');
                                const day = String(utcDate.getDate()).padStart(2, '0');
                                record[header] = `${year}-${month}-${day}`;
                            } 
                            // If it's a string with slashes (DD/MM/YYYY)
                            else if (typeof row[index] === 'string' && row[index].includes('/')) {
                                const dateParts = row[index].split('/');
                                if (dateParts.length === 3) {
                                    const day = dateParts[0].padStart(2, '0');
                                    const month = dateParts[1].padStart(2, '0');
                                    const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
                                    record[header] = `${year}-${month}-${day}`;
                                } else {
                                    record[header] = null; // Invalid date format
                                }
                            } 
                            // If it's already in YYYY-MM-DD format
                            else if (typeof row[index] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row[index])) {
                                record[header] = row[index];
                            }
                            else {
                                record[header] = null; // Invalid or unrecognized date
                            }
                        }
                        // Handle TotalCTE as float
                        else if (header === 'TotalCTE') {
                            const value = parseFloat(row[index]);
                            record[header] = isNaN(value) ? 0 : value;
                        }
                        // Handle numeric fields
                        else if (header === 'NF' || header === 'SerieNF' || header === 'CTE') {
                            const value = parseInt(row[index], 10);
                            record[header] = isNaN(value) ? 0 : value;
                        }
                        // Handle text fields
                        else {
                            record[header] = String(row[index]).trim();
                        }
                    });
                    
                    return record;
                });

                await uploadToSupabase(records);
                updateProgress(100, `Upload de ${file.name} concluído com sucesso.`);
            } catch (error) {
                console.error('Error processing file:', error);
                showMessage(`Erro ao processar ${file.name}: ${error.message}`, 'error');
            }
        }
    }

    async function uploadToSupabase(records) {
        try {
            // Use the Supabase client directly instead of fetch
            let successCount = 0;
            let duplicateCount = 0;
            let errorCount = 0;
            
            // Em vez de criar um novo resumo, vamos atualizar o existente
            // Remova este bloco inteiro que cria um novo elemento
            /*
            if (!uploadResults.querySelector('.upload-summary')) {
                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'upload-summary';
                summaryDiv.innerHTML = `
                    <h3>Resumo do Upload</h3>
                    <div class="summary-stats">
                        <div class="stat-item">
                            <span class="stat-label">Registros Processados:</span>
                            <span class="stat-value" id="total-records">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Inseridos com Sucesso:</span>
                            <span class="stat-value success-count" id="success-count">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Duplicados (Ignorados):</span>
                            <span class="stat-value duplicate-count" id="duplicate-count">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Erros:</span>
                            <span class="stat-value error-count" id="error-count">0</span>
                        </div>
                    </div>
                    <div class="error-details" style="display: none;">
                        <h4>Detalhes dos Erros</h4>
                        <ul id="error-list"></ul>
                    </div>
                `;
                uploadResults.appendChild(summaryDiv);
            }
            */
            
            // Atualizar os contadores no resumo existente
            document.getElementById('count-processed').textContent = records.length;
            document.getElementById('count-success').textContent = '0';
            document.getElementById('count-duplicate').textContent = '0';
            document.getElementById('count-error').textContent = '0';
            
            // Process records in smaller batches to avoid payload size issues
            const batchSize = 20;
            for (let i = 0; i < records.length; i += batchSize) {
                updateProgress(Math.floor((i / records.length) * 90), `Enviando registros ${i+1} até ${Math.min(i+batchSize, records.length)}...`);
                
                const batch = records.slice(i, i + batchSize);
                const { data, error } = await supabaseClient
                    .from('DadosCTE')
                    .insert(batch)
                    .select();
                
                if (error) {
                    console.error('Batch error:', error);
                    
                    // Check if it's a duplicate key error
                    if (error.code === '23505') {
                        duplicateCount += batch.length;
                        
                        // Try to insert records one by one to identify which ones are duplicates
                        for (const record of batch) {
                            const { data: singleData, error: singleError } = await supabaseClient
                                .from('DadosCTE')
                                .insert([record])
                                .select();
                                
                            if (!singleError) {
                                // This record was inserted successfully
                                successCount++;
                                duplicateCount--;
                            }
                        }
                    } else {
                        // Other type of error
                        errorCount += batch.length;
                        
                        // Add error details
                        const errorList = document.getElementById('error-list');
                        const errorItem = document.createElement('li');
                        errorItem.textContent = `Erro no lote ${i+1}-${Math.min(i+batchSize, records.length)}: ${error.message}`;
                        errorList.appendChild(errorItem);
                        document.querySelector('.error-details').style.display = 'block';
                    }
                } else {
                    successCount += data ? data.length : 0;
                }
                
                // Atualizar os contadores no resumo existente
                document.getElementById('count-success').textContent = successCount;
                document.getElementById('count-duplicate').textContent = duplicateCount;
                document.getElementById('count-error').textContent = errorCount;
            }
            
            updateProgress(100, `Upload concluído!`);
            showMessage(`Upload finalizado: ${successCount} registros inseridos, ${duplicateCount} duplicados.`, 'success');
            
        } catch (error) {
            console.error('Upload error:', error);
            showMessage(`Erro no upload: ${error.message}`, 'error');
            
            // Add to error details
            const errorList = document.getElementById('error-list');
            const errorItem = document.createElement('li');
            errorItem.textContent = `Erro geral: ${error.message}`;
            errorList.appendChild(errorItem);
            document.querySelector('.error-details').style.display = 'block';
        }
    }

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                resolve(event.target.result);
            };
            reader.onerror = function() {
                reject(new Error('Erro ao ler o arquivo'));
            };
            reader.readAsBinaryString(file);
        });
    }

    function showMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message-animation ${type}`;
        messageElement.innerText = message;
        document.body.appendChild(messageElement);
        setTimeout(() => {
            if (messageElement.parentNode) {
                document.body.removeChild(messageElement);
            }
        }, 3000);
    }
});

// Modificar a função que exibe os resultados para não criar elementos stat-item
function displayResults(results) {
    // Atualizar apenas o resumo usando os elementos summary-item existentes
    const resultData = {
        processed: results.total || 0,
        success: results.success || 0,
        duplicate: results.duplicates || 0,
        error: results.errors || 0
    };
    
    // Atualizar o resumo com os dados reais
    updateUploadSummary(resultData);
    
    // Não criar elementos stat-item adicionais
    // Remover qualquer elemento stat-item existente
    const statsContainer = document.querySelector('.summary-stats');
    if (statsContainer) {
        statsContainer.remove();
    }
    
    // ... resto da função ...
}
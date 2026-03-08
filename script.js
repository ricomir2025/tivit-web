// Define registrosProtocolo in the global scope
let registrosProtocolo = [];

// Move helper functions to global scope
function mostrarLoading() {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'loading-animation';
    loadingElement.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingElement);
}

function removerLoading() {
    const loadingElement = document.querySelector('.loading-animation');
    if (loadingElement) {
        document.body.removeChild(loadingElement);
    }
}

// Modificar mostrarMensagemTemporaria para alinhar à esquerda e centralizar verticalmente
function mostrarMensagemTemporaria(mensagem, tipo) {
    // Remover mensagens antigas do mesmo tipo para evitar acúmulo
    const existingMessages = document.querySelectorAll(`.message-animation.${tipo}`);
    existingMessages.forEach(msg => msg.remove());

    const messageElement = document.createElement('div');
    messageElement.className = `message-animation ${tipo}`;
    messageElement.innerText = mensagem;

    // {{ Apply styles for left alignment and vertical centering }}
    messageElement.style.position = 'fixed';
    messageElement.style.top = '50%';
    // Position near the left edge (e.g., 20px from the left)
    messageElement.style.left = '20px';
    // Only translate vertically to center it
    messageElement.style.transform = 'translateY(-50%)';
    messageElement.style.zIndex = '1001';
    messageElement.style.padding = '15px 25px';
    messageElement.style.borderRadius = '5px';
    messageElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    // As cores de fundo/texto devem vir das classes .success / .error / .info no seu CSS

    document.body.appendChild(messageElement);

    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }, 3000); // 3 segundos
}

// Configurações do remetente
// --- INÍCIO: Função para atualizar o label do remetente ---
function atualizarLabelRemetente() {
    // console.log('Atualizando label. Tamanho atual de registrosProtocolo:', registrosProtocolo.length); // Log 1: Tamanho da matriz - REMOVED
    const remetenteLabel = document.getElementById('remetente-label');
    if (!remetenteLabel) {
        // console.error('Elemento remetente-label não encontrado!'); // Log 2: Erro se o elemento sumir - REMOVED
        return;
    }

    if (registrosProtocolo.length > 0) {
        // console.log('Mostrando label do remetente.'); // Log 3: Indicando que vai mostrar - REMOVED
        const primeiroRemetente = registrosProtocolo[0][1];
        remetenteLabel.textContent = `Remetente: ${primeiroRemetente}`;
        remetenteLabel.style.display = 'inline-block';
    } else {
        // console.log('Ocultando label do remetente.'); // Log 4: Indicando que vai ocultar - REMOVED
        remetenteLabel.textContent = '';
        remetenteLabel.style.display = 'none';
    }
}
// --- FIM: Função para atualizar o label do remetente ---


document.addEventListener('DOMContentLoaded', function () {

    // Verificar se estamos na página de gerar protocolo
    const nfsInput = document.getElementById('nfs');
    if (nfsInput) {
        // Aplicar comportamento baseado na configuração
        const formatoNf = localStorage.getItem('formatoNF') || 'numero';

        if (formatoNf === 'numero') {
            // ... código existente para formatação de números ...
        } else {
            // Para formato texto, não fazemos nenhuma modificação
            nfsInput.type = 'text';
        }

        // Remove the local declaration since we now have it globally
        // let registrosProtocolo = []; <- This line is removed

        // Botão Gravar - Implementação revisada
        const gravarNotaBtn = document.getElementById('gravar-nota');
        if (gravarNotaBtn) {
            gravarNotaBtn.textContent = 'Gravar'; // Mantido para clareza, pode ser ajustado se necessário
            gravarNotaBtn.addEventListener('click', async function () {
                const notaFiscalInput = nfsInput.value.trim(); // Renomeado para clareza
                const dataEntrega = document.getElementById('data-entrega').value;

                if (!notaFiscalInput || !dataEntrega) {
                    // {{ Chamada atualizada sem anchorElement }}
                    mostrarMensagemTemporaria('Por favor, preencha todos os campos!', 'error');
                    return;
                }

                // 1. Verificação de Duplicidade (comparando como strings)
                const nfJaExiste = registrosProtocolo.some(registro => {
                    // console.log(`Comparando: Input "${notaFiscalInput}" com Registro[2] "${registro[2]}"`);
                    // Converter ambos para string para garantir a comparação correta
                    return String(registro[2]) === String(notaFiscalInput);
                });


                if (nfJaExiste) {
                    // Passar o botão como âncora para a mensagem de erro
                    mostrarMensagemTemporaria(`Nota Fiscal ${notaFiscalInput} já incluída nesse protocolo.`, 'error', gravarNotaBtn);
                    nfsInput.focus();
                    return;
                }

                // Validação da data de entrega
                const dataEntregaObj = new Date(dataEntrega);
                // Ajuste para considerar o fuso horário local ao validar datas
                const dataEntregaUTC = new Date(dataEntregaObj.getUTCFullYear(), dataEntregaObj.getUTCMonth(), dataEntregaObj.getUTCDate());
                const dataMinima = new Date();
                dataMinima.setDate(dataMinima.getDate() - 365); // Subtrai 365 dias da data atual para dataMinima
                const dataMaxima = new Date(); // Define dataMaxima como a data atual

                if (isNaN(dataEntregaUTC.getTime()) || dataEntregaUTC < dataMinima || dataEntregaUTC > dataMaxima) {
                    // Passar o botão como âncora para a mensagem de erro
                    mostrarMensagemTemporaria('Data de entrega inválida ou fora do intervalo permitido!', 'error', gravarNotaBtn);
                    return;
                }

                mostrarLoading();

                try {
                    // Conexão corrigida com Supabase
                    const SUPABASE_URL = 'https://xmgykunzqneldwokzfvi.supabase.co';
                    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZ3lrdW56cW5lbGR3b2t6ZnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzMDM1OTEsImV4cCI6MjA2MTg3OTU5MX0.3282Te3Dvridl9jq5COdzgcUXGvcqTXJ4xLBwxipBaQ';

                    const response = await fetch(
                        `${SUPABASE_URL}/rest/v1/DadosCTE?TipoCTE=eq.Normal&NF=eq.${notaFiscalInput}`, // Usar notaFiscalInput
                        {
                            method: 'GET',
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
                    }

                    const data = await response.json();

                    // Verificar se há dados
                    if (!data || data.length === 0) {
                        throw new Error(`NF ${notaFiscalInput} não localizada no banco de dados`);
                    }

                    const dados = data[0];

                    // Extrair dados corretamente da resposta do Supabase
                    const cnpj = dados.CNPJ || '';
                    const remetente = dados.Remetente || '';
                    const nf = dados.NF || ''; // Usar o NF retornado para consistência
                    const serie = dados.SerieNF || '';
                    const cte = dados.CTE || '';
                    // Usar a função de formatação para a data de emissão exibida
                    const emissaoCte = dados.DataCTE ? formatarDataParaPTBR(dados.DataCTE) : '';
                    const valor = dados.TotalCTE ? `R$ ${parseFloat(dados.TotalCTE).toFixed(2)}` : 'R$ 0.00'; // Adicionar R$ aqui
                    const shipment = dados.Shipment || '';

                    // 2. Verificação de Remetente Consistente
                    if (registrosProtocolo.length > 0) {
                        const primeiroRemetente = registrosProtocolo[0][1]; // Índice 1 é o Remetente
                        if (remetente !== primeiroRemetente) {
                            // Não permitir misturar remetentes
                            throw new Error(`Remetente "${remetente}" não pode ser adicionado no mesmo protocolo da ("${primeiroRemetente}").`);
                        }
                    }

                    // Formatar data de entrega corretamente para exibição e Excel
                    const dataEntregaFormatada = formatarDataParaPTBR(dataEntrega); // Usar a função para DD/MM/YYYY

                    // Criar registro para a matriz - com valores formatados para Excel
                    const valorExcel = dados.TotalCTE ? parseFloat(dados.TotalCTE).toFixed(2).replace('.', ',') : '0,00';
                    // Usar a data de emissão já formatada para PT-BR
                    const emissaoCteExcel = emissaoCte;

                    const novoRegistro = [
                        cnpj,           // A - CNPJ
                        remetente,      // B - REMETENTE
                        nf,             // C - NF (agora garantido como string)
                        serie,          // D - SERIE
                        cte,            // E - CTE
                        emissaoCteExcel,// F - EMISSÃO (formato PT-BR para Excel)
                        valorExcel,     // G - VALOR (sem R$ e com vírgula para Excel)
                        shipment,       // H - SHIPMENT
                        dataEntregaFormatada // I - DATA_ENTREGA (formato PT-BR)
                    ];

                    // Adicionar à matriz global
                    registrosProtocolo.push(novoRegistro);

                    // --- INÍCIO DA ALTERAÇÃO: Atualizar label do remetente ---
                    atualizarLabelRemetente(); // Chama a função para mostrar/atualizar o label
                    // --- FIM DA ALTERAÇÃO ---

                    // Adicionar à tabela de relatório
                    const tabela = document.getElementById('relatorio-notas');
                    const tbody = tabela.querySelector('tbody');
                    const novaLinha = document.createElement('tr');
                    // Usar os dados formatados para exibição
                    novaLinha.innerHTML = `
                        <td>${cnpj}</td>
                        <td>${remetente}</td>
                        <td>${nf}</td>
                        <td>${serie}</td>
                        <td>${cte}</td>
                        <td>${emissaoCte}</td>
                        <td>${valor}</td>
                        <td>${shipment}</td>
                        <td>${dataEntregaFormatada}</td>
                        <td><button class="excluir-btn">Excluir</button></td>
                    `;

                    tbody.appendChild(novaLinha);

                    // Adicionar evento para o botão excluir
                    const excluirBtn = novaLinha.querySelector('.excluir-btn');
                    excluirBtn.addEventListener('click', function () {
                        // console.log('Botão Excluir clicado.'); // Log 5: Confirmação do clique - REMOVED
                        const nfParaExcluir = String(novaLinha.cells[2].textContent);
                        const index = registrosProtocolo.findIndex(reg => String(reg[2]) === nfParaExcluir);
                        // console.log(`Tentando excluir NF: ${nfParaExcluir}. Índice encontrado: ${index}`); // Log 6: Detalhes da exclusão - REMOVED

                        if (index !== -1) {
                            // console.log('Tamanho ANTES de splice:', registrosProtocolo.length); // Log 7: Tamanho antes - REMOVED
                            // Remover da matriz global
                            registrosProtocolo.splice(index, 1);
                            // console.log('Tamanho DEPOIS de splice:', registrosProtocolo.length); // Log 8: Tamanho depois - REMOVED
                            // Remover da tabela
                            tbody.removeChild(novaLinha);
                            // console.log('Chamando atualizarLabelRemetente após exclusão bem-sucedida.'); // Log 9: Confirmação da chamada - REMOVED
                            // --- INÍCIO DA ALTERAÇÃO: Atualizar label após exclusão ---
                            atualizarLabelRemetente();
                            // --- FIM DA ALTERAÇÃO ---
                        } else {
                            // console.error(`Erro ao encontrar índice para exclusão da NF: ${nfParaExcluir}. Removendo apenas da tabela.`); // Log 10: Erro no índice - REMOVED
                            // Apenas remover da tabela como fallback
                            tbody.removeChild(novaLinha);
                            // Considerar chamar atualizarLabelRemetente() aqui também se a remoção visual deve sempre atualizar o label
                            // console.log('Chamando atualizarLabelRemetente após fallback de exclusão.');
                            // atualizarLabelRemetente();
                        }
                    });

                    // Limpar campos
                    nfsInput.value = '';
                    document.getElementById('data-entrega').value = '';

                    removerLoading();
                    // Passar o botão como âncora para a mensagem de sucesso
                    mostrarMensagemTemporaria('NF Incluída com sucesso!', 'success', gravarNotaBtn);

                } catch (err) {
                    console.error('Erro detalhado ao gravar nota:', err); // Log mais específico
                    removerLoading();
                    // Exibir a mensagem de erro específica capturada
                    mostrarMensagemTemporaria(`Erro: ${err.message}`, 'error');
                }

                // Retornar o foco para o campo de Nota Fiscal
                nfsInput.focus();
            });
        }
        // --- INÍCIO DA ALTERAÇÃO: Chamar atualização inicial casa a página recarregue com dados (pouco provável aqui, mas boa prática) ---
        atualizarLabelRemetente();
        // --- FIM DA ALTERAÇÃO ---
    } // This brace closes the 'if (nfsInput)' block

    // The preencherDadosProtocolo function was previously inside the 'if (nfsInput)' block,
    // but it seems it should be accessible outside it as well, or perhaps it was intended
    // to be inside. Assuming it should be inside the DOMContentLoaded but outside the if(nfsInput):
    /*
    function preencherDadosProtocolo(dados, dataEntrega) {
        const tabela = document.getElementById('relatorio-notas');
        if (!tabela) return;
        
        const tbody = tabela.querySelector('tbody');
        const tr = document.createElement('tr');
        
        // Corrigindo a ordem dos campos para corresponder às colunas da tabela
        tr.innerHTML = `
            <td>${dados.CNPJ || ''}</td>
            <td>${dados.Remetente || ''}</td>
            <td>${dados.NF || ''}</td>
            <td>${dados.SerieNF || ''}</td>
            <td>${dados.CTE || ''}</td>
            <td>${dados.DataCTE || ''}</td>
            <td>${dados.TotalCTE || '0.00'}</td>
            <td>${dados.Shipment || ''}</td>
            <td>${dataEntrega}</td>
        `;
        
        tbody.appendChild(tr);
    }
    */
    // If preencherDadosProtocolo is only used within the if(nfsInput) block, it should stay there.
    // If it's used elsewhere, it needs to be defined in the correct scope.
    // For now, let's assume the structure was intended as is, and the extra brace is the issue.

});

// Optional: Function to play hover sound (requires sound files)
function playHoverSound() {
    // const audio = new Audio('sounds/hover.mp3');
    // audio.volume = 0.1;
    // audio.play().catch(() => {}); // Fail silently if no audio file
}

// Add CSS class for scroll animation via JavaScript
const style = document.createElement('style');
style.textContent = `
    .animate-on-scroll {
        animation: slideInScale 0.6s ease-out;
    }
    
    @keyframes slideInScale {
        0% {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
        }
        100% {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
`;
document.head.appendChild(style);

// Manter as funções existentes (These should be outside DOMContentLoaded if called from HTML or other scripts)
// Or inside if only called by code within DOMContentLoaded

function formatarDataDDMMAAAA(dataString) {
    // ... código existente para formatação de data ...
}

// Implementação do botão finalizar protocolo removida daqui (duplicação corrigida)
// A implementação correta está dentro do DOMContentLoaded


// Corrected Structure Suggestion:
// Move the Finalizar Protocolo logic and its helpers INSIDE the DOMContentLoaded listener

document.addEventListener('DOMContentLoaded', function () {
    // ... (existing code inside DOMContentLoaded, including the if(nfsInput) block) ...

    // --- START: Finalizar Protocolo Logic (versão única corrigida) ---
    const finalizarProtocoloBtn = document.getElementById('finalizar-protocolo');
    if (finalizarProtocoloBtn) {
        finalizarProtocoloBtn.addEventListener('click', async function () {
            if (!registrosProtocolo.length) {
                mostrarMensagemTemporaria('Adicione pelo menos uma nota fiscal antes de finalizar', 'error');
                return;
            }

            const userConfirmed = await showCustomConfirm("Confirma a Finalização do Protocolo?");
            if (!userConfirmed) {
                mostrarMensagemTemporaria('Geração cancelada pelo usuário.', 'info');
                return;
            }

            mostrarLoading();
            try {
                if (typeof XLSX === 'undefined') {
                    await carregarBibliotecaXLSX();
                    if (typeof XLSX === 'undefined') {
                        throw new Error('Falha crítica: Biblioteca XLSX não carregada');
                    }
                }

                // Cabeçalho fixo completo, conforme solicitado (incluindo todas as colunas da imagem)
                const headers = [
                    "CNPJ", "REMETENTE", "NOTA FISCAL", "SERIE", "CTE",
                    "EMISSÃO", "VALOR", "SHIPMENT", "DATA ENTREGA", "POSSUI RESSALVA", "OBSERVAÇÃO", "", "", "", "", "WI-NOVO", "", "", "WI"
                ];

                // Garante que, mesmo sem dados, a planilha terá apenas o cabeçalho
                const wsData = [headers];
                if (registrosProtocolo.length > 0) {
                    wsData.push(...registrosProtocolo);
                }

                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.aoa_to_sheet(wsData);
                XLSX.utils.book_append_sheet(workbook, worksheet, "Protocolo");
                const wscols = [
                    { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
                    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
                    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
                ];
                worksheet['!cols'] = wscols;

                const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xls' });
                const blob = new Blob([buffer], { type: 'application/octet-stream' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `ProtTivit${new Date().toISOString().replace(/[-:TZ]/g, '').slice(0, 14)}.xls`;
                document.body.appendChild(link);
                link.click();

                setTimeout(() => {
                    if (link.parentNode) {
                        document.body.removeChild(link);
                    }
                    URL.revokeObjectURL(link.href);
                    registrosProtocolo = [];
                    location.reload();
                }, 1000);

            } catch (error) {
                console.error('Erro detalhado:', error);
                mostrarMensagemTemporaria(`Falha na exportação: ${error.message}`, 'error');
            } finally {
                removerLoading();
            }
        });
    }
    // --- END: Finalizar Protocolo Logic ---

}); // Fecha o DOMContentLoaded


// Example: Defining them globally
async function carregarBibliotecaXLSX() {
    // console.log("[XLSX Loader] Attempting to load SheetJS library..."); // Log removido
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            // console.log("[XLSX Loader] Library already loaded."); // Log removido
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.async = true;

        script.onload = () => {
            if (typeof XLSX !== 'undefined') {
                // console.log("[XLSX Loader] Library loaded successfully via onload."); // Log removido
                resolve();
            } else {
                console.error("[XLSX Loader] ERROR: Script loaded but XLSX object not found!"); // Manter este console.error
                reject(new Error('Falha ao carregar a biblioteca XLSX: objeto XLSX não definido após load.'));
            }
        };

        script.onerror = (error) => {
            console.error("[XLSX Loader] ERROR: Failed to load the script.", error); // Manter este console.error
            reject(new Error('Falha ao carregar o script da biblioteca XLSX. Verifique a conexão ou o URL.'));
        };

        document.head.appendChild(script);
        // console.log("[XLSX Loader] Script tag added to head."); // Log removido
    });
}

function formatarDataParaPTBR(dataString) {
    if (!dataString) return '';
    const partes = dataString.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataString; // Retorna original se não estiver no formato esperado
}

function showCustomConfirm(message) {
    return new Promise((resolve) => {
        // console.log("[Confirm Modal] Initializing..."); // Log removido
        const overlay = document.getElementById('custom-confirm-overlay');
        const modal = document.getElementById('custom-confirm-modal');
        const messageElement = document.getElementById('custom-confirm-message');
        const yesButton = document.getElementById('custom-confirm-yes');
        const noButton = document.getElementById('custom-confirm-no');

        // console.log("[Confirm Modal] Elements found:", { overlay, modal, messageElement, yesButton, noButton }); // Log removido

        if (!overlay || !modal || !messageElement || !yesButton || !noButton) {
            console.error("[Confirm Modal] ERROR: One or more modal elements not found! Please check IDs in gerar-protocolo.html."); // Manter este console.error pode ser útil para erros inesperados
            resolve(false);
            return;
        }

        messageElement.textContent = message;

        const handleYes = () => {
            // console.log("[Confirm Modal] 'Yes' button clicked."); // Log removido
            cleanup();
            resolve(true);
        };

        const handleNo = () => {
            // console.log("[Confirm Modal] 'No' button clicked."); // Log removido
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            // console.log("[Confirm Modal] Cleaning up listeners."); // Log removido
            yesButton.removeEventListener('click', handleYes);
            noButton.removeEventListener('click', handleNo);
            overlay.style.display = 'none';
        };

        // console.log("[Confirm Modal] Adding event listeners."); // Log removido
        yesButton.addEventListener('click', handleYes);
        noButton.addEventListener('click', handleNo);

        // console.log("[Confirm Modal] Displaying modal."); // Log removido
        overlay.style.display = 'flex';
    });
}
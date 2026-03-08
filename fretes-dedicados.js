// Fretes Dedicados - Lógica de Upload e Conferência de CTE
document.addEventListener('DOMContentLoaded', function () {

    // ===== Configuração Supabase (projeto: protocolos_tivit_2025) =====
    const SUPABASE_URL = 'https://xmgykunzqneldwokzfvi.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZ3lrdW56cW5lbGR3b2t6ZnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzMDM1OTEsImV4cCI6MjA2MTg3OTU5MX0.3282Te3Dvridl9jq5COdzgcUXGvcqTXJ4xLBwxipBaQ';
    const CTE_NS = 'http://www.portalfiscal.inf.br/cte';

    // Estado dos arquivos
    let arquivoOferta = null;
    let arquivoXml = null;

    // Referências aos elementos
    const dropOferta = document.getElementById('drop-oferta');
    const dropXml = document.getElementById('drop-xml');
    const inputOferta = document.getElementById('input-oferta');
    const inputXml = document.getElementById('input-xml');
    const previewOferta = document.getElementById('preview-oferta');
    const previewXml = document.getElementById('preview-xml');
    const nomeOferta = document.getElementById('nome-oferta');
    const tamanhoOferta = document.getElementById('tamanho-oferta');
    const nomeXml = document.getElementById('nome-xml');
    const tamanhoXml = document.getElementById('tamanho-xml');
    const removerOferta = document.getElementById('remover-oferta');
    const removerXml = document.getElementById('remover-xml');
    const btnConferir = document.getElementById('btn-conferir');
    const actionHint = document.getElementById('action-hint');
    const cardOferta = document.getElementById('card-oferta');
    const cardXml = document.getElementById('card-xml');

    // ===== Utilidades =====

    function formatarTamanho(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatarMoeda(valor) {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function atualizarEstadoBotao() {
        if (arquivoOferta && arquivoXml) {
            btnConferir.disabled = false;
            actionHint.textContent = '✓ Arquivos carregados — pronto para conferir';
            actionHint.classList.add('ready');
        } else {
            btnConferir.disabled = true;
            const faltam = [];
            if (!arquivoOferta) faltam.push('Oferta de Carga');
            if (!arquivoXml) faltam.push('XML do CTE');
            actionHint.textContent = `Carregue: ${faltam.join(' e ')}`;
            actionHint.classList.remove('ready');
        }
    }

    // ===== Validação de arquivos =====

    function validarArquivoOferta(file) {
        const extensoes = ['.xls', '.xlsx'];
        const nomeArq = file.name.toLowerCase();
        const valido = extensoes.some(ext => nomeArq.endsWith(ext));
        if (!valido) {
            mostrarErro('Formato inválido! Selecione um arquivo .xls ou .xlsx');
            return false;
        }
        return true;
    }

    function validarArquivoXml(file) {
        const nomeArq = file.name.toLowerCase();
        if (!nomeArq.endsWith('.xml')) {
            mostrarErro('Formato inválido! Selecione um arquivo .xml');
            return false;
        }
        return true;
    }

    function mostrarErro(mensagem) {
        const msgEl = document.createElement('div');
        msgEl.className = 'message-animation error';
        msgEl.textContent = mensagem;
        msgEl.style.position = 'fixed';
        msgEl.style.top = '50%';
        msgEl.style.left = '50%';
        msgEl.style.transform = 'translate(-50%, -50%)';
        msgEl.style.zIndex = '1001';
        msgEl.style.padding = '15px 25px';
        msgEl.style.borderRadius = '8px';
        msgEl.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        msgEl.style.backgroundColor = 'rgba(231, 76, 60, 0.9)';
        msgEl.style.color = '#fff';
        msgEl.style.fontWeight = 'bold';
        msgEl.style.animation = 'fade-in-out 3s ease-in-out forwards';
        document.body.appendChild(msgEl);
        setTimeout(() => {
            if (msgEl.parentNode) msgEl.parentNode.removeChild(msgEl);
        }, 3000);
    }

    // ===== Carregar arquivo na UI =====

    function carregarOferta(file) {
        if (!validarArquivoOferta(file)) return;
        arquivoOferta = file;
        nomeOferta.textContent = file.name;
        tamanhoOferta.textContent = formatarTamanho(file.size);
        dropOferta.querySelector('.drop-zone-content').style.display = 'none';
        previewOferta.style.display = 'flex';
        cardOferta.classList.add('has-file');
        atualizarEstadoBotao();
    }

    function carregarXml(file) {
        if (!validarArquivoXml(file)) return;
        arquivoXml = file;
        nomeXml.textContent = file.name;
        tamanhoXml.textContent = formatarTamanho(file.size);
        dropXml.querySelector('.drop-zone-content').style.display = 'none';
        previewXml.style.display = 'flex';
        cardXml.classList.add('has-file');
        atualizarEstadoBotao();
    }

    function removerArquivoOferta() {
        arquivoOferta = null;
        inputOferta.value = '';
        previewOferta.style.display = 'none';
        dropOferta.querySelector('.drop-zone-content').style.display = 'flex';
        cardOferta.classList.remove('has-file');
        atualizarEstadoBotao();
    }

    function removerArquivoXml() {
        arquivoXml = null;
        inputXml.value = '';
        previewXml.style.display = 'none';
        dropXml.querySelector('.drop-zone-content').style.display = 'flex';
        cardXml.classList.remove('has-file');
        atualizarEstadoBotao();
    }

    // ===== Event Listeners: Seleção de arquivo =====

    inputOferta.addEventListener('change', function (e) {
        if (e.target.files.length > 0) {
            carregarOferta(e.target.files[0]);
        }
    });

    inputXml.addEventListener('change', function (e) {
        if (e.target.files.length > 0) {
            carregarXml(e.target.files[0]);
        }
    });

    // ===== Event Listeners: Remover arquivo =====

    removerOferta.addEventListener('click', function (e) {
        e.stopPropagation();
        removerArquivoOferta();
    });

    removerXml.addEventListener('click', function (e) {
        e.stopPropagation();
        removerArquivoXml();
    });

    // ===== Drag and Drop =====

    function setupDropZone(dropZone, tipo) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', function (e) {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                if (tipo === 'oferta') {
                    carregarOferta(files[0]);
                } else {
                    carregarXml(files[0]);
                }
            }
        });

        dropZone.addEventListener('click', function () {
            if (tipo === 'oferta') {
                inputOferta.click();
            } else {
                inputXml.click();
            }
        });
    }

    setupDropZone(dropOferta, 'oferta');
    setupDropZone(dropXml, 'xml');

    // ==========================================================
    // ===== LÓGICA DE CONFERÊNCIA DE FRETES =====
    // ==========================================================

    /**
     * 1. Extrai o CNPJ do destinatário (<dest><CNPJ>) do XML CTE.
     *    Trata o namespace do portal fiscal.
     */
    function extrairCnpjDestinatario(xmlDoc) {
        // Tenta com namespace
        let destNodes = xmlDoc.getElementsByTagNameNS(CTE_NS, 'dest');
        if (destNodes.length === 0) {
            // Fallback sem namespace
            destNodes = xmlDoc.getElementsByTagName('dest');
        }
        if (destNodes.length === 0) {
            throw new Error('Tag <dest> não encontrada no XML.');
        }

        const destNode = destNodes[0];
        let cnpjNodes = destNode.getElementsByTagNameNS(CTE_NS, 'CNPJ');
        if (cnpjNodes.length === 0) {
            cnpjNodes = destNode.getElementsByTagName('CNPJ');
        }
        if (cnpjNodes.length === 0) {
            throw new Error('Tag <CNPJ> não encontrada dentro de <dest>.');
        }

        return cnpjNodes[0].textContent.trim();
    }

    /**
     * 2. Extrai o nome do destinatário (<dest><xNome>) do XML CTE.
     */
    function extrairNomeDestinatario(xmlDoc) {
        let destNodes = xmlDoc.getElementsByTagNameNS(CTE_NS, 'dest');
        if (destNodes.length === 0) destNodes = xmlDoc.getElementsByTagName('dest');
        if (destNodes.length === 0) return 'N/A';

        const destNode = destNodes[0];
        let nomeNodes = destNode.getElementsByTagNameNS(CTE_NS, 'xNome');
        if (nomeNodes.length === 0) nomeNodes = destNode.getElementsByTagName('xNome');
        if (nomeNodes.length === 0) return 'N/A';

        return nomeNodes[0].textContent.trim();
    }

    /**
     * 3. Extrai o número do CTE do XML.
     */
    function extrairNumeroCte(xmlDoc) {
        let nctNodes = xmlDoc.getElementsByTagNameNS(CTE_NS, 'nCT');
        if (nctNodes.length === 0) nctNodes = xmlDoc.getElementsByTagName('nCT');
        return nctNodes.length > 0 ? nctNodes[0].textContent.trim() : 'N/A';
    }

    /**
     * 4. Consulta o Supabase para buscar o cod_cliente pelo CNPJ.
     *    Tenta primeiro com o CNPJ original, depois sem zeros à esquerda.
     */
    async function buscarCodCliente(cnpj) {
        // Primeira tentativa: CNPJ exato
        let resultado = await consultarSupabase(cnpj);
        if (resultado) return resultado;

        // Segunda tentativa: sem zeros à esquerda
        const cnpjSemZeros = cnpj.replace(/^0+/, '');
        if (cnpjSemZeros !== cnpj) {
            resultado = await consultarSupabase(cnpjSemZeros);
            if (resultado) return resultado;
        }

        return null;
    }

    async function consultarSupabase(cnpj) {
        const url = `${SUPABASE_URL}/rest/v1/base_clientes?cnpj=eq.${encodeURIComponent(cnpj)}&select=cod_cliente,razao_social,cnpj,cidade,uf`;
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ao consultar Supabase: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.length > 0 ? data[0] : null;
    }

    /**
     * 5. Localiza o valor do frete na planilha de ofertas.
     *    Procura o cod_cliente na coluna "Cód Cliente" (col M)
     *    e retorna o valor da coluna "Frete Sem Impostos" (col Y).
     */
    function localizarFretePlanilha(dadosPlanilha, codCliente) {
        const codClienteNum = Number(codCliente);

        // Possíveis nomes da coluna do código do cliente
        const colsCodCliente = ['Cód Cliente', 'Cod Cliente', 'CÓD CLIENTE', 'COD CLIENTE', 'Código Cliente', 'CODIGO CLIENTE'];
        // Possíveis nomes da coluna do frete
        const colsFrete = ['Frete Sem Impostos', 'FRETE SEM IMPOSTOS', 'Frete sem Impostos', 'Frete Sem impostos'];

        // Detectar nome real das colunas
        if (dadosPlanilha.length === 0) {
            throw new Error('Planilha vazia — nenhum registro encontrado.');
        }

        const primeiraLinha = dadosPlanilha[0];
        const chaves = Object.keys(primeiraLinha);

        let colCliente = chaves.find(k => colsCodCliente.includes(k.trim()));
        let colFrete = chaves.find(k => colsFrete.includes(k.trim()));

        // Fallback: busca parcial
        if (!colCliente) {
            colCliente = chaves.find(k => k.toLowerCase().includes('cliente') && (k.toLowerCase().includes('cod') || k.toLowerCase().includes('cód')));
        }
        if (!colFrete) {
            colFrete = chaves.find(k => k.toLowerCase().includes('frete') && k.toLowerCase().includes('sem'));
        }

        if (!colCliente) {
            throw new Error('Coluna "Cód Cliente" não encontrada na planilha. Colunas disponíveis: ' + chaves.join(', '));
        }
        if (!colFrete) {
            throw new Error('Coluna "Frete Sem Impostos" não encontrada na planilha. Colunas disponíveis: ' + chaves.join(', '));
        }

        // Buscar a linha com o cod_cliente
        for (const linha of dadosPlanilha) {
            const valorCodRaw = linha[colCliente];
            const valorCod = Number(String(valorCodRaw).trim().replace(/\D/g, ''));

            if (valorCod === codClienteNum) {
                const valorFreteRaw = linha[colFrete];
                const valorFrete = parseMoeda(valorFreteRaw);
                return {
                    valorFrete: valorFrete,
                    valorFreteFormatado: formatarMoeda(valorFrete),
                    valorFreteOriginal: String(valorFreteRaw),
                    colClienteUsada: colCliente,
                    colFreteUsada: colFrete
                };
            }
        }

        return null;
    }

    /**
     * Converte valores monetários brasileiros para float.
     * Ex: "R$ 6.358,39" → 6358.39, "121284.13" → 121284.13
     */
    function parseMoeda(valor) {
        if (typeof valor === 'number') return valor;
        let str = String(valor).trim();
        // Remove "R$" e espaços
        str = str.replace(/R\$\s*/gi, '');
        // Se usa formato brasileiro (ponto como milhar, vírgula como decimal)
        if (str.includes(',')) {
            str = str.replace(/\./g, '');  // remove pontos de milhar
            str = str.replace(',', '.');   // vírgula → ponto decimal
        }
        const num = parseFloat(str);
        if (isNaN(num)) {
            throw new Error(`Não foi possível interpretar o valor monetário: "${valor}"`);
        }
        return num;
    }

    /**
     * 6. Extrai o valor de FRETE PESO do XML.
     *    Hierarquia: <vPrest> → <Comp> → <xNome>FRETE PESO</xNome> → <vComp>
     */
    function extrairFretePesoXml(xmlDoc) {
        let vprestNodes = xmlDoc.getElementsByTagNameNS(CTE_NS, 'vPrest');
        if (vprestNodes.length === 0) vprestNodes = xmlDoc.getElementsByTagName('vPrest');
        if (vprestNodes.length === 0) {
            throw new Error('Tag <vPrest> não encontrada no XML.');
        }

        const vprest = vprestNodes[0];
        let compNodes = vprest.getElementsByTagNameNS(CTE_NS, 'Comp');
        if (compNodes.length === 0) compNodes = vprest.getElementsByTagName('Comp');

        for (const comp of compNodes) {
            let nomeNodes = comp.getElementsByTagNameNS(CTE_NS, 'xNome');
            if (nomeNodes.length === 0) nomeNodes = comp.getElementsByTagName('xNome');
            if (nomeNodes.length === 0) continue;

            const nome = nomeNodes[0].textContent.trim().toUpperCase();
            if (nome === 'FRETE PESO') {
                let vcompNodes = comp.getElementsByTagNameNS(CTE_NS, 'vComp');
                if (vcompNodes.length === 0) vcompNodes = comp.getElementsByTagName('vComp');
                if (vcompNodes.length === 0) {
                    throw new Error('Tag <vComp> não encontrada dentro do componente FRETE PESO.');
                }
                return parseFloat(vcompNodes[0].textContent.trim());
            }
        }

        throw new Error('Componente "FRETE PESO" não encontrado dentro de <vPrest>.');
    }

    /**
     * 7. Extrai o valor total do CTE (<vTPrest>).
     */
    function extrairValorTotalCte(xmlDoc) {
        let nodes = xmlDoc.getElementsByTagNameNS(CTE_NS, 'vTPrest');
        if (nodes.length === 0) nodes = xmlDoc.getElementsByTagName('vTPrest');
        return nodes.length > 0 ? parseFloat(nodes[0].textContent.trim()) : null;
    }

    // ===== Modal de Resultado =====

    function abrirModal() {
        const modal = document.getElementById('modal-resultado');
        modal.style.display = 'flex';
        // Trigger animation after display change
        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
        });
        document.body.style.overflow = 'hidden';
    }

    function fecharModal() {
        const modal = document.getElementById('modal-resultado');
        modal.classList.remove('modal-visible');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    // Close modal events
    document.getElementById('modal-close-btn').addEventListener('click', fecharModal);
    document.getElementById('modal-backdrop').addEventListener('click', fecharModal);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') fecharModal();
    });

    // ===== Renderização dos Resultados =====

    function renderizarResultado(resultado) {
        const resultadoConteudo = document.getElementById('resultado-conteudo');

        const isCorreto = resultado.status === 'correto';
        const diferenca = resultado.valorXml - resultado.valorPlanilha;
        const percentDif = resultado.valorPlanilha > 0
            ? ((diferenca / resultado.valorPlanilha) * 100).toFixed(2)
            : 'N/A';

        resultadoConteudo.innerHTML = `
            <div class="resultado-card ${isCorreto ? 'resultado-ok' : 'resultado-erro'}">
                <div class="resultado-status">
                    <div class="status-icon">
                        <i class="fas ${isCorreto ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                    </div>
                    <div class="status-text">
                        <h3>${isCorreto ? 'CTE EMITIDO CORRETAMENTE' : 'DIVERGÊNCIA ENCONTRADA'}</h3>
                        <p>${isCorreto
                ? 'O valor de FRETE PESO do CTE confere com a planilha de ofertas.'
                : 'O valor de FRETE PESO do CTE NÃO confere — CTE precisa ser refeito!'}</p>
                    </div>
                </div>

                <div class="resultado-detalhes">
                    <div class="comparacao-box">
                        <h4><i class="fas fa-balance-scale"></i> Comparação de Valores</h4>
                        <div class="comparacao-grid">
                            <div class="comparacao-item">
                                <span class="comp-label">FRETE PESO (XML)</span>
                                <span class="comp-valor-grande xml">${formatarMoeda(resultado.valorXml)}</span>
                            </div>
                            <div class="comparacao-vs">
                                <i class="fas fa-arrows-alt-h"></i>
                            </div>
                            <div class="comparacao-item">
                                <span class="comp-label">Frete Sem Impostos (Planilha)</span>
                                <span class="comp-valor-grande planilha">${formatarMoeda(resultado.valorPlanilha)}</span>
                            </div>
                        </div>
                        ${!isCorreto ? `
                        <div class="diferenca-box">
                            <span class="dif-label">Diferença</span>
                            <span class="dif-valor ${diferenca > 0 ? 'positiva' : 'negativa'}">${diferenca > 0 ? '+' : ''}${formatarMoeda(diferenca)} (${percentDif}%)</span>
                        </div>` : ''}
                    </div>

                    <div class="detalhe-group">
                        <h4><i class="fas fa-file-code"></i> Dados do XML (CTE)</h4>
                        <div class="detalhe-item">
                            <span class="detalhe-label">N° CTE</span>
                            <span class="detalhe-valor">${resultado.numeroCte}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Destinatário</span>
                            <span class="detalhe-valor">${resultado.nomeDestinatario}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">CNPJ Destinatário</span>
                            <span class="detalhe-valor">${resultado.cnpj}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Cód. Cliente (Supabase)</span>
                            <span class="detalhe-valor">${resultado.codCliente}</span>
                        </div>
                        ${resultado.valorTotal != null ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Valor Total CTE</span>
                            <span class="detalhe-valor">${formatarMoeda(resultado.valorTotal)}</span>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;

        abrirModal();
    }

    function renderizarErroConferencia(mensagem, detalhes) {
        const resultadoConteudo = document.getElementById('resultado-conteudo');

        resultadoConteudo.innerHTML = `
            <div class="resultado-card resultado-aviso">
                <div class="resultado-status">
                    <div class="status-icon aviso">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="status-text">
                        <h3>NÃO FOI POSSÍVEL CONFERIR</h3>
                        <p>${mensagem}</p>
                    </div>
                </div>
                ${detalhes ? `<div class="resultado-detalhes"><p style="color: #888; font-size: 13px;">${detalhes}</p></div>` : ''}
            </div>
        `;

        abrirModal();
    }

    // ===== Botão Conferir - Lógica Principal =====

    btnConferir.addEventListener('click', async function () {
        if (!arquivoOferta || !arquivoXml) return;

        btnConferir.disabled = true;
        btnConferir.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        actionHint.textContent = 'Lendo arquivos...';

        try {
            // PASSO 1: Ler ambos os arquivos
            const dadosPlanilha = await lerPlanilha(arquivoOferta);
            const xmlDoc = await lerXml(arquivoXml);

            console.log('Planilha:', dadosPlanilha.length, 'registros');

            // PASSO 2: Extrair CNPJ do destinatário do XML
            actionHint.textContent = 'Extraindo CNPJ do destinatário...';
            const cnpj = extrairCnpjDestinatario(xmlDoc);
            const nomeDestinatario = extrairNomeDestinatario(xmlDoc);
            const numeroCte = extrairNumeroCte(xmlDoc);
            console.log('CNPJ dest:', cnpj, '| Nome:', nomeDestinatario, '| CTE:', numeroCte);

            // PASSO 3: Consultar Supabase para obter cod_cliente
            actionHint.textContent = 'Consultando base de clientes no Supabase...';
            const clienteInfo = await buscarCodCliente(cnpj);

            if (!clienteInfo) {
                renderizarErroConferencia(
                    `CNPJ ${cnpj} não encontrado na base de clientes.`,
                    `Destinatário: ${nomeDestinatario}. Verifique se o CNPJ está cadastrado na tabela base_clientes do Supabase.`
                );
                return;
            }

            const codCliente = clienteInfo.cod_cliente;
            console.log('cod_cliente encontrado:', codCliente, '| Razão:', clienteInfo.razao_social);

            // PASSO 4: Localizar valor do frete na planilha
            actionHint.textContent = 'Localizando frete na planilha de ofertas...';
            const fretePlanilha = localizarFretePlanilha(dadosPlanilha, codCliente);

            if (!fretePlanilha) {
                renderizarErroConferencia(
                    `Código de cliente ${codCliente} não encontrado na planilha de ofertas.`,
                    `Razão Social: ${clienteInfo.razao_social} | CNPJ: ${cnpj}. Verifique se o código do cliente consta na coluna "Cód Cliente" da planilha.`
                );
                return;
            }

            console.log('Frete planilha:', fretePlanilha.valorFrete, '(', fretePlanilha.valorFreteOriginal, ')');

            // PASSO 5: Extrair FRETE PESO do XML
            actionHint.textContent = 'Extraindo valor de FRETE PESO do XML...';
            const fretePesoXml = extrairFretePesoXml(xmlDoc);
            const valorTotalCte = extrairValorTotalCte(xmlDoc);
            console.log('FRETE PESO XML:', fretePesoXml);

            // PASSO 6: Comparar valores
            actionHint.textContent = 'Comparando valores...';
            const tolerancia = 0.01; // tolerância de R$ 0.01
            const diferenca = Math.abs(fretePesoXml - fretePlanilha.valorFrete);
            const status = diferenca <= tolerancia ? 'correto' : 'divergente';

            console.log(`Resultado: ${status} | XML: ${fretePesoXml} | Planilha: ${fretePlanilha.valorFrete} | Dif: ${diferenca}`);

            // RENDERIZAR RESULTADO
            renderizarResultado({
                status: status,
                cnpj: cnpj,
                nomeDestinatario: nomeDestinatario,
                numeroCte: numeroCte,
                codCliente: codCliente,
                razaoSocial: clienteInfo.razao_social,
                valorXml: fretePesoXml,
                valorPlanilha: fretePlanilha.valorFrete,
                valorTotal: valorTotalCte
            });

        } catch (error) {
            console.error('Erro na conferência:', error);
            renderizarErroConferencia(error.message);
        } finally {
            btnConferir.disabled = false;
            btnConferir.innerHTML = '<i class="fas fa-search-dollar"></i> Conferir Fretes';
            atualizarEstadoBotao();
        }
    });

    // ===== Leitura de Arquivos =====

    function lerPlanilha(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheet];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                    resolve(jsonData);
                } catch (err) {
                    reject(new Error('Falha ao ler a planilha: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Erro ao ler o arquivo da planilha'));
            reader.readAsArrayBuffer(file);
        });
    }

    function lerXml(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(e.target.result, 'text/xml');
                    const parseError = xmlDoc.querySelector('parsererror');
                    if (parseError) {
                        reject(new Error('XML inválido: ' + parseError.textContent.substring(0, 100)));
                        return;
                    }
                    resolve(xmlDoc);
                } catch (err) {
                    reject(new Error('Falha ao ler o XML: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Erro ao ler o arquivo XML'));
            reader.readAsText(file);
        });
    }

});

import type { Context, Config } from "@netlify/functions";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import axios from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessingResult {
    fileName: string;
    success: boolean;
    chaveAcesso?: string;
    ocrRawText?: string;
    nfeData?: NFeData;
    error?: string;
    errorStep?: "ocr" | "regex" | "nsdocs";
}

interface NFeData {
    emitente: string;
    cnpjEmitente: string;
    valorNF: string;
    dataEmissao: string;
    status: string;
    documentId?: number;
    xmlUrl?: string;
    pdfUrl?: string;
    raw?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Google Cloud Vision client (singleton)
// ---------------------------------------------------------------------------

let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
    if (visionClient) return visionClient;

    const credEnv = Netlify.env.get("GOOGLE_CLOUD_CREDENTIALS");
    if (!credEnv) {
        throw new Error(
            "GOOGLE_CLOUD_CREDENTIALS não configurado nas variáveis de ambiente."
        );
    }

    const credentials = JSON.parse(credEnv);
    visionClient = new ImageAnnotatorClient({ credentials });
    return visionClient;
}

// ---------------------------------------------------------------------------
// OCR: Extract text from image using Google Cloud Vision
// ---------------------------------------------------------------------------

async function extractTextFromImage(
    imageBuffer: Buffer
): Promise<{ text: string }> {
    const client = getVisionClient();

    const [result] = await client.documentTextDetection({
        image: { content: imageBuffer.toString("base64") },
    });

    const fullText =
        result.fullTextAnnotation?.text ||
        result.textAnnotations?.[0]?.description ||
        "";

    if (!fullText.trim()) {
        throw new Error(
            "Nenhum texto foi detectado na imagem. Verifique se a imagem é legível."
        );
    }

    return { text: fullText };
}

// ---------------------------------------------------------------------------
// Regex: Find the 44-digit access key
// ---------------------------------------------------------------------------

function isValidChaveAcesso(chave: string): boolean {
    if (!/^\d{44}$/.test(chave)) return false;
    let sum = 0;
    let weight = 2;
    for (let i = 42; i >= 0; i--) {
        sum += parseInt(chave[i]) * weight;
        weight++;
        if (weight > 9) weight = 2;
    }
    const remainder = sum % 11;
    const digit = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
    return digit === parseInt(chave[43]);
}

const VALID_UF_CODES = new Set([
    11, 12, 13, 14, 15, 16, 17,
    21, 22, 23, 24, 25, 26, 27, 28, 29,
    31, 32, 33, 35,
    41, 42, 43,
    50, 51, 52, 53,
]);

function extractAccessKey(text: string): string | null {
    console.log("--- OCR RAW TEXT (first 1000 chars) ---");
    console.log(text.substring(0, 1000));
    console.log("--- END OCR TEXT ---");

    // ESTRATÉGIA 1: 44 dígitos contíguos
    const contiguous44Regex = /\d{44}/g;
    const contiguousMatches = text.match(contiguous44Regex);
    if (contiguousMatches) {
        for (const match of contiguousMatches) {
            const stateCode = parseInt(match.substring(0, 2), 10);
            if (VALID_UF_CODES.has(stateCode) && isValidChaveAcesso(match)) {
                console.log("✅ [Estratégia 1] Chave encontrada:", match);
                return match;
            }
        }
    }

    // ESTRATÉGIA 2: 11 blocos de 4 dígitos
    const blocks4Regex =
        /\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}[\s\t\r\n\-]{1,3}\d{4}/g;
    const blockMatches = text.match(blocks4Regex);
    if (blockMatches) {
        for (const match of blockMatches) {
            const candidate = match.replace(/\D/g, "");
            if (candidate.length === 44) {
                const stateCode = parseInt(candidate.substring(0, 2), 10);
                if (VALID_UF_CODES.has(stateCode) && isValidChaveAcesso(candidate)) {
                    console.log("✅ [Estratégia 2] Chave encontrada:", candidate);
                    return candidate;
                }
            }
        }
    }

    // ESTRATÉGIA 3: Bloco com UF + janela deslizante
    const ufAlternation = Array.from(VALID_UF_CODES).join("|");
    const blockRegex = new RegExp(
        `(?:${ufAlternation})[\\s.\\-]*?(?:\\d[\\s.\\-]*){42,}`,
        "g"
    );
    const potentialBlocks = text.match(blockRegex);
    if (potentialBlocks) {
        for (const block of potentialBlocks) {
            const digitsOnly = block.replace(/\D/g, "");
            for (let i = 0; i <= digitsOnly.length - 44; i++) {
                const candidate = digitsOnly.substring(i, i + 44);
                const stateCode = parseInt(candidate.substring(0, 2), 10);
                if (VALID_UF_CODES.has(stateCode) && isValidChaveAcesso(candidate)) {
                    console.log("✅ [Estratégia 3] Chave encontrada:", candidate);
                    return candidate;
                }
            }
        }
    }

    // ESTRATÉGIA 4: Fallback global
    const allDigits = text.replace(/\D/g, "");
    console.log("--- GLOBAL DIGITS (length:", allDigits.length, ") ---");
    if (allDigits.length >= 44) {
        for (let i = 0; i <= allDigits.length - 44; i++) {
            const candidate = allDigits.substring(i, i + 44);
            const stateCode = parseInt(candidate.substring(0, 2), 10);
            if (VALID_UF_CODES.has(stateCode) && isValidChaveAcesso(candidate)) {
                console.warn("⚠️ [Estratégia 4] Chave via concatenação global:", candidate);
                return candidate;
            }
        }
    }

    console.log("❌ Nenhuma chave de 44 dígitos válida encontrada.");
    return null;
}

// ---------------------------------------------------------------------------
// NSDocs API: Query NFe data by access key
// ---------------------------------------------------------------------------

async function queryNSDocs(chaveAcesso: string): Promise<NFeData> {
    const apiKey = Netlify.env.get("NSDOCS_API_KEY");
    const apiUrl = Netlify.env.get("NSDOCS_API_URL") || "https://api.nsdocs.com.br/v2";

    if (!apiKey) {
        throw new Error("NSDOCS_API_KEY não configurado nas variáveis de ambiente.");
    }

    try {
        const response = await axios.get(`${apiUrl}/documentos`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Accept-Encoding": "gzip, deflate",
                Accept: "application/json",
            },
            params: {
                chave_acesso: chaveAcesso,
                campos: "id,emitente_razao,emitente_cnpj,valor,data_emissao,status,chave_acesso",
            },
            timeout: 30000,
        });

        const responseData = response.data;
        let docs: Record<string, unknown>[] = [];
        if (Array.isArray(responseData)) {
            docs = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
            docs = responseData.data;
        } else if (responseData?.value && Array.isArray(responseData.value)) {
            docs = responseData.value;
        } else if (responseData && typeof responseData === "object" && !responseData.Count && !responseData.value) {
            docs = [responseData as Record<string, unknown>];
        }

        let doc = docs.find((d) => d.chave_acesso === chaveAcesso);

        // --- SEFAZ IMPORT LOGIC ---
        if (!doc) {
            console.log(`Document [${chaveAcesso}] not found. Triggering SEFAZ import...`);

            const importParams = new URLSearchParams();
            importParams.append("documento", chaveAcesso);

            let importResponse;
            try {
                importResponse = await axios.post(`${apiUrl}/consultas/dfe`, importParams, {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                        Accept: "application/json",
                    },
                    timeout: 15000,
                });
            } catch (importError: unknown) {
                if (axios.isAxiosError(importError)) {
                    const errBody = importError.response?.data;
                    const descricao = errBody?.descricao || errBody?.message || JSON.stringify(errBody);
                    const httpStatus = importError.response?.status;
                    throw new Error(`Erro na API NSDocs ao importar da SEFAZ (HTTP ${httpStatus}): ${descricao}`);
                }
                throw importError;
            }

            const idConsulta = importResponse.data?.id_consulta;
            if (!idConsulta) {
                throw new Error(`Falha ao iniciar consulta Sefaz para a chave: ${chaveAcesso}`);
            }

            let isReady = false;
            let attempts = 0;
            const maxAttempts = 15;

            while (!isReady && attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                attempts++;
                try {
                    const statusResponse = await axios.get(`${apiUrl}/consultas/dfe/${idConsulta}`, {
                        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
                        timeout: 15000,
                    });
                    if (statusResponse.status === 200 && statusResponse.data?.status_consulta === "Ok") {
                        isReady = true;
                        console.log(`SEFAZ import completed on attempt ${attempts}.`);
                    } else {
                        console.log(`Polling SEFAZ (Attempt ${attempts}): ${statusResponse.data?.status_consulta}`);
                    }
                } catch (pollError: any) {
                    console.warn(`Polling error on attempt ${attempts}:`, pollError.message);
                }
            }

            if (!isReady) {
                throw new Error(`Tempo esgotado na consulta SEFAZ para a chave: ${chaveAcesso}.`);
            }

            const retryResponse = await axios.get(`${apiUrl}/documentos`, {
                headers: { Authorization: `Bearer ${apiKey}`, "Accept-Encoding": "gzip, deflate", Accept: "application/json" },
                params: { chave_acesso: chaveAcesso, campos: "id,emitente_razao,emitente_cnpj,valor,data_emissao,status,chave_acesso" },
                timeout: 30000,
            });

            const retryData = retryResponse.data;
            let retryDocs: Record<string, unknown>[] = [];
            if (Array.isArray(retryData)) retryDocs = retryData;
            else if (retryData?.data && Array.isArray(retryData.data)) retryDocs = retryData.data;
            else if (retryData?.value && Array.isArray(retryData.value)) retryDocs = retryData.value;
            else if (retryData && typeof retryData === "object" && !retryData.Count && !retryData.value) retryDocs = [retryData as Record<string, unknown>];

            doc = retryDocs.find((d) => d.chave_acesso === chaveAcesso);
        }

        if (!doc) {
            throw new Error(`Nota fiscal [${chaveAcesso}] processada mas dados não localizados.`);
        }

        const documentId = doc.id || doc.Id || doc.ID;
        const nfeData: NFeData = {
            emitente:
                (doc.emitente_razao as string) ||
                (doc.emitente as Record<string, unknown>)?.razaoSocial as string ||
                (doc.emitenteRazaoSocial as string) ||
                "N/A",
            cnpjEmitente:
                (doc.emitente_cnpj as string) ||
                (doc.emitente as Record<string, unknown>)?.cnpj as string ||
                (doc.emitenteCnpj as string) ||
                "N/A",
            valorNF: (() => {
                const raw = doc.valor ?? doc.valorTotal ?? doc.valorNF ?? doc.vlrNF ?? doc.vNF ?? doc.valor_nf ?? null;
                if (raw === null || raw === undefined) return "0.00";
                const rawStr = String(raw);
                const normalized = rawStr.replace(/\./g, "").replace(",", ".");
                const num = parseFloat(normalized);
                return isNaN(num) ? rawStr : num.toFixed(2);
            })(),
            dataEmissao: (doc.data_emissao as string) || (doc.dataEmissao as string) || (doc.dtEmissao as string) || "N/A",
            status: (doc.status as string) || (doc.situacao as string) || "Desconhecido",
            documentId: documentId ? Number(documentId) : undefined,
            xmlUrl: (doc.urlXml as string) || undefined,
            pdfUrl: (doc.urlPdf as string) || undefined,
            raw: doc,
        };

        return nfeData;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.descricao || error.response?.data?.message || error.message;
            if (status === 401) throw new Error("Falha de autenticação NSDocs. Verifique sua API Key.");
            if (status === 404) throw new Error(`Chave não encontrada na NSDocs: ${chaveAcesso}`);
            throw new Error(`Erro NSDocs (HTTP ${status}): ${message}`);
        }
        throw error;
    }
}

// ---------------------------------------------------------------------------
// Resolve NSDocs document Id from chave de acesso
// ---------------------------------------------------------------------------

async function resolveDocumentId(chaveAcesso: string): Promise<number> {
    const apiKey = Netlify.env.get("NSDOCS_API_KEY");
    const apiUrl = Netlify.env.get("NSDOCS_API_URL") || "https://api.nsdocs.com.br/v2";

    const response = await axios.get(`${apiUrl}/documentos`, {
        headers: { Authorization: `Bearer ${apiKey}`, "Accept-Encoding": "gzip, deflate", Accept: "application/json" },
        params: { chave_acesso: chaveAcesso, campos: "id,chave_acesso" },
        timeout: 30000,
    });

    const responseData = response.data;
    let docs: Record<string, unknown>[] = [];
    if (Array.isArray(responseData)) docs = responseData;
    else if (responseData?.data && Array.isArray(responseData.data)) docs = responseData.data;
    else if (responseData?.value && Array.isArray(responseData.value)) docs = responseData.value;
    else if (responseData && typeof responseData === "object" && !responseData.Count && !responseData.value) docs = [responseData as Record<string, unknown>];

    const doc = docs.find((d) => d.chave_acesso === chaveAcesso);
    if (!doc) throw new Error(`Nota fiscal [${chaveAcesso}] não localizada para download.`);

    const docId = doc?.id || doc?.Id || doc?.ID;
    if (!docId) throw new Error(`Documento sem ID retornado pela NSDocs para chave: ${chaveAcesso}`);
    return Number(docId);
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

export default async (req: Request, context: Context) => {
    // --- GET: Download XML or PDF ---
    if (req.method === "GET") {
        const url = new URL(req.url);
        const chave = url.searchParams.get("chave");
        const tipo = url.searchParams.get("tipo");

        if (!chave || !tipo) {
            return new Response(JSON.stringify({ error: 'Parâmetros "chave" e "tipo" são obrigatórios.' }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (tipo !== "xml" && tipo !== "pdf") {
            return new Response(JSON.stringify({ error: 'Parâmetro "tipo" deve ser "xml" ou "pdf".' }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const apiKey = Netlify.env.get("NSDOCS_API_KEY");
        const apiUrl = Netlify.env.get("NSDOCS_API_URL") || "https://api.nsdocs.com.br/v2";

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "NSDOCS_API_KEY não configurado." }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        try {
            const documentId = await resolveDocumentId(chave);
            const downloadUrl = `${apiUrl}/documentos/${documentId}/${tipo}`;

            const response = await axios.get(downloadUrl, {
                headers: { Authorization: `Bearer ${apiKey}`, "Accept-Encoding": "gzip, deflate" },
                responseType: "arraybuffer",
                timeout: 60000,
            });

            const contentType = tipo === "xml" ? "application/xml" : "application/pdf";
            const extension = tipo === "xml" ? "xml" : "pdf";

            return new Response(response.data, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `attachment; filename="NFe_${chave}.${extension}"`,
                },
            });
        } catch (error: unknown) {
            console.error(`Erro ao baixar ${tipo}:`, error);
            if (axios.isAxiosError(error)) {
                let message = error.message;
                if (error.response?.data) {
                    try {
                        message = Buffer.from(error.response.data).toString("utf-8");
                    } catch {
                        message = error.message;
                    }
                }
                return new Response(JSON.stringify({ error: message }), {
                    status: error.response?.status || 500,
                    headers: { "Content-Type": "application/json" },
                });
            }
            const message = error instanceof Error ? error.message : "Erro ao baixar arquivo";
            return new Response(JSON.stringify({ error: message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    // --- POST: Process uploaded images ---
    if (req.method === "POST") {
        try {
            const formData = await req.formData();
            const files = formData.getAll("files") as File[];

            if (!files || files.length === 0) {
                return new Response(JSON.stringify({ error: "Nenhuma imagem enviada." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                });
            }

            const results: ProcessingResult[] = [];

            for (const file of files) {
                const result: ProcessingResult = { fileName: file.name, success: false };

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // Step 1: OCR
                    let ocrText: string;
                    try {
                        const ocrResult = await extractTextFromImage(buffer);
                        ocrText = ocrResult.text;
                        result.ocrRawText = ocrText.substring(0, 500);
                    } catch (ocrError: unknown) {
                        result.error = ocrError instanceof Error ? ocrError.message : "Erro desconhecido no OCR";
                        result.errorStep = "ocr";
                        results.push(result);
                        continue;
                    }

                    // Step 2: Extract access key
                    const chaveAcesso = extractAccessKey(ocrText);
                    if (!chaveAcesso) {
                        result.error = "Chave de acesso de 44 dígitos não encontrada no texto extraído.";
                        result.errorStep = "regex";
                        result.ocrRawText = ocrText.substring(0, 500);
                        results.push(result);
                        continue;
                    }
                    result.chaveAcesso = chaveAcesso;

                    // Step 3: Query NSDocs
                    try {
                        const nfeData = await queryNSDocs(chaveAcesso);
                        result.nfeData = nfeData;
                        result.success = true;
                    } catch (nsdocsError: unknown) {
                        result.error = nsdocsError instanceof Error ? nsdocsError.message : "Erro desconhecido na consulta NSDocs";
                        result.errorStep = "nsdocs";
                        results.push(result);
                        continue;
                    }
                } catch (generalError: unknown) {
                    result.error = generalError instanceof Error ? generalError.message : "Erro inesperado no processamento";
                }

                results.push(result);
            }

            return new Response(JSON.stringify({ results }), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (error: unknown) {
            console.error("Erro no processamento:", error);
            return new Response(
                JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno do servidor" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }

    // --- Other methods ---
    return new Response(JSON.stringify({ error: "Método não suportado." }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
    });
};

export const config: Config = {
    path: "/api/ocr-process",
};

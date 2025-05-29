const CALENDAR_ID = "protrainingpfstudio@gmail.com";
const SHEET_NAME_PLANOS = "Planos";
const SHEET_NAME_CONTAS = "Contas";
const PT_KEYWORDS = ["PRO NR", "PRO JM", "PRO JP", "PRO DN", "PRO EL", "GIL"];
const SHEET_NAME_MASTER = "MasterExercises";
const SCRIPT_CACHE = CacheService.getScriptCache();
const CACHE_EXPIRATION_SECONDS = 3600; // 1 hora

function doGet(e) {
    try {
        const htmlOutput = HtmlService.createTemplateFromFile('index33').evaluate();
        htmlOutput.setSandboxMode(HtmlService.SandboxMode.IFRAME);
        htmlOutput.setTitle('Pro Training v33 Optimized').addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        return htmlOutput;
    } catch (error) {
        Logger.log(`Erro doGet: ${error.message}\n${error.stack}`);
        return HtmlService.createHtmlOutput('<h1>Erro Interno</h1><p>Ocorreu um erro ao carregar a aplicação.</p>');
    }
}

function calcularPeriodoFiltro(dataInicioStr, dataFimStr) {
    try {
        let primeiroDiaDoPeriodo, ultimoDiaDoPeriodo, anoFiltro, mesInicialFiltro, mesFinalFiltro, isSpecificDayFilter = false, diaFiltro = null;
        const today = new Date();
        let anoIni, mesIni, diaIni, anoFim, mesFim, diaFim;

        if (!dataInicioStr || dataInicioStr.trim() === "") {
            anoIni = anoFim = today.getFullYear();
            mesIni = mesFim = today.getMonth(); // 0-11
            diaIni = 1;
            const ultimoDiaDoMesAtual = new Date(anoFim, mesFim + 1, 0).getDate();
            diaFim = ultimoDiaDoMesAtual;
            isSpecificDayFilter = false;
        } else {
            const partesInicio = dataInicioStr.split('/');
            if (partesInicio.length !== 3) throw new Error("Formato data início inválido (dd/mm/yyyy).");
            diaIni = parseInt(partesInicio[0], 10);
            mesIni = parseInt(partesInicio[1], 10) - 1; // Mês é 0-indexado
            anoIni = parseInt(partesInicio[2], 10);

            if (!dataFimStr || dataFimStr.trim() === "" || dataFimStr === dataInicioStr) {
                diaFim = diaIni; mesFim = mesIni; anoFim = anoIni;
                isSpecificDayFilter = true; diaFiltro = diaIni;
            } else {
                const partesFim = dataFimStr.split('/');
                if (partesFim.length !== 3) throw new Error("Formato data fim inválido (dd/mm/yyyy).");
                diaFim = parseInt(partesFim[0], 10);
                mesFim = parseInt(partesFim[1], 10) - 1;
                anoFim = parseInt(partesFim[2], 10);
                isSpecificDayFilter = (anoIni === anoFim && mesIni === mesFim && diaIni === diaFim);
                if (isSpecificDayFilter) diaFiltro = diaIni;
            }
        }

        primeiroDiaDoPeriodo = new Date(Date.UTC(anoIni, mesIni, diaIni, 0, 0, 0, 0));
        ultimoDiaDoPeriodo = new Date(Date.UTC(anoFim, mesFim, diaFim, 23, 59, 59, 999));

        if (isNaN(primeiroDiaDoPeriodo.getTime()) || isNaN(ultimoDiaDoPeriodo.getTime()) || primeiroDiaDoPeriodo > ultimoDiaDoPeriodo) {
            throw new Error("Período de datas inválido ou inconsistente.");
        }
        anoFiltro = anoIni;
        mesInicialFiltro = mesIni;
        mesFinalFiltro = mesFim;

        return { primeiroDiaDoPeriodo, ultimoDiaDoPeriodo, ano: anoFiltro, mesInicialNum: mesInicialFiltro, mesFinalNum: mesFinalFiltro, isSpecificDayFilter, diaNum: diaFiltro, error: null };
    } catch (e) {
        Logger.log(`[calcularPeriodoFiltro] Erro: ${e.message}\n${e.stack}`);
        return { error: `Erro ao calcular período: ${e.message}` };
    }
}

function parseMRefToDateParts(mRefString, defaultAno, mesesDescMap) {
    if (!mRefString || typeof mRefString !== 'string') return null;
    const mRefClean = mRefString.trim().toLowerCase();
    if (mRefClean === "" || mRefClean === "n/a") return null;
    const parts = mRefClean.split(/[\s\/]+/);
    let mesStr = parts[0];
    let anoStr = parts.length > 1 ? parts[1] : null;
    const mesNum = mesesDescMap[mesStr];
    if (mesNum === undefined) return null;
    let ano;
    if (anoStr) {
        ano = parseInt(anoStr, 10);
        if (isNaN(ano)) return null;
        if (anoStr.length === 2) ano += 2000;
    } else {
        ano = defaultAno;
    }
    if (ano < 2000 || ano > 2100) return null;
    return { mes: mesNum, ano: ano };
}

function _getClienteNomeBaseFromTitle(tituloOriginal, ptKeywordsArray) {
    let clienteNomeBase = String(tituloOriginal || '').trim();
    const padraoInfoExtra = /(\s-\s.*|\s\(.*CS\)|\[.*\])/i;
    clienteNomeBase = clienteNomeBase.replace(padraoInfoExtra, "").trim();
    for (const kw of ptKeywordsArray) {
        const kwOriginalCase = kw;
        if (clienteNomeBase.toUpperCase().startsWith(kwOriginalCase.toUpperCase())) {
            let nomeAposKW = clienteNomeBase.substring(kwOriginalCase.length).trim();
            if (nomeAposKW.startsWith("-")) {
                nomeAposKW = nomeAposKW.substring(1).trim();
            }
            clienteNomeBase = nomeAposKW ? `${kwOriginalCase} ${nomeAposKW}` : kwOriginalCase;
            break;
        }
    }
    return clienteNomeBase;
}

function calcularMetricas(filtroNomeEvento, dataInicioStr, dataFimStr, personalTrainer, corEventoFiltro) {
    const defaultReturn = { totalHoras: 0, nivel: 0, totalEventos: 0, eventosConcluidos: 0, detalhesNivel: [], dadosClientePorRef: {}, erro: null, mensagem: null };
    const startTime = Date.now();
    Logger.log(`[calcularMetricas] Iniciando. Filtros: Nome=${filtroNomeEvento}, Início=${dataInicioStr}, Fim=${dataFimStr}, PT=${personalTrainer}, Cor=${corEventoFiltro}`);

    try {
        const { primeiroDiaDoPeriodo: pFiltroOriginal, ultimoDiaDoPeriodo: uFiltroOriginal, ano: anoFiltroOriginal, mesInicialNum: mesInicialFiltroOriginal, mesFinalNum: mesFinalFiltroOriginal, error: dateError } = calcularPeriodoFiltro(dataInicioStr, dataFimStr);
        if (dateError) return { ...defaultReturn, erro: "Data inválida.", mensagem: dateError };
        Logger.log(`[calcularMetricas] Período calculado: ${pFiltroOriginal} a ${uFiltroOriginal}`);

        const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
        if (!calendar) return { ...defaultReturn, erro: "Calendário inacessível.", mensagem: "Calendário não encontrado." };

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetPlanos = ss.getSheetByName(SHEET_NAME_PLANOS);
        const spreadsheetTimezone = ss.getSpreadsheetTimeZone();
        let planosMap = new Map();

        if (sheetPlanos) {
            const data = sheetPlanos.getDataRange().getValues();
            if (data.length > 0) {
                const headers = data[0].map(h => String(h).trim());
                const idEventoCol = headers.indexOf("ID do Evento");
                const dataCol = headers.indexOf("Data");
                const mRefCol = headers.indexOf("M.Ref");
                const statusCol = headers.indexOf("Status");
                if (idEventoCol !== -1 && dataCol !== -1) {
                    for (let i = 1; i < data.length; i++) {
                        const eventoId = data[i][idEventoCol];
                        const dataValor = data[i][dataCol];
                        const dataFormatada = formatarDataValor(dataValor, spreadsheetTimezone);
                        if (eventoId && dataFormatada) {
                            planosMap.set(`${eventoId}_${dataFormatada}`, {
                                mRef: mRefCol !== -1 ? (data[i][mRefCol] || '') : '',
                                status: statusCol !== -1 ? (data[i][statusCol] || '') : ''
                            });
                        }
                    }
                }
            }
        }
        Logger.log(`[calcularMetricas] Planos da planilha mapeados: ${planosMap.size} entradas.`);

        const eventosNivelProcessados = new Set();
        let totalHoras = 0, nivel = 0, totalEventos = 0, eventosConcluidos = 0;
        const detalhesNivel = [];
        const dadosClientePorRef = {};
        const filtroLower = filtroNomeEvento ? filtroNomeEvento.toLowerCase() : null;
        const ptLower = personalTrainer && personalTrainer !== "" ? personalTrainer.toLowerCase() : null;
        const mesesDescMap = {"jan":0,"fev":1,"mar":2,"abr":3,"mai":4,"jun":5,"jul":6,"ago":7,"set":8,"out":9,"nov":10,"dez":11,"janeiro":0,"fevereiro":1,"março":2,"marco":2,"abril":3,"maio":4,"junho":5,"julho":6,"agosto":7,"setembro":8,"outubro":9,"novembro":10,"dezembro":11};
        const mesRegex = new RegExp(`(?:\\d+(?:\\.\\d+)?pr|\\d+xp|\\d+x(?!p))\\s+(${Object.keys(mesesDescMap).join('|')})(?:\\s+(\\d{4}|\\d{2}))?\\b`, "i");

        const pFiltroOriginalDate = new Date(pFiltroOriginal);
        const uFiltroOriginalDate = new Date(uFiltroOriginal);
        const dataInicioBuscaAmpliada = new Date(Date.UTC(pFiltroOriginalDate.getUTCFullYear(), pFiltroOriginalDate.getUTCMonth() - 1, 1));
        const ultimoDiaMesSeguinte = new Date(Date.UTC(uFiltroOriginalDate.getUTCFullYear(), uFiltroOriginalDate.getUTCMonth() + 2, 0));
        const dataFimBuscaAmpliada = new Date(Date.UTC(ultimoDiaMesSeguinte.getUTCFullYear(), ultimoDiaMesSeguinte.getUTCMonth(), ultimoDiaMesSeguinte.getUTCDate(), 23, 59, 59, 999));

        const eventos = calendar.getEvents(dataInicioBuscaAmpliada, dataFimBuscaAmpliada);
        Logger.log(`[calcularMetricas] Eventos do calendário (busca ampliada): ${eventos.length}`);

        const filtroFimMesUTC = uFiltroOriginalDate.getUTCMonth();
        const filtroFimAnoUTC = uFiltroOriginalDate.getUTCFullYear();

        for (const evento of eventos) {
            try {
                const dataIniEv = evento.getStartTime();
                const dataFimEv = evento.getEndTime();
                const tituloOriginal = evento.getTitle();
                const descricaoEvento = (evento.getDescription() || '').toLowerCase();

                if (!dataIniEv || isNaN(dataIniEv.getTime()) || !dataFimEv || isNaN(dataFimEv.getTime()) || !tituloOriginal) continue;

                const eventoFiltradoParaMetricasGerais = filtrarEventoCalendarApp(evento, filtroLower, corEventoFiltro, ptLower, PT_KEYWORDS);
                const evMesOriginal = dataIniEv.getMonth();
                const evAnoOriginal = dataIniEv.getFullYear();
                const evDayOriginal = dataIniEv.getDate();

                if (dataIniEv.getTime() >= pFiltroOriginal.getTime() && dataIniEv.getTime() <= uFiltroOriginal.getTime()) {
                    if (eventoFiltradoParaMetricasGerais) {
                        totalEventos++;
                        const durMins = Math.round((dataFimEv.getTime() - dataIniEv.getTime()) / 60000);
                        if (durMins >= 15) totalHoras += durMins / 60;

                        let clienteNomeBase = _getClienteNomeBaseFromTitle(tituloOriginal, PT_KEYWORDS);
                        const dataFormatadaEvento = Utilities.formatDate(dataIniEv, spreadsheetTimezone, "dd/MM/yyyy");
                        const planoInfo = planosMap.get(`${evento.getId()}_${dataFormatadaEvento}`);
                        let mRefValor = (planoInfo && planoInfo.mRef) ? String(planoInfo.mRef).trim() : "N/A";

                        let incluirNosDadosClienteEsteEvento = true;
                        if (mRefValor && mRefValor !== "N/A") {
                            const mRefDateParts = parseMRefToDateParts(mRefValor, dataIniEv.getFullYear(), mesesDescMap);
                            if (mRefDateParts) {
                                if (mRefDateParts.ano > filtroFimAnoUTC || (mRefDateParts.ano === filtroFimAnoUTC && mRefDateParts.mes > filtroFimMesUTC)) {
                                    incluirNosDadosClienteEsteEvento = false;
                                }
                            }
                        }

                        if (incluirNosDadosClienteEsteEvento) {
                            const chaveClienteRef = `${clienteNomeBase}_${mRefValor}`;
                            if (dadosClientePorRef[chaveClienteRef]) {
                                dadosClientePorRef[chaveClienteRef].count++;
                            } else {
                                dadosClientePorRef[chaveClienteRef] = { nomeCliente: clienteNomeBase, mRef: mRefValor, count: 1 };
                            }
                        }

                        if (planoInfo && planoInfo.status === "Done") {
                            eventosConcluidos++;
                        }
                    }
                }

                let mesAlvoNivel = evMesOriginal;
                let anoAlvoNivel = evAnoOriginal;
                const mesMatch = descricaoEvento.match(mesRegex);

                if (mesMatch && mesMatch[1]) {
                    const mesNumDesc = mesesDescMap[mesMatch[1].toLowerCase()];
                    if (mesNumDesc !== undefined) {
                        mesAlvoNivel = mesNumDesc;
                        if (mesMatch[2]) {
                            let anoDesc = parseInt(mesMatch[2], 10);
                            anoAlvoNivel = mesMatch[2].length === 2 ? anoDesc + 2000 : anoDesc;
                        } else {
                            if (mesNumDesc > evMesOriginal && evMesOriginal < 3 && mesNumDesc > 8) {
                                anoAlvoNivel = evAnoOriginal - 1;
                            } else if (mesNumDesc < evMesOriginal && evMesOriginal > 8 && mesNumDesc < 3) {
                                anoAlvoNivel = evAnoOriginal + 1;
                            } else {
                                anoAlvoNivel = evAnoOriginal;
                            }
                        }
                    }
                }

                let isInNivelPeriod = false;
                if (anoAlvoNivel === anoFiltroOriginal) {
                    if (anoFiltroOriginal === uFiltroOriginalDate.getUTCFullYear()) {
                         isInNivelPeriod = (mesAlvoNivel >= mesInicialFiltroOriginal && mesAlvoNivel <= mesFinalFiltroOriginal);
                    } else {
                         isInNivelPeriod = (mesAlvoNivel >= mesInicialFiltroOriginal && mesAlvoNivel <= 11);
                    }
                } else if (anoAlvoNivel > anoFiltroOriginal && anoAlvoNivel < uFiltroOriginalDate.getUTCFullYear()) {
                    isInNivelPeriod = true;
                } else if (anoAlvoNivel === uFiltroOriginalDate.getUTCFullYear() && anoFiltroOriginal < uFiltroOriginalDate.getUTCFullYear()) {
                    isInNivelPeriod = (mesAlvoNivel >= 0 && mesAlvoNivel <= mesFinalFiltroOriginal);
                }


                if (eventoFiltradoParaMetricasGerais && isInNivelPeriod) {
                    const chaveNivelUnica = `${tituloOriginal.trim().toLowerCase()}_${anoAlvoNivel}-${mesAlvoNivel}`;
                    if (!eventosNivelProcessados.has(chaveNivelUnica)) {
                        let valorContribuidoNivel = 0; let regraAplicada = null;
                        const durMinsEvento = Math.round((dataFimEv.getTime() - dataIniEv.getTime()) / 60000);
                        const prMatch = descricaoEvento.match(/(\d+(?:\.\d+)?)pr/);
                        if (prMatch && prMatch[1]) { const prValue = parseFloat(prMatch[1]); if (!isNaN(prValue)) { valorContribuidoNivel = prValue; regraAplicada = "PR"; } }
                        if (!regraAplicada) { const xpMatch = descricaoEvento.match(/(\d+)xp/); if (xpMatch && xpMatch[1]) { const xpNum = parseInt(xpMatch[1], 10); if (xpNum === 1) valorContribuidoNivel = 5; else if (xpNum === 2) valorContribuidoNivel = 10; if (valorContribuidoNivel > 0) regraAplicada = (xpNum === 1 ? "1XP" : "2XP"); } }
                        if (!regraAplicada) { const freqMatch = descricaoEvento.match(/(\d+)x(?!p)/); const freq = freqMatch ? parseInt(freqMatch[1], 10) : 0; if (freq > 0 && [30, 45, 60].includes(durMinsEvento)) { let vH = 0; const cat = tituloOriginal.toLowerCase(); const catType = cat.includes("duo") ? "duo" : cat.includes("pro") ? "pro" : cat.includes("fisio") ? "fisio" : cat.includes("nutri") ? "nutri" : "outros"; if (catType !== "outros") { if (durMinsEvento === 30) vH = 2.17; else if (durMinsEvento === 45) vH = 3.25; else if (durMinsEvento === 60) vH = (catType === "duo" ? 4.34 : 4.33); } if (vH > 0) { valorContribuidoNivel = parseFloat((vH * freq).toFixed(2)); regraAplicada = "FREQ_DUR"; } } }

                        let tipoPagamento = "Outro";
                        if (descricaoEvento.match(/\b\d+(?:\.\d+)?pr\b/i)) tipoPagamento = "PRO-RATA";
                        else if (descricaoEvento.match(/\b\d+xp\b/i)) tipoPagamento = "PACK";
                        else if (descricaoEvento.match(/\b\d+xc\b/i)) tipoPagamento = "CS";
                        else if (descricaoEvento.match(/\b\d+x(?![pc])\b/i)) tipoPagamento = "DD";

                        if (valorContribuidoNivel > 0) {
                            nivel += valorContribuidoNivel;
                            eventosNivelProcessados.add(chaveNivelUnica);
                            detalhesNivel.push({ titulo: tituloOriginal.trim(), valor: valorContribuidoNivel, mesAlocado: `${mesAlvoNivel + 1}/${anoAlvoNivel}`, regra: regraAplicada, dataOriginalEvt: `${evDayOriginal}/${evMesOriginal + 1}/${evAnoOriginal}`, tipoPagamento: tipoPagamento });
                        }
                    }
                }
            } catch (e) {
                Logger.log(`[calcularMetricas] Erro processando evento ${evento?.getId()} (${evento?.getTitle()}): ${e.message}\n${e.stack}`);
            }
        }

        const N_MONTHS_BACK_FOR_MREF = 1;
        const pFiltroOriginalMes = pFiltroOriginalDate.getUTCMonth();
        const pFiltroOriginalAno = pFiltroOriginalDate.getUTCFullYear();
        const dataInicioBuscaAdicionalMRef = new Date(Date.UTC(pFiltroOriginalAno, pFiltroOriginalMes - N_MONTHS_BACK_FOR_MREF, 1));
        const dataFimBuscaAdicionalMRef = new Date(Date.UTC(pFiltroOriginalAno, pFiltroOriginalMes, 0));

        const targetMRefMonth = uFiltroOriginalDate.getUTCMonth();
        const targetMRefYear = uFiltroOriginalDate.getUTCFullYear();

        if (dataInicioBuscaAdicionalMRef <= dataFimBuscaAdicionalMRef) {
             const eventosAnteriores = calendar.getEvents(dataInicioBuscaAdicionalMRef, dataFimBuscaAdicionalMRef);
             Logger.log(`[calcularMetricas] Eventos anteriores para M.Ref (${N_MONTHS_BACK_FOR_MREF} mês(es) antes do filtro): ${eventosAnteriores.length}`);
             for (const evento of eventosAnteriores) {
                try {
                    const eventoFiltradoAnterior = filtrarEventoCalendarApp(evento, filtroLower, corEventoFiltro, ptLower, PT_KEYWORDS);
                    if (!eventoFiltradoAnterior) continue;

                    const dataIniEvAnterior = evento.getStartTime();
                    const tituloOriginalEvAnterior = evento.getTitle();
                    if (!dataIniEvAnterior || isNaN(dataIniEvAnterior.getTime()) || !tituloOriginalEvAnterior) continue;

                    let clienteNomeBaseAnterior = _getClienteNomeBaseFromTitle(tituloOriginalEvAnterior, PT_KEYWORDS);
                    const dataFormatadaEvAnterior = Utilities.formatDate(dataIniEvAnterior, spreadsheetTimezone, "dd/MM/yyyy");
                    const planoInfoAnterior = planosMap.get(`${evento.getId()}_${dataFormatadaEvAnterior}`);
                    let mRefValorAnterior = (planoInfoAnterior && planoInfoAnterior.mRef) ? String(planoInfoAnterior.mRef).trim() : "N/A";

                    if (mRefValorAnterior && mRefValorAnterior !== "N/A") {
                        const mRefDatePartsAnterior = parseMRefToDateParts(mRefValorAnterior, dataIniEvAnterior.getFullYear(), mesesDescMap);
                        if (mRefDatePartsAnterior && mRefDatePartsAnterior.mes === targetMRefMonth && mRefDatePartsAnterior.ano === targetMRefYear) {
                            const chaveClienteRefAnterior = `${clienteNomeBaseAnterior}_${mRefValorAnterior}`;
                            if (!dadosClientePorRef[chaveClienteRefAnterior]) {
                                dadosClientePorRef[chaveClienteRefAnterior] = { nomeCliente: clienteNomeBaseAnterior, mRef: mRefValorAnterior, count: 1 };
                            }
                        }
                    }
                } catch (e) {
                    Logger.log(`[calcularMetricas] Erro processando evento anterior (M.Ref) ${evento?.getId()}: ${e.message}\n${e.stack}`);
                }
            }
        }


        detalhesNivel.sort((a, b) => {
            const [mA, yA] = a.mesAlocado.split('/').map(Number);
            const [mB, yB] = b.mesAlocado.split('/').map(Number);
            if (yA !== yB) return yA - yB;
            if (mA !== mB) return mA - mB;
            return a.titulo.localeCompare(b.titulo);
        });

        Logger.log(`[calcularMetricas] Tempo de execução: ${Date.now() - startTime}ms. Eventos (período filtro): ${totalEventos}, Horas (período filtro): ${totalHoras.toFixed(2)}, Nível (alocado no período): ${nivel.toFixed(2)}, Concluídos (período filtro): ${eventosConcluidos}`);
        return { totalHoras: parseFloat(totalHoras.toFixed(2)), nivel: parseFloat(nivel.toFixed(2)), totalEventos, eventosConcluidos, detalhesNivel, dadosClientePorRef, erro: null, mensagem: "Métricas calculadas." };

    } catch (e) {
        Logger.log(`[calcularMetricas] Erro crítico: ${e.message}\n${e.stack}`);
        return { ...defaultReturn, erro: 'Erro interno ao calcular métricas.', mensagem: `Ocorreu um erro inesperado: ${e.message}` };
    }
}


function getMasterExerciseData() {
    const cacheKey = "MASTER_EXERCISES_DATA_V2";
    const cached = SCRIPT_CACHE.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const exercises = {};
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_MASTER);
        if (!sheet) return {};
        const data = sheet.getDataRange().getValues();
        if (data.length < 1) return {};
        const headers = data[0];
        for (let j = 0; j < headers.length; j++) {
            const groupName = (headers[j] != null && headers[j] !== '') ? String(headers[j]).trim() : null;
            if (groupName) {
                exercises[groupName] = [];
                for (let i = 1; i < data.length; i++) {
                    const exercise = (data[i][j] != null && data[i][j] !== '') ? String(data[i][j]).trim() : null;
                    if (exercise && !exercises[groupName].includes(exercise)) exercises[groupName].push(exercise);
                }
                exercises[groupName].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            }
        }
        SCRIPT_CACHE.put(cacheKey, JSON.stringify(exercises), CACHE_EXPIRATION_SECONDS);
        return exercises;
    } catch (e) {
        Logger.log(`[getMasterExerciseData] Erro: ${e.message}`);
        return {};
    }
}

function getPlanos(filtroNomeEvento, dataInicioStr, dataFimStr, personalTrainer, corEventoFiltro) {
    const lock = LockService.getScriptLock();
    let hasLock = false;
    const defaultReturn = { planos: [], masterExercises: {}, erro: null, mensagem: null };
    const startTime = Date.now();
    Logger.log(`[getPlanos] Iniciando. Filtros: Nome=${filtroNomeEvento}, Início=${dataInicioStr}, Fim=${dataFimStr}, PT=${personalTrainer}, Cor=${corEventoFiltro}`);

    try {
        hasLock = lock.tryLock(30000); // Aumentado para 30s devido à complexidade
        const masterExercisesData = getMasterExerciseData();
        if (!hasLock) return { ...defaultReturn, masterExercises: masterExercisesData, erro: "Serviço ocupado.", mensagem: "O servidor está processando outra solicitação. Tente novamente em alguns segundos." };

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(SHEET_NAME_PLANOS);
        if (!sheet) return { ...defaultReturn, masterExercises: masterExercisesData, erro: `Folha ${SHEET_NAME_PLANOS} não existe.`, mensagem: `Erro de configuração: folha de planos não encontrada.` };

        const spreadsheetTimezone = ss.getSpreadsheetTimeZone();
        const { primeiroDiaDoPeriodo, ultimoDiaDoPeriodo, ano, mesInicialNum, mesFinalNum, isSpecificDayFilter, diaNum, error: dateError } = calcularPeriodoFiltro(dataInicioStr, dataFimStr);
        if (dateError) return { ...defaultReturn, masterExercises: masterExercisesData, erro: "Data inválida.", mensagem: dateError };
        Logger.log(`[getPlanos] Período para calendário: ${primeiroDiaDoPeriodo} a ${ultimoDiaDoPeriodo}`);

        const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
        if (!calendar) return { ...defaultReturn, masterExercises: masterExercisesData, erro: "Calendário inacessível.", mensagem: "Calendário principal não encontrado." };

        const eventos = calendar.getEvents(primeiroDiaDoPeriodo, ultimoDiaDoPeriodo);
        Logger.log(`[getPlanos] Eventos do calendário no período: ${eventos.length}`);

        const sheetDataResult = sheet.getDataRange().getValues();
        const headers = sheetDataResult.length > 0 ? sheetDataResult[0].map(h => String(h).trim()) : [];
        const { headerMap, colIndices, error: headerError } = mapearCabecalhos(headers);
        if (headerError) return { ...defaultReturn, masterExercises: masterExercisesData, erro: headerError, mensagem: `Erro de configuração nas colunas da folha ${SHEET_NAME_PLANOS}.` };

        const { sheetPlansMap, originalSheetData } = prepararMapaPlanilha(sheetDataResult, colIndices, spreadsheetTimezone);
        const archivedPlanKeys = getArchivedPlanKeys(ss, spreadsheetTimezone);

        const { planosFiltradosParaRetorno, rowsForDateRangeSegment, processedSheetIndices } = processarEventosParaSheetDataAndReturnList(
            eventos, sheetPlansMap, archivedPlanKeys, headerMap, colIndices, PT_KEYWORDS,
            filtroNomeEvento, corEventoFiltro, personalTrainer,
            ano, mesInicialNum, mesFinalNum, isSpecificDayFilter, diaNum, spreadsheetTimezone
        );

        const fullNewSheetData = [headers];
        originalSheetData.forEach((row, idx) => {
            if (!processedSheetIndices.has(idx + 1) && row[colIndices.idPlano]) {
                fullNewSheetData.push(row);
            }
        });
        if (rowsForDateRangeSegment.length > 0) {
            fullNewSheetData.push(...rowsForDateRangeSegment);
        }

        // Otimização: Remoção da ordenação no servidor antes de escrever na planilha.
        // A ordenação para exibição é feita no cliente.
        // if (fullNewSheetData.length > 1) {
        //     const dataRowsToSort = fullNewSheetData.slice(1);
        //     dataRowsToSort.sort((a,b) => {
        //         const dateA = parseDate(formatarDataValor(a[colIndices.data], spreadsheetTimezone), String(a[colIndices.hora]||'00:00'), spreadsheetTimezone);
        //         const dateB = parseDate(formatarDataValor(b[colIndices.data], spreadsheetTimezone), String(b[colIndices.hora]||'00:00'), spreadsheetTimezone);
        //         if (dateA && dateB) return dateA.getTime() - dateB.getTime();
        //         if (dateA) return -1; if (dateB) return 1;
        //         return 0;
        //     });
        //     fullNewSheetData.splice(1, fullNewSheetData.length -1, ...dataRowsToSort);
        // }

        escreverDadosPlanilha(sheet, headers, fullNewSheetData);

        // A ordenação dos planos para retorno ao cliente é mantida.
        planosFiltradosParaRetorno.forEach(p => { p._parsedDate = parseDate(p.data, p.hora, spreadsheetTimezone); });
        planosFiltradosParaRetorno.sort((a, b) => {
            const dA = a._parsedDate; const dB = b._parsedDate;
            if (dA && dB) return dA.getTime() - dB.getTime();
            if (dA) return -1; if (dB) return 1;
            return (a.cliente && b.cliente) ? a.cliente.localeCompare(b.cliente) : 0;
        });
        planosFiltradosParaRetorno.forEach(p => delete p._parsedDate);

        Logger.log(`[getPlanos] Tempo total: ${Date.now() - startTime}ms. Planos retornados: ${planosFiltradosParaRetorno.length}`);
        return { planos: planosFiltradosParaRetorno, masterExercises: masterExercisesData, erro: null, mensagem: `Filtro aplicado. ${planosFiltradosParaRetorno.length} planos encontrados.` };

    } catch (e) {
        Logger.log(`[getPlanos] Erro Crítico: ${e.message}\n${e.stack}`);
        const masterData = getMasterExerciseData();
        return { ...defaultReturn, masterExercises: masterData, erro: 'Erro interno ao buscar planos.', mensagem: `Ocorreu um erro inesperado: ${e.message}` };
    } finally {
        if (hasLock) lock.releaseLock();
    }
}

function savePlano(plano, status) {
    if (!plano?.planUuid || !plano?.cliente || !plano?.data || !status || typeof plano.data !== 'string' || !plano.data.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return { sucesso: false, erro: "Dados do plano inválidos.", mensagem: "Verifique os dados do plano antes de salvar." };
    }
    const lock = LockService.getScriptLock();
    let hasLock = false;
    try {
        hasLock = lock.tryLock(15000);
        if (!hasLock) return { sucesso: false, erro: "Serviço ocupado", mensagem: "O servidor está processando outra solicitação. Tente novamente." };

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(SHEET_NAME_PLANOS);
        if (!sheet) return { sucesso: false, erro: `Folha ${SHEET_NAME_PLANOS} não encontrada.`, mensagem: "Erro de configuração da planilha." };

        const spreadsheetTimezone = ss.getSpreadsheetTimeZone();
        const sheetData = sheet.getDataRange().getValues();
        const headers = sheetData.length > 0 ? sheetData[0].map(h => String(h).trim()) : [];
        const { headerMap, colIndices, error: headerError } = mapearCabecalhos(headers);
        if (headerError) return { sucesso: false, erro: headerError, mensagem: `Erro de configuração das colunas da folha ${SHEET_NAME_PLANOS}.` };

        const { rowData, error: rowDataError } = prepararDadosLinha(plano, status, headers, colIndices, spreadsheetTimezone);
        if (rowDataError) return { sucesso: false, erro: rowDataError, mensagem: "Erro ao preparar os dados para salvar." };
        if (!rowData || rowData.length !== headers.length) return { sucesso: false, erro: "Inconsistência nos dados da linha.", mensagem: "Erro interno ao preparar os dados para salvar." };

        let foundRowIndex = -1;
        for (let i = 1; i < sheetData.length; i++) {
            if (sheetData[i][colIndices.idPlano] === plano.planUuid) {
                foundRowIndex = i + 1;
                break;
            }
        }

        let savedRowIndex = -1;
        if (foundRowIndex > 0) {
            sheet.getRange(foundRowIndex, 1, 1, headers.length).setValues([rowData]);
            savedRowIndex = foundRowIndex;
        } else {
            sheet.appendRow(rowData);
            savedRowIndex = sheet.getLastRow();
        }
        SpreadsheetApp.flush();

        let archived = false;
        if (status === "Done" && savedRowIndex > 0) {
            const finalRowDataForArchive = sheet.getRange(savedRowIndex, 1, 1, headers.length).getValues()[0];
            archived = archivePlan(ss, finalRowDataForArchive, headerMap, spreadsheetTimezone);
            if (!archived) {
                const formattedPlanDataForReturn = formatPlanData(rowData, headerMap, spreadsheetTimezone);
                return { sucesso: true, mensagem: "Salvo com sucesso, mas falha ao arquivar.", ...formattedPlanDataForReturn };
            }
        }
        const formattedPlanData = formatPlanData(rowData, headerMap, spreadsheetTimezone);
        return { sucesso: true, mensagem: archived ? "Salvo e arquivado com sucesso!" : "Salvo com sucesso!", ...formattedPlanData };
    } catch (e) {
        Logger.log(`[savePlano] UUID ${plano?.planUuid} Erro: ${e.message}\n${e.stack}`);
        return { sucesso: false, erro: "Erro interno ao salvar o plano.", mensagem: `Ocorreu um erro inesperado: ${e.message}` };
    } finally {
        if (hasLock) lock.releaseLock();
    }
}

function mapearCabecalhos(headers) {
    const requiredHeaders = ["ID do Plano", "ID do Evento", "Data", "Cliente", "Hora", "Duração", "Exercícios", "Status", "Cor"];
    const headerMap = headers.reduce((map, header, index) => { map[String(header).trim()] = index; return map; }, {});
    for (const requiredHeader of requiredHeaders) {
        if (headerMap[requiredHeader] === undefined) return { headerMap: null, colIndices: null, error: `Coluna obrigatória "${requiredHeader}" faltando na planilha ${SHEET_NAME_PLANOS}.` };
    }
    return {
        headerMap: headerMap,
        colIndices: {
            idPlano: headerMap["ID do Plano"], idEvento: headerMap["ID do Evento"], data: headerMap["Data"], cliente: headerMap["Cliente"],
            hora: headerMap["Hora"], duracao: headerMap["Duração"], exercicios: headerMap["Exercícios"], status: headerMap["Status"],
            cor: headerMap["Cor"], sessao: headerMap["Sessão"], mes: headerMap["Mês"], mRef: headerMap["M.Ref"],
            avaliacaoData: headerMap["AvaliacaoJSON"]
        },
        error: null
    };
}

function prepararDadosLinha(plano, status, headers, colIndices, timezone) {
    let exerciciosJSON = '[]';
    try {
        exerciciosJSON = JSON.stringify(Array.isArray(plano.exercicios) ? plano.exercicios : []);
    } catch (e) {
        Logger.log(`[prepararDadosLinha] Erro ao stringificar exercícios: ${e.message}`);
        return { rowData: null, error: "Erro ao processar dados de exercícios." };
    }
    const rowData = Array(headers.length).fill('');
    try {
        rowData[colIndices.idPlano] = plano.planUuid || Utilities.getUuid();
        rowData[colIndices.idEvento] = plano.eventId || '';
        rowData[colIndices.cliente] = plano.cliente || '';
        const formattedDate = formatarDataValor(plano.data, timezone);
        if (!formattedDate) return { rowData: null, error: "Formato de data inválido." };
        rowData[colIndices.data] = formattedDate;
        rowData[colIndices.hora] = plano.hora || '';
        rowData[colIndices.duracao] = plano.duracao || '';
        rowData[colIndices.exercicios] = exerciciosJSON;
        rowData[colIndices.status] = status || 'Edit';
        rowData[colIndices.cor] = plano.cor ? String(plano.cor) : '';
        if (colIndices.sessao !== undefined) rowData[colIndices.sessao] = plano.sessao || '';
        if (colIndices.mes !== undefined) rowData[colIndices.mes] = plano.mes || '';
        if (colIndices.mRef !== undefined) rowData[colIndices.mRef] = plano.mRef || '';
        if (colIndices.avaliacaoData !== undefined) {
            rowData[colIndices.avaliacaoData] = (plano.avaliacao && Object.keys(plano.avaliacao).length > 0) ? JSON.stringify(plano.avaliacao) : '';
        }
        if (rowData.length !== headers.length) return { rowData: null, error: "Erro interno ao criar os dados da linha." };
    } catch (indexError) {
        Logger.log(`[prepararDadosLinha] Erro no índice da coluna: ${indexError}. ColIndices: ${JSON.stringify(colIndices)}`);
        return { rowData: null, error: "Erro no mapeamento de coluna ao preparar dados." };
    }
    return { rowData: rowData, error: null };
}

function prepararMapaPlanilha(sheetData, colIndices, tz) {
    const map = new Map();
    const originalData = [];
    for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        originalData.push(row);
        const eventId = row[colIndices.idEvento];
        const formattedDate = formatarDataValor(row[colIndices.data], tz);
        if (eventId && formattedDate) {
            map.set(`${eventId}_${formattedDate}`, { originalIndex: i, rowData: row });
        }
    }
    return { sheetPlansMap: map, originalSheetData: originalData };
}

function getArchivedPlanKeys(ss, tz) {
    const archiveSheet = ss.getSheetByName(SHEET_NAME_CONTAS);
    const archivedKeys = new Set();
    if (!archiveSheet) return archivedKeys;
    const data = archiveSheet.getDataRange().getValues();
    if (data.length < 2) return archivedKeys;
    const headers = data[0].map(h => String(h).trim());
    const eventIdCol = headers.indexOf("ID Evento");
    const dateCol = headers.indexOf("Data");
    if (eventIdCol === -1 || dateCol === -1) return archivedKeys;
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const eventId = row[eventIdCol];
        const formattedDate = formatarDataValor(row[dateCol], tz);
        if (eventId && formattedDate) archivedKeys.add(`${eventId}_${formattedDate}`);
    }
    return archivedKeys;
}

function processarEventosParaSheetDataAndReturnList(
    eventos, sheetPlansMap, archivedPlanKeys, headerMap, colIndices, ptKeywords,
    filtroNomeEvento, corEventoFiltro, personalTrainer,
    anoFiltroPeriodo, mesInicialFiltroPeriodo, mesFinalFiltroPeriodo, isSpecificDayFilter, diaNumFiltro, timezone
) {
    const planosRetorno = [];
    const rowsForDateRangeSegment = [];
    const processedSheetIndices = new Set();
    const filtroLower = filtroNomeEvento ? filtroNomeEvento.toLowerCase() : null;
    const ptLower = personalTrainer && personalTrainer !== "" ? personalTrainer.toLowerCase() : null;
    const headersArray = Object.keys(headerMap).sort((a, b) => headerMap[a] - headerMap[b]);

    for (const evento of eventos) {
        try {
            const eventId = evento.getId();
            const dataIni = evento.getStartTime();
            const dataFim = evento.getEndTime();
            const titulo = evento.getTitle();
            if (!dataIni || isNaN(dataIni.getTime()) || !dataFim || isNaN(dataFim.getTime()) || !titulo) continue;

            if (!filtrarEventoCalendarApp(evento, filtroLower, corEventoFiltro, ptLower, ptKeywords)) continue;

            const dataFmt = Utilities.formatDate(dataIni, timezone, "dd/MM/yyyy");
            const syncKey = `${eventId}_${dataFmt}`;
            const existingInfo = sheetPlansMap.get(syncKey);
            let currentPlanRow;
            const corId = evento.getColor() ? String(evento.getColor()) : null;
            const horaFmt = Utilities.formatDate(dataIni, timezone, "HH:mm");
            const durMins = Math.round((dataFim.getTime() - dataIni.getTime()) / 60000);
            const durFmt = durMins > 0 ? `${durMins} min` : '';

            if (existingInfo) {
                processedSheetIndices.add(existingInfo.originalIndex);
                currentPlanRow = [...existingInfo.rowData];
                if (currentPlanRow[colIndices.cliente] !== titulo) currentPlanRow[colIndices.cliente] = titulo;
                if (currentPlanRow[colIndices.hora] !== horaFmt) currentPlanRow[colIndices.hora] = horaFmt;
                if (currentPlanRow[colIndices.duracao] !== durFmt) currentPlanRow[colIndices.duracao] = durFmt;
                if (String(currentPlanRow[colIndices.cor] || '') !== String(corId || '')) currentPlanRow[colIndices.cor] = corId || '';
                rowsForDateRangeSegment.push(currentPlanRow);
                planosRetorno.push(formatPlanData(currentPlanRow, headerMap, timezone));
            } else if (!archivedPlanKeys.has(syncKey)) {
                currentPlanRow = Array(headersArray.length).fill('');
                currentPlanRow[colIndices.idPlano] = Utilities.getUuid();
                currentPlanRow[colIndices.idEvento] = eventId;
                currentPlanRow[colIndices.cliente] = titulo;
                currentPlanRow[colIndices.data] = dataFmt;
                currentPlanRow[colIndices.hora] = horaFmt;
                currentPlanRow[colIndices.duracao] = durFmt;
                currentPlanRow[colIndices.exercicios] = '[]';
                currentPlanRow[colIndices.status] = "Edit";
                currentPlanRow[colIndices.cor] = corId || '';
                if (colIndices.sessao !== undefined) currentPlanRow[colIndices.sessao] = '';
                if (colIndices.mes !== undefined) currentPlanRow[colIndices.mes] = '';
                if (colIndices.mRef !== undefined) currentPlanRow[colIndices.mRef] = '';
                if (colIndices.avaliacaoData !== undefined) currentPlanRow[colIndices.avaliacaoData] = '';
                rowsForDateRangeSegment.push(currentPlanRow);
                planosRetorno.push(formatPlanData(currentPlanRow, headerMap, timezone));
            }
        } catch (e) {
            Logger.log(`[processarEventosParaSheetDataAndReturnList] Erro ao processar evento ID ${evento?.getId()}: ${e.message}\n${e.stack}`);
        }
    }
    return { planosFiltradosParaRetorno: planosRetorno, rowsForDateRangeSegment, processedSheetIndices };
}

function escreverDadosPlanilha(sheet, headers, fullNewSheetData) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 0) {
        sheet.getRange(1, 1, lastRow, sheet.getLastColumn() || 1).clearContent();
    }
    if (fullNewSheetData.length > 0 && headers.length > 0) {
        sheet.getRange(1, 1, fullNewSheetData.length, headers.length).setValues(fullNewSheetData);
    } else if (fullNewSheetData.length === 1 && fullNewSheetData[0].length === 0) {
        // Cabeçalho vazio
    } else {
        Logger.log("[escreverDadosPlanilha] Aviso: Sem dados ou colunas para escrever.");
    }
    SpreadsheetApp.flush();
}

const mesNumeroCache = {};
function obterNumeroMes(nomeMes) {
    if (!nomeMes || typeof nomeMes !== 'string') return -1;
    const lN = nomeMes.trim().toLowerCase();
    if (lN === '') return -1;
    if (mesNumeroCache[lN] !== undefined) return mesNumeroCache[lN];
    const mF = {"janeiro":0,"fevereiro":1,"março":2,"marco":2,"abril":3,"maio":4,"junho":5,"julho":6,"agosto":7,"setembro":8,"outubro":9,"novembro":10,"dezembro":11};
    const mS = {"jan":0,"fev":1,"mar":2,"abr":3,"mai":4,"jun":5,"jul":6,"ago":7,"set":8,"out":9,"nov":10,"dez":11};
    mesNumeroCache[lN] = mF[lN] ?? mS[lN] ?? -1;
    return mesNumeroCache[lN];
}

function filtrarEventoCalendarApp(evento, filtroNomeLower, corFiltro, ptLower, ptKeywords) {
    if (!evento?.getTitle) return false;
    const tituloOriginal = evento.getTitle() || "";
    const tituloLower = tituloOriginal.toLowerCase();
    const eventoCor = evento.getColor() ? String(evento.getColor()) : null;

    if (filtroNomeLower && !tituloLower.includes(filtroNomeLower)) {
        return false;
    }
    if (corFiltro && corFiltro !== "") {
        if (eventoCor !== corFiltro) return false;
    }
    if (ptLower && ptLower !== "todos" && ptLower !== "") {
        const foundPtKeyword = ptKeywords.find(p => tituloLower.includes(p.toLowerCase()));
        if (!foundPtKeyword || foundPtKeyword.toLowerCase() !== ptLower) {
            return false;
        }
    }
    return true;
}

const dateParseCache = new Map();
function parseDate(dateString, timeString, timezone) {
    const cacheKey = `${dateString}_${timeString}_${timezone}`;
    if (dateParseCache.has(cacheKey)) return dateParseCache.get(cacheKey);
    try {
        const dM = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        const tM = timeString ? String(timeString).match(/^(\d{2}):(\d{2})$/) : ['00:00','00','00'];
        if (!dM) { dateParseCache.set(cacheKey, null); return null; }
        const effectiveTM = tM || ['00:00','00','00'];
        const dO = Utilities.parseDate(`${dM[3]}-${dM[2]}-${dM[1]} ${effectiveTM[1]}:${effectiveTM[2]}:00`, timezone, "yyyy-MM-dd HH:mm:ss");
        if (isNaN(dO.getTime())) { dateParseCache.set(cacheKey, null); return null; }
        dateParseCache.set(cacheKey, dO);
        return dO;
    } catch (e) {
        Logger.log(`[parseDate] Erro ao parsear data/hora: ${dateString} ${timeString} em ${timezone}. Erro: ${e.message}`);
        dateParseCache.set(cacheKey, null);
        return null;
    }
}


const formatarDataValorCache = new Map();
function formatarDataValor(dataValue, tz) {
    if (typeof dataValue === 'string' && dataValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dataValue;
    tz = tz || Session.getScriptTimeZone();
    const cacheKey = `${String(dataValue)}_${tz}`;
    if (formatarDataValorCache.has(cacheKey)) return formatarDataValorCache.get(cacheKey);
    let result = '';
    try {
        if (dataValue instanceof Date && !isNaN(dataValue.getTime())) {
            result = Utilities.formatDate(dataValue, tz, "dd/MM/yyyy");
        } else if (typeof dataValue === 'number' && dataValue > 0 && dataValue < 60000) {
            const date = new Date((dataValue - 25569) * 86400000 + (new Date().getTimezoneOffset() * 60000));
            if (!isNaN(date.getTime())) result = Utilities.formatDate(date, tz, "dd/MM/yyyy");
        }
    } catch (e) {  /* Ignorar erro de formatação, retorna '' */ }
    formatarDataValorCache.set(cacheKey, result);
    if (formatarDataValorCache.size > 200) formatarDataValorCache.delete(formatarDataValorCache.keys().next().value);
    return result;
}

function formatPlanData(rowData, headerMap, tz) {
    const colIndices = {
        idPlano: headerMap["ID do Plano"], idEvento: headerMap["ID do Evento"], data: headerMap["Data"],
        cliente: headerMap["Cliente"], hora: headerMap["Hora"], duracao: headerMap["Duração"],
        exercicios: headerMap["Exercícios"], status: headerMap["Status"], cor: headerMap["Cor"],
        sessao: headerMap["Sessão"], mes: headerMap["Mês"], mRef: headerMap["M.Ref"],
        avaliacaoData: headerMap["AvaliacaoJSON"]
    };
    const getStringValue = idx => (idx !== undefined && rowData[idx] != null && rowData[idx] !== '') ? String(rowData[idx]) : null;

    let horaFormatada = '--:--';
    try {
        const horaValue = rowData[colIndices.hora];
        if (horaValue instanceof Date && !isNaN(horaValue.getTime())) {
            horaFormatada = Utilities.formatDate(horaValue, tz, "HH:mm");
        } else if (typeof horaValue === 'number' && horaValue >= 0 && horaValue < 1) {
            const totalMinutes = Math.round(horaValue * 1440);
            horaFormatada = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
        } else if (typeof horaValue === 'string' && horaValue.match(/^\d{2}:\d{2}$/)) {
            horaFormatada = horaValue;
        } else if (horaValue === '') {
             horaFormatada = '--:--';
        } else {
            horaFormatada = String(horaValue || '--:--');
        }
    } catch (e) { horaFormatada = '--:--'; }

    let exercicios = [];
    const exerciciosStrValue = rowData[colIndices.exercicios];
    if (typeof exerciciosStrValue === 'string' && exerciciosStrValue.trim().startsWith('[')) {
        try {
            exercicios = JSON.parse(exerciciosStrValue);
            if (!Array.isArray(exercicios)) exercicios = [{ type: 'error', msg: 'Dados de exercícios inválidos (não é array).' }];
        } catch (e) { exercicios = [{ type: 'error', msg: 'Erro ao carregar dados de exercícios.' }]; }
    } else if (exerciciosStrValue && String(exerciciosStrValue).trim()) {
        exercicios = [{ type: 'warn', msg: 'Formato de dados de exercícios inesperado.' }];
    }

    let avaliacao = null;
    if (colIndices.avaliacaoData !== undefined) {
        const avaliacaoJSON = getStringValue(colIndices.avaliacaoData);
        if (avaliacaoJSON && avaliacaoJSON.trim() !== '' && avaliacaoJSON !== 'null' && avaliacaoJSON !== '{}') {
            try {
                avaliacao = JSON.parse(avaliacaoJSON);
                if (typeof avaliacao !== 'object' || avaliacao === null) {
                    avaliacao = { error: "Dados de avaliação inválidos (não é objeto)." };
                }
            } catch (e) {
                Logger.log(`Erro ao parsear AvaliacaoJSON para plano ${getStringValue(colIndices.idPlano)}: ${e.message}. JSON: ${avaliacaoJSON}`);
                avaliacao = { error: "Falha ao carregar dados de avaliação (erro de parse)." };
            }
        }
    }

    return {
        planUuid: getStringValue(colIndices.idPlano),
        eventId: getStringValue(colIndices.idEvento),
        clienteContagem: getStringValue(colIndices.sessao),
        clienteMes: getStringValue(colIndices.mes),
        data: formatarDataValor(rowData[colIndices.data], tz) || 'Data Inválida',
        hora: horaFormatada,
        duracao: getStringValue(colIndices.duracao),
        cliente: getStringValue(colIndices.cliente),
        status: getStringValue(colIndices.status) || 'Edit',
        cor: getStringValue(colIndices.cor),
        exercicios: exercicios,
        mRef: getStringValue(colIndices.mRef),
        avaliacao: avaliacao
    };
}

function archivePlan(ss, planRowData, headerMap, tz) {
    let archiveSheet = ss.getSheetByName(SHEET_NAME_CONTAS);
    try {
        if (!archiveSheet) {
            archiveSheet = ss.insertSheet(SHEET_NAME_CONTAS);
            archiveSheet.appendRow(["ID Arquivo", "ID Plano(Orig)", "ID Evento", "Cliente", "Data", "Hora", "Duração", "M.Ref", "Sessão", "Mês", "Exercícios(JSON)", "Status Arq", "Cor", "Data Arq", "AvaliacaoJSON"]).getRange("A1:O1").setFontWeight("bold");
            archiveSheet.setFrozenRows(1);
        }
        const cI = {
            idPlano: headerMap["ID do Plano"], idEvento: headerMap["ID do Evento"], cliente: headerMap["Cliente"],
            data: headerMap["Data"], hora: headerMap["Hora"], duracao: headerMap["Duração"],
            sessao: headerMap["Sessão"], mes: headerMap["Mês"], exercicios: headerMap["Exercícios"],
            status: headerMap["Status"], cor: headerMap["Cor"], mRef: headerMap["M.Ref"],
            avaliacaoData: headerMap["AvaliacaoJSON"]
        };
        const gAV = idx => (idx !== undefined && planRowData[idx] != null) ? planRowData[idx] : null;
        let horaFormatada = '';
        try {
            const hV = gAV(cI.hora);
            if (hV instanceof Date && !isNaN(hV.getTime())) horaFormatada = Utilities.formatDate(hV, tz, "HH:mm");
            else if (typeof hV === 'number' && hV >= 0 && hV < 1) { const tM = Math.round(hV * 1440); horaFormatada = `${String(Math.floor(tM / 60)).padStart(2, '0')}:${String(tM % 60).padStart(2, '0')}`; }
            else if (typeof hV === 'string' && hV.match(/^\d{2}:\d{2}$/)) horaFormatada = hV;
            else horaFormatada = String(hV || '');
        } catch (e) { /* Ignorar erro de formatação de hora */ }

        archiveSheet.appendRow([
            Utilities.getUuid(), gAV(cI.idPlano), gAV(cI.idEvento), gAV(cI.cliente),
            formatarDataValor(gAV(cI.data), tz), horaFormatada, gAV(cI.duracao), gAV(cI.mRef),
            gAV(cI.sessao), gAV(cI.mes), gAV(cI.exercicios) ?? '[]', gAV(cI.status),
            gAV(cI.cor) ? String(gAV(cI.cor)) : null, new Date(), gAV(cI.avaliacaoData) ?? ''
        ]);
        SpreadsheetApp.flush();
        return true;
    } catch (e) {
        Logger.log(`[archivePlan] Erro: ${e.message}\n${e.stack}`);
        return false;
    }
}

function saveNewMasterExercise(exerciseName, muscleGroup) {
    const lock = LockService.getScriptLock();
    let gotLock = false;
    if (!exerciseName || !muscleGroup) return { success: false, error: "Nome do exercício ou grupo muscular em falta." };
    try {
        gotLock = lock.tryLock(10000);
        if (!gotLock) return { success: false, error: "Serviço ocupado. Tente novamente." };
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const masterSheet = ss.getSheetByName(SHEET_NAME_MASTER);
        if (!masterSheet) return { success: false, error: `Folha "${SHEET_NAME_MASTER}" não encontrada.` };
        const headers = masterSheet.getRange(1, 1, 1, masterSheet.getLastColumn()).getValues()[0];
        const muscleGroupColIndex = headers.findIndex(h => typeof h === 'string' && h.trim() === muscleGroup);
        if (muscleGroupColIndex === -1) return { success: false, error: `Grupo muscular "${muscleGroup}" não encontrado.` };
        const muscleGroupColNum = muscleGroupColIndex + 1;
        const lastRow = masterSheet.getLastRow();
        const columnValues = lastRow > 1 ? masterSheet.getRange(2, muscleGroupColNum, lastRow - 1, 1).getValues().flat().map(v => String(v).trim().toLowerCase()) : [];
        const exerciseNameLower = exerciseName.trim().toLowerCase();
        if (columnValues.includes(exerciseNameLower)) return { success: true, message: "Exercício já existe neste grupo." };
        masterSheet.getRange(columnValues.filter(String).length + 2, muscleGroupColNum).setValue(exerciseName.trim());
        SCRIPT_CACHE.remove("MASTER_EXERCISES_DATA_V2"); // Invalidar cache
        SpreadsheetApp.flush();
        return { success: true };
    } catch (e) {
        Logger.log(`[saveNewMasterExercise] Erro: ${e.message}\n${e.stack}`);
        return { success: false, error: `Erro interno: ${e.message}` };
    } finally {
        if (gotLock) lock.releaseLock();
    }
}

function getEstatisticasCliente(filtroNomeEvento, dataInicioStr, dataFimStr, personalTrainer, corEventoFiltro) {
    const defaultReturn = { clienteNome: null, periodo: {}, planosDetalhes: [], avaliacoesSeries: {}, workoutAnalysis: { muscleGroupUsage: {}, objectiveUsage: {}, exerciseWeightProgress: {} }, erro: "Nenhum dado encontrado", mensagem: "Nenhum dado para os filtros." };
    if (!filtroNomeEvento) return { ...defaultReturn, erro: "Nome do cliente é obrigatório para estatísticas.", mensagem: "Forneça o nome do cliente." };
    Logger.log(`[getEstatisticasCliente] Iniciando. Cliente=${filtroNomeEvento}, Início=${dataInicioStr}, Fim=${dataFimStr}, PT=${personalTrainer}, Cor=${corEventoFiltro}`);
    try {
        const { primeiroDiaDoPeriodo, ultimoDiaDoPeriodo, error: dateError } = calcularPeriodoFiltro(dataInicioStr, dataFimStr);
        if (dateError) return { ...defaultReturn, erro: "Data inválida.", mensagem: dateError };

        const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
        if (!calendar) return { ...defaultReturn, erro: "Calendário inacessível.", mensagem: "Calendário não encontrado." };

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetPlanos = ss.getSheetByName(SHEET_NAME_PLANOS);
        if (!sheetPlanos) return { ...defaultReturn, erro: `Folha ${SHEET_NAME_PLANOS} não encontrada.`, mensagem: "Erro de configuração." };

        const spreadsheetTimezone = ss.getSpreadsheetTimeZone();
        const sheetDataResult = sheetPlanos.getDataRange().getValues();
        const headers = sheetDataResult.length > 0 ? sheetDataResult[0].map(h => String(h).trim()) : [];
        const { headerMap, colIndices, error: headerError } = mapearCabecalhos(headers);
        if (headerError) return { ...defaultReturn, erro: headerError, mensagem: "Erro de configuração de colunas." };

        const eventosDoCalendario = calendar.getEvents(primeiroDiaDoPeriodo, ultimoDiaDoPeriodo);
        Logger.log(`[getEstatisticasCliente] Eventos do calendário no período: ${eventosDoCalendario.length}`);

        const planosDetalhes = [];
        const avaliacoesSeries = { peso: [], massaGorda: [], massaMuscular: [], metabolismoBasal: [], h2o: [], gorduraVisceral: [] };
        const muscleGroupCounts = {};
        const objectiveCounts = {};
        const exerciseWeightProgressByGroup = {};
        let clienteNomeDisplay = filtroNomeEvento;
        const filtroLower = filtroNomeEvento.toLowerCase();
        const ptLower = personalTrainer && personalTrainer !== "" ? personalTrainer.toLowerCase() : null;

        for (const evento of eventosDoCalendario) {
            if (!filtrarEventoCalendarApp(evento, filtroLower, corEventoFiltro, ptLower, PT_KEYWORDS)) {
                continue;
            }
            clienteNomeDisplay = _getClienteNomeBaseFromTitle(evento.getTitle(), PT_KEYWORDS) || evento.getTitle();

            const eventId = evento.getId();
            const eventStartDate = evento.getStartTime();
            const eventDateFormatted = Utilities.formatDate(eventStartDate, spreadsheetTimezone, "dd/MM/yyyy");
            const eventDateISO = Utilities.formatDate(eventStartDate, spreadsheetTimezone, "yyyy-MM-dd");
            let planoEncontradoNaPlanilha = null;

            for (let i = 1; i < sheetDataResult.length; i++) {
                const row = sheetDataResult[i];
                const sheetEventId = row[colIndices.idEvento];
                const sheetDate = formatarDataValor(row[colIndices.data], spreadsheetTimezone);
                if (sheetEventId === eventId && sheetDate === eventDateFormatted) {
                    planoEncontradoNaPlanilha = formatPlanData(row, headerMap, spreadsheetTimezone);
                    break;
                }
            }

            if (planoEncontradoNaPlanilha) {
                planosDetalhes.push({ data: eventDateFormatted, exercicios: planoEncontradoNaPlanilha.exercicios || [], avaliacao: planoEncontradoNaPlanilha.avaliacao });
                if (planoEncontradoNaPlanilha.avaliacao && typeof planoEncontradoNaPlanilha.avaliacao === 'object' && !planoEncontradoNaPlanilha.avaliacao.error) {
                    const aval = planoEncontradoNaPlanilha.avaliacao;
                    if (aval.peso != null) avaliacoesSeries.peso.push({ date: eventDateISO, value: parseFloat(aval.peso) });
                    if (aval.massaGorda != null) avaliacoesSeries.massaGorda.push({ date: eventDateISO, value: parseFloat(aval.massaGorda) });
                    if (aval.massaMuscular != null) avaliacoesSeries.massaMuscular.push({ date: eventDateISO, value: parseFloat(aval.massaMuscular) });
                    if (aval.metabolismoBasal != null) avaliacoesSeries.metabolismoBasal.push({ date: eventDateISO, value: parseInt(aval.metabolismoBasal) });
                    if (aval.h2o != null) avaliacoesSeries.h2o.push({ date: eventDateISO, value: parseFloat(aval.h2o) });
                    if (aval.gorduraVisceral != null) avaliacoesSeries.gorduraVisceral.push({ date: eventDateISO, value: parseInt(aval.gorduraVisceral) });
                }
                if (planoEncontradoNaPlanilha.exercicios && Array.isArray(planoEncontradoNaPlanilha.exercicios)) {
                    planoEncontradoNaPlanilha.exercicios.forEach(ex => {
                        if (ex.type === 'exercise') {
                            if (ex.grupoMuscular) { muscleGroupCounts[ex.grupoMuscular] = (muscleGroupCounts[ex.grupoMuscular] || 0) + 1; }
                            if (ex.objetivo) { objectiveCounts[ex.objetivo] = (objectiveCounts[ex.objetivo] || 0) + 1; }
                            const exName = ex.exerciseName || ex.exercicio;
                            const exMuscleGroup = ex.grupoMuscular || "Desconhecido";
                            if (exName && ex.seriesData && ex.seriesData.length > 0) {
                                let totalWeight = 0; let countWeights = 0; let commonUnit = null;
                                ex.seriesData.forEach(sd => {
                                    if (sd.peso && !isNaN(parseFloat(sd.peso))) {
                                        totalWeight += parseFloat(sd.peso); countWeights++;
                                        if (!commonUnit && sd.pesoUnit) commonUnit = sd.pesoUnit;
                                    }
                                });
                                if (countWeights > 0) {
                                    const avgWeight = totalWeight / countWeights;
                                    if (!exerciseWeightProgressByGroup[exMuscleGroup]) exerciseWeightProgressByGroup[exMuscleGroup] = {};
                                    if (!exerciseWeightProgressByGroup[exMuscleGroup][exName]) exerciseWeightProgressByGroup[exMuscleGroup][exName] = { progressData: [] };
                                    const existingEntry = exerciseWeightProgressByGroup[exMuscleGroup][exName].progressData.find(e => e.date === eventDateISO);
                                    if (!existingEntry) {
                                        exerciseWeightProgressByGroup[exMuscleGroup][exName].progressData.push({ date: eventDateISO, weight: parseFloat(avgWeight.toFixed(2)), unit: commonUnit || 'kg' });
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
        for (const key in avaliacoesSeries) { avaliacoesSeries[key].sort((a, b) => new Date(a.date) - new Date(b.date)); }
        planosDetalhes.sort((a,b) => parseDate(a.data, "00:00", spreadsheetTimezone).getTime() - parseDate(b.data, "00:00", spreadsheetTimezone).getTime());
        for (const group in exerciseWeightProgressByGroup) {
            for (const exName in exerciseWeightProgressByGroup[group]) {
                exerciseWeightProgressByGroup[group][exName].progressData.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
        }

        const noEvalData = Object.values(avaliacoesSeries).every(arr => arr.length === 0);
        const noMuscleData = Object.keys(muscleGroupCounts).length === 0;
        const noObjectiveData = Object.keys(objectiveCounts).length === 0;
        const noWeightProgressData = Object.keys(exerciseWeightProgressByGroup).length === 0;

        if (planosDetalhes.length === 0 && noEvalData && noMuscleData && noObjectiveData && noWeightProgressData) {
            return { ...defaultReturn, clienteNome: clienteNomeDisplay, periodo: { inicio: dataInicioStr || "Início", fim: dataFimStr || "Fim" } };
        }
        return {
            clienteNome: clienteNomeDisplay,
            periodo: { inicio: Utilities.formatDate(primeiroDiaDoPeriodo, spreadsheetTimezone, "dd/MM/yyyy"), fim: Utilities.formatDate(ultimoDiaDoPeriodo, spreadsheetTimezone, "dd/MM/yyyy") },
            planosDetalhes: planosDetalhes,
            avaliacoesSeries: avaliacoesSeries,
            workoutAnalysis: { muscleGroupUsage: muscleGroupCounts, objectiveUsage: objectiveCounts, exerciseWeightProgress: exerciseWeightProgressByGroup },
            erro: null,
            mensagem: "Estatísticas carregadas."
        };
    } catch (e) {
        Logger.log(`[getEstatisticasCliente] Erro Crítico: ${e.message}\n${e.stack}`);
        return { ...defaultReturn, erro: 'Erro interno ao buscar estatísticas.', mensagem: e.message };
    }
}

function getClientSuggestions(inputText, corFiltro, ptFiltro) {
    if (!inputText || inputText.trim().length < 2) return [];
    const startTime = Date.now();
    const inputTextLower = inputText.trim().toLowerCase();
    let suggestions = new Set();
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetPlanos = ss.getSheetByName(SHEET_NAME_PLANOS);
        if (!sheetPlanos) return [];

        // Otimização: Ler apenas as colunas necessárias se a planilha for muito larga.
        // Por agora, mantemos a leitura de todas as colunas pois a lógica de _getClienteNomeBaseFromTitle
        // e filtros de PT/Cor podem depender de dados em várias colunas ou do título completo.
        const data = sheetPlanos.getDataRange().getValues();
        if (data.length < 2) return [];

        const headers = data[0].map(h => String(h).trim());
        const clienteCol = headers.indexOf("Cliente");
        const corCol = headers.indexOf("Cor");
        if (clienteCol === -1) return [];

        let processedCount = 0;
        const MAX_ROWS_TO_SCAN_FOR_SUGGESTIONS = 2000; // Limite para performance

        for (let i = data.length - 1; i >= 1 && processedCount < MAX_ROWS_TO_SCAN_FOR_SUGGESTIONS; i--) {
            const row = data[i];
            const clienteNomeOriginal = row[clienteCol];
            if (clienteNomeOriginal && typeof clienteNomeOriginal === 'string') {
                const clienteNomeBase = _getClienteNomeBaseFromTitle(clienteNomeOriginal, PT_KEYWORDS);
                if (clienteNomeBase.toLowerCase().includes(inputTextLower)) {
                    let matchCor = true;
                    if (corFiltro && corFiltro !== "") {
                        const eventoCor = (corCol !== -1 && row[corCol]) ? String(row[corCol]) : null;
                        matchCor = (eventoCor === corFiltro);
                    }
                    let matchPt = true;
                    if (ptFiltro && ptFiltro !== "" && ptFiltro !== "todos") {
                        const tituloLower = clienteNomeOriginal.toLowerCase(); // Usa o nome original para filtro PT
                        const foundPtKeyword = PT_KEYWORDS.find(p => tituloLower.includes(p.toLowerCase()));
                        matchPt = (foundPtKeyword && foundPtKeyword.toLowerCase() === ptFiltro.toLowerCase());
                    }
                    if (matchCor && matchPt) {
                        suggestions.add(clienteNomeBase);
                    }
                }
            }
            processedCount++;
        }
        Logger.log(`[getClientSuggestions] Planilha. Tempo: ${Date.now() - startTime}ms. Sugestões: ${suggestions.size}`);
        return Array.from(suggestions).sort((a,b) => a.localeCompare(b)).slice(0, 10); // Limita a 10 sugestões
    } catch (e) {
        Logger.log(`Erro em getClientSuggestions: ${e.toString()}`);
        return [];
    }
}



const config = require('../config');
const dateUtils = require('../utils/dateUtils');
const googleCalendarAPI = require('../services/googleCalendarAPI');
const { dbAll } = require('../services/database'); // Import dbAll for SQLite access
// const cacheService = require('../services/cacheService'); // If caching results

const mesesDescMap = {"jan":0,"fev":1,"mar":2,"abr":3,"mai":4,"jun":5,"jul":6,"ago":7,"set":8,"out":9,"nov":10,"dez":11,"janeiro":0,"fevereiro":1,"março":2,"marco":2,"abril":3,"maio":4,"junho":5,"julho":6,"agosto":7,"setembro":8,"outubro":9,"novembro":10,"dezembro":11};


async function calcularMetricasHandler(request, reply) {
    const { filtroNomeEvento, dataInicioStr, dataFimStr, personalTrainer, corEventoFiltro } = request.query;
    const defaultReturn = { totalHoras: 0, nivel: 0, totalEventos: 0, eventosConcluidos: 0, detalhesNivel: [], dadosClientePorRef: {}, erro: null, mensagem: null };
    const startTime = Date.now();
    console.log(`[calcularMetricasDB] Iniciando. Filtros: Nome=${filtroNomeEvento}, Início=${dataInicioStr}, Fim=${dataFimStr}, PT=${personalTrainer}, Cor=${corEventoFiltro}`);

    try {
        const { primeiroDiaDoPeriodo: pFiltroOriginal, ultimoDiaDoPeriodo: uFiltroOriginal, ano: anoFiltroOriginal, mesInicialNum: mesInicialFiltroOriginal, mesFinalNum: mesFinalFiltroOriginal, error: dateError } = dateUtils.calcularPeriodoFiltro(dataInicioStr, dataFimStr);
        if (dateError) {
            reply.status(400).send({ ...defaultReturn, erro: "Data inválida.", mensagem: dateError });
            return;
        }
        console.log(`[calcularMetricasDB] Período calculado: ${pFiltroOriginal.toISOString()} a ${uFiltroOriginal.toISOString()}`);
        
        // Instead of spreadsheetTimezone, assume dates from DB are consistently formatted (e.g., YYYY-MM-DD)
        // and use a consistent timezone for operations if needed (e.g. 'Europe/Lisbon' or UTC)
        const operatingTimezone = 'Europe/Lisbon'; // Or config.OPERATING_TIMEZONE

        let planosMap = new Map();
        // Fetch relevant plan data from SQLite for the broad date range
        // This query needs to be adapted based on how broadly you need plan info for metrics.
        // For instance, if mRef and status are crucial for all events in a wider range than the strict filter.
        const planRowsFromDb = await dbAll(
            "SELECT eventId, data, mRef, status FROM Planos WHERE data >= ? AND data <= ?", 
            [
                dateUtils.formatarDataValor(dateUtils.subMonths(pFiltroOriginal, 2), null, "YYYY-MM-DD"), // Example: 2 months before 
                dateUtils.formatarDataValor(dateUtils.addMonths(uFiltroOriginal, 2), null, "YYYY-MM-DD")  // Example: 2 months after
            ]
        );
        
        planRowsFromDb.forEach(row => {
            // DB stores date as YYYY-MM-DD, formatarDataValor here should convert it to dd/MM/yyyy for the key if needed
            // Or, more robustly, use YYYY-MM-DD directly for keys if eventId is globally unique.
            // Assuming eventId is from calendar, which is unique.
            const dataFormatadaForKey = dateUtils.formatarDataValor(row.data); // to dd/MM/yyyy for map key consistency
            if (row.eventId && dataFormatadaForKey) {
                 planosMap.set(`${row.eventId}_${dataFormatadaForKey}`, {
                    mRef: row.mRef || '',
                    status: row.status || ''
                });
            }
        });
        console.log(`[calcularMetricasDB] Planos do DB mapeados: ${planosMap.size} entradas.`);

        const eventosNivelProcessados = new Set();
        let totalHoras = 0, nivel = 0, totalEventos = 0, eventosConcluidos = 0;
        const detalhesNivel = [];
        const dadosClientePorRef = {};
        const filtroLower = filtroNomeEvento ? filtroNomeEvento.toLowerCase() : null;
        const ptLower = personalTrainer && personalTrainer !== "" ? personalTrainer.toLowerCase() : null;
        
        const mesRegex = new RegExp(`(?:\\d+(?:\\.\\d+)?pr|\\d+xp|\\d+x(?!p))\\s+(${Object.keys(mesesDescMap).join('|')})(?:\\s+(\\d{4}|\\d{2}))?\\b`, "i");

        const dataInicioBuscaAmpliada = new Date(Date.UTC(pFiltroOriginal.getUTCFullYear(), pFiltroOriginal.getUTCMonth() - 1, 1));
        const ultimoDiaMesSeguinte = new Date(Date.UTC(uFiltroOriginal.getUTCFullYear(), uFiltroOriginal.getUTCMonth() + 2, 0));
        const dataFimBuscaAmpliada = new Date(Date.UTC(ultimoDiaMesSeguinte.getUTCFullYear(), ultimoDiaMesSeguinte.getUTCMonth(), ultimoDiaMesSeguinte.getUTCDate(), 23, 59, 59, 999));

        const eventosCalendar = await googleCalendarAPI.getCalendarEvents(
            config.CALENDAR_ID, 
            dataInicioBuscaAmpliada.toISOString(), 
            dataFimBuscaAmpliada.toISOString()
        );
        console.log(`[calcularMetricasDB] Eventos do calendário (busca ampliada): ${eventosCalendar.length}`);

        const filtroFimMesUTC = uFiltroOriginal.getUTCMonth();
        const filtroFimAnoUTC = uFiltroOriginal.getUTCFullYear();

        for (const evento of eventosCalendar) {
            try {
                const dataIniEv = new Date(evento.start.dateTime || evento.start.date); 
                const dataFimEv = new Date(evento.end.dateTime || evento.end.date);
                const tituloOriginal = evento.summary || '';
                const descricaoEvento = (evento.description || '').toLowerCase();

                if (!dataIniEv || !dateUtils.isValid(dataIniEv) || !dataFimEv || !dateUtils.isValid(dataFimEv) || !tituloOriginal) continue;
                
                const eventoFiltradoParaMetricasGerais = (() => {
                    const tituloLower = tituloOriginal.toLowerCase();
                    const eventoCor = evento.colorId ? String(evento.colorId) : null; 
                    if (filtroLower && !tituloLower.includes(filtroLower)) return false;
                    if (corEventoFiltro && corEventoFiltro !== "" && eventoCor !== corEventoFiltro) return false;
                    if (ptLower && ptLower !== "todos" && ptLower !== "") {
                        const foundPtKeyword = config.PT_KEYWORDS.find(p => tituloLower.includes(p.toLowerCase()));
                        if (!foundPtKeyword || foundPtKeyword.toLowerCase() !== ptLower) return false;
                    }
                    return true;
                })();

                const evMesOriginal = dataIniEv.getUTCMonth();
                const evAnoOriginal = dataIniEv.getUTCFullYear();
                const evDayOriginal = dataIniEv.getUTCDate();

                if (dataIniEv.getTime() >= pFiltroOriginal.getTime() && dataIniEv.getTime() <= uFiltroOriginal.getTime()) {
                    if (eventoFiltradoParaMetricasGerais) {
                        totalEventos++;
                        const durMins = Math.round(dateUtils.differenceInMilliseconds(dataFimEv, dataIniEv) / 60000);
                        if (durMins >= 15) totalHoras += durMins / 60;

                        let clienteNomeBase = dateUtils._getClienteNomeBaseFromTitle(tituloOriginal, config.PT_KEYWORDS);
                        const dataFormatadaEventoKey = dateUtils.formatarDataValor(dataIniEv); // dd/MM/yyyy for map key
                        const planoInfo = planosMap.get(`${evento.id}_${dataFormatadaEventoKey}`);
                        let mRefValor = (planoInfo && planoInfo.mRef) ? String(planoInfo.mRef).trim() : "N/A";

                        let incluirNosDadosClienteEsteEvento = true;
                        if (mRefValor && mRefValor !== "N/A") {
                            const mRefDateParts = dateUtils.parseMRefToDateParts(mRefValor, dataIniEv.getUTCFullYear(), mesesDescMap);
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
                    if (anoFiltroOriginal === uFiltroOriginal.getUTCFullYear()) { 
                         isInNivelPeriod = (mesAlvoNivel >= mesInicialFiltroOriginal && mesAlvoNivel <= mesFinalFiltroOriginal);
                    } else { 
                         isInNivelPeriod = (mesAlvoNivel >= mesInicialFiltroOriginal && mesAlvoNivel <= 11);
                    }
                } else if (anoAlvoNivel > anoFiltroOriginal && anoAlvoNivel < uFiltroOriginal.getUTCFullYear()) { 
                    isInNivelPeriod = true;
                } else if (anoAlvoNivel === uFiltroOriginal.getUTCFullYear() && anoFiltroOriginal < uFiltroOriginal.getUTCFullYear()) { 
                    isInNivelPeriod = (mesAlvoNivel >= 0 && mesAlvoNivel <= mesFinalFiltroOriginal);
                }

                if (eventoFiltradoParaMetricasGerais && isInNivelPeriod) {
                    const chaveNivelUnica = `${tituloOriginal.trim().toLowerCase()}_${anoAlvoNivel}-${mesAlvoNivel}`;
                    if (!eventosNivelProcessados.has(chaveNivelUnica)) {
                        let valorContribuidoNivel = 0; let regraAplicada = null;
                        const durMinsEvento = Math.round(dateUtils.differenceInMilliseconds(dataFimEv, dataIniEv) / 60000);
                        const prMatch = descricaoEvento.match(/(\\d+(?:\\.\\d+)?)pr/);
                        if (prMatch && prMatch[1]) { const prValue = parseFloat(prMatch[1]); if (!isNaN(prValue)) { valorContribuidoNivel = prValue; regraAplicada = "PR"; } }
                        if (!regraAplicada) { const xpMatch = descricaoEvento.match(/(\\d+)xp/); if (xpMatch && xpMatch[1]) { const xpNum = parseInt(xpMatch[1], 10); if (xpNum === 1) valorContribuidoNivel = 5; else if (xpNum === 2) valorContribuidoNivel = 10; if (valorContribuidoNivel > 0) regraAplicada = (xpNum === 1 ? "1XP" : "2XP"); } }
                        if (!regraAplicada) { const freqMatch = descricaoEvento.match(/(\\d+)x(?!p)/); const freq = freqMatch ? parseInt(freqMatch[1], 10) : 0; if (freq > 0 && [30, 45, 60].includes(durMinsEvento)) { let vH = 0; const cat = tituloOriginal.toLowerCase(); const catType = cat.includes("duo") ? "duo" : cat.includes("pro") ? "pro" : cat.includes("fisio") ? "fisio" : cat.includes("nutri") ? "nutri" : "outros"; if (catType !== "outros") { if (durMinsEvento === 30) vH = 2.17; else if (durMinsEvento === 45) vH = 3.25; else if (durMinsEvento === 60) vH = (catType === "duo" ? 4.34 : 4.33); } if (vH > 0) { valorContribuidoNivel = parseFloat((vH * freq).toFixed(2)); regraAplicada = "FREQ_DUR"; } } }

                        let tipoPagamento = "Outro";
                        if (descricaoEvento.match(/\\b\\d+(?:\\.\\d+)?pr\\b/i)) tipoPagamento = "PRO-RATA";
                        else if (descricaoEvento.match(/\\b\\d+xp\\b/i)) tipoPagamento = "PACK";
                        else if (descricaoEvento.match(/\\b\\d+xc\\b/i)) tipoPagamento = "CS";
                        else if (descricaoEvento.match(/\\b\\d+x(?![pc])\\b/i)) tipoPagamento = "DD";

                        if (valorContribuidoNivel > 0) {
                            nivel += valorContribuidoNivel;
                            eventosNivelProcessados.add(chaveNivelUnica);
                            detalhesNivel.push({ titulo: tituloOriginal.trim(), valor: valorContribuidoNivel, mesAlocado: `${mesAlvoNivel + 1}/${anoAlvoNivel}`, regra: regraAplicada, dataOriginalEvt: `${evDayOriginal}/${evMesOriginal + 1}/${evAnoOriginal}`, tipoPagamento: tipoPagamento });
                        }
                    }
                }

            } catch (e) {
                console.error(`[calcularMetricasDB] Erro processando evento ${evento?.id} (${evento?.summary}): ${e.message}\n${e.stack}`);
            }
        }
        
        // MRef logic for previous events would also need translation, fetching from DB and Calendar

        detalhesNivel.sort((a, b) => {
            const [mA, yA] = a.mesAlocado.split('/').map(Number);
            const [mB, yB] = b.mesAlocado.split('/').map(Number);
            if (yA !== yB) return yA - yB;
            if (mA !== mB) return mA - mB;
            return a.titulo.localeCompare(b.titulo);
        });

        console.log(`[calcularMetricasDB] Tempo de execução: ${Date.now() - startTime}ms.`);
        reply.send({ 
            totalHoras: parseFloat(totalHoras.toFixed(2)), 
            nivel: parseFloat(nivel.toFixed(2)), 
            totalEventos, 
            eventosConcluidos, 
            detalhesNivel, 
            dadosClientePorRef, 
            erro: null, 
            mensagem: "Métricas calculadas." 
        });

    } catch (error) {
        console.error(`[calcularMetricasDB] Erro crítico: ${error.message}\n${error.stack}`);
        reply.status(500).send({ ...defaultReturn, erro: 'Erro interno ao calcular métricas.', mensagem: `Ocorreu um erro inesperado: ${error.message}` });
    }
}


module.exports = async function (fastify, options) {
  fastify.get('/', calcularMetricasHandler);
};

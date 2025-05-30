
const { parse, format, getYear, getMonth, getDate, getDaysInMonth, differenceInMilliseconds, addMonths, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, isValid, parseISO } = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');

const PT_KEYWORDS = require('../config').PT_KEYWORDS; // Assuming config.js is in parent directory

function calcularPeriodoFiltro(dataInicioStr, dataFimStr) {
    try {
        let primeiroDiaDoPeriodo, ultimoDiaDoPeriodo;
        let anoFiltro, mesInicialFiltro, mesFinalFiltro;
        let isSpecificDayFilter = false, diaFiltro = null;
        const today = new Date(); // Local timezone by default

        let anoIni, mesIni, diaIni, anoFim, mesFim, diaFim;

        if (!dataInicioStr || dataInicioStr.trim() === "") {
            anoIni = anoFim = getYear(today);
            mesIni = mesFim = getMonth(today); // 0-11
            diaIni = 1;
            diaFim = getDaysInMonth(today);
            isSpecificDayFilter = false;
        } else {
            const partesInicio = dataInicioStr.split('/');
            if (partesInicio.length !== 3) throw new Error("Formato data início inválido (dd/mm/yyyy).");
            diaIni = parseInt(partesInicio[0], 10);
            mesIni = parseInt(partesInicio[1], 10) - 1;
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

        // Use UTC for constructing dates to match Apps Script's Date.UTC behavior for consistency
        primeiroDiaDoPeriodo = new Date(Date.UTC(anoIni, mesIni, diaIni, 0, 0, 0, 0));
        ultimoDiaDoPeriodo = new Date(Date.UTC(anoFim, mesFim, diaFim, 23, 59, 59, 999));


        if (!isValid(primeiroDiaDoPeriodo) || !isValid(ultimoDiaDoPeriodo) || primeiroDiaDoPeriodo > ultimoDiaDoPeriodo) {
            throw new Error("Período de datas inválido ou inconsistente.");
        }
        anoFiltro = anoIni;
        mesInicialFiltro = mesIni;
        mesFinalFiltro = mesFim;

        return {
            primeiroDiaDoPeriodo,
            ultimoDiaDoPeriodo,
            ano: anoFiltro,
            mesInicialNum: mesInicialFiltro,
            mesFinalNum: mesFinalFiltro,
            isSpecificDayFilter,
            diaNum: diaFiltro,
            error: null
        };
    } catch (e) {
        console.error(`[calcularPeriodoFiltro] Erro: ${e.message}\n${e.stack}`);
        return { error: `Erro ao calcular período: ${e.message}` };
    }
}

function parseMRefToDateParts(mRefString, defaultAno, mesesDescMap) {
    if (!mRefString || typeof mRefString !== 'string') return null;
    const mRefClean = mRefString.trim().toLowerCase();
    if (mRefClean === "" || mRefClean === "n/a") return null;
    const parts = mRefClean.split(/[\\s\\/]+/);
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

function _getClienteNomeBaseFromTitle(tituloOriginal, ptKeywordsArray = PT_KEYWORDS) {
    let clienteNomeBase = String(tituloOriginal || '').trim();
    const padraoInfoExtra = /(\\s-\\s.*|\\s\\(.*CS\\)|\\[.*\\])/i;
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

function formatarDataValor(dataValue, timezone = 'Europe/Lisbon') {
    if (typeof dataValue === 'string') {
        // Check if it's already dd/MM/yyyy
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataValue)) return dataValue;
        // Try to parse from ISO or other common formats if necessary
        const parsedDate = parseISO(dataValue);
        if (isValid(parsedDate)) {
             const zonedDate = utcToZonedTime(parsedDate, timezone);
             return format(zonedDate, 'dd/MM/yyyy', { timeZone: timezone });
        }
    }
    if (dataValue instanceof Date && isValid(dataValue)) {
        const zonedDate = utcToZonedTime(dataValue, timezone); // Assuming input date might be UTC
        return format(zonedDate, 'dd/MM/yyyy', { timeZone: timezone });
    }
    // Handling for Excel-like date numbers (days since 1899-12-30)
    // This specific conversion logic might need adjustment based on exact source of number
    if (typeof dataValue === 'number' && dataValue > 0 && dataValue < 60000) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch starts at 1899-12-30
        const date = new Date(excelEpoch.getTime() + dataValue * 24 * 60 * 60 * 1000);
         if (isValid(date)) {
            const zonedDate = utcToZonedTime(date, timezone);
            return format(zonedDate, 'dd/MM/yyyy', { timeZone: timezone });
        }
    }
    return ''; // Return empty if formatting fails
}

function parseDateWithTime(dateString, timeString, timezone = 'Europe/Lisbon') {
    try {

        const dM = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        const tM = timeString ? String(timeString).match(/^(\d{2}):(\d{2})$/) : null;

        if (!dM) return null;

        const day = parseInt(dM[1], 10);
        const month = parseInt(dM[2], 10) - 1; // month is 0-indexed
        const year = parseInt(dM[3], 10);

        const hour = tM ? parseInt(tM[1], 10) : 0;
        const minute = tM ? parseInt(tM[2], 10) : 0;

        // Construct date in local time first, then convert to UTC if original logic implied it
        // Or, if timezone is specified, construct as if it's in that zone.
        // Utilities.parseDate in Apps Script uses the script's timezone.
        // For consistency, let's assume dateString and timeString are in the specified timezone.
        const dateInSpecifiedTimezone = new Date(year, month, day, hour, minute, 0);
        if (!isValid(dateInSpecifiedTimezone)) return null;

        // If you need this date object to represent a UTC timestamp that corresponds
        // to this wall-clock time in the target timezone:
        return zonedTimeToUtc(dateInSpecifiedTimezone, timezone);
        // If you just need a Date object that, when formatted *for that timezone*, shows this time:
        // return dateInSpecifiedTimezone;

    } catch (e) {
        console.error(`[parseDateWithTime] Erro: ${e.message}`);
        return null;
    }
}


module.exports = {
    calcularPeriodoFiltro,
    parseMRefToDateParts,
    _getClienteNomeBaseFromTitle,
    formatarDataValor,
    parseDateWithTime
};

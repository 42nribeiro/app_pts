
const config = require('../config');
const dateUtils = require('../utils/dateUtils');
const googleCalendarAPI = require('../services/googleCalendarAPI');
const { dbAll } = require('../services/database'); // Import dbAll for SQLite access


// Helper function to format plan data from a DB row (can be shared or adapted)
function formatPlanDataFromDbRowForStats(dbRow) {
    if (!dbRow) return null;
    let exercicios = [];
    try {
        exercicios = JSON.parse(dbRow.exercicios || '[]');
    } catch (e) { exercicios = [{ type: 'error', msg: 'bad exercises json' }]; }

    let avaliacao = null;
    try {
        if (dbRow.avaliacaoData) avaliacao = JSON.parse(dbRow.avaliacaoData);
    } catch (e) { avaliacao = { error: 'bad avaliacao json' }; }

    return {
        planUuid: dbRow.planUuid, eventId: dbRow.eventId,
        data: dateUtils.formatarDataValor(dbRow.data), // From YYYY-MM-DD to dd/MM/yyyy
        hora: dbRow.hora, duracao: dbRow.duracao, cliente: dbRow.cliente,
        status: dbRow.status, cor: dbRow.cor,
        exercicios, mRef: dbRow.mRef, avaliacao,
        clienteContagem: dbRow.sessao, clienteMes: dbRow.mes,
    };
}


async function getEstatisticasClienteHandler(request, reply) {
    const { filtroNomeEvento, dataInicioStr, dataFimStr, personalTrainer, corEventoFiltro } = request.query;
    const defaultReturn = { clienteNome: null, periodo: {}, planosDetalhes: [], avaliacoesSeries: {}, workoutAnalysis: { muscleGroupUsage: {}, objectiveUsage: {}, exerciseWeightProgress: {} }, erro: "Nenhum dado encontrado", mensagem: "Nenhum dado para os filtros." };

    if (!filtroNomeEvento) {
        reply.status(400).send({ ...defaultReturn, erro: "Nome do cliente é obrigatório para estatísticas.", mensagem: "Forneça o nome do cliente." });
        return;
    }
    console.log(`[getEstatisticasClienteDB] Iniciando. Cliente=${filtroNomeEvento}, Início=${dataInicioStr}, Fim=${dataFimStr}, PT=${personalTrainer}, Cor=${corEventoFiltro}`);

    try {
        const { primeiroDiaDoPeriodo, ultimoDiaDoPeriodo, error: dateError } = dateUtils.calcularPeriodoFiltro(dataInicioStr, dataFimStr);
        if (dateError) {
            reply.status(400).send({ ...defaultReturn, erro: "Data inválida.", mensagem: dateError });
            return;
        }
        
        // Fetch Planos data from SQLite for the specified client and date range
        // Note: Client name filtering in SQL can be tricky with _getClienteNomeBaseFromTitle logic.
        // A simpler approach is to fetch for the date range and then filter by client name in JS,
        // or store a 'baseClientName' in the DB if this logic is heavily used for querying.
        const startDateDb = dateUtils.formatarDataValor(primeiroDiaDoPeriodo, null, "YYYY-MM-DD");
        const endDateDb = dateUtils.formatarDataValor(ultimoDiaDoPeriodo, null, "YYYY-MM-DD");
        
        // This query might need to be broader if _getClienteNomeBaseFromTitle cannot be easily translated to SQL
        let query = "SELECT * FROM Planos WHERE data >= ? AND data <= ?";
        const queryParams = [startDateDb, endDateDb];

        // Add client name filtering if possible, otherwise filter after fetching
        // For now, we fetch broadly by date and filter client name in JS
        // query += " AND cliente LIKE ?"; 
        // queryParams.push(`%${filtroNomeEvento}%`); // This is a simple LIKE, might not match _getClienteNomeBaseFromTitle

        const planosFromDb = await dbAll(query, queryParams);

        const planosDetalhes = [];
        const avaliacoesSeries = { peso: [], massaGorda: [], massaMuscular: [], metabolismoBasal: [], h2o: [], gorduraVisceral: [] };
        const muscleGroupCounts = {};
        const objectiveCounts = {};
        const exerciseWeightProgressByGroup = {};
        let clienteNomeDisplay = filtroNomeEvento; 
        const filtroLower = filtroNomeEvento.toLowerCase();
        // const ptLower = personalTrainer && personalTrainer !== "" ? personalTrainer.toLowerCase() : null; // For PT filtering

        for (const dbRow of planosFromDb) {
            const planoFormatado = formatPlanDataFromDbRowForStats(dbRow);
            if (!planoFormatado) continue;

            const clienteBase = dateUtils._getClienteNomeBaseFromTitle(planoFormatado.cliente, config.PT_KEYWORDS);
            if (!clienteBase.toLowerCase().includes(filtroLower)) { // Apply client name filter
                continue;
            }
            // Apply PT and Color filters here if they are stored in the plan or can be derived
            // e.g. if (corEventoFiltro && planoFormatado.cor !== corEventoFiltro) continue;
            //      if (ptLower && !isTrainerForPlan(planoFormatado.cliente, ptLower)) continue;


            clienteNomeDisplay = clienteBase; // Update display name if a match is found

            planosDetalhes.push({ 
                data: planoFormatado.data, // dd/MM/yyyy from formatPlanData...
                exercicios: planoFormatado.exercicios || [], 
                avaliacao: planoFormatado.avaliacao 
            });
            
            const eventDateISO = planoFormatado.data.split('/').reverse().join('-'); // Convert dd/MM/yyyy to yyyy-MM-dd

            if (planoFormatado.avaliacao && typeof planoFormatado.avaliacao === 'object' && !planoFormatado.avaliacao.error) {
                const aval = planoFormatado.avaliacao;
                if (aval.peso != null) avaliacoesSeries.peso.push({ date: eventDateISO, value: parseFloat(String(aval.peso)) });
                if (aval.massaGorda != null) avaliacoesSeries.massaGorda.push({ date: eventDateISO, value: parseFloat(String(aval.massaGorda)) });
                if (aval.massaMuscular != null) avaliacoesSeries.massaMuscular.push({ date: eventDateISO, value: parseFloat(String(aval.massaMuscular)) });
                if (aval.metabolismoBasal != null) avaliacoesSeries.metabolismoBasal.push({ date: eventDateISO, value: parseInt(String(aval.metabolismoBasal)) });
                if (aval.h2o != null) avaliacoesSeries.h2o.push({ date: eventDateISO, value: parseFloat(String(aval.h2o)) });
                if (aval.gorduraVisceral != null) avaliacoesSeries.gorduraVisceral.push({ date: eventDateISO, value: parseInt(String(aval.gorduraVisceral)) });
            }
            if (planoFormatado.exercicios && Array.isArray(planoFormatado.exercicios)) {
                planoFormatado.exercicios.forEach(ex => {
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
                                if (!existingEntry) { // Only add if no entry for this date yet (avg for the day)
                                    exerciseWeightProgressByGroup[exMuscleGroup][exName].progressData.push({ date: eventDateISO, weight: parseFloat(avgWeight.toFixed(2)), unit: commonUnit || 'kg' });
                                }
                            }
                        }
                    }
                });
            }
        }
        
        for (const key in avaliacoesSeries) { avaliacoesSeries[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); }
        planosDetalhes.sort((a,b) => new Date(a.data.split('/').reverse().join('-')).getTime() - new Date(b.data.split('/').reverse().join('-')).getTime());
        for (const group in exerciseWeightProgressByGroup) {
            for (const exName in exerciseWeightProgressByGroup[group]) {
                exerciseWeightProgressByGroup[group][exName].progressData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            }
        }
        
        const noEvalData = Object.values(avaliacoesSeries).every(arr => arr.length === 0);
        const noMuscleData = Object.keys(muscleGroupCounts).length === 0;
        // ... add checks for other data points

        if (planosDetalhes.length === 0 && noEvalData && noMuscleData /* && other checks */) {
             reply.send({ ...defaultReturn, clienteNome: clienteNomeDisplay, periodo: { inicio: dataInicioStr || "Início", fim: dataFimStr || "Fim" } });
             return;
        }

        reply.send({
            clienteNome: clienteNomeDisplay,
            periodo: { inicio: dateUtils.formatarDataValor(primeiroDiaDoPeriodo), fim: dateUtils.formatarDataValor(ultimoDiaDoPeriodo) },
            planosDetalhes,
            avaliacoesSeries,
            workoutAnalysis: { muscleGroupUsage: muscleGroupCounts, objectiveUsage: objectiveCounts, exerciseWeightProgress: exerciseWeightProgressByGroup },
            erro: null,
            mensagem: "Estatísticas carregadas."
        });

    } catch (e) {
        console.error(`[getEstatisticasClienteDB] Erro Crítico: ${e.message}\n${e.stack}`);
        reply.status(500).send({ ...defaultReturn, erro: 'Erro interno ao buscar estatísticas.', mensagem: e.message });
    }
}


module.exports = async function (fastify, options) {
  fastify.get('/cliente', getEstatisticasClienteHandler);
};

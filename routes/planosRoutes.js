
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const dateUtils = require('../utils/dateUtils');
const googleCalendarAPI = require('../services/googleCalendarAPI');
const { dbRun, dbGet, dbAll } = require('../services/database');
const cacheService = require('../services/cacheService');
const lockService = require('../services/lockService'); // Simple in-memory lock

// This function is less critical if data is well-structured in DB,
// but might be used for client-side display object construction.
function formatPlanDataFromDbRow(dbRow) {
    if (!dbRow) return null;
    let exercicios = [];
    try {
        exercicios = JSON.parse(dbRow.exercicios || '[]');
    } catch (e) { 
        console.error("Error parsing exercises JSON from DB:", e, dbRow.exercicios);
        exercicios = [{ type: 'error', msg: 'Dados de exercícios inválidos no DB.' }]; 
    }

    let avaliacao = null;
    try {
        if (dbRow.avaliacaoData) {
            avaliacao = JSON.parse(dbRow.avaliacaoData);
        }
    } catch (e) {
        console.error("Error parsing avaliacaoData JSON from DB:", e, dbRow.avaliacaoData);
        avaliacao = { error: 'Dados de avaliação inválidos no DB.' };
    }
    
    return {
        planUuid: dbRow.planUuid,
        eventId: dbRow.eventId,
        cliente: dbRow.cliente,
        data: dateUtils.formatarDataValor(dbRow.data), // Assuming dbRow.data is YYYY-MM-DD
        hora: dbRow.hora,
        duracao: dbRow.duracao,
        status: dbRow.status,
        cor: dbRow.cor,
        exercicios: exercicios,
        mRef: dbRow.mRef,
        avaliacao: avaliacao,
        clienteContagem: dbRow.sessao, 
        clienteMes: dbRow.mes, 
    };
}


async function getPlanosHandler(request, reply) {
    const { filtroNomeEvento, dataInicioStr, dataFimStr, personalTrainer, corEventoFiltro } = request.query;
    const defaultReturn = { planos: [], masterExercises: {}, erro: null, mensagem: null };
    const startTime = Date.now();
    console.log(`[getPlanosDB] Iniciando. Filtros: Nome=${filtroNomeEvento}, Início=${dataInicioStr}, Fim=${dataFimStr}, PT=${personalTrainer}, Cor=${corEventoFiltro}`);

    const lockKey = 'getPlanosLock';
    if (!lockService.tryLock(lockKey, 30000)) {
        reply.status(503).send({ ...defaultReturn, erro: "Serviço ocupado.", mensagem: "O servidor está processando outra solicitação." });
        return;
    }

    try {
        // Fetch master exercises (replace with DB call if master exercises are also in DB)
        const masterExercisesData = await dbAll("SELECT groupName, exerciseName FROM MasterExercises ORDER BY groupName, exerciseName");
        const formattedMasterExercises = masterExercisesData.reduce((acc, item) => {
            if (!acc[item.groupName]) acc[item.groupName] = [];
            acc[item.groupName].push(item.exerciseName);
            return acc;
        }, {});


        const { primeiroDiaDoPeriodo, ultimoDiaDoPeriodo, error: dateError } = dateUtils.calcularPeriodoFiltro(dataInicioStr, dataFimStr);
        if (dateError) {
            reply.status(400).send({ ...defaultReturn, masterExercises: formattedMasterExercises, erro: "Data inválida.", mensagem: dateError });
            return;
        }
        
        const eventosCalendar = await googleCalendarAPI.getCalendarEvents(
            config.CALENDAR_ID, 
            primeiroDiaDoPeriodo.toISOString(), 
            ultimoDiaDoPeriodo.toISOString()
        );
        console.log(`[getPlanosDB] Eventos do calendário no período: ${eventosCalendar.length}`);

        const planosParaRetorno = [];
        const currentEventSyncKeys = new Set();

        for (const evento of eventosCalendar) {
            const eventId = evento.id;
            const dataIni = new Date(evento.start.dateTime || evento.start.date);
            const dataFim = new Date(evento.end.dateTime || evento.end.date);
            const titulo = evento.summary || '';
            const dataFormatada = dateUtils.formatarDataValor(dataIni); // YYYY-MM-DD for DB
            const horaFormatada = dateUtils.formatarDataValor(dataIni, null, "HH:mm") // Assuming formatarDataValor can format time too

            const syncKey = `${eventId}_${dataFormatada}`;
            currentEventSyncKeys.add(syncKey);

            // Check if event is archived in Contas
            const archivedPlan = await dbGet("SELECT 1 FROM Contas WHERE eventId = ? AND data = ?", [eventId, dataFormatada]);
            if (archivedPlan) continue; // Skip if archived

            let planFromDb = await dbGet("SELECT * FROM Planos WHERE eventId = ? AND data = ?", [eventId, dataFormatada]);

            if (planFromDb) {
                // Update if necessary (e.g., title, color from calendar)
                let needsUpdate = false;
                if (planFromDb.cliente !== titulo) { planFromDb.cliente = titulo; needsUpdate = true; }
                // Add more update checks here (color, time, duration)
                if(needsUpdate){
                    await dbRun("UPDATE Planos SET cliente = ? WHERE planUuid = ?", [planFromDb.cliente, planFromDb.planUuid]);
                }
            } else {
                // Create new plan
                const newPlanUuid = uuidv4();
                const newPlan = {
                    planUuid: newPlanUuid, eventId: eventId, cliente: titulo,
                    data: dataFormatada, hora: horaFormatada, // Needs proper time formatting
                    duracao: `${Math.round(dateUtils.differenceInMilliseconds(dataFim, dataIni) / 60000)} min`,
                    exercicios: '[]', status: 'Edit', cor: evento.colorId || '', // Map colorId if needed
                    sessao: '', mes: '', mRef: '', avaliacaoData: null
                };
                await dbRun(
                    `INSERT INTO Planos (planUuid, eventId, cliente, data, hora, duracao, exercicios, status, cor, sessao, mes, mRef, avaliacaoData)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newPlan.planUuid, newPlan.eventId, newPlan.cliente, newPlan.data, newPlan.hora, newPlan.duracao, 
                     newPlan.exercicios, newPlan.status, newPlan.cor, newPlan.sessao, newPlan.mes, newPlan.mRef, newPlan.avaliacaoData]
                );
                planFromDb = newPlan; // Use the newly created object
            }
            planosParaRetorno.push(formatPlanDataFromDbRow(planFromDb));
        }
        
        // Optional: Clean up plans in DB that are no longer in the calendar for this period (if desired)
        // This would involve querying all plans in the date range from DB and removing those not in currentEventSyncKeys.
        // This is a complex step and depends on desired data retention policy.

        // Apply filters from request.query via SQL WHERE clauses if possible, or filter planosParaRetorno array
        let filteredResults = planosParaRetorno;
        if (filtroNomeEvento) {
            filteredResults = filteredResults.filter(p => p.cliente && p.cliente.toLowerCase().includes(filtroNomeEvento.toLowerCase()));
        }
        if (corEventoFiltro) {
             filteredResults = filteredResults.filter(p => p.cor === corEventoFiltro);
        }
        if (personalTrainer) {
             // Assuming PT info is part of the client name or a dedicated field
             filteredResults = filteredResults.filter(p => p.cliente && config.PT_KEYWORDS.some(kw => kw.toLowerCase() === personalTrainer.toLowerCase() && p.cliente.toLowerCase().includes(kw.toLowerCase())));
        }


        // Sort for client-side display
        // This assumes date is YYYY-MM-DD and hora is HH:MM
        filteredResults.sort((a, b) => {
            const dateTimeA = new Date(`${a.data}T${a.hora || '00:00'}:00`);
            const dateTimeB = new Date(`${b.data}T${b.hora || '00:00'}:00`);
            if (dateTimeA.getTime() !== dateTimeB.getTime()) {
                return dateTimeA.getTime() - dateTimeB.getTime();
            }
            return (a.cliente && b.cliente) ? a.cliente.localeCompare(b.cliente) : 0;
        });

        console.log(`[getPlanosDB] Tempo total: ${Date.now() - startTime}ms. Planos retornados: ${filteredResults.length}`);
        reply.send({ planos: filteredResults, masterExercises: formattedMasterExercises, erro: null, mensagem: `Filtro aplicado. ${filteredResults.length} planos encontrados.` });

    } catch (error) {
        console.error(`[getPlanosDB] Erro Crítico: ${error.message}\n${error.stack}`);
        reply.status(500).send({ ...defaultReturn, masterExercises: {}, erro: 'Erro interno ao buscar planos.', mensagem: `Ocorreu um erro inesperado: ${error.message}` });
    } finally {
        lockService.releaseLock(lockKey);
    }
}

async function savePlanoHandler(request, reply) {
    const { plano, status } = request.body; 

    if (!plano?.planUuid || !plano?.cliente || !plano?.data || !status || typeof plano.data !== 'string' /* Add more validation for data format */) {
        reply.status(400).send({ sucesso: false, erro: "Dados do plano inválidos.", mensagem: "Verifique os dados do plano antes de salvar." });
        return;
    }

    const lockKey = `savePlano_${plano.planUuid}`;
    if (!lockService.tryLock(lockKey, 15000)) {
        reply.status(503).send({ sucesso: false, erro: "Serviço ocupado", mensagem: "O servidor está processando outra solicitação para este plano." });
        return;
    }
    
    try {
        const planDataForDb = {
            planUuid: plano.planUuid,
            eventId: plano.eventId || null,
            cliente: plano.cliente,
            data: dateUtils.formatarDataValor(plano.data, null, "YYYY-MM-DD"), // Ensure YYYY-MM-DD for DB
            hora: plano.hora || null,
            duracao: plano.duracao || null,
            exercicios: JSON.stringify(Array.isArray(plano.exercicios) ? plano.exercicios : []),
            status: status,
            cor: plano.cor || null,
            sessao: plano.clienteContagem || null, // Map from client object
            mes: plano.clienteMes || null,       // Map from client object
            mRef: plano.mRef || null,
            avaliacaoData: (plano.avaliacao && Object.keys(plano.avaliacao).length > 0) ? JSON.stringify(plano.avaliacao) : null,
        };

        const existingPlan = await dbGet("SELECT planUuid FROM Planos WHERE planUuid = ?", [plano.planUuid]);

        if (existingPlan) {
            await dbRun(
                `UPDATE Planos SET eventId = ?, cliente = ?, data = ?, hora = ?, duracao = ?, exercicios = ?, status = ?, 
                 cor = ?, sessao = ?, mes = ?, mRef = ?, avaliacaoData = ? WHERE planUuid = ?`,
                [planDataForDb.eventId, planDataForDb.cliente, planDataForDb.data, planDataForDb.hora, planDataForDb.duracao,
                 planDataForDb.exercicios, planDataForDb.status, planDataForDb.cor, planDataForDb.sessao, planDataForDb.mes,
                 planDataForDb.mRef, planDataForDb.avaliacaoData, planDataForDb.planUuid]
            );
        } else {
            await dbRun(
                `INSERT INTO Planos (planUuid, eventId, cliente, data, hora, duracao, exercicios, status, cor, sessao, mes, mRef, avaliacaoData)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [planDataForDb.planUuid, planDataForDb.eventId, planDataForDb.cliente, planDataForDb.data, planDataForDb.hora,
                 planDataForDb.duracao, planDataForDb.exercicios, planDataForDb.status, planDataForDb.cor, planDataForDb.sessao,
                 planDataForDb.mes, planDataForDb.mRef, planDataForDb.avaliacaoData]
            );
        }

        let archived = false;
        if (status === "Done") {
            const archiveData = {
                idArquivo: uuidv4(),
                planUuidOriginal: planDataForDb.planUuid,
                eventId: planDataForDb.eventId,
                cliente: planDataForDb.cliente,
                data: planDataForDb.data,
                hora: planDataForDb.hora,
                duracao: planDataForDb.duracao,
                mRef: planDataForDb.mRef,
                sessao: planDataForDb.sessao,
                mes: planDataForDb.mes,
                exerciciosJSON: planDataForDb.exercicios,
                statusArq: status, // "Done"
                cor: planDataForDb.cor,
                dataArq: new Date().toISOString(),
                avaliacaoJSON: planDataForDb.avaliacaoData
            };
            await dbRun(
                `INSERT INTO Contas (idArquivo, planUuidOriginal, eventId, cliente, data, hora, duracao, mRef, sessao, mes, exerciciosJSON, statusArq, cor, dataArq, avaliacaoJSON)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                Object.values(archiveData)
            );
            // Optionally, delete from Planos or mark as archived
            // await dbRun("DELETE FROM Planos WHERE planUuid = ?", [planDataForDb.planUuid]);
            archived = true;
        }
        
        // Fetch the saved/updated plan to return it in full formatted structure
        const savedPlanDb = await dbGet("SELECT * FROM Planos WHERE planUuid = ?", [planDataForDb.planUuid]);
        const formattedPlanForReturn = formatPlanDataFromDbRow(savedPlanDb);

        reply.send({ sucesso: true, mensagem: archived ? "Salvo e arquivado com sucesso!" : "Salvo com sucesso!", ...formattedPlanForReturn });

    } catch (error) {
        console.error(`[savePlanoDB] UUID ${plano?.planUuid} Erro: ${error.message}\n${error.stack}`);
        reply.status(500).send({ sucesso: false, erro: "Erro interno ao salvar o plano.", mensagem: `Ocorreu um erro inesperado: ${error.message}` });
    } finally {
        lockService.releaseLock(lockKey);
    }
}


module.exports = async function (fastify, options) {
  fastify.get('/', getPlanosHandler);
  fastify.post('/', savePlanoHandler);
};

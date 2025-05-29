
const config = require('../config');
const { dbGet, dbAll, dbRun } = require('../services/database');
const cacheService = require('../services/cacheService');
const lockService = require('../services/lockService');


async function getMasterExerciseDataHandler(request, reply) {
    const cacheKey = "MASTER_EXERCISES_DATA_V2_DB"; // Changed cache key for DB version
    const cached = cacheService.get(cacheKey);
    if (cached) {
        reply.send(JSON.parse(cached));
        return;
    }

    try {
        const rows = await dbAll("SELECT groupName, exerciseName FROM MasterExercises ORDER BY groupName, exerciseName");
        const exercises = rows.reduce((acc, row) => {
            if (!acc[row.groupName]) {
                acc[row.groupName] = [];
            }
            acc[row.groupName].push(row.exerciseName);
            return acc;
        }, {});
        
        cacheService.put(cacheKey, JSON.stringify(exercises), config.CACHE_EXPIRATION_SECONDS);
        reply.send(exercises);
    } catch (e) {
        console.error(`[getMasterExerciseDataDB] Erro: ${e.message}`);
        reply.status(500).send({});
    }
}

async function saveNewMasterExerciseHandler(request, reply) {
    const { exerciseName, muscleGroup } = request.body;
    if (!exerciseName || !muscleGroup) {
        reply.status(400).send({ success: false, error: "Nome do exercício ou grupo muscular em falta." });
        return;
    }

    const lockKey = 'saveMasterExerciseLockDB';
    if (!lockService.tryLock(lockKey, 10000)) {
        reply.status(503).send({ success: false, error: "Serviço ocupado. Tente novamente." });
        return;
    }

    try {
        const existingExercise = await dbGet(
            "SELECT id FROM MasterExercises WHERE groupName = ? AND exerciseName = ?",
            [muscleGroup, exerciseName.trim()]
        );

        if (existingExercise) {
            reply.send({ success: true, message: "Exercício já existe neste grupo." });
            return;
        }
        
        await dbRun(
            "INSERT INTO MasterExercises (groupName, exerciseName) VALUES (?, ?)",
            [muscleGroup, exerciseName.trim()]
        );
        
        cacheService.remove("MASTER_EXERCISES_DATA_V2_DB"); // Invalidate cache
        reply.send({ success: true, message: "Novo exercício salvo com sucesso!" });

    } catch (e) {
        console.error(`[saveNewMasterExerciseDB] Erro: ${e.message}\n${e.stack}`);
        if (e.message.includes('UNIQUE constraint failed')) { // More specific error for duplicates
             reply.status(409).send({ success: false, error: "Exercício já existe neste grupo (UNIQUE constraint)." });
        } else {
            reply.status(500).send({ success: false, error: `Erro interno: ${e.message}` });
        }
    } finally {
        lockService.releaseLock(lockKey);
    }
}

module.exports = async function (fastify, options) {
  fastify.get('/', getMasterExerciseDataHandler);
  fastify.post('/', saveNewMasterExerciseHandler);
};

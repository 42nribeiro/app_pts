
const fastify = require('fastify')({ logger: true });

const config = require('./config');
const metricasRoutes = require('./routes/metricasRoutes');
const planosRoutes = require('./routes/planosRoutes');
const masterExerciseRoutes = require('./routes/masterExerciseRoutes');
const statsRoutes = require('./routes/statsRoutes');
const suggestionsRoutes = require('./routes/suggestionsRoutes');


fastify.register(metricasRoutes, { prefix: '/api/metricas' });
fastify.register(planosRoutes, { prefix: '/api/planos' });
fastify.register(masterExerciseRoutes, { prefix: '/api/master-exercises' });
fastify.register(statsRoutes, { prefix: '/api/stats' });
fastify.register(suggestionsRoutes, { prefix: '/api/suggestions' });

const start = async () => {
  try {
    await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

const http = require('http'); // reload cache
const { createAppRuntime } = require('./src/server/createAppRuntime');
const logger = require('./src/server/logger');

const app = createAppRuntime({
    rootDir: __dirname,
    env: process.env
});
const PORT = process.env.PORT || 3002;

const server = http.createServer(app.requestHandler).listen(PORT, () => {
    logger.info(`Server started on http://localhost:${PORT}/`, {
        port: PORT,
        rootDir: __dirname,
        boardDriver: app.boardRepository?.getMeta()?.driver
    });

    if (app.repositoryDiagnostics?.repositories) {
        const drivers = Object.entries(app.repositoryDiagnostics.repositories)
            .reduce((acc, [key, entry]) => {
                acc[key] = entry.effectiveDriver || entry.predictedDriver || 'unknown';
                return acc;
            }, {});
        logger.info('Repository drivers initialized', { drivers });
    }

    if (Array.isArray(app.repositoryDiagnostics?.warnings)) {
        for (const warning of app.repositoryDiagnostics.warnings) {
            logger.warn(`Runtime warning: ${warning}`);
        }
    }
});

// Handle graceful shutdown
const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
        try {
            await app.shutdown();
            logger.info('Graceful shutdown completed.');
            process.exit(0);
        } catch (err) {
            logger.error('Error during shutdown:', { error: err.message });
            process.exit(1);
        }
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
        logger.error('Shutdown timed out, forcing exit.');
        process.exit(1);
    }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

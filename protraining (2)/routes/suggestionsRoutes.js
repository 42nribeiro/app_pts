
const config = require('../config');
const { dbAll } = require('../services/database');
const dateUtils = require('../utils/dateUtils');

async function getClientSuggestionsHandler(request, reply) {
    const { inputText, corFiltro, ptFiltro } = request.query;

    if (!inputText || inputText.trim().length < 2) {
        reply.send([]);
        return;
    }
    const inputTextLower = inputText.trim().toLowerCase();
    let suggestions = new Set();

    try {
        // Base query for client names
        // This is a simplified query. A full implementation would need to carefully consider
        // how _getClienteNomeBaseFromTitle logic is applied.
        // Storing a normalized `clienteNomeBase` in the Planos table during save/update
        // would make these kinds of suggestion queries much more efficient and accurate.
        let sql = "SELECT DISTINCT cliente FROM Planos WHERE cliente LIKE ?";
        const params = [`%${inputTextLower}%`]; // Basic LIKE search

        // Add color and PT filters if they are provided and stored directly
        // This assumes 'cor' is a direct field. PT filter is more complex if based on keywords in 'cliente' field.
        if (corFiltro) {
            sql += " AND cor = ?";
            params.push(corFiltro);
        }
        
        // PT filter is tricky here. If PT_KEYWORDS are part of the 'cliente' string,
        // you might need to fetch more broadly and then filter in JS, or use complex SQL LIKE clauses.
        // For simplicity, this example doesn't fully implement the PT keyword filter in SQL.
        
        sql += " LIMIT 500"; // Limit rows scanned from DB for performance

        const rows = await dbAll(sql, params);
        
        const MAX_SUGGESTIONS = 10;

        for (const row of rows) {
            if (suggestions.size >= MAX_SUGGESTIONS * 5) break; // Limit processing if too many raw matches

            const clienteNomeOriginal = row.cliente;
            if (clienteNomeOriginal && typeof clienteNomeOriginal === 'string') {
                const clienteNomeBase = dateUtils._getClienteNomeBaseFromTitle(clienteNomeOriginal, config.PT_KEYWORDS);
                 // The SQL LIKE already did a basic filter. This refines it.
                if (clienteNomeBase.toLowerCase().includes(inputTextLower)) {
                    // Re-apply PT filter here if it was too complex for SQL
                    let matchPt = true;
                    if (ptFiltro && ptFiltro !== "" && ptFiltro !== "todos") {
                        const tituloLower = clienteNomeOriginal.toLowerCase();
                        const foundPtKeyword = config.PT_KEYWORDS.find(p => tituloLower.includes(p.toLowerCase()));
                        matchPt = (foundPtKeyword && foundPtKeyword.toLowerCase() === ptFiltro.toLowerCase());
                    }
                    if(matchPt) {
                        suggestions.add(clienteNomeBase);
                    }
                }
            }
        }
        
        const sortedSuggestions = Array.from(suggestions).sort((a,b) => a.localeCompare(b)).slice(0, MAX_SUGGESTIONS);
        reply.send(sortedSuggestions);

    } catch (e) {
        console.error(`Erro em getClientSuggestionsDB: ${e.toString()}`);
        reply.status(500).send([]);
    }
}

module.exports = async function (fastify, options) {
  fastify.get('/client', getClientSuggestionsHandler);
};

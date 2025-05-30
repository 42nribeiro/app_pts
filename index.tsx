// Main Entry Point: index.tsx
import * as DOM from './modules/domElements';
import { API_BASE_URL, state } from './modules/config';
import { 
    showLoadingIndicator, setupAlerts, toggleFullscreen, 
    setupKeyboardScrollHandler, handleBackendError 
} from './modules/uiUtils';
import { 
    filtrarPlanos, executarCalculoMetricas, toggleFilterVisibility, 
    displayClienteSuggestions, hideClienteSuggestions 
} from './modules/filterHandlers';
import * as planManager from './modules/planManager';
import * as modalManager from './modules/modalManager';
import * as chartManager from './modules/chartManager';
import { fetchApi } from './modules/api';


// --- TypeScript Global Augmentations & Declarations ---
// Moved to modules/config.ts or modules/interfaces.ts where appropriate for Chart
// Ensure Chart related declarations are correctly handled (e.g. via interfaces.ts and config.ts)

// Expose modules to global scope for HTML onclicks
// This is a temporary measure. Ideally, use addEventListener.
(window as any).app = {
    planManager,
    modalManager,
    chartManager,
    filterHandlers: { // Expose specific filter handlers if needed by HTML
        toggleFilterVisibility 
    },
    uiUtils: { // Expose specific UI utils if needed by HTML
        toggleFullscreen
    }
};


// --- Event Listeners and Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    setupAlerts(); // From uiUtils
    if (DOM.dateRangeFilterInput) {
        flatpickr(DOM.dateRangeFilterInput, { mode: "range", dateFormat: "d/m/Y", locale: "pt" as any });
    }

    // Attach event listeners using imported functions
    if (DOM.appIcon) DOM.appIcon.addEventListener('click', toggleFullscreen);
    if (DOM.toggleFilterButton) DOM.toggleFilterButton.addEventListener('click', toggleFilterVisibility);
    if (DOM.buscarPlanosBtn) DOM.buscarPlanosBtn.addEventListener('click', filtrarPlanos);
    if (DOM.calcularMetricasBtn) DOM.calcularMetricasBtn.addEventListener('click', executarCalculoMetricas);
    if (DOM.estatisticasBtn) DOM.estatisticasBtn.addEventListener('click', modalManager.abrirModalEstatisticas);
    
    // Client suggestions
    let clienteSuggestionTimeout: number;
    if (DOM.nomeFiltroInput && DOM.clienteSuggestionsDropdown) {
        DOM.nomeFiltroInput.addEventListener('input', () => {
            clearTimeout(clienteSuggestionTimeout);
            const inputText = DOM.nomeFiltroInput.value.trim();
            if (inputText.length < 2) { 
                hideClienteSuggestions(); // from filterHandlers
                return; 
            }
            
            clienteSuggestionTimeout = window.setTimeout(async () => {
                const corVal = DOM.corSelect?.value ?? '';
                const personalTrainerVal = DOM.personalTrainerSelect?.value ?? '';
                const params = new URLSearchParams({ inputText, corFiltro: corVal, ptFiltro: personalTrainerVal });
                try {
                    // Assuming API response is directly the array of suggestions
                    const suggestionsArray = await fetchApi(`/api/suggestions/client?${params.toString()}`, {}, 'getClientSuggestions');
                    displayClienteSuggestions(suggestionsArray || [], inputText); // from filterHandlers
                } catch (error) {
                    console.error("Erro ao buscar sugestões de cliente:", error);
                    hideClienteSuggestions(); // from filterHandlers
                }
            }, 300);
        });
        document.addEventListener('click', function(event) {
            const target = event.target as HTMLElement;
            if (DOM.nomeFiltroInput && !DOM.nomeFiltroInput.contains(target) && 
                DOM.clienteSuggestionsDropdown && !DOM.clienteSuggestionsDropdown.contains(target)) {
                hideClienteSuggestions(); // from filterHandlers
            }
        });
    }
    
    // Modal overlay clicks
    const overlaysToCloseModals: { [key: string]: () => void } = {
        'avaliacao-modal-overlay': modalManager.fecharModalAvaliacao,
        'estatisticas-modal-overlay': modalManager.fecharModalEstatisticas,
    };
    for (const overlayId in overlaysToCloseModals) {
        const overlay = document.getElementById(overlayId) as HTMLElement;
        if (overlay) {
            overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlaysToCloseModals[overlayId](); } });
        }
    }
    
    if (DOM.alertOverlay) { 
        DOM.alertOverlay.addEventListener('click', e => {
            if (e.target === DOM.alertOverlay) { 
                if (DOM.exerciseModal && DOM.exerciseModal.style.display !== 'none') {
                    modalManager.hideExerciseModal();
                } 
                // Do not hide general custom alerts here; let their own logic handle it
            }
        });
    }
    if (DOM.alertDiv) {
        const okButton = DOM.alertDiv.querySelector('#custom-alert-ok-btn');
        if (okButton) okButton.addEventListener('click', () => import('./modules/uiUtils').then(ui => ui.hideCustomAlert()));
    }


    // Global Keydown Listener for Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (DOM.exerciseModal && DOM.exerciseModal.style.display !== 'none') {
                 if (document.activeElement === DOM.modalSearchInput && DOM.modalSearchInput.value !== '') return;
                e.preventDefault(); modalManager.hideExerciseModal();
            } else if (DOM.avaliacaoModal && DOM.avaliacaoModal.style.display !== 'none') {
                e.preventDefault(); modalManager.fecharModalAvaliacao();
            } else if (DOM.estatisticasModal && DOM.estatisticasModal.style.display !== 'none') {
                e.preventDefault(); modalManager.fecharModalEstatisticas();
            } else if (DOM.alertDiv && DOM.alertDiv.style.display !== 'none' && DOM.alertDiv.classList.contains('show')) {
                e.preventDefault(); import('./modules/uiUtils').then(ui => ui.hideCustomAlert());
            }
        }
         // Enter in exercise modal search
        if (e.key === 'Enter' && DOM.exerciseModal && DOM.exerciseModal.style.display !== 'none' && document.activeElement === DOM.modalSearchInput) {
            e.preventDefault(); 
            const searchTerm = DOM.modalSearchInput.value.trim();
            if (!searchTerm && DOM.modalListContainer) { // If search is empty, maybe select first visible item
                const firstItem = DOM.modalListContainer.querySelector('.suggestion-item') as HTMLElement;
                if (firstItem) firstItem.click();
                return;
            }
            if (!searchTerm) return; // If still empty, do nothing

            const modalItems = DOM.modalListContainer.querySelectorAll('.suggestion-item, .add-new-suggestion');
            if (modalItems.length > 0) {
                // If "add new" is the only option or the first option after filtering
                const addNewSuggestionButton = DOM.modalListContainer.querySelector('.add-new-suggestion') as HTMLElement;
                if (addNewSuggestionButton && (modalItems.length === 1 || addNewSuggestionButton === modalItems[0])) {
                     addNewSuggestionButton.click();
                } else {
                    const firstSuggestion = DOM.modalListContainer.querySelector('.suggestion-item') as HTMLElement;
                    if (firstSuggestion) firstSuggestion.click(); // Click the first actual suggestion
                }
            }
        }
    });

    if (DOM.exerciseModalCloseButton) DOM.exerciseModalCloseButton.addEventListener('click', modalManager.hideExerciseModal);
    
    setupKeyboardScrollHandler(); // From uiUtils

    // Chart.js global configurations
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels); 
        Chart.defaults.font.family = 'Roboto, "Helvetica Neue", Arial, sans-serif';
        Chart.defaults.font.size = 11; 
        Chart.defaults.color = '#333';
        Chart.defaults.plugins.legend.display = false; 
        Chart.defaults.plugins.datalabels.display = false; 
        Chart.defaults.plugins.datalabels.borderRadius = 3;
        Chart.defaults.plugins.datalabels.font = { weight: 'bold', size: 9 };
    }
    
    // Initial data load
    (async () => {
        console.log("DOM fully loaded. Starting initial data fetch...");
        try {
            // No need to call showLoadingIndicator here, fetchApi will do it.
            await filtrarPlanos(); 
        } catch (initialError) {
            console.error("Erro no carregamento inicial:", initialError);
            // handleBackendError from uiUtils will also hide spinner
            handleBackendError(initialError, "Initial Page Load"); 
        }
    })();

});

export {}; // Ensures this file is treated as a module

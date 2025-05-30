// modules/filterHandlers.ts
import * as DOM from './domElements';
import { fetchApi } from './api';
import { state } from './config';
import { enableActionButtons, disableActionButtons, handleBackendError, resetHeaderStats } from './uiUtils';
import { mostrarPlanos } // This will create a circular dependency if mostrarPlanos calls functions from here.
    from './planManager'; 
import { mostrarResultadosEstatisticas } 
    from './chartManager'; 

// Declare flatpickr if it's used globally and not imported
declare var flatpickr: any;

export function toggleFilterVisibility() {
    if (!DOM.filterContainer || !DOM.toggleFilterButton) {
        console.warn("Filter container or toggle button not found for toggleFilterVisibility.");
        return;
    }
    hideClienteSuggestions(); // Hide suggestions when toggling filter visibility

    const isCurrentlyCollapsed = DOM.filterContainer.classList.contains('collapsed');
    
    // Always ensure overflow is hidden during transition calculations/execution
    DOM.filterContainer.style.overflow = 'hidden';
    // Set transition property via JS to ensure it's applied at the right time
    DOM.filterContainer.style.transition = 'max-height 0.3s ease-out, opacity 0.3s ease-out, padding-top 0.3s ease-out, padding-bottom 0.3s ease-out, border-top-width 0.3s ease-out';


    if (isCurrentlyCollapsed) { // To open
        DOM.filterContainer.classList.remove('collapsed'); 
        
        // Temporarily set final padding to correctly calculate scrollHeight with padding
        const finalPaddingTop = '9px';
        const finalPaddingBottom = '5px';
        const originalPaddingTop = DOM.filterContainer.style.paddingTop;
        const originalPaddingBottom = DOM.filterContainer.style.paddingBottom;
        DOM.filterContainer.style.paddingTop = finalPaddingTop;
        DOM.filterContainer.style.paddingBottom = finalPaddingBottom;
        const scrollHeight = DOM.filterContainer.scrollHeight + 'px';
        // Revert padding to animate it
        DOM.filterContainer.style.paddingTop = originalPaddingTop;
        DOM.filterContainer.style.paddingBottom = originalPaddingBottom;
        
        // Start animation from collapsed state
        DOM.filterContainer.style.maxHeight = '0px'; 
        DOM.filterContainer.style.opacity = '0';
        // DOM.filterContainer.style.paddingTop = '0px'; // Will transition
        // DOM.filterContainer.style.paddingBottom = '0px'; // Will transition
        DOM.filterContainer.style.borderTopWidth = '0px'; // Will transition
        
        requestAnimationFrame(() => { // Next frame to apply target styles for transition
            DOM.filterContainer.style.maxHeight = scrollHeight;
            DOM.filterContainer.style.opacity = '1';
            DOM.filterContainer.style.paddingTop = finalPaddingTop;
            DOM.filterContainer.style.paddingBottom = finalPaddingBottom;
            DOM.filterContainer.style.borderTopWidth = '1px';
        });

        DOM.toggleFilterButton.innerHTML = '<i class="fas fa-times"></i>';
        
        const onTransitionEnd = () => {
            if (!DOM.filterContainer.classList.contains('collapsed')) { 
                DOM.filterContainer.style.maxHeight = 'none'; // Allow dynamic content
                DOM.filterContainer.style.overflow = 'visible'; // Show scrollbars if content overflows
            }
            DOM.filterContainer.removeEventListener('transitionend', onTransitionEnd);
        };
        DOM.filterContainer.addEventListener('transitionend', onTransitionEnd);

    } else { // To close
        // Set maxHeight to current scrollHeight to animate from current height
        DOM.filterContainer.style.maxHeight = DOM.filterContainer.scrollHeight + 'px';
        
        requestAnimationFrame(() => { // Next frame to apply target styles for transition
            DOM.filterContainer.style.maxHeight = '0px';
            DOM.filterContainer.style.opacity = '0';
            DOM.filterContainer.style.paddingTop = '0px';
            DOM.filterContainer.style.paddingBottom = '0px';
            DOM.filterContainer.style.borderTopWidth = '0px';
        });

        DOM.toggleFilterButton.innerHTML = '<i class="fas fa-filter"></i>';

        const onTransitionEnd = () => {
            // Add .collapsed class only after transition to apply final styles like padding:0 !important
            if (DOM.filterContainer.style.maxHeight === '0px' || DOM.filterContainer.style.opacity === '0') {
                DOM.filterContainer.classList.add('collapsed'); 
            }
            // No need to remove transition here if it's set on the element not the class
            DOM.filterContainer.removeEventListener('transitionend', onTransitionEnd);
        };
        DOM.filterContainer.addEventListener('transitionend', onTransitionEnd);
    }
}


export async function filtrarPlanos() {
    if (state.isFiltering) return;
    state.isFiltering = true;
    disableActionButtons(); 

    try {
        const nomeFiltroVal = DOM.nomeFiltroInput.value.trim().toLowerCase() || 'pro';
        const personalTrainerVal = DOM.personalTrainerSelect.value;
        const corVal = DOM.corSelect.value;
        
        let dataInicioStr = '', dataFimStr = '';
        const datePickerInstance = (DOM.dateRangeFilterInput as any)?._flatpickr;
        if (datePickerInstance && datePickerInstance.selectedDates.length > 0) {
            dataInicioStr = flatpickr.formatDate(datePickerInstance.selectedDates[0], "d/m/Y");
            dataFimStr = datePickerInstance.selectedDates.length > 1 
                ? flatpickr.formatDate(datePickerInstance.selectedDates[1], "d/m/Y") 
                : dataInicioStr;
        }

        const params = new URLSearchParams();
        params.append('filtroNomeEvento', nomeFiltroVal);
        if (dataInicioStr) params.append('dataInicioStr', dataInicioStr);
        if (dataFimStr) params.append('dataFimStr', dataFimStr);
        if (personalTrainerVal) params.append('personalTrainer', personalTrainerVal);
        if (corVal) params.append('corEventoFiltro', corVal);

        const responseData = await fetchApi(`/api/planos?${params.toString()}`, {}, 'filtrarPlanos');
        mostrarPlanos(responseData); 
    } catch (error: any) {
        handleBackendError(error, 'filtrarPlanos');
    } finally {
        state.isFiltering = false;
        enableActionButtons();
    }
}

export async function executarCalculoMetricas() {
    if (state.isFiltering) return; 
    state.isFiltering = true;
    disableActionButtons();

    let periodoSelecionadoStr = "Período Não Especificado";
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    try {
        const nomeFiltroVal = DOM.nomeFiltroInput.value.trim().toLowerCase() || 'pro';
        const personalTrainerVal = DOM.personalTrainerSelect.value;
        const corVal = DOM.corSelect.value;
        let dataInicioStr = '', dataFimStr = '';
        const datePickerInstance = (DOM.dateRangeFilterInput as any)?._flatpickr;

        if (datePickerInstance && datePickerInstance.selectedDates.length > 0) {
            const dataInicioObj = datePickerInstance.selectedDates[0];
            dataInicioStr = flatpickr.formatDate(dataInicioObj, "d/m/Y");
            if (datePickerInstance.selectedDates.length > 1) {
                const dataFimObj = datePickerInstance.selectedDates[1];
                dataFimStr = flatpickr.formatDate(dataFimObj, "d/m/Y");
                const mesInicioNome = meses[dataInicioObj.getMonth()], anoInicio = dataInicioObj.getFullYear();
                const mesFimNome = meses[dataFimObj.getMonth()], anoFim = dataFimObj.getFullYear();
                periodoSelecionadoStr = mesInicioNome === mesFimNome && anoInicio === anoFim ? `${mesInicioNome} de ${anoInicio}` :
                                     anoInicio === anoFim ? `${mesInicioNome} a ${mesFimNome} de ${anoInicio}` :
                                     `${mesInicioNome}/${anoInicio} a ${mesFimNome}/${anoFim}`;
            } else {
                dataFimStr = dataInicioStr;
                periodoSelecionadoStr = `${meses[dataInicioObj.getMonth()]} de ${dataInicioObj.getFullYear()}`;
            }
        } else {
            const hoje = new Date();
            periodoSelecionadoStr = `Mês Atual (${meses[hoje.getMonth()]} de ${hoje.getFullYear()})`;
        }

        if (DOM.trainingPlansContainer) DOM.trainingPlansContainer.innerHTML = ''; 

        const params = new URLSearchParams();
        params.append('filtroNomeEvento', nomeFiltroVal);
        if (dataInicioStr) params.append('dataInicioStr', dataInicioStr);
        if (dataFimStr) params.append('dataFimStr', dataFimStr);
        if (personalTrainerVal) params.append('personalTrainer', personalTrainerVal);
        if (corVal) params.append('corEventoFiltro', corVal);
        
        const responseData = await fetchApi(`/api/metricas?${params.toString()}`, {}, 'executarCalculoMetricas');
        
        // Use the directly imported function if static, or await if dynamic
        // For static import:
        // mostrarResultadosEstatisticas(responseData, periodoSelecionadoStr); 
        // This was an error in the prompt as 'mostrarResultadosEstatisticas' is not taking 'periodoSelecionadoStr'.
        // The function 'atualizarDisplayMetricas' (which was the original name being called) in the original non-working code did.
        // However, the fixed `mostrarResultadosEstatisticas` handles the display of `ClientStats` which *contains* period info.
        // The `MetricasApiResponse` (returned by /api/metricas) does not seem to have a dedicated 'periodo' field used by `atualizarDisplayMetricas`
        // Let's check the `atualizarDisplayMetricas` which was supposed to be in `chartManager`.
        // The prompt does not show its definition, only its import and usage in `filterHandlers`.
        // Given the error about `atualizarDisplayMetricas` not being exported and `mostrarResultadosEstatisticas` *being* exported for client stats,
        // it seems there's a mismatch in what /api/metricas returns vs what /api/stats/cliente returns and which display function is used.

        // The original `executarCalculoMetricas` called `atualizarDisplayMetricas` (from chartManager)
        // `atualizarDisplayMetricas` was supposed to take `responseData` (from /api/metricas) and `periodoSelecionadoStr`.
        // Since `atualizarDisplayMetricas` is not exported from `chartManager`, and the prompt only shows `mostrarResultadosEstatisticas` for client stats,
        // I will assume for now that the metrics response should just update the header inputs.
        // If `chartManager` had a function to display general metrics (not client-specific stats), it would be used here.
        // For now, I'll update the header inputs directly as the old code might have implied.

        if (responseData && responseData.erro === null) {
            if (DOM.numeroTreinosInput) DOM.numeroTreinosInput.value = String(responseData.totalEventos || 0);
            if (DOM.treinosConcluidosInput) DOM.treinosConcluidosInput.value = String(responseData.eventosConcluidos || 0);
            if (DOM.filtroNivelInput) DOM.filtroNivelInput.value = String(responseData.nivel?.toFixed(2) || '--');
            if (DOM.filtroHorasInput) DOM.filtroHorasInput.value = String(responseData.totalHoras?.toFixed(2) || '--');

            // If there was a chart display function for general metrics, it would be called here.
            // For example, if chartManager.displayGeneralMetrics existed:
            // const chartManager = await import('./chartManager');
            // chartManager.displayGeneralMetrics(responseData, periodoSelecionadoStr);
            // For now, let's assume the primary display is the header and potentially a table of 'detalhesNivel' if UI was designed for it.
            // The prompt did not include UI for `detalhesNivel` or `dadosClientePorRef` from `/api/metricas` in the plan view area.
             if (DOM.trainingPlansContainer) { // Display details if available
                let detailsHtml = `<div class="p-3"><h4>Resumo Métricas (${periodoSelecionadoStr})</h4>`;
                if(responseData.detalhesNivel && responseData.detalhesNivel.length > 0) {
                    detailsHtml += '<h5 class="mt-3">Detalhes do Nível:</h5><ul class="list-group">';
                    responseData.detalhesNivel.forEach((item: any) => {
                        detailsHtml += `<li class="list-group-item d-flex justify-content-between align-items-center small">
                            <span>${item.titulo} (${item.tipoPagamento || item.regra}, ${item.mesAlocado})</span>
                            <span class="badge badge-primary badge-pill">${item.valor?.toFixed(2)}</span>
                        </li>`;
                    });
                    detailsHtml += '</ul>';
                }
                 if(responseData.dadosClientePorRef && Object.keys(responseData.dadosClientePorRef).length > 0) {
                    detailsHtml += '<h5 class="mt-3">Contagem Cliente por M.Ref:</h5><ul class="list-group">';
                     Object.values(responseData.dadosClientePorRef).forEach((item: any) => {
                        detailsHtml += `<li class="list-group-item d-flex justify-content-between align-items-center small">
                            <span>${item.nomeCliente} (M.Ref: ${item.mRef})</span>
                            <span class="badge badge-info badge-pill">${item.count}</span>
                        </li>`;
                    });
                    detailsHtml += '</ul>';
                }

                if (!(responseData.detalhesNivel && responseData.detalhesNivel.length > 0) && !(responseData.dadosClientePorRef && Object.keys(responseData.dadosClientePorRef).length > 0)) {
                    detailsHtml += '<p class="text-muted">Nenhum detalhe adicional de métricas para exibir.</p>';
                }
                detailsHtml += '</div>';
                DOM.trainingPlansContainer.innerHTML = detailsHtml;
            }


        } else {
            resetHeaderStats(); // If error or no data
        }


    } catch (error: any) {
        handleBackendError(error, 'executarCalculoMetricas');
    } finally {
        state.isFiltering = false;
        enableActionButtons();
    }
}

export function displayClienteSuggestions(suggestions: string[], inputText: string) {
    if (!DOM.clienteSuggestionsDropdown) return;
    DOM.clienteSuggestionsDropdown.innerHTML = '';
    if (suggestions && suggestions.length > 0) {
        suggestions.forEach(suggestion => {
            const item = document.createElement('a'); 
            item.classList.add('dropdown-item');
            item.href = '#'; 
            
            const regex = new RegExp(`(${inputText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            item.innerHTML = suggestion.replace(regex, '<strong>$1</strong>');
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                if (DOM.nomeFiltroInput) DOM.nomeFiltroInput.value = suggestion;
                hideClienteSuggestions();
            });
            DOM.clienteSuggestionsDropdown.appendChild(item);
        });
        DOM.clienteSuggestionsDropdown.style.display = 'block';
    } else {
        hideClienteSuggestions();
    }
}
export function hideClienteSuggestions() {
    if (DOM.clienteSuggestionsDropdown) DOM.clienteSuggestionsDropdown.style.display = 'none';
}

// modules/planManager.ts
import * as DOM from './domElements';
import { state, OBJETIVOS } from './config';
import { Plan, Exercise, MasterExercises, SeriesDataItem, SavePlanoApiResponse } from './interfaces';
import { fetchApi } from './api';
import { showCustomAlert, enableActionButtons, disableActionButtons, getCalendarColorStyle, handleBackendError as globalHandleBackendError, resetHeaderStats } from './uiUtils';
import { abrirModalAvaliacao, handleExerciseFocus as modalHandleExerciseFocus } from './modalManager';

// Declare Sortable if used globally
declare var Sortable: any;

export function handleStatusChange(e: Event) { 
    const select = e.target as HTMLSelectElement;
    const id = parseInt(select.dataset.planoId!, 10);
    const plano = state.planos.find(pL => pL.contadorPlano === id); 
    if (plano) {
        plano.status = select.value; 
        setReadOnlyState(id, select.value === 'Done');
    }
}

export function handleSessaoChange(e: Event) { 
    const input = e.target as HTMLInputElement;
    const cardHeader = input.closest('.card-header');
    if (!cardHeader) return; 
    const statusSelect = cardHeader.querySelector('.status-select') as HTMLSelectElement;
    if (!statusSelect) return; 
    const id = parseInt(statusSelect.dataset.planoId!, 10);
    const plano = state.planos.find(pL => pL.contadorPlano === id); 
    if (plano) { 
        if (input.classList.contains('sessao-inicio')) plano.clienteContagem = input.value; 
        else if (input.classList.contains('sessao-fim')) plano.clienteMes = input.value; 
    } 
}

export function togglePlano(idHTML: number) {
    const content = document.getElementById(`plano-conteudo-${idHTML}`) as HTMLElement;
    const header = document.getElementById(`card-header-${idHTML}`) as HTMLElement;
    if (!content || !header) return;
    const card = header.closest('.card') as HTMLElement;
    const isOpen = content.style.display === 'block';
    content.style.display = isOpen ? 'none' : 'block';
    card?.classList.toggle('card-open', !isOpen);
}


export async function atualizarExercicios(selectElement: HTMLSelectElement) { 
    const selectedGroup = selectElement.value;
    const exerciseContainer = selectElement.closest('.exercise-container');
    if (!exerciseContainer || typeof state.MASTER_EXERCISE_DATA === 'undefined') return;
    
    const exerciseInput = exerciseContainer.querySelector('.exercicio') as HTMLInputElement;
    if (exerciseInput) {
        exerciseInput.value = ''; 
        const exerciseList = state.MASTER_EXERCISE_DATA[selectedGroup] || [];
        exerciseInput.dataset.exerciseList = JSON.stringify(exerciseList);
        
        if (state.currentExerciseInputTarget === exerciseInput && DOM.modalSearchInput) {
            state.fullModalExerciseList = exerciseList;
            // Dynamically import to avoid circular dependency at module load time
            const modalManager = await import('./modalManager');
            modalManager.populateModalList(state.fullModalExerciseList, DOM.modalSearchInput.value);
        }
    }
}

export function alterarSeries(buttonElement: HTMLButtonElement, idHTML: number, increment: number) {
    const exerciseContainer = buttonElement.closest('.exercise-container');
    if (!exerciseContainer) return;
    const statusSelect = document.getElementById(`card-header-${idHTML}`)?.querySelector('.status-select') as HTMLSelectElement;
    if (statusSelect?.value === 'Done' || exerciseContainer.classList.contains('item-readonly')) return;

    const seriesInput = exerciseContainer.querySelector('.series-value') as HTMLInputElement;
    if (!seriesInput) return;
    let currentSeries = parseInt(seriesInput.value, 10);
    if (isNaN(currentSeries)) currentSeries = 1;
    let newSeries = currentSeries + increment;
    newSeries = Math.max(1, Math.min(10, newSeries)); 
    seriesInput.value = String(newSeries);
    atualizarRepeticoes(seriesInput, idHTML);
}

export function atualizarRepeticoes(seriesInput: HTMLInputElement, idHTML: number) {
    const exerciseContainer = seriesInput.closest('.exercise-container');
    if (!exerciseContainer) return;
    const seriesDetailContainer = exerciseContainer.querySelector('.series-detail-container') as HTMLElement;
    if (!seriesDetailContainer) return;

    const targetCount = parseInt(seriesInput.value, 10);
    if (isNaN(targetCount) || targetCount < 1) {
        seriesDetailContainer.innerHTML = ''; 
        return;
    }
    
    const statusSelect = document.getElementById(`card-header-${idHTML}`)?.querySelector('.status-select') as HTMLSelectElement;
    const isReadOnly = statusSelect?.value === 'Done' || exerciseContainer.classList.contains('item-readonly');

    const existingSeriesColumns = seriesDetailContainer.querySelectorAll('.series-column');
    const currentCount = existingSeriesColumns.length;

    if (targetCount > currentCount) {
        for (let i = currentCount; i < targetCount; i++) {
            const seriesColumn = document.createElement('div');
            seriesColumn.className = 'series-column';
            seriesColumn.innerHTML = `
                <div class="input-group input-group-sm series-rep-tempo-group">
                    <input type="number" class="form-control manual-rep-tempo" placeholder="-" value="" ${isReadOnly ? 'readonly' : ''} title="Rep/Tempo ${i + 1}" min="0">
                    <select class="form-control unit-select rep-tempo-unit" ${isReadOnly ? 'disabled' : ''} title="Unidade Rep/Tempo ${i + 1}">
                        <option value="rep">rep</option><option value="sec">sec</option><option value="min">min</option>
                    </select>
                </div>
                <div class="input-group input-group-sm series-weight-group">
                    <input type="number" step="any" class="form-control peso-value" placeholder="-" value="" ${isReadOnly ? 'readonly' : ''} title="Peso ${i + 1}" min="0">
                    <select class="form-control unit-select peso-unit" ${isReadOnly ? 'disabled' : ''} title="Unidade Peso ${i + 1}">
                        <option value="kg">kg</option><option value="lbs" selected>lbs</option><option value="body">body</option>
                    </select>
                </div>`;
            seriesDetailContainer.appendChild(seriesColumn);
        }
    } else if (targetCount < currentCount) {
        for (let i = currentCount - 1; i >= targetCount; i--) {
            if (existingSeriesColumns[i]) existingSeriesColumns[i].remove();
        }
    }
}

export function handleExerciseListInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const isRepTempoInput = target.classList.contains('manual-rep-tempo');
    const isPesoInput = target.classList.contains('peso-value');
    const isRepTempoUnitSelect = target.classList.contains('rep-tempo-unit');
    const isPesoUnitSelect = target.classList.contains('peso-unit');

    if (!isRepTempoInput && !isPesoInput && !isRepTempoUnitSelect && !isPesoUnitSelect) return;

    const seriesColumn = target.closest('.series-column');
    if (!seriesColumn) return;
    const seriesDetailContainer = seriesColumn.closest('.series-detail-container');
    if (!seriesDetailContainer || seriesColumn !== seriesDetailContainer.querySelector('.series-column:first-child')) return;

    const exerciseContainer = target.closest('.exercise-container');
    if (exerciseContainer?.classList.contains('item-readonly')) return;
    
    const valueToPropagate = target.value;
    let selectorToMatch = '';
    if (isRepTempoInput) selectorToMatch = '.manual-rep-tempo';
    else if (isPesoInput) selectorToMatch = '.peso-value';
    else if (isRepTempoUnitSelect) selectorToMatch = '.rep-tempo-unit';
    else if (isPesoUnitSelect) selectorToMatch = '.peso-unit';

    if (selectorToMatch) {
        seriesDetailContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`.series-column ${selectorToMatch}`).forEach((otherInput, index) => {
            if (index > 0) otherInput.value = valueToPropagate;
        });
    }
}

export function adicionarExercicio(idHTML: number) { 
    const listContainer = document.getElementById(`exercise-list-${idHTML}`) as HTMLElement;
    if (!listContainer) return; 
    const statusSelect = document.getElementById(`card-header-${idHTML}`)?.querySelector('.status-select') as HTMLSelectElement;
    if (statusSelect?.value === 'Done') return; 

    state.exercicioCounter++; 
    const exerciseDiv = document.createElement('div');
    exerciseDiv.className = 'exercise-container sortable-item border rounded mb-2 shadow-sm';
    exerciseDiv.dataset.highlightState = 'neutral';
    if (listContainer.children.length % 2 === 0) exerciseDiv.classList.add('exercise-alternate');
    
    const exerciseGroups = Object.keys(state.MASTER_EXERCISE_DATA || {});
    // Note: onclick attributes in this innerHTML will need to be exposed via window.app...
    exerciseDiv.innerHTML = `
        <div class="handle-container" style="grid-area:handle;"><i class="fas fa-grip-vertical handle text-muted" onclick="window.app.planManager.cycleHighlight(this)"></i></div>
        <div class="exercise-content-wrapper">
            <div class="exercise-header">
                <select class="form-control form-control-sm objetivo objetivo-${idHTML}" title="Objetivo"><option value="" disabled selected>-- Objetivo --</option>${OBJETIVOS.map(o => `<option value="${o}">${o}</option>`).join('')}</select>
                <select class="form-control form-control-sm grupoMuscular grupoMuscular-${idHTML}" onchange="window.app.planManager.atualizarExercicios(this)" title="Grupo Muscular"><option value="" disabled selected>-- Grupo Muscular --</option>${exerciseGroups.map(g => `<option value="${g}">${g}</option>`).join('')}</select>
            </div>
            <div class="exercise-main-content">
                <input type="text" class="form-control form-control-sm exercicio exercicio-${idHTML}" placeholder="Exercício" title="Nome" autocomplete="off">
                <button type="button" class="btn btn-sm select-exercise-button" onclick="window.app.modalManager.handleExerciseFocus(this)" title="Selecionar Exercício"><i class="fas fa-list"></i></button>
            </div>
            <div class="exercise-footer-content">
                <div class="series-controls">
                    <button type="button" class="btn btn-sm btn-outline-secondary series-btn" onclick="window.app.planManager.alterarSeries(this,${idHTML},-1)" title="Menos Séries"><i class="fas fa-minus"></i></button>
                    <input type="number" class="form-control form-control-sm series-value" value="3" min="1" max="10" readonly title="Séries">
                    <button type="button" class="btn btn-sm btn-outline-secondary series-btn" onclick="window.app.planManager.alterarSeries(this,${idHTML},1)" title="Mais Séries"><i class="fas fa-plus"></i></button>
                </div>
                <div class="series-detail-container"></div>
            </div>
        </div>
        <div style="grid-area:delete;" class="delete-button-container"><button class="btn btn-light btn-sm" onclick="this.closest('.sortable-item').remove()" title="Remover"><i class="fas fa-trash text-danger"></i></button></div>`;
    listContainer.appendChild(exerciseDiv);
    const seriesInput = exerciseDiv.querySelector('.series-value') as HTMLInputElement;
    if (seriesInput) atualizarRepeticoes(seriesInput, idHTML);
}

export function adicionarObservacao(idHTML: number) { 
    const listContainer = document.getElementById(`exercise-list-${idHTML}`) as HTMLElement;
    if (!listContainer) return;
    const statusSelect = document.getElementById(`card-header-${idHTML}`)?.querySelector('.status-select') as HTMLSelectElement;
    if (statusSelect?.value === 'Done') return;
    
    state.exercicioCounter++; 
    const obsDiv = document.createElement('div');
    obsDiv.className = 'observation-container sortable-item border rounded mb-2 bg-light';
    obsDiv.dataset.highlightState = 'neutral';
    if (listContainer.children.length % 2 === 0) obsDiv.classList.add('exercise-alternate');
    obsDiv.innerHTML = `
        <div class="handle-container" style="grid-area:handle;"><i class="fas fa-grip-vertical handle text-muted" onclick="window.app.planManager.cycleHighlight(this)"></i></div>
        <div class="observation-content-wrapper" style="grid-area:input;"><input type="text" class="form-control form-control-sm observacao-texto observacao-texto-${idHTML}" placeholder="Observação..." title="Observação"></div>
        <div style="grid-area:delete;" class="delete-button-container"><button class="btn btn-light btn-sm" onclick="this.closest('.sortable-item').remove()" title="Remover"><i class="fas fa-trash text-danger"></i></button></div>`;
    listContainer.appendChild(obsDiv);
}

export function adicionarExercicioComDados(idHTML: number, itemData: Exercise, listContainer: HTMLElement, isReadOnly: boolean, masterExercises: MasterExercises) {
    if (!listContainer) return;
    state.exercicioCounter++;
    const exerciseGroups = Object.keys(masterExercises || {});

    if (itemData.type === 'exercise') {
        const exerciseDiv = document.createElement('div');
        exerciseDiv.className = 'exercise-container sortable-item border rounded mb-2 shadow-sm';
        exerciseDiv.dataset.highlightState = itemData.highlight || 'neutral';
        if (itemData.highlight && itemData.highlight !== 'neutral') {
            exerciseDiv.classList.add(`highlight-${itemData.highlight}`);
        }
        if (listContainer.children.length % 2 === 0) exerciseDiv.classList.add('exercise-alternate');

        exerciseDiv.innerHTML = `
            <div class="handle-container" style="grid-area:handle;"><i class="fas fa-grip-vertical handle text-muted" onclick="window.app.planManager.cycleHighlight(this)"></i></div>
            <div class="exercise-content-wrapper">
                <div class="exercise-header">
                    <select class="form-control form-control-sm objetivo objetivo-${idHTML}" title="Objetivo" ${isReadOnly ? 'disabled' : ''}><option value="" ${!itemData.objetivo ? 'selected' : ''} disabled>-- Objetivo --</option>${OBJETIVOS.map(o => `<option value="${o}" ${itemData.objetivo === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
                    <select class="form-control form-control-sm grupoMuscular grupoMuscular-${idHTML}" onchange="window.app.planManager.atualizarExercicios(this)" title="Grupo Muscular" ${isReadOnly ? 'disabled' : ''}><option value="" ${!itemData.grupoMuscular ? 'selected' : ''} disabled>-- Grupo --</option>${exerciseGroups.map(g => `<option value="${g}" ${itemData.grupoMuscular === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
                </div>
                <div class="exercise-main-content">
                    <input type="text" class="form-control form-control-sm exercicio exercicio-${idHTML}" placeholder="Exercício" title="Nome" value="${itemData.exerciseName || itemData.exercicio || ''}" autocomplete="off" ${isReadOnly ? 'readonly' : ''}>
                    <button type="button" class="btn btn-sm select-exercise-button" onclick="window.app.modalManager.handleExerciseFocus(this)" title="Selecionar Exercício" ${isReadOnly ? 'disabled' : ''}><i class="fas fa-list"></i></button>
                </div>
                <div class="exercise-footer-content">
                    <div class="series-controls">
                        <button type="button" class="btn btn-sm btn-outline-secondary series-btn" onclick="window.app.planManager.alterarSeries(this,${idHTML},-1)" title="Menos Séries" ${isReadOnly ? 'disabled' : ''}><i class="fas fa-minus"></i></button>
                        <input type="number" class="form-control form-control-sm series-value" value="${itemData.series || '3'}" min="1" max="10" readonly title="Séries">
                        <button type="button" class="btn btn-sm btn-outline-secondary series-btn" onclick="window.app.planManager.alterarSeries(this,${idHTML},1)" title="Mais Séries" ${isReadOnly ? 'disabled' : ''}><i class="fas fa-plus"></i></button>
                    </div>
                    <div class="series-detail-container"></div>
                </div>
            </div>
            <div style="grid-area:delete;" class="delete-button-container"><button class="btn btn-light btn-sm" onclick="this.closest('.sortable-item').remove()" title="Remover" ${isReadOnly ? 'disabled' : ''}><i class="fas fa-trash text-danger"></i></button></div>`;
        listContainer.appendChild(exerciseDiv);

        const seriesInput = exerciseDiv.querySelector('.series-value') as HTMLInputElement;
        if (seriesInput) {
            atualizarRepeticoes(seriesInput, idHTML); // Create series columns first

            // Now populate series data
            const seriesColumns = exerciseDiv.querySelectorAll('.series-detail-container .series-column');
            itemData.seriesData?.forEach((sd, index) => {
                if (seriesColumns[index]) {
                    const repInput = seriesColumns[index].querySelector('.manual-rep-tempo') as HTMLInputElement;
                    const repUnitSelect = seriesColumns[index].querySelector('.rep-tempo-unit') as HTMLSelectElement;
                    const pesoInput = seriesColumns[index].querySelector('.peso-value') as HTMLInputElement;
                    const pesoUnitSelect = seriesColumns[index].querySelector('.peso-unit') as HTMLSelectElement;

                    if (repInput) repInput.value = sd.repTempo || '';
                    if (repUnitSelect) repUnitSelect.value = sd.repTempoUnit || 'rep';
                    if (pesoInput) pesoInput.value = sd.peso || '';
                    if (pesoUnitSelect) pesoUnitSelect.value = sd.pesoUnit || 'lbs';
                }
            });
        }
         if (isReadOnly) itemData.highlight = 'neutral'; // No highlight in readonly for now
    } else if (itemData.type === 'observation') {
        const obsDiv = document.createElement('div');
        obsDiv.className = 'observation-container sortable-item border rounded mb-2 bg-light';
        obsDiv.dataset.highlightState = itemData.highlight || 'neutral';
         if (itemData.highlight && itemData.highlight !== 'neutral') {
            obsDiv.classList.add(`highlight-${itemData.highlight}`);
        }
        if (listContainer.children.length % 2 === 0) obsDiv.classList.add('exercise-alternate');

        obsDiv.innerHTML = `
            <div class="handle-container" style="grid-area:handle;"><i class="fas fa-grip-vertical handle text-muted" onclick="window.app.planManager.cycleHighlight(this)"></i></div>
            <div class="observation-content-wrapper" style="grid-area:input;"><input type="text" class="form-control form-control-sm observacao-texto observacao-texto-${idHTML}" placeholder="Observação..." title="Observação" value="${itemData.observacao || ''}" ${isReadOnly ? 'readonly' : ''}></div>
            <div style="grid-area:delete;" class="delete-button-container"><button class="btn btn-light btn-sm" onclick="this.closest('.sortable-item').remove()" title="Remover" ${isReadOnly ? 'disabled' : ''}><i class="fas fa-trash text-danger"></i></button></div>`;
        listContainer.appendChild(obsDiv);
        if (isReadOnly) itemData.highlight = 'neutral';
    }
}


export async function salvarPlano(idHTML: number) {
    const planoIndex = state.planos.findIndex(pl => pl.contadorPlano === idHTML);
    if (planoIndex === -1) { 
        showCustomAlert(`Erro: Plano com ID visual ${idHTML} não encontrado.`, true); 
        return; 
    }
    const planoOriginal = state.planos[planoIndex];
    const planoParaSalvar: Plan = JSON.parse(JSON.stringify(planoOriginal)); 
    
    const cardHeader = document.getElementById(`card-header-${idHTML}`);
    if (cardHeader) {
        const sessaoInput = cardHeader.querySelector('.sessao-inicio') as HTMLInputElement;
        const mesInput = cardHeader.querySelector('.sessao-fim') as HTMLInputElement;
        const statusSelect = cardHeader.querySelector('.status-select') as HTMLSelectElement;
        const mRefInputEl = cardHeader.querySelector('.m-ref-input') as HTMLInputElement;

        if (sessaoInput) planoParaSalvar.clienteContagem = sessaoInput.value;
        if (mesInput) planoParaSalvar.clienteMes = mesInput.value;
        if (statusSelect) planoParaSalvar.status = statusSelect.value;
        if (mRefInputEl) planoParaSalvar.mRef = mRefInputEl.value;
    }

    const exercisesData = getExercisesData(idHTML);
    planoParaSalvar.exercicios = exercisesData.exercises || [];
    planoParaSalvar.avaliacao = planoOriginal.avaliacao || null; 

    disableActionButtons();

    try {
        const responseData: SavePlanoApiResponse = await fetchApi('/api/planos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plano: planoParaSalvar, status: planoParaSalvar.status }) 
        }, 'salvarPlano');

        if (!responseData || !responseData.sucesso || responseData.erro) {
            throw new Error(responseData?.mensagem || responseData?.erro || "Falha ao salvar o plano.");
        }

        showCustomAlert(responseData.mensagem?.includes("arquivado") ? "Plano arquivado com sucesso!" : "Plano salvo com sucesso!", false);
        
        // Update local plano state with the response from the server
        // The server should return the complete, updated plan object including planUuid and other potentially generated fields.
        if (state.planos[planoIndex] && responseData.planUuid === state.planos[planoIndex].planUuid) {
            // Merge: Keep local UI-specific fields (like contadorPlano) but update all others from server
            const currentContadorPlano = state.planos[planoIndex].contadorPlano;
            state.planos[planoIndex] = { ...responseData, contadorPlano: currentContadorPlano } as Plan;
        } else { 
            // This case should ideally not happen if planUuid is consistent
            // If it does, find by UUID and update, or add if truly new (though save implies existing frontend object)
            const existingPlanIndex = state.planos.findIndex(p => p.planUuid === responseData.planUuid);
            if (existingPlanIndex !== -1) {
                const currentContadorPlano = state.planos[existingPlanIndex].contadorPlano;
                state.planos[existingPlanIndex] = {...responseData, contadorPlano: currentContadorPlano} as Plan;
            } else {
                // Fallback: if it's a new plan not previously in the list (e.g. after a clear and then save)
                // this might be more complex if UI relies on a specific order or `contadorPlano` sequence
                // For now, just push, but this scenario needs review based on app flow
                 console.warn("Plano salvo não encontrado na lista local por UUID, adicionando. Isso pode afetar a ordem da UI.");
                 state.planos.push({...responseData, contadorPlano: state.planos.length + 1} as Plan); // Assign new contadorPlano
            }
        }
        
        // Re-find the plan in the local state to ensure we're using the most up-to-date version for UI update
        const updatedLocalPlan = state.planos.find(p => p.planUuid === responseData.planUuid);

        if (updatedLocalPlan && cardHeader && updatedLocalPlan.contadorPlano !== undefined) {
            (cardHeader.querySelector('.status-select') as HTMLSelectElement).value = updatedLocalPlan.status;
            (cardHeader.querySelector('.sessao-inicio') as HTMLInputElement).value = updatedLocalPlan.clienteContagem ?? '';
            (cardHeader.querySelector('.sessao-fim') as HTMLInputElement).value = updatedLocalPlan.clienteMes ?? '';
            (cardHeader.querySelector('.m-ref-input') as HTMLInputElement).value = updatedLocalPlan.mRef ?? '';
            setReadOnlyState(updatedLocalPlan.contadorPlano, updatedLocalPlan.status === 'Done');
        }


    } catch (error: any) {
        globalHandleBackendError(error, '/api/planos POST (salvarPlano)');
    } finally {
        enableActionButtons();
    }
}

export function mostrarPlanos(r: { planos: Plan[], masterExercises: MasterExercises, erro?: string, mensagem?: string } | null) {
    if (!DOM.trainingPlansContainer) return;
    DOM.trainingPlansContainer.innerHTML = ''; 

    if (!r || r.erro) { // Error already handled by calling function (filtrarPlanos)
        resetHeaderStats(); 
        return;
    }

    state.MASTER_EXERCISE_DATA = r.masterExercises || {};
    state.planos = r.planos || [];
    
    const planosAbertosAnteriormente = new Set<string>(); 
    document.querySelectorAll<HTMLElement>('.plano-conteudo[style*="display: block"]').forEach(el => {
        const card = el.closest('.card') as HTMLElement;
        if (card?.dataset.planUuid) {
            planosAbertosAnteriormente.add(card.dataset.planUuid);
        }
    });
    
    state.contadorPlano = 0; 
    let treinosConcluidos = 0;
    const fragment = document.createDocumentFragment();

    if (state.planos.length === 0) {
        DOM.trainingPlansContainer.innerHTML = '<p class="text-center text-muted p-3">Nenhum plano encontrado para os filtros aplicados.</p>';
        resetHeaderStats(); 
    } else {
        state.planos.forEach((planoData, index) => {
            if (!planoData?.planUuid) {
                console.warn("Plano inválido encontrado, pulando:", planoData);
                return; 
            }
            planoData.contadorPlano = index + 1; // Assign unique ID for frontend DOM manipulation
            state.contadorPlano = planoData.contadorPlano; 

            const planoElemento = criarElementoPlano(planoData, planoData.contadorPlano, state.MASTER_EXERCISE_DATA);
            fragment.appendChild(planoElemento);
            if (planoData.status === 'Done') treinosConcluidos++;
        });
        DOM.trainingPlansContainer.appendChild(fragment);

        state.planos.forEach(p => {
            if (p.contadorPlano === undefined) return;
            const exerciseListEl = document.getElementById(`exercise-list-${p.contadorPlano}`) as HTMLElement;
            if (typeof Sortable !== 'undefined' && exerciseListEl && !(exerciseListEl as any).sortableInstance) {
                try {
                    (exerciseListEl as any).sortableInstance = new Sortable(exerciseListEl, { 
                        animation: 150, handle: '.handle', draggable: '.sortable-item', 
                        group: `plano-${p.contadorPlano}`, disabled: p.status === 'Done' 
                    });
                    if (p.status === 'Done') exerciseListEl.style.cursor = 'default';
                } catch (e) { console.error("Erro ao inicializar Sortable para plano:", p.contadorPlano, e); }
            } else if (exerciseListEl && (exerciseListEl as any).sortableInstance) {
                (exerciseListEl as any).sortableInstance.option('disabled', p.status === 'Done');
                exerciseListEl.style.cursor = p.status === 'Done' ? 'default' : 'grab';
            }

            if (p.planUuid && planosAbertosAnteriormente.has(p.planUuid)) {
                const cardElement = document.querySelector(`.card[data-plan-uuid="${p.planUuid}"]`) as HTMLElement;
                const contentElement = cardElement?.querySelector('.plano-conteudo') as HTMLElement;
                if (contentElement && (contentElement.style.display === 'none' || contentElement.style.display === '')) {
                    togglePlano(p.contadorPlano); 
                }
            }
        });
        
        if(DOM.treinosConcluidosInput) DOM.treinosConcluidosInput.value = String(treinosConcluidos);
        if(DOM.numeroTreinosInput) DOM.numeroTreinosInput.value = String(state.planos.length);
        if (state.planos.length > 0) { // Reset metrics summary if plans are shown
             if(DOM.filtroHorasInput) DOM.filtroHorasInput.value = '--';
             if(DOM.filtroNivelInput) DOM.filtroNivelInput.value = '--';
        }
    }
}

export function criarElementoPlano(planoData: Plan, idHTML: number, masterExercises: MasterExercises): HTMLElement {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card mb-3';
    cardDiv.dataset.planUuid = String(planoData.planUuid ?? '');
    
    const eventIdStr = String(planoData.eventId ?? '');
    const { clienteContagem, clienteMes, data, hora, duracao, cliente, status, planUuid, exercicios = [], cor, mRef } = planoData;
    const isDone = status === 'Done';
    const upperCaseCliente = String(cliente ?? '').toUpperCase();

    if (upperCaseCliente.includes('PRO DUO')) cardDiv.classList.add('pro-duo-card');
    else if (upperCaseCliente.includes('PRO')) cardDiv.classList.add('pro-card');
    else if (upperCaseCliente.includes('FISIO')) cardDiv.classList.add('fisio-card');
    else if (upperCaseCliente.includes('NUTRI')) cardDiv.classList.add('nutri-card');
    
    const backgroundColor = getCalendarColorStyle(cor);
    if (backgroundColor) cardDiv.style.backgroundColor = backgroundColor;

    // Updated onclicks to use window.app
    cardDiv.innerHTML = `
        <div class="card-header" id="card-header-${idHTML}" onclick="window.app.planManager.togglePlano(${idHTML})">
            <div title="Sessão"><span class="small text-muted">S:</span><input type="number" class="form-control form-control-sm sessao-inicio" value="${clienteContagem ?? ''}" ${isDone ? 'readonly' : ''}> <span class="text-muted">/</span> <input type="number" class="form-control form-control-sm sessao-fim" value="${clienteMes ?? ''}" ${isDone ? 'readonly' : ''}></div>
            <div title="Data"><span class="small text-muted">D:</span><input type="text" class="form-control form-control-sm" value="${data || ''}" readonly></div>
            <div title="Hora"><span class="small text-muted">H:</span><input type="text" class="form-control form-control-sm" value="${hora || ''}" readonly></div>
            <div title="Duração"><span class="small text-muted">T:</span><input type="text" class="form-control form-control-sm" value="${duracao || ''}" readonly></div>
            <div title="Cliente"><span class="small text-muted">Cli:</span><input type="text" class="form-control form-control-sm cliente-nome-display" value="${cliente || 'N/A'}" readonly></div>
            <div title="M.Ref"><span class="small text-muted">M.Ref:</span><input type="text" class="form-control form-control-sm m-ref-input" value="${mRef ?? ''}" placeholder="..." ${isDone ? 'readonly' : ''}></div>
            <div title="Status"><select class="status-select form-control form-control-sm" data-plano-id="${idHTML}" ${isDone ? 'disabled' : ''}><option value="Edit" ${status === 'Edit' ? 'selected' : ''}>Edit</option><option value="Done" ${status === 'Done' ? 'selected' : ''}>Done</option></select></div>
        </div>
        <div class="card-body plano-conteudo" id="plano-conteudo-${idHTML}" style="display:none;">
            <div class="exercise-list mb-3" id="exercise-list-${idHTML}"></div>
            <div class="d-flex justify-content-between flex-wrap mt-2" style="gap:10px;">
                <div class="d-flex flex-wrap" style="gap:5px;">
                    <button class="btn btn-primary btn-sm" onclick="window.app.planManager.adicionarExercicio(${idHTML})" ${isDone ? 'disabled' : ''} title="Adicionar Exercício"><i class="fas fa-plus"></i> Exer.</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.app.planManager.adicionarObservacao(${idHTML})" ${isDone ? 'disabled' : ''} title="Adicionar Observação"><i class="fas fa-comment-alt"></i> Obs.</button>
                    <button class="btn btn-info btn-sm avaliacao-btn" onclick="window.app.modalManager.abrirModalAvaliacao(${idHTML})" ${isDone ? 'disabled' : ''} title="Registar Avaliação"><i class="fas fa-clipboard-list"></i> Eva.</button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="window.app.planManager.copiarPlano(${idHTML})" title="Copiar Conteúdo"><i class="fas fa-copy"></i> Copiar</button>
                    <button class="btn btn-warning btn-sm" onclick="window.app.planManager.colarPlano(${idHTML})" ${isDone ? 'disabled' : ''} title="Colar Conteúdo"><i class="fas fa-paste"></i> Colar</button>
                </div>
                <button class="btn btn-success btn-sm salvar-btn ml-auto" onclick="window.app.planManager.salvarPlano(${idHTML})" data-plano-uuid="${String(planUuid ?? '')}" data-event-id="${eventIdStr}" ${isDone ? 'disabled' : ''} title="Salvar"><i class="fas fa-save"></i> Salvar</button>
            </div>
        </div>`;

    const listContainer = cardDiv.querySelector(`#exercise-list-${idHTML}`) as HTMLElement;
    if (listContainer) { 
      listContainer.addEventListener('input', handleExerciseListInput); 
      listContainer.addEventListener('change', handleExerciseListInput); 
    }

    const statusSelectEl = cardDiv.querySelector('.status-select') as HTMLSelectElement;
    const sessaoInicioEl = cardDiv.querySelector('.sessao-inicio') as HTMLInputElement;
    const sessaoFimEl = cardDiv.querySelector('.sessao-fim') as HTMLInputElement;
    const mRefInputEl = cardDiv.querySelector('.m-ref-input') as HTMLInputElement;

    // These should be attached in index.tsx or a dedicated event handler setup function
    // after elements are added to the DOM, or use event delegation on listContainer.
    // For now, assuming they are re-added or onclicks are handled.
    if (statusSelectEl) statusSelectEl.addEventListener('change', handleStatusChange);
    if (sessaoInicioEl) sessaoInicioEl.addEventListener('change', handleSessaoChange);
    if (sessaoFimEl) sessaoFimEl.addEventListener('change', handleSessaoChange);
    if (mRefInputEl && statusSelectEl) { 
        mRefInputEl.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
            const planoIdStr = statusSelectEl.dataset.planoId;
            if (planoIdStr) {
                const planoId = parseInt(planoIdStr, 10);
                const plano = state.planos.find(pl => pl.contadorPlano === planoId);
                if (plano) plano.mRef = target.value;
            }
        });
    }
    
    if (listContainer && exercicios?.length > 0) {
        exercicios.forEach(item => adicionarExercicioComDados(idHTML, item, listContainer, isDone, masterExercises));
    }
    setReadOnlyState(idHTML, isDone); 
    return cardDiv;
}

export function getExercisesData(idHTML: number): { exercises: Exercise[] } {
    const listContainer = document.getElementById(`exercise-list-${idHTML}`);
    if (!listContainer) return { exercises: [] };
    const items: Exercise[] = [];

    listContainer.querySelectorAll<HTMLElement>(':scope > .exercise-container, :scope > .observation-container').forEach(itemElement => {
        const highlightState = itemElement.dataset.highlightState as Exercise['highlight'] || 'neutral';
        if (itemElement.classList.contains('exercise-container')) {
            const objetivoEl = itemElement.querySelector(`.objetivo-${idHTML}`) as HTMLSelectElement;
            const grupoMuscularEl = itemElement.querySelector(`.grupoMuscular-${idHTML}`) as HTMLSelectElement;
            const exercicioEl = itemElement.querySelector(`.exercicio-${idHTML}`) as HTMLInputElement;
            const seriesInputEl = itemElement.querySelector('.series-value') as HTMLInputElement;

            const objetivo = objetivoEl?.value || '';
            const grupoMuscular = grupoMuscularEl?.value || '';
            const exerciseNameFromInput = exercicioEl?.value.trim() || '';
            const series = seriesInputEl ? parseInt(seriesInputEl.value, 10) : 0;
            const seriesDataItems: SeriesDataItem[] = [];

            itemElement.querySelectorAll('.series-detail-container .series-column').forEach(column => {
                const repInput = column.querySelector('.manual-rep-tempo') as HTMLInputElement;
                const repUnitSelect = column.querySelector('.rep-tempo-unit') as HTMLSelectElement;
                const pesoInput = column.querySelector('.peso-value') as HTMLInputElement;
                const pesoUnitSelect = column.querySelector('.peso-unit') as HTMLSelectElement;
                seriesDataItems.push({
                    repTempo: repInput?.value || '',
                    repTempoUnit: (repUnitSelect?.value as SeriesDataItem['repTempoUnit']) || 'rep',
                    peso: pesoInput?.value || '',
                    pesoUnit: (pesoUnitSelect?.value as SeriesDataItem['pesoUnit']) || 'lbs'
                });
            });
            
            if (seriesDataItems.length > series) seriesDataItems.length = series;
            while (seriesDataItems.length < series) seriesDataItems.push({ repTempo: '', repTempoUnit: 'rep', peso: '', pesoUnit: 'lbs' });
            
            if (objetivo || grupoMuscular || exerciseNameFromInput || seriesDataItems.some(d => d.repTempo || d.peso)) {
                items.push({
                    type: 'exercise', objetivo, grupoMuscular, 
                    exerciseName: exerciseNameFromInput, exercicio: exerciseNameFromInput, 
                    series, seriesData: seriesDataItems, highlight: highlightState
                });
            }
        } else if (itemElement.classList.contains('observation-container')) {
            const observacaoEl = itemElement.querySelector(`.observacao-texto-${idHTML}`) as HTMLInputElement;
            const observacaoValue = observacaoEl?.value.trim() || '';
            if (observacaoValue) {
                items.push({ type: 'observation', observacao: observacaoValue, highlight: highlightState });
            }
        }
    });
    return { exercises: items };
}

export function setReadOnlyState(idHTML: number, isReadOnly: boolean) {
    const card = document.querySelector(`#card-header-${idHTML}`)?.closest('.card') as HTMLElement;
    if (!card) return;

    card.classList.toggle('plan-readonly', isReadOnly);

    card.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.card-header input:not([readonly]):not(.cliente-nome-display), .card-header select').forEach(element => {
        if (element.tagName === 'SELECT') (element as HTMLSelectElement).disabled = isReadOnly;
        else (element as HTMLInputElement).readOnly = isReadOnly;
    });

    (card.querySelector('.salvar-btn') as HTMLButtonElement).disabled = isReadOnly;
    (card.querySelector('.avaliacao-btn') as HTMLButtonElement).disabled = isReadOnly;

    const exerciseListContainer = card.querySelector(`#exercise-list-${idHTML}`) as HTMLElement;
    if (exerciseListContainer) {
        const sortableInstance = (exerciseListContainer as any).sortableInstance;
        if (sortableInstance) {
            sortableInstance.option('disabled', isReadOnly);
            exerciseListContainer.style.cursor = isReadOnly ? 'default' : 'auto';
        }

        exerciseListContainer.querySelectorAll<HTMLElement>('.handle').forEach(handle => {
            handle.style.cursor = isReadOnly ? 'default' : 'grab';
            if (isReadOnly) handle.onclick = null;
            // Re-assigning onclick like this if it was removed, assuming cycleHighlight is globally available or on window.app
            else if (!handle.onclick) (handle as any).onclick = function() { (window as any).app.planManager.cycleHighlight(this as HTMLElement); };
        });

        exerciseListContainer.querySelectorAll<HTMLElement>('.sortable-item').forEach(item => {
            item.classList.toggle('item-readonly', isReadOnly);
            item.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:not([type="button"]), select, textarea').forEach(formEl => {
                if (formEl.tagName === 'SELECT') (formEl as HTMLSelectElement).disabled = isReadOnly;
                else (formEl as HTMLInputElement | HTMLTextAreaElement).readOnly = isReadOnly;
                
                formEl.style.backgroundColor = isReadOnly ? 'var(--google-gray-200)' : '';
                formEl.style.cursor = isReadOnly ? 'default' : '';
                formEl.style.borderColor = isReadOnly ? 'var(--google-gray-300)' : '';
                formEl.style.color = isReadOnly ? 'var(--google-gray-600)' : '';
                if (formEl.tagName === 'SELECT' && isReadOnly) (formEl as HTMLSelectElement).style.backgroundImage = 'none';
                else if (formEl.tagName === 'SELECT' && !isReadOnly) (formEl as HTMLSelectElement).style.backgroundImage = '';

                if (!isReadOnly && formEl.classList.contains('exercicio')) formEl.style.cursor = 'text';
            });

            item.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
                if (button.closest('.delete-button-container') || button.classList.contains('series-btn') || button.classList.contains('select-exercise-button')) {
                    button.disabled = isReadOnly;
                }
            });
        });
    }
}

export function copiarPlano(idHTML: number) { 
    const plano = state.planos.find(pL => pL.contadorPlano === idHTML); 
    if (!plano) { showCustomAlert(`Erro: Plano ${idHTML} não encontrado.`, true); return; } 
    state.clipboardPlanoData = getExercisesData(idHTML); 
    if (state.clipboardPlanoData?.exercises?.length > 0) showCustomAlert("Conteúdo do plano copiado!", false); 
    else { showCustomAlert("Nenhum exercício ou observação para copiar.", false); state.clipboardPlanoData = null; } 
}

export function colarPlano(idHTML: number) {
    if (!state.clipboardPlanoData?.exercises?.length) { showCustomAlert("Nada para colar. Copie um plano primeiro.", false); return; }
    const targetPlano = state.planos.find(pL => pL.contadorPlano === idHTML);
    if (!targetPlano) { showCustomAlert(`Erro: Plano alvo ${idHTML} não encontrado.`, true); return; }
    
    const cardHeader = document.getElementById(`card-header-${idHTML}`);
    const statusSelect = cardHeader?.querySelector('.status-select') as HTMLSelectElement;
    if (statusSelect?.value === 'Done') { 
        showCustomAlert("Não é possível colar em um plano finalizado ('Done').", true); return; 
    }

    const targetListContainer = document.getElementById(`exercise-list-${idHTML}`) as HTMLElement;
    if (!targetListContainer) { showCustomAlert(`Container de exercícios para o plano ${idHTML} não encontrado.`, true); return; }
    
    targetListContainer.innerHTML = ''; 
    state.clipboardPlanoData.exercises.forEach(item => {
        adicionarExercicioComDados(idHTML, item, targetListContainer, false, state.MASTER_EXERCISE_DATA);
    });
    showCustomAlert("Conteúdo colado! Lembre-se de salvar o plano.", false);
}

export function cycleHighlight(handleIcon: HTMLElement) {
    const item = handleIcon.closest('.sortable-item') as HTMLElement;
    if (!item || item.classList.contains('item-readonly')) return;
    const currentState = item.dataset.highlightState as Exercise['highlight'] || 'neutral';
    let nextState: Exercise['highlight'];
    if (currentState === 'neutral') nextState = 'blue';
    else if (currentState === 'blue') nextState = 'grey';
    else nextState = 'neutral';
    item.dataset.highlightState = nextState;
    item.classList.remove('highlight-blue', 'highlight-grey');
    if (nextState !== 'neutral') item.classList.add(`highlight-${nextState}`);
}

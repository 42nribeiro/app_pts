import * as DOM from './domElements';
import { state } from './config';
import { formatAvaliacaoKey, showCustomAlert, showLoadingIndicator } from './uiUtils';
export function updateOrCreateChart(chartId, chartType, data, options) {
    const canvasEl = document.getElementById(chartId);
    if (!canvasEl) {
        console.error(`Canvas element ${chartId} not found.`);
        return null;
    }
    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
        console.error(`Could not get 2D context for canvas ${chartId}.`);
        return null;
    }
    if (state.activeCharts[chartId]) {
        state.activeCharts[chartId].data = data;
        if (options) {
            state.activeCharts[chartId].options = Chart.helpers.merge(state.activeCharts[chartId].options, options);
        }
        state.activeCharts[chartId].update();
    }
    else {
        state.activeCharts[chartId] = new Chart(ctx, { type: chartType, data: data, options: options || {} });
    }
    return state.activeCharts[chartId];
}
export function updateEvaluationChartsDisplay(hideXAxisCompletely = false) {
    if (!state.allFetchedEvalSeriesData || !DOM.selectEvalMetric) {
        if (DOM.evalMainChartContainer)
            DOM.evalMainChartContainer.style.display = 'none';
        if (DOM.evalAllChartsContainer)
            DOM.evalAllChartsContainer.style.display = 'none';
        if (DOM.estatisticasGraficosContainer)
            DOM.estatisticasGraficosContainer.style.display = 'none';
        return;
    }
    const selectedMetricKey = DOM.selectEvalMetric.value;
    const metricConfigs = [
        { key: 'peso', label: 'Peso (kg)', color: 'rgb(75,192,192)' },
        { key: 'massaGorda', label: 'Massa Gorda', color: 'rgb(255,99,132)' },
        { key: 'massaMuscular', label: 'Massa Muscular', color: 'rgb(54,162,235)' },
        { key: 'metabolismoBasal', label: 'Metab. Basal (kcal)', color: 'rgb(255,205,86)' },
        { key: 'h2o', label: 'H2O (%)', color: 'rgb(153,102,255)' },
        { key: 'gorduraVisceral', label: 'Gordura Visceral (nível)', color: 'rgb(255,159,64)' }
    ];
    const commonChartOptionsBase = {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: {
            x: { type: 'time', time: { unit: 'day', tooltipFormat: 'dd MMM yyyy', displayFormats: { day: 'dd MMM' } }, ticks: { source: 'data', autoSkip: true, maxRotation: 45, minRotation: 0 }, grid: { display: true }, title: { display: false } },
            y: { beginAtZero: false, ticks: { display: true }, grid: { display: true }, title: { display: true, text: '' } }
        },
        plugins: {
            legend: { display: true, position: 'top', labels: { boxWidth: 15, padding: 10, font: { size: 10 } } },
            tooltip: { mode: 'index', intersect: false, bodySpacing: 5, titleSpacing: 6, titleFont: { size: 13 }, bodyFont: { size: 11 }, footerFont: { size: 9 } },
            datalabels: {
                display: true, align: 'top', anchor: 'end', offset: 6,
                backgroundColor: (context) => context.dataset.borderColor || 'rgba(0,0,0,0.7)',
                borderRadius: 4, color: 'white', font: { weight: 'normal', size: 9 }, padding: { top: 2, bottom: 1, left: 4, right: 4 },
                formatter: (value, context) => {
                    if (typeof value === 'number') {
                        const labelLower = (context.dataset.label || '').toLowerCase();
                        if (labelLower.includes('peso') || labelLower.includes('muscular') || labelLower.includes('gorda'))
                            return value.toFixed(1);
                        if (labelLower.includes('metab. basal') || labelLower.includes('visceral'))
                            return value.toFixed(0);
                        return value.toFixed(1);
                    }
                    return value;
                }
            }
        }
    };
    const getChartOptions = (yTitle = '', hideX = false) => {
        const opts = JSON.parse(JSON.stringify(commonChartOptionsBase));
        if (opts.scales?.y?.title)
            opts.scales.y.title.text = yTitle;
        if (opts.scales?.y?.title)
            opts.scales.y.title.display = !hideX;
        if (opts.scales?.x?.ticks)
            opts.scales.x.ticks.display = !hideX;
        if (opts.scales?.x?.grid)
            opts.scales.x.grid.display = !hideX;
        return opts;
    };
    if (selectedMetricKey === "all") {
        if (DOM.evalMainChartContainer)
            DOM.evalMainChartContainer.style.display = 'none';
        if (DOM.evalAllChartsContainer)
            DOM.evalAllChartsContainer.style.display = 'flex';
        DOM.evalAllChartsContainer.innerHTML = '';
        let hasAnySmallChartData = false;
        metricConfigs.forEach(m => {
            const seriesData = state.allFetchedEvalSeriesData[m.key];
            const chartWrapperDiv = document.createElement('div');
            chartWrapperDiv.className = 'col-lg-4 col-md-6 mb-3';
            const chartContainerDiv = document.createElement('div');
            chartContainerDiv.className = 'chart-container';
            const canvasEl = document.createElement('canvas');
            const chartId = `chart-${m.key.replace(/\s/g, '-')}`;
            canvasEl.id = chartId;
            chartContainerDiv.appendChild(canvasEl);
            chartWrapperDiv.appendChild(chartContainerDiv);
            DOM.evalAllChartsContainer.appendChild(chartWrapperDiv);
            if (seriesData && seriesData.length > 0) {
                hasAnySmallChartData = true;
                const chartData = {
                    labels: seriesData.map(i => i.date),
                    datasets: [{ label: m.label, data: seriesData.map(i => i.value), borderColor: m.color, backgroundColor: m.color.replace('rgb', 'rgba').replace(')', ',0.2)'), tension: 0.1, fill: true, pointRadius: 3, pointHoverRadius: 5 }]
                };
                const chartOptions = getChartOptions(m.label.split('(')[0].trim(), hideXAxisCompletely);
                updateOrCreateChart(chartId, 'line', chartData, chartOptions);
            }
            else {
                chartContainerDiv.innerHTML = `<canvas id="${chartId}"></canvas><p class="text-muted small text-center p-2">Sem dados para ${m.label.split('(')[0].trim()}</p>`;
                if (state.activeCharts[chartId]) {
                    state.activeCharts[chartId].destroy();
                    delete state.activeCharts[chartId];
                }
            }
        });
        if (DOM.estatisticasGraficosContainer)
            DOM.estatisticasGraficosContainer.style.display = hasAnySmallChartData ? 'block' : 'none';
        if (!hasAnySmallChartData && DOM.evalAllChartsContainer)
            DOM.evalAllChartsContainer.innerHTML = '<p class="col-12 text-muted small text-center">Nenhuma data para as métricas de avaliação.</p>';
    }
    else {
        if (DOM.evalMainChartContainer)
            DOM.evalMainChartContainer.style.display = 'block';
        if (DOM.evalAllChartsContainer)
            DOM.evalAllChartsContainer.style.display = 'none';
        if (DOM.evalMainChartContainer && !document.getElementById('chart-evaluation-main')) {
            DOM.evalMainChartContainer.innerHTML = '<canvas id="chart-evaluation-main"></canvas>';
        }
        const seriesData = state.allFetchedEvalSeriesData[selectedMetricKey];
        const metricConfig = metricConfigs.find(m => m.key === selectedMetricKey) || { label: selectedMetricKey, color: 'rgb(75,192,192)' };
        const chartId = 'chart-evaluation-main';
        if (seriesData && seriesData.length > 0) {
            const chartData = {
                labels: seriesData.map(i => i.date),
                datasets: [{ label: metricConfig.label, data: seriesData.map(i => i.value), borderColor: metricConfig.color, backgroundColor: metricConfig.color.replace('rgb', 'rgba').replace(')', ',0.2)'), tension: 0.1, fill: true, pointRadius: 3, pointHoverRadius: 5 }]
            };
            const chartOptions = getChartOptions(metricConfig.label.split('(')[0].trim(), hideXAxisCompletely);
            updateOrCreateChart(chartId, 'line', chartData, chartOptions);
            if (DOM.estatisticasGraficosContainer)
                DOM.estatisticasGraficosContainer.style.display = 'block';
        }
        else {
            if (DOM.evalMainChartContainer)
                DOM.evalMainChartContainer.innerHTML = `<canvas id="chart-evaluation-main"></canvas><p class="text-muted small text-center p-2">Sem dados para ${metricConfig.label.split('(')[0].trim()}.</p>`;
            if (state.activeCharts[chartId]) {
                state.activeCharts[chartId].destroy();
                delete state.activeCharts[chartId];
            }
            if (DOM.estatisticasGraficosContainer)
                DOM.estatisticasGraficosContainer.style.display = 'none';
        }
    }
}
export function updateExerciseLoadChartsByGroup(hideXAxisCompletely = false) {
    if (!state.allFetchedExerciseProgressData || !DOM.exerciseLoadChartsByGroup || !DOM.selectMuscleGroupProgress) {
        if (DOM.exerciseLoadChartsByGroup)
            DOM.exerciseLoadChartsByGroup.innerHTML = '<p class="col-12 text-muted small text-center">Sem dados de progressão de carga.</p>';
        if (DOM.exerciseMainProgressChartContainer)
            DOM.exerciseMainProgressChartContainer.style.display = 'none';
        return;
    }
    const selectedMuscleGroupFilter = DOM.selectMuscleGroupProgress.value;
    DOM.exerciseLoadChartsByGroup.innerHTML = '';
    let exercisesToDisplay = [];
    if (selectedMuscleGroupFilter === "" || selectedMuscleGroupFilter === "all_groups_top") {
        exercisesToDisplay = Object.entries(state.allFetchedExerciseProgressData)
            .map(([groupName, exercises]) => Object.entries(exercises).map(([exName, exData]) => ({
            name: exName, data: exData.progressData, group: groupName
        })))
            .flat()
            .filter(ex => ex.data && ex.data.length > 0)
            .sort((a, b) => b.data.length - a.data.length)
            .slice(0, 6);
    }
    else {
        if (state.allFetchedExerciseProgressData[selectedMuscleGroupFilter]) {
            Object.entries(state.allFetchedExerciseProgressData[selectedMuscleGroupFilter]).forEach(([exName, exData]) => {
                if (exData.progressData && exData.progressData.length > 0) {
                    exercisesToDisplay.push({ name: exName, data: exData.progressData, group: selectedMuscleGroupFilter });
                }
            });
            exercisesToDisplay.sort((a, b) => a.name.localeCompare(b.name));
        }
    }
    if (exercisesToDisplay.length > 0) {
        if (DOM.exerciseMainProgressChartContainer)
            DOM.exerciseMainProgressChartContainer.style.display = 'block';
    }
    else {
        if (DOM.exerciseMainProgressChartContainer)
            DOM.exerciseMainProgressChartContainer.style.display = 'none';
        DOM.exerciseLoadChartsByGroup.innerHTML = `<p class="col-12 text-muted small text-center">Sem dados de progressão de carga para ${selectedMuscleGroupFilter === "all_groups_top" ? "os filtros selecionados" : selectedMuscleGroupFilter}.</p>`;
        return;
    }
    const chartColors = ['rgba(255,99,132,0.9)', 'rgba(54,162,235,0.9)', 'rgba(255,206,86,0.9)', 'rgba(75,192,192,0.9)', 'rgba(153,102,255,0.9)', 'rgba(255,159,64,0.9)'];
    let colorIndex = 0;
    const commonLineOptionsBase = {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: {
            x: { type: 'time', time: { unit: 'day', tooltipFormat: 'dd MMM yyyy', displayFormats: { day: 'dd MMM' } }, ticks: { source: 'data', autoSkip: true, maxRotation: 45, minRotation: 0 }, grid: { display: true }, title: { display: false } },
            y: { beginAtZero: false, ticks: { display: true, padding: 5 }, grid: { display: true }, title: { display: true, text: 'Peso Carga', font: { size: 10 } } }
        },
        plugins: {
            legend: { display: true, position: 'top', labels: { padding: 8, boxWidth: 12, font: { size: 10 } } },
            tooltip: { mode: 'index', intersect: false, bodySpacing: 4, titleSpacing: 5, titleFont: { size: 12 }, bodyFont: { size: 10 } },
            datalabels: { display: true, align: 'top', anchor: 'end', offset: 5, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 3, color: 'white', font: { weight: 'normal', size: 8 }, padding: { top: 1, bottom: 1, left: 3, right: 3 }, formatter: (value) => typeof value === 'number' ? value.toFixed(1) : value }
        },
        font: { size: 10 }
    };
    const getLineChartOptions = (yTitle = 'Peso Carga', hideX = false) => {
        const opts = JSON.parse(JSON.stringify(commonLineOptionsBase));
        if (opts.scales?.y?.title)
            opts.scales.y.title.text = yTitle;
        if (opts.scales?.y?.title)
            opts.scales.y.title.display = !hideX;
        if (opts.scales?.x?.ticks)
            opts.scales.x.ticks.display = !hideX;
        if (opts.scales?.x?.grid)
            opts.scales.x.grid.display = !hideX;
        return opts;
    };
    exercisesToDisplay.forEach(ex => {
        const progressData = ex.data;
        if (progressData && progressData.length > 0) {
            const chartId = `chart-ex-load-${(ex.group ? ex.group.replace(/[^a-zA-Z0-9]/g, '') + '-' : '') + ex.name.replace(/[^a-zA-Z0-9]/g, '')}`;
            const chartWrapperDiv = document.createElement('div');
            chartWrapperDiv.className = 'col-md-6 mb-3';
            const chartContainerDiv = document.createElement('div');
            chartContainerDiv.className = 'chart-container';
            const canvasEl = document.createElement('canvas');
            canvasEl.id = chartId;
            chartContainerDiv.appendChild(canvasEl);
            chartWrapperDiv.appendChild(chartContainerDiv);
            DOM.exerciseLoadChartsByGroup.appendChild(chartWrapperDiv);
            const currentColor = chartColors[colorIndex % chartColors.length];
            const chartData = {
                labels: progressData.map(i => i.date),
                datasets: [{ label: `${ex.name} (${progressData[0]?.unit || 'kg'})`, data: progressData.map(i => i.weight), borderColor: currentColor, backgroundColor: currentColor.replace('0.9)', '0.2)'), tension: 0.1, fill: true, pointRadius: 2, pointHoverRadius: 4 }]
            };
            const chartOptions = getLineChartOptions(`Peso (${progressData[0]?.unit || 'kg'})`, hideXAxisCompletely);
            updateOrCreateChart(chartId, 'line', chartData, chartOptions);
            colorIndex++;
        }
    });
}
export function mostrarResultadosEstatisticas(data) {
    showLoadingIndicator(false);
    if (!DOM.estatisticasModal || !DOM.estatisticasModalOverlay || !DOM.estatisticasTitulo ||
        !DOM.estatisticasClientePeriodo || !DOM.estatisticasPlanosDetalhes ||
        !DOM.estatisticasWorkoutAnalysisContainer || !DOM.estatisticasSemDados ||
        !DOM.exportOptionsContainer || !DOM.selectEvalMetric || !DOM.selectMuscleGroupProgress) {
        console.error("Um ou mais elementos do modal de estatísticas não foram encontrados.");
        showCustomAlert("Erro ao exibir estatísticas: componentes da UI ausentes.", true);
        return;
    }
    if (!data || data.erro) {
        showCustomAlert(data?.mensagem || data?.erro || "Erro ao carregar estatísticas.", true);
        DOM.estatisticasModal.style.display = 'none';
        DOM.estatisticasModalOverlay.style.display = 'none';
        DOM.exportOptionsContainer.style.display = 'none';
        return;
    }
    DOM.estatisticasTitulo.textContent = `Estatísticas: ${data.clienteNome}`;
    DOM.estatisticasClientePeriodo.textContent = `Período: ${data.periodo.inicio} - ${data.periodo.fim}`;
    DOM.estatisticasPlanosDetalhes.innerHTML = '<h6><i class="fas fa-clipboard-list"></i> Detalhes dos Treinos no Período</h6>';
    if (DOM.exerciseLoadChartsByGroup)
        DOM.exerciseLoadChartsByGroup.innerHTML = '';
    let hasAnyDataAtAll = false;
    if (data.planosDetalhes && data.planosDetalhes.length > 0) {
        hasAnyDataAtAll = true;
        DOM.estatisticasPlanosDetalhes.style.display = 'block';
        data.planosDetalhes.forEach(pl => {
            const planoElement = document.createElement('div');
            planoElement.className = 'mb-3 p-2 border rounded bg-light';
            let planoHTML = `<p class="mb-1"><strong>Data: ${pl.data}</strong></p>`;
            if (pl.avaliacao && Object.keys(pl.avaliacao).some(k => pl.avaliacao[k] !== null && pl.avaliacao[k] !== '' && k !== 'error')) {
                planoHTML += '<div class="mb-1"><strong>Avaliação Física:</strong><ul class="list-unstyled small mb-0 pl-3">';
                for (const k in pl.avaliacao) {
                    if (pl.avaliacao[k] !== null && pl.avaliacao[k] !== '' && k !== 'error') {
                        planoHTML += `<li><span class="text-muted">${formatAvaliacaoKey(k)}:</span> ${pl.avaliacao[k]}</li>`;
                    }
                }
                planoHTML += '</ul></div>';
            }
            if (pl.exercicios && pl.exercicios.length > 0) {
                planoHTML += '<div class="mt-1"><strong>Exercícios:</strong><ul class="list-unstyled small mb-0 pl-3">';
                pl.exercicios.forEach((ex) => {
                    planoHTML += `<li>`;
                    if (ex.type === 'exercise') {
                        planoHTML += `<strong>${ex.exerciseName || ex.exercicio || 'Exercício'}</strong> <small class="text-muted">(${ex.grupoMuscular || 'N/A'} | ${ex.objetivo || 'N/A'})</small>`;
                        if (ex.seriesData && ex.seriesData.length > 0) {
                            planoHTML += ` <span class="text-info">- ${ex.series || ex.seriesData.length}x: `;
                            ex.seriesData.forEach(sd => { planoHTML += `[${sd.repTempo || '-'}${sd.repTempoUnit || ''} @ ${sd.peso || '-'}${sd.pesoUnit || ''}] `; });
                            planoHTML += '</span>';
                        }
                    }
                    else if (ex.type === 'observation' && ex.observacao) {
                        planoHTML += `<span class="text-muted"><em>Obs: ${ex.observacao}</em></span>`;
                    }
                    planoHTML += '</li>';
                });
                planoHTML += '</ul></div>';
            }
            planoElement.innerHTML = planoHTML;
            DOM.estatisticasPlanosDetalhes.appendChild(planoElement);
        });
    }
    else {
        DOM.estatisticasPlanosDetalhes.style.display = 'none';
    }
    Object.keys(state.activeCharts).forEach(key => {
        if (state.activeCharts[key] && typeof state.activeCharts[key].destroy === 'function') {
            state.activeCharts[key].destroy();
            delete state.activeCharts[key];
        }
    });
    state.allFetchedEvalSeriesData = data.avaliacoesSeries || {};
    state.allFetchedExerciseProgressData = data.workoutAnalysis?.exerciseWeightProgress || {};
    const hideIndividualAxisAndScale = DOM.toggleXAxisLabelsCheckbox?.checked ?? true;
    if (DOM.selectEvalMetric) {
        DOM.selectEvalMetric.removeEventListener('change', toggleChartXAxisLabels);
        DOM.selectEvalMetric.addEventListener('change', toggleChartXAxisLabels);
        if (Object.keys(state.allFetchedEvalSeriesData).length > 0 && Object.values(state.allFetchedEvalSeriesData).some(arr => arr && arr.length > 0)) {
            updateEvaluationChartsDisplay(hideIndividualAxisAndScale);
            hasAnyDataAtAll = true;
            if (DOM.estatisticasGraficosContainer)
                DOM.estatisticasGraficosContainer.style.display = 'block';
        }
        else {
            if (DOM.estatisticasGraficosContainer)
                DOM.estatisticasGraficosContainer.style.display = 'none';
            if (DOM.evalMainChartContainer)
                DOM.evalMainChartContainer.style.display = 'none';
            if (DOM.evalAllChartsContainer)
                DOM.evalAllChartsContainer.style.display = 'none';
        }
    }
    else if (DOM.estatisticasGraficosContainer) {
        DOM.estatisticasGraficosContainer.style.display = 'none';
    }
    if (DOM.selectMuscleGroupProgress) {
        DOM.selectMuscleGroupProgress.innerHTML = '<option value="all_groups_top">-- Top Exercícios (Todos Grupos) --</option>';
        if (data.workoutAnalysis?.exerciseWeightProgress) {
            const muscleGroupsWithData = Object.keys(data.workoutAnalysis.exerciseWeightProgress);
            muscleGroupsWithData.sort().forEach(groupName => {
                if (data.workoutAnalysis.exerciseWeightProgress[groupName] &&
                    Object.values(data.workoutAnalysis.exerciseWeightProgress[groupName]).some((ex) => ex.progressData && ex.progressData.length > 0)) {
                    const option = document.createElement('option');
                    option.value = groupName;
                    option.textContent = groupName;
                    DOM.selectMuscleGroupProgress.appendChild(option);
                }
            });
        }
        DOM.selectMuscleGroupProgress.removeEventListener('change', toggleChartXAxisLabels);
        DOM.selectMuscleGroupProgress.addEventListener('change', toggleChartXAxisLabels);
        if (Object.keys(state.allFetchedExerciseProgressData).length > 0 &&
            Object.values(state.allFetchedExerciseProgressData).some(group => Object.values(group).some(ex => ex.progressData && ex.progressData.length > 0))) {
            updateExerciseLoadChartsByGroup(hideIndividualAxisAndScale);
            hasAnyDataAtAll = true;
            if (DOM.exerciseMainProgressChartContainer)
                DOM.exerciseMainProgressChartContainer.style.display = 'block';
        }
        else {
            if (DOM.exerciseMainProgressChartContainer)
                DOM.exerciseMainProgressChartContainer.style.display = 'none';
        }
    }
    else if (DOM.exerciseMainProgressChartContainer) {
        DOM.exerciseMainProgressChartContainer.style.display = 'none';
    }
    let hasWorkoutPieData = false;
    const chartColorsPie = ['rgba(255,99,132,0.85)', 'rgba(54,162,235,0.85)', 'rgba(255,206,86,0.85)', 'rgba(75,192,192,0.85)', 'rgba(153,102,255,0.85)', 'rgba(255,159,64,0.85)', 'rgba(201,203,207,0.85)', 'rgba(50,50,50,0.85)'];
    if (data.workoutAnalysis) {
        const muscleGroupCanvas = document.getElementById('chart-muscle-group');
        if (data.workoutAnalysis.muscleGroupUsage && Object.keys(data.workoutAnalysis.muscleGroupUsage).length > 0 && muscleGroupCanvas) {
            hasWorkoutPieData = true;
            const muscleGroupLabels = Object.keys(data.workoutAnalysis.muscleGroupUsage);
            const muscleGroupDataValues = Object.values(data.workoutAnalysis.muscleGroupUsage);
            const muscleGroupChartData = { labels: muscleGroupLabels, datasets: [{ label: 'Grupos Musculares', data: muscleGroupDataValues, backgroundColor: chartColorsPie.slice(0, muscleGroupLabels.length) }] };
            const muscleGroupChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 9 }, boxWidth: 10, padding: 8 } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 9 }, formatter: (value, ctx) => { let sum = 0; let dataArr = ctx.chart.data.datasets[0].data; dataArr.forEach(dVal => { sum += dVal; }); if (sum === 0)
                            return "0.0%"; let percentage = (value * 100 / sum).toFixed(1) + "%"; return percentage; } } } };
            updateOrCreateChart('chart-muscle-group', 'doughnut', muscleGroupChartData, muscleGroupChartOptions);
        }
        else if (muscleGroupCanvas) {
            if (state.activeCharts['chart-muscle-group']) {
                state.activeCharts['chart-muscle-group'].destroy();
                delete state.activeCharts['chart-muscle-group'];
            }
            const ctx = muscleGroupCanvas.getContext('2d');
            if (ctx)
                ctx.clearRect(0, 0, muscleGroupCanvas.width, muscleGroupCanvas.height);
        }
        const objectiveCanvas = document.getElementById('chart-objective');
        if (data.workoutAnalysis.objectiveUsage && Object.keys(data.workoutAnalysis.objectiveUsage).length > 0 && objectiveCanvas) {
            hasWorkoutPieData = true;
            const objectiveLabels = Object.keys(data.workoutAnalysis.objectiveUsage);
            const objectiveDataValues = Object.values(data.workoutAnalysis.objectiveUsage);
            const objectiveChartData = { labels: objectiveLabels, datasets: [{ label: 'Objetivos', data: objectiveDataValues, backgroundColor: chartColorsPie.slice(0, objectiveLabels.length).reverse() }] };
            const objectiveChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 9 }, boxWidth: 10, padding: 8 } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 9 }, formatter: (value, ctx) => { let sum = 0; let dataArr = ctx.chart.data.datasets[0].data; dataArr.forEach(dVal => { sum += dVal; }); if (sum === 0)
                            return "0.0%"; let percentage = (value * 100 / sum).toFixed(1) + "%"; return percentage; } } } };
            updateOrCreateChart('chart-objective', 'doughnut', objectiveChartData, objectiveChartOptions);
        }
        else if (objectiveCanvas) {
            if (state.activeCharts['chart-objective']) {
                state.activeCharts['chart-objective'].destroy();
                delete state.activeCharts['chart-objective'];
            }
            const ctx = objectiveCanvas.getContext('2d');
            if (ctx)
                ctx.clearRect(0, 0, objectiveCanvas.width, objectiveCanvas.height);
        }
    }
    const showWorkoutAnalysisContainer = hasWorkoutPieData || (DOM.selectMuscleGroupProgress && Object.keys(state.allFetchedExerciseProgressData || {}).length > 0 && Object.values(state.allFetchedExerciseProgressData || {}).some(g => Object.keys(g).length > 0));
    if (DOM.estatisticasWorkoutAnalysisContainer)
        DOM.estatisticasWorkoutAnalysisContainer.style.display = showWorkoutAnalysisContainer ? 'block' : 'none';
    if (showWorkoutAnalysisContainer)
        hasAnyDataAtAll = true;
    DOM.estatisticasSemDados.style.display = !hasAnyDataAtAll ? 'block' : 'none';
    DOM.exportOptionsContainer.style.display = hasAnyDataAtAll ? 'block' : 'none';
    DOM.estatisticasModalOverlay.style.display = 'block';
    DOM.estatisticasModal.style.display = 'flex';
    setTimeout(() => {
        if (DOM.estatisticasModal)
            DOM.estatisticasModal.classList.add('show');
        if (DOM.estatisticasModalOverlay)
            DOM.estatisticasModalOverlay.classList.add('show');
    }, 50);
}
export function toggleChartXAxisLabels() {
    const hide = DOM.toggleXAxisLabelsCheckbox?.checked ?? true;
    updateEvaluationChartsDisplay(hide);
    updateExerciseLoadChartsByGroup(hide);
}
export function aplicarOpcoesImpressao(targetElementId = 'estatisticas-body-content', forPdfCapture = false) {
    const contentToProcess = document.getElementById(targetElementId);
    if (!contentToProcess)
        return;
    const sections = {
        evalMetrics: DOM.estatisticasGraficosContainer,
        workoutAnalysis: DOM.estatisticasWorkoutAnalysisContainer,
        planDetails: DOM.estatisticasPlanosDetalhes
    };
    Object.keys(sections).forEach(key => {
        const checkbox = document.getElementById(`printOpt${key.charAt(0).toUpperCase() + key.slice(1)}`);
        const sectionEl = sections[key];
        if (sectionEl) {
            const shouldBeVisible = checkbox ? checkbox.checked : true;
            if (forPdfCapture) {
                sectionEl.style.display = shouldBeVisible ? '' : 'none';
            }
            else {
                if (shouldBeVisible) {
                    sectionEl.classList.remove('d-print-none-true');
                }
                else {
                    sectionEl.classList.add('d-print-none-true');
                }
            }
        }
    });
    if (forPdfCapture) {
        if (!contentToProcess.dataset.originalHeight) {
            contentToProcess.dataset.originalHeight = contentToProcess.style.height;
            contentToProcess.dataset.originalOverflowY = contentToProcess.style.overflowY;
            contentToProcess.dataset.originalMaxHeight = contentToProcess.style.maxHeight;
        }
        contentToProcess.style.height = 'auto';
        contentToProcess.style.overflowY = 'visible';
        contentToProcess.style.maxHeight = 'none';
        const modalContent = DOM.estatisticasModal?.querySelector('.modal-content');
        if (modalContent && !modalContent.dataset.originalMaxHeight) {
            modalContent.dataset.originalMaxHeight = modalContent.style.maxHeight;
            modalContent.style.maxHeight = 'none';
        }
    }
}
export function reverterOpcoesImpressao(targetElementId = 'estatisticas-body-content') {
    const contentToProcess = document.getElementById(targetElementId);
    if (!contentToProcess)
        return;
    document.querySelectorAll('.d-print-none-true').forEach(el => el.classList.remove('d-print-none-true'));
    document.querySelectorAll('#estatisticas-body-content [style*="display: none"]').forEach(el => {
        const sectionId = el.id;
        let optKey = '';
        if (sectionId === 'estatisticas-graficos-container')
            optKey = 'EvalMetrics';
        else if (sectionId === 'estatisticas-workout-analysis-container')
            optKey = 'WorkoutAnalysis';
        else if (sectionId === 'estatisticas-planos-detalhes')
            optKey = 'PlanDetails';
        const checkbox = optKey ? document.getElementById(`printOpt${optKey}`) : null;
        if (checkbox && checkbox.checked) {
            el.style.display = '';
        }
        else if (!checkbox && sectionId) {
            if (!checkbox)
                el.style.display = '';
        }
    });
    if (contentToProcess.dataset.originalHeight !== undefined) {
        contentToProcess.style.height = contentToProcess.dataset.originalHeight;
        contentToProcess.style.overflowY = contentToProcess.dataset.originalOverflowY;
        contentToProcess.style.maxHeight = contentToProcess.dataset.originalMaxHeight;
        delete contentToProcess.dataset.originalHeight;
        delete contentToProcess.dataset.originalOverflowY;
        delete contentToProcess.dataset.originalMaxHeight;
    }
    const modalContent = DOM.estatisticasModal?.querySelector('.modal-content');
    if (modalContent && modalContent.dataset.originalMaxHeight !== undefined) {
        modalContent.style.maxHeight = modalContent.dataset.originalMaxHeight;
        delete modalContent.dataset.originalMaxHeight;
    }
}
export function imprimirEstatisticas() {
    if (!DOM.estatisticasModal)
        return;
    aplicarOpcoesImpressao('estatisticas-body-content', false);
    DOM.estatisticasModal.classList.add('print-mode');
    setTimeout(() => {
        window.print();
    }, 250);
}
if (typeof window !== 'undefined') {
    window.onafterprint = () => {
        if (DOM.estatisticasModal)
            DOM.estatisticasModal.classList.remove('print-mode');
        reverterOpcoesImpressao('estatisticas-body-content');
    };
}
export async function baixarPdfEstatisticas() {
    if (!DOM.estatisticasModal || !DOM.estatisticasBodyContent || !DOM.estatisticasTitulo || !DOM.estatisticasClientePeriodo)
        return;
    showLoadingIndicator(true);
    const contentToCapture = DOM.estatisticasBodyContent;
    const modalTitleText = DOM.estatisticasTitulo.textContent || "Estatisticas";
    const modalPeriodText = DOM.estatisticasClientePeriodo.textContent || "Periodo Desconhecido";
    aplicarOpcoesImpressao('estatisticas-body-content', true);
    const originalStylesToRestore = new Map();
    const elementsToHideForCapture = [
        DOM.estatisticasModal.querySelector('.modal-header'),
        DOM.estatisticasModal.querySelector('.modal-footer'),
        DOM.exportOptionsContainer
    ];
    elementsToHideForCapture.forEach(el => {
        if (el) {
            originalStylesToRestore.set(el, { display: el.style.display, visibility: el.style.visibility });
            el.style.display = 'none';
        }
    });
    const originalChartAnimation = Chart.defaults.animation;
    Chart.defaults.animation = false;
    Object.values(state.activeCharts).forEach(chartInstance => {
        if (chartInstance && chartInstance.canvas && chartInstance.canvas.offsetParent !== null) {
            chartInstance.update('none');
        }
    });
    await new Promise(resolve => setTimeout(resolve, 600));
    try {
        const canvas = await html2canvas(contentToCapture, {
            scale: 1.5,
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
                const clonedContent = clonedDoc.getElementById('estatisticas-body-content');
                if (clonedContent) {
                    clonedContent.style.height = 'auto';
                    clonedContent.style.overflowY = 'visible';
                    clonedContent.style.maxHeight = 'none';
                    const clonedSections = {
                        evalMetrics: clonedDoc.getElementById('estatisticas-graficos-container'),
                        workoutAnalysis: clonedDoc.getElementById('estatisticas-workout-analysis-container'),
                        planDetails: clonedDoc.getElementById('estatisticas-planos-detalhes')
                    };
                    Object.keys(clonedSections).forEach(key => {
                        const checkbox = document.getElementById(`printOpt${key.charAt(0).toUpperCase() + key.slice(1)}`);
                        const sectionEl = clonedSections[key];
                        if (sectionEl && checkbox && !checkbox.checked) {
                            sectionEl.style.display = 'none';
                        }
                    });
                }
            }
        });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF: JSPDFConstructor } = jspdf;
        const pdf = new JSPDFConstructor({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pdfWidth - 2 * margin;
        const imgOriginalWidth = canvas.width;
        const imgOriginalHeight = canvas.height;
        let yPos = margin;
        pdf.setFontSize(14);
        pdf.text(modalTitleText, pdfWidth / 2, yPos, { align: 'center' });
        yPos += 7;
        pdf.setFontSize(10);
        pdf.text(modalPeriodText, pdfWidth / 2, yPos, { align: 'center' });
        yPos += 10;
        let remainingCanvasHeight = imgOriginalHeight;
        let currentCanvasY = 0;
        const availablePageHeightInitial = pdfHeight - margin - yPos;
        while (remainingCanvasHeight > 0) {
            const currentPageAvailableHeight = (currentCanvasY === 0) ? availablePageHeightInitial : (pdfHeight - 2 * margin);
            const pdfImageSliceHeight = Math.min(currentPageAvailableHeight, remainingCanvasHeight * (contentWidth / imgOriginalWidth));
            const canvasSliceHeight = pdfImageSliceHeight * (imgOriginalWidth / contentWidth);
            if (currentCanvasY > 0) {
                pdf.addPage();
                yPos = margin;
            }
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = imgOriginalWidth;
            sliceCanvas.height = Math.min(canvasSliceHeight, remainingCanvasHeight);
            const sliceCtx = sliceCanvas.getContext('2d');
            if (sliceCtx) {
                sliceCtx.drawImage(canvas, 0, currentCanvasY, imgOriginalWidth, sliceCanvas.height, 0, 0, imgOriginalWidth, sliceCanvas.height);
                pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, yPos, contentWidth, pdfImageSliceHeight);
            }
            remainingCanvasHeight -= canvasSliceHeight;
            currentCanvasY += canvasSliceHeight;
        }
        pdf.save(`${modalTitleText.replace(/[^a-zA-Z0-9]/g, '_')}_Stats.pdf`);
    }
    catch (err) {
        console.error("Error generating PDF:", err);
        showCustomAlert("Erro ao gerar PDF. Tente 'Imprimir' e salvar como PDF.", true, 5000);
    }
    finally {
        Chart.defaults.animation = originalChartAnimation;
        elementsToHideForCapture.forEach(el => {
            if (el) {
                const original = originalStylesToRestore.get(el);
                if (original) {
                    el.style.display = original.display;
                }
            }
        });
        reverterOpcoesImpressao('estatisticas-body-content');
        showLoadingIndicator(false);
    }
}

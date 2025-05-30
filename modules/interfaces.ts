// modules/interfaces.ts

// --- Chart.js Interface Declarations ---
// These define the structure for Chart.js objects if you are strongly typing them.
// If using Chart.js globally via a <script> tag, you might use 'any' or rely on its own global types.
export interface ChartInstance { // Renamed to avoid conflict with Chart class if Chart is globally declared
    destroy: () => void;
    update: (mode?: string) => void;
    config: ChartConfiguration; // Use ChartConfiguration for the config object
    canvas: HTMLCanvasElement | null;
    data: ChartData;
    options: ChartOptions;
}

export interface ChartPoint {
    x: number | string | Date;
    y: number | string;
}

export interface ChartDataset {
    label?: string;
    data: number[] | ChartPoint[] | any[]; // any[] for flexibility if data structures vary
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    fill?: boolean | string;
    tension?: number;
    [key: string]: any; // For other dataset-specific properties
}

export interface ChartData {
    labels?: (string | Date)[];
    datasets: ChartDataset[];
}

export interface ChartPluginsOptions {
    legend?: any;
    title?: any;
    tooltip?: any;
    datalabels?: any; 
    [key: string]: any;
}

export interface ChartScaleTitleOptions {
    display?: boolean;
    text?: string;
    font?: any; // FontSpec from Chart.js, e.g. { family: string, size: number, style: string, weight: string, lineHeight: number | string }
    color?: any; // Color from Chart.js
    padding?: any; // number | { top?: number, bottom?: number, left?: number, right?: number }
}

export interface ChartScaleOptions {
    display?: boolean;
    title?: ChartScaleTitleOptions;
    type?: string; 
    time?: any;    
    ticks?: any;
    grid?: any;
    [key: string]: any; // For other scale-specific properties
    beginAtZero?: boolean;
}

export interface ChartScales {
    x?: ChartScaleOptions;
    y?: ChartScaleOptions;
    [key: string]: ChartScaleOptions; // For multiple x/y axes
}

export interface ChartOptions {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    plugins?: ChartPluginsOptions;
    scales?: ChartScales;
    interaction?: any; 
    [key: string]: any; // For other chart-specific options
    font?: any; // Chart.js v3 global font settings
}

export interface ChartConfiguration {
    type: string; // e.g., 'line', 'bar', 'doughnut'
    data: ChartData;
    options?: ChartOptions;
    plugins?: any[]; // For Chart.js plugins
}


// --- Application Interfaces ---
export interface Plan {
    planUuid: string;
    eventId: string;
    cliente: string;
    data: string; // Expected as dd/MM/yyyy for display, YYYY-MM-DD for DB/API
    hora: string; // Expected as HH:mm
    duracao: string;
    status: string; // 'Edit', 'Done'
    cor?: string;
    exercicios: Exercise[];
    mRef?: string;
    avaliacao?: AvaliacaoData | null;
    clienteContagem?: string; // Maps to 'sessao' in some contexts
    clienteMes?: string;      // Maps to 'mes' in some contexts
    contadorPlano?: number;   // Frontend-only identifier for DOM manipulation
}

export interface Exercise {
    id?: string; 
    type: 'exercise' | 'observation' | 'error' | 'warn';
    exerciseName?: string; 
    exercicio?: string; // Alias, can be consolidated with exerciseName
    grupoMuscular?: string;
    objetivo?: string;
    series?: number | string; 
    seriesData?: SeriesDataItem[];
    observacao?: string; 
    highlight?: 'neutral' | 'blue' | 'grey'; 
    msg?: string; 
    // Deprecated fields from original script - can be removed if fully migrated
    reps?: string;
    peso?: string;
    cadencia?: string;
    descanso?: string;
    obs?: string; 
}

export interface SeriesDataItem {
    id?: string; 
    repTempo?: string;
    repTempoUnit?: 'rep' | 'sec' | 'min';
    peso?: string;
    pesoUnit?: 'kg' | 'lbs' | 'body';
}

export interface AvaliacaoData {
    [key: string]: any; 
    peso?: number | string | null;
    altura?: number | string | null;
    massaMuscular?: number | string | null;
    massaGorda?: number | string | null;
    gorduraVisceral?: number | string | null;
    idadeBiologica?: number | string | null;
    metabolismoBasal?: number | string | null;
    massaOssea?: number | string | null;
    h2o?: number | string | null;
    pressaoArterial?: string | null;
    perimetroAbdominal?: number | string | null;
    observacoes?: string | null;
    error?: string; // If there's an error related to this data
}

export interface MasterExercises {
    [groupName: string]: string[];
}

export interface ClientStats {
    clienteNome: string | null;
    periodo: { inicio: string; fim: string; };
    planosDetalhes: Array<{ data: string; exercicios: Exercise[]; avaliacao: AvaliacaoData | null; }>;
    avaliacoesSeries: { [metric: string]: Array<{ date: string; value: number; }> };
    workoutAnalysis: {
        muscleGroupUsage: { [group: string]: number; };
        objectiveUsage: { [objective: string]: number; };
        exerciseWeightProgress: {
            [group: string]: { 
                [exerciseName: string]: { 
                    progressData: Array<{date: string; weight: number; unit: string;}>
                }
            }
        }
    };
    erro: string | null;
    mensagem: string | null;
}

// For general API responses
export interface ApiResponse {
    erro?: string;
    mensagem?: string;
    [key: string]: any; 
}

// Specific API response types
export interface PlanosApiResponse extends ApiResponse {
    planos: Plan[];
    masterExercises: MasterExercises;
}

export interface MetricasApiResponse extends ApiResponse {
    totalHoras: number;
    nivel: number;
    totalEventos: number;
    eventosConcluidos: number;
    detalhesNivel: any[]; // Define more strictly if possible
    dadosClientePorRef: any; // Define more strictly if possible
}

export interface SavePlanoApiResponse extends ApiResponse, Partial<Plan> { 
    sucesso: boolean;
    // Server should return the full updated plan object as part of the response
}

export interface SaveMasterExerciseApiResponse extends ApiResponse {
    success: boolean;
    message?: string; 
}

export interface ClientSuggestionsApiResponse extends ApiResponse {
    // Assuming API returns a simple array of strings for suggestions
    // If it's an object, adjust accordingly, e.g., { suggestions: string[] }
    // For now, assuming the direct array is the primary data if no 'erro'
}

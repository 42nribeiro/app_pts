import { showLoadingIndicator } from './uiUtils';
import { API_BASE_URL } from './config';
export async function fetchApi(endpoint, options = {}, callingFunctionName) {
    showLoadingIndicator(true);
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            let errorData = {
                message: `HTTP error ${response.status}`,
                erro: `HTTP error ${response.status}`,
                status: response.status
            };
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    errorData = await response.json();
                    if (!errorData.status)
                        errorData.status = response.status;
                }
                else {
                    errorData.message = response.statusText || errorData.message;
                    errorData.erro = response.statusText || errorData.erro;
                }
            }
            catch (e) {
                console.warn(`Could not parse error response for ${endpoint} as JSON. Status: ${response.status}`);
            }
            const errorMessage = errorData.mensagem || errorData.erro || errorData.message;
            console.error(`API Error (${callingFunctionName || endpoint}): Status ${response.status}`, errorMessage, errorData);
            const err = new Error(errorMessage);
            err.status = response.status;
            err.data = errorData;
            throw err;
        }
        if (response.status === 204) {
            return null;
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const responseData = await response.json();
            if (responseData && responseData.erro) {
                console.warn(`API Warning (${callingFunctionName || endpoint}): Successful response with error field:`, responseData.erro, responseData.mensagem);
                const err = new Error(responseData.mensagem || responseData.erro);
                err.status = 200;
                err.data = responseData;
                throw err;
            }
            return responseData;
        }
        else {
            console.warn(`API Warning (${callingFunctionName || endpoint}): Response was not JSON. Status: ${response.status}. Content-Type: ${contentType}`);
            return await response.text();
        }
    }
    catch (error) {
        console.error(`fetchApi error for ${callingFunctionName || endpoint}:`, error.message, error.data || error);
        throw error;
    }
    finally {
        showLoadingIndicator(false);
    }
}

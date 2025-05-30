
// modules/api.ts
import { showLoadingIndicator } from './uiUtils';
import { API_BASE_URL } from './config'; 

export async function fetchApi(endpoint: string, options: RequestInit = {}, callingFunctionName?: string): Promise<any> {
  showLoadingIndicator(true);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    if (!response.ok) {
      let errorData: any = { 
        message: `HTTP error ${response.status}`, 
        erro: `HTTP error ${response.status}`, 
        status: response.status 
      };
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            errorData = await response.json();
             // Ensure status is part of errorData if not already
            if (!errorData.status) errorData.status = response.status;
        } else {
             errorData.message = response.statusText || errorData.message; // Use statusText if not JSON
             errorData.erro = response.statusText || errorData.erro;
        }
      } catch (e) {
        // Parsing error, stick with initial errorData based on status
        console.warn(`Could not parse error response for ${endpoint} as JSON. Status: ${response.status}`);
      }
      
      const errorMessage = errorData.mensagem || errorData.erro || errorData.message;
      console.error(`API Error (${callingFunctionName || endpoint}): Status ${response.status}`, errorMessage, errorData);
      
      const err = new Error(errorMessage) as any; // Cast to any to add custom properties
      err.status = response.status;
      err.data = errorData; // Attach the full error data object
      throw err; 
    }

    if (response.status === 204) { 
      return null; 
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        const responseData = await response.json();
        // Backend might return 200 OK but with an error field (common in some API designs)
        if (responseData && responseData.erro) { 
            console.warn(`API Warning (${callingFunctionName || endpoint}): Successful response with error field:`, responseData.erro, responseData.mensagem);
            // Construct an error object similar to HTTP errors for consistent handling
            const err = new Error(responseData.mensagem || responseData.erro) as any;
            err.status = 200; // Or a custom status to indicate application-level error
            err.data = responseData;
            throw err;
        }
        return responseData;
    } else {
        console.warn(`API Warning (${callingFunctionName || endpoint}): Response was not JSON. Status: ${response.status}. Content-Type: ${contentType}`);
        // For non-JSON, return text or handle as an error if JSON was expected
        // throw new Error(`Unexpected response type: ${contentType}`);
        return await response.text(); // Or handle as appropriate for your app
    }

  } catch (error: any) { 
    // Log here, but let the calling function handle UI specific error display via its own catch.
    console.error(`fetchApi error for ${callingFunctionName || endpoint}:`, error.message, error.data || error);
    throw error; // Re-throw for the specific handler
  } finally {
    showLoadingIndicator(false); 
  }
}

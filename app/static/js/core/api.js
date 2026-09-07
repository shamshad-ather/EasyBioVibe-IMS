export async function apiCall(endpoint, payload = null, method = 'POST') {
    try {
        const options = {
            method: payload ? method : 'GET',
            headers: payload ? { 'Content-Type': 'application/json' } : {}
        };
        if (payload) options.body = JSON.stringify(payload);
        
        const res = await fetch(endpoint, options);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`API Error at ${endpoint}:`, err);
        return { status: 'error', message: 'Connection Error: Is the Python server running?' };
    }
}
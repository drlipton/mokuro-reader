import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return json({ error: 'URL parameter is required' }, { status: 400 });
    }

    const user = url.searchParams.get('user');
    const pass = url.searchParams.get('pass');

    const headers = new Headers();
    if (user && pass) {
        const credentials = btoa(`${user}:${pass}`);
        headers.set('Authorization', `Basic ${credentials}`);
    }

    try {
        const response = await fetch(targetUrl, { headers });

        if (!response.ok) {
            return new Response(`Failed to fetch target URL: ${response.statusText}`, {
                status: response.status
            });
        }

        // Create new headers to forward, preserving Content-Type and Content-Length
        const newHeaders = new Headers();
        if (response.headers.get('Content-Type')) {
            newHeaders.set('Content-Type', response.headers.get('Content-Type')!);
        }
        if (response.headers.get('Content-Length')) {
            newHeaders.set('Content-Length', response.headers.get('Content-Length')!);
        }

        // Return the response body directly for efficient streaming
        return new Response(response.body, {
            status: response.status,
            headers: newHeaders
        });
    } catch (err: any) {
        // Keep a generic error log for unexpected issues
        console.error('Proxy error:', err.message);
        return json({ error: 'Failed to fetch target URL', details: err.message }, { status: 500 });
    }
};
import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';

const app = new Hono();

app.get('/', serveStatic({ root: './index.html' }));

// Handles incoming chat requests from the frontend, serving up the chatbot's response.
app.post('/prompt', async (c) => {

});

// Quick test to make sure we are getting back documents we want from the similarity search.
app.get('/search', async (c) => {
	return Response.json({});
});

// Loads the poem data into the database so it can be used as context.
app.get('/load-em-up', async (c) => {
	return new Response(null, { status: 200 });
});

export default app;

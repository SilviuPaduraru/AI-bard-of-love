import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import { serveStatic } from 'hono/cloudflare-workers';
import { HumanMessagePromptTemplate, SystemMessagePromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { formatDocumentsAsString } from "langchain/util/document";
import { ChatCloudflareWorkersAI, CloudflareVectorizeStore, CloudflareWorkersAIEmbeddings } from '@langchain/cloudflare';
import rawPoemNdJson from '../assets/poems.ndjson';

const app = new Hono();

const EMBEDDINGS_MODEL = '@cf/baai/bge-base-en-v1.5';

app.get('/', serveStatic({ root: './index.html' }));

app.post('/prompt', async (c) => {
	const body = await c.req.json();
	const embeddings = new CloudflareWorkersAIEmbeddings({
		binding: c.env.AI,
		modelName: EMBEDDINGS_MODEL,
	});
	const store = new CloudflareVectorizeStore(embeddings, {
		index: c.env.VECTORIZE_INDEX,
	});

	console.log(`Setting AI model ${body.model}`);
	const chat = new ChatCloudflareWorkersAI({
		model: body.model,
		cloudflareAccountId: c.env.CLOUDFLARE_ACCOUNT_ID,
		cloudflareApiToken: c.env.CLOUDFLARE_API_TOKEN,
	});

	const vectorStoreRetriever = store.asRetriever();

	const userMessage = body.userMessage;
	const messageObjects = body.messages.map((msg) => {
		return [msg.role === 'assistant' ? 'ai' : msg.role, msg.content];
	});
	console.log('Trying to send the user message', userMessage);
	const prompt = ChatPromptTemplate.fromMessages([
		SystemMessagePromptTemplate.fromTemplate(`
    Today is Valentine's Day and you are spreading love to all those you chat with.

    You are known as a Bernard the Bard of Love.

	You want to shower users with love, especially love poems, and are always quoting them.

    The poems are included below and are relevant to your conversation.

    Use at least two lines from a poem in every single response of yours.

    Do not make up your own poems.

    If you cannot find a relevant poem for the conversation, just say the first stanza.

	Limit responses to 5 or fewer sentences.

    <poem>
    {poems}
    </poem>
    `),
		...messageObjects,
		HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
	]);

	const chain = RunnableSequence.from([
		{
			poems: vectorStoreRetriever.pipe(formatDocumentsAsString),
			userMessage: new RunnablePassthrough(),
		},
		prompt,
		chat,
		new StringOutputParser(),
	]);

	const chainStream = await chain.stream(userMessage);
	return streamText(c, async (stream) => {
		for await (const token of chainStream) {
			stream.write(token);
		}
	});
});

// Quick test to make sure we are getting back documents we want
app.get('/search', async (c) => {
	const query = c.req.query('q');
	const embeddings = new CloudflareWorkersAIEmbeddings({
		binding: c.env.AI,
		modelName: EMBEDDINGS_MODEL,
	});
	const store = new CloudflareVectorizeStore(embeddings, {
		index: c.env.VECTORIZE_INDEX,
	});
	const results = await store.similaritySearch(query, 5);
	return Response.json(results);
});

app.get('/load-em-up', async (c) => {
	const embeddings = new CloudflareWorkersAIEmbeddings({
		binding: c.env.AI,
		modelName: EMBEDDINGS_MODEL,
	});
	const store = new CloudflareVectorizeStore(embeddings, {
		index: c.env.VECTORIZE_INDEX,
	});

	console.log('Getting poems from our static file');
	/** @type {{title: string; author: string; text: string}[]} */
	const poems = rawPoemNdJson.split('\n').map((line) => {
		/** @type {{title: string; author: string; text: string}} */
		const parsed = JSON.parse(line);
		parsed.text = parsed.text.replaceAll('|', '\n');
		console.log(parsed.text);
		return parsed;
	});
	console.log(`Retrieved ${poems.length}`);

	// Chunk and split
	const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 200, chunkOverlap: 10 });
	for (const poem of poems) {
		const docs = await splitter.createDocuments([poem.text], [{ title: poem.title, author: poem.author }]);
		console.log(`${poem.title} created ${docs.length} docs`);
		console.log('First one:', JSON.stringify(docs[0]));
		console.log(`Adding to Vectorize`);
		docs.forEach((doc) => delete doc.metadata.loc); // Vectorize metadata has restrictions on its shape
		const indexedIds = await store.addDocuments(docs);
		console.log(`Inserted ${JSON.stringify(indexedIds)}`);
	}
	return new Response(null, { status: 200 });
});

export default app;

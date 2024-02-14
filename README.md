# The Love Bard

Sometimes we could all use a little extra love, especially with Valentine's Day around the corner!

This is an exploration using [Workers AI](https://developers.cloudflare.com/workers-ai/) w/ [Hono](https://hono.dev/getting-started/cloudflare-workers) and [LangChain](https://js.langchain.com/docs/integrations/vectorstores/cloudflare_vectorize) [abstractions](https://js.langchain.com/docs/integrations/chat/cloudflare_workersai) to build a love poem reading bard that you can chat with.

We seed poems from a static file in our app, (though conceivably you could also use [R2](https://developers.cloudflare.com/r2/)), which is then used to create [embeddings](https://js.langchain.com/docs/integrations/text_embedding/cloudflare_ai) and store them in Cloudflare's vector database [Vectorize](https://js.langchain.com/docs/integrations/text_embedding/cloudflare_ai).

This, like all of us, is a work in progress.

## Installation

```bash
npm install
```

Set up your secrets

```bash
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

Create your Vector database

```bash
npx wrangler vectorize create spaduraru-poems --preset "@cf/baai/bge-base-en-v1.5"
```

## Deploy

```bash
npm run deploy
```

Tail the logs

```bash
npx wrangler tail
```

## TODO

- [ ] Explore D1 History
- [ ] Create character profiles based on songs, allow chatting with different types
- [ ] Use a tool to get the Spotify link for the song
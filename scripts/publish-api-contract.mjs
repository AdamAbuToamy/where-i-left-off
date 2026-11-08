import { copyFileSync } from 'node:fs';
// Publish the authoritative contract with each Hosting build, before SW generation.
copyFileSync(new URL('../docs/openapi-public-api.json', import.meta.url), new URL('../dist/openapi-public-api.json', import.meta.url));

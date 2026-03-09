// Plain JS entry point for Hostinger — loads tsx as ESM hook then runs server.ts
import { register } from 'tsx/esm/api';
register();
await import('./server.ts');

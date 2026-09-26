import { createVercelHandler } from '../backend/src/vercel';

/**
 * Vercel function for `/rpc` (mounted there via vercel.json rewrite).
 * Path-agnostic: rebasePath forces the `/rpc` Express mount regardless of
 * the URL the platform delivers (see backend/src/vercel.ts).
 */
export default createVercelHandler('/rpc');

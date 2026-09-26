import { createVercelHandler } from '../backend/src/vercel';

/** Vercel function for `/api/config` — runtime contract addresses (R4). */
export default createVercelHandler('/api/config');

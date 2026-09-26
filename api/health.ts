import { createVercelHandler } from '../backend/src/vercel';

/** Vercel function for `/api/health` — chain reachability probe. */
export default createVercelHandler('/api/health');

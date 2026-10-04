/**
 * Server-side Repository Registry
 * Directly re-exports SQLite database repositories and contracts
 * to ensure 100% compatibility across server services and controllers.
 */

export * from '../../data/contracts/index.js';
export * from '../../data/sqlite/repositories.js';

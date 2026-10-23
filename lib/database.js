const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { createClient } = require('@libsql/client');

function normalizeValue(value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function createDatabase() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (Boolean(databaseUrl) !== Boolean(authToken)) {
    throw new Error('TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN을 함께 설정해야 합니다.');
  }

  const localPath = process.env.DB_PATH || path.join(__dirname, '..', 'DB', 'scorex.sqlite');
  const url = databaseUrl || `file:${localPath}`;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  const transactionContext = new AsyncLocalStorage();
  const remoteUrl = databaseUrl ? new URL(databaseUrl) : null;

  async function execute(sql, args = []) {
    const connection = transactionContext.getStore() || client;
    return connection.execute({ sql, args });
  }

  return {
    kind: databaseUrl ? 'turso' : 'sqlite',
    target: remoteUrl ? `${remoteUrl.protocol}//${remoteUrl.host}${remoteUrl.pathname}` : localPath,
    prepare(sql) {
      return {
        async get(...args) {
          const result = await execute(sql, args);
          const row = result.rows[0];
          return row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])) : undefined;
        },
        async all(...args) {
          const result = await execute(sql, args);
          return result.rows.map((row) => Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])
          ));
        },
        async run(...args) {
          const result = await execute(sql, args);
          return {
            changes: Number(result.rowsAffected),
            lastInsertRowid: normalizeValue(result.lastInsertRowid)
          };
        }
      };
    },
    async exec(sql) {
      await client.executeMultiple(sql);
    },
    async batch(statements) {
      return client.batch(statements, 'write');
    },
    async transaction(work) {
      const transaction = await client.transaction('write');
      return transactionContext.run(transaction, async () => {
        try {
          const result = await work();
          await transaction.commit();
          return result;
        } catch (error) {
          try {
            await transaction.rollback();
          } catch (rollbackError) {
            throw new AggregateError([error, rollbackError], 'Database transaction and rollback both failed.');
          }
          throw error;
        }
      });
    },
    async close() {
      await client.close();
    }
  };
}

module.exports = { createDatabase };

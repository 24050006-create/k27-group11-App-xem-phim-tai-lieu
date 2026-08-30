const db = require('./config/db');

async function checkSchema() {
  try {
    console.log('=== DATABASE SCHEMA ===\n');

    const tables = ['users', 'episodes', 'watch_history', 'comments', 'movies', 'genres', 'movie_genres'];

    for (const table of tables) {
      try {
        const [columns] = await db.query(`DESCRIBE ${table}`);
        console.log(`\n✅ TABLE: ${table}`);
        console.log('Columns:');
        columns.forEach(col => {
          console.log(`  - ${col.Field} (${col.Type})`);
        });
      } catch (error) {
        console.log(`\n❌ TABLE: ${table} - Error: ${error.message}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSchema();

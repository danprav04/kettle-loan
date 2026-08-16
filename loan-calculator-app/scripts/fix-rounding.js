const { Pool } = require('pg');

async function fixRounding() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('POSTGRES_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log('Fetching entries with payer_shares or beneficiary_shares...');
    
    // We only need to check entries that actually have the JSON arrays
    const res = await client.query(`
      SELECT id, payer_shares, beneficiary_shares 
      FROM entries 
      WHERE payer_shares IS NOT NULL 
         OR beneficiary_shares IS NOT NULL
    `);
    
    let updatedCount = 0;

    // Helper to round percentages to 2 decimal places
    const roundShares = (shares) => {
      if (!Array.isArray(shares)) return shares;
      let modified = false;
      const rounded = shares.map(share => {
        if (typeof share.percentage === 'number') {
          // Round to 2 decimal places
          const roundedPercentage = Math.round(share.percentage * 100) / 100;
          if (roundedPercentage !== share.percentage) {
            modified = true;
          }
          return { ...share, percentage: roundedPercentage };
        }
        return share;
      });
      return { rounded, modified };
    };

    await client.query('BEGIN');

    for (const row of res.rows) {
      const payerResult = roundShares(row.payer_shares);
      const beneficiaryResult = roundShares(row.beneficiary_shares);

      if (payerResult.modified || beneficiaryResult.modified) {
        console.log(`Entry ${row.id} needs updating:`);
        if (payerResult.modified) {
          console.log(`  Payer shares: ${JSON.stringify(row.payer_shares)} -> ${JSON.stringify(payerResult.rounded)}`);
        }
        if (beneficiaryResult.modified) {
          console.log(`  Beneficiary shares: ${JSON.stringify(row.beneficiary_shares)} -> ${JSON.stringify(beneficiaryResult.rounded)}`);
        }

        await client.query(`
          UPDATE entries 
          SET payer_shares = $1, beneficiary_shares = $2 
          WHERE id = $3
        `, [
          payerResult.rounded ? JSON.stringify(payerResult.rounded) : null,
          beneficiaryResult.rounded ? JSON.stringify(beneficiaryResult.rounded) : null,
          row.id
        ]);

        updatedCount++;
      }
    }

    // Uncomment this to actually commit the transaction. 
    // We're doing a dry-run first to be safe.
    // await client.query('COMMIT');
    // console.log(`Committed updates for ${updatedCount} entries.`);
    
    // DRY RUN MODE:
    await client.query('ROLLBACK');
    console.log(`[DRY RUN] Rolled back updates. Would have updated ${updatedCount} entries.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during update:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fixRounding().catch(console.error);

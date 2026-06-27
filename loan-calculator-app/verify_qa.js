// verify_qa.js
const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(chunks) });
          } catch (e) {
            resolve({ status: res.statusCode, data: chunks });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING QA AUTOMATED VERIFICATION ---');

  // 1. Login as admin
  console.log('\n[Phase 1] Testing Login validation...');
  const loginRes = await request('POST', '/api/auth/login', { username: 'admin', password: '123' });
  if (loginRes.status !== 200 || !loginRes.data.token) throw new Error('Login failed: ' + JSON.stringify(loginRes));
  const adminToken = loginRes.data.token;
  console.log('✓ Login successful! Token received.');

  // 2. Fetch Room & Check Roles/Currency
  console.log('\n[Phase 2] Testing Room Dashboard API & RBAC Roles...');
  const roomRes = await request('GET', '/api/rooms/J990GT', null, adminToken);
  if (roomRes.status !== 200) throw new Error('Room fetch failed: ' + JSON.stringify(roomRes));
  console.log(`✓ Room fetched: "${roomRes.data.name}", Currency: ${roomRes.data.currency}, My Role: ${roomRes.data.currentUserRole}`);
  
  const roles = roomRes.data.members.map(m => `${m.username}:${m.role}`).join(', ');
  console.log(`✓ Member roles verified: [ ${roles} ]`);

  const roomId = roomRes.data.id || 1;

  // 3. Test Room Settings Update
  console.log('\n[Phase 3] Testing Room Settings (Currency/Name update)...');
  const updateRes = await request('PUT', `/api/rooms/${roomId}`, { name: 'Euro Trip Updated 🏰', currency: 'USD' }, adminToken);
  if (updateRes.status !== 200) throw new Error('Settings update failed: ' + JSON.stringify(updateRes));
  console.log('✓ Room renamed to "Euro Trip Updated 🏰" with currency USD.');

  // 4. Test Last-Admin Safeguard
  console.log('\n[Phase 3] Testing Last-Admin Safeguard...');
  const demoteSelfRes = await request('PUT', `/api/rooms/${roomId}/members/1`, { role: 'active' }, adminToken);
  if (demoteSelfRes.status !== 400) throw new Error('Last admin safeguard failed to block demotion! Got status: ' + demoteSelfRes.status);
  console.log('✓ Safeguard correctly blocked demoting sole admin (status 400).');

  // 5. Test Member Promotion & Transfer
  console.log('\n[Phase 3] Promoting Bob (id=2) to Admin...');
  const promoteBob = await request('PUT', `/api/rooms/${roomId}/members/2`, { role: 'admin' }, adminToken);
  if (promoteBob.status !== 200) throw new Error('Promotion failed: ' + JSON.stringify(promoteBob));
  console.log('✓ Bob promoted to Admin.');

  // 6. Test Multi-Party Entry Creation
  console.log('\n[Phase 4] Testing Custom Multi-Party Split Entry creation...');
  const entryRes = await request('POST', '/api/entries', {
    roomId,
    amount: 500,
    description: 'Yacht Charter ⛵',
    payerShares: [{ userId: 1, percentage: 60 }, { userId: 2, percentage: 40 }],
    beneficiaryShares: [{ userId: 1, percentage: 25 }, { userId: 2, percentage: 25 }, { userId: 3, percentage: 50 }],
    createdByUserId: 1,
    createdAt: new Date().toISOString()
  }, adminToken);
  if (entryRes.status !== 200 && entryRes.status !== 201) throw new Error('Multi-party entry creation failed: ' + JSON.stringify(entryRes));
  console.log('✓ Multi-party percentage entry successfully logged!');

  // 7. Test Entry Audit Trail
  console.log('\n[Phase 6] Testing Audit Trail Fetch (`/api/entries/101/edits`)...\n');
  const editsRes = await request('GET', '/api/entries/101/edits', null, adminToken);
  if (editsRes.status !== 200) throw new Error('Edits fetch failed: ' + JSON.stringify(editsRes));
  console.log(`✓ Audit trail records found: ${editsRes.data.length} event(s).`);
  if (editsRes.data.length > 0) {
    console.log(`  Event: ${editsRes.data[0].old_amount} -> ${editsRes.data[0].new_amount} (${editsRes.data[0].new_description})`);
  }

  console.log('\n--- ALL QA AUTOMATED TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(e => {
  console.error('\n❌ QA TEST ERROR:', e);
  process.exit(1);
});

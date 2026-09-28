const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('c:/Presenza/serviceAccountKey.json');

const app = admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

const NEW_PASSWORD = '12341234';

async function updateOrCreateUser(email, displayName, id) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password: NEW_PASSWORD,
      displayName: displayName || existing.displayName || id
    });
    return { status: 'UPDATED', uid: existing.uid };
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email: email,
        password: NEW_PASSWORD,
        displayName: displayName || id
      });
      return { status: 'CREATED', uid: created.uid };
    }
    throw err;
  }
}

async function main() {
  console.log('='.repeat(65));
  console.log(`[*] Bulk Resetting All Student & Faculty Passwords to: ${NEW_PASSWORD}`);
  console.log('='.repeat(65));

  let facultyCount = 0;
  let studentCount = 0;
  let authUpdatedCount = 0;
  let authCreatedCount = 0;
  let errorCount = 0;

  // 1. Process Faculties
  console.log('\n[1/3] Processing Faculty Members...');
  const facultySnap = await db.collection('colleges/faculties/all_faculties').get();
  console.log(`Found ${facultySnap.size} faculty documents in Firestore.`);

  for (const doc of facultySnap.docs) {
    const data = doc.data();
    const id = doc.id.trim().toUpperCase();
    const name = data.name || id;
    const authEmail = `${id.toLowerCase()}@presenza.app`;

    try {
      const res = await updateOrCreateUser(authEmail, name, id);
      if (res.status === 'UPDATED') authUpdatedCount++;
      if (res.status === 'CREATED') authCreatedCount++;
      facultyCount++;

      // Also check if faculty has an institutional email
      if (data.email && data.email.includes('@') && data.email.toLowerCase() !== authEmail) {
        try {
          const instUser = await auth.getUserByEmail(data.email.trim());
          if (!instUser.customClaims?.admin) {
            await auth.updateUser(instUser.uid, { password: NEW_PASSWORD });
          }
        } catch (e) {
          // It's ok if institutional email is not in Firebase Auth
        }
      }

      // If document has password field, update it
      if (data.password !== undefined) {
        await doc.ref.update({ password: NEW_PASSWORD });
      }
    } catch (err) {
      console.error(`  ❌ Error processing faculty ${id}:`, err.message);
      errorCount++;
    }
  }
  console.log(`✅ Processed ${facultyCount} faculties.`);

  // 2. Process Students
  console.log('\n[2/3] Processing Students...');
  const studentSnap = await db.collection('colleges/students/all_students').get();
  console.log(`Found ${studentSnap.size} student documents in Firestore.`);

  for (const doc of studentSnap.docs) {
    const data = doc.data();
    const id = doc.id.trim().toUpperCase();
    const name = data.name || id;
    const authEmail = `${id.toLowerCase()}@presenza.app`;

    try {
      const res = await updateOrCreateUser(authEmail, name, id);
      if (res.status === 'UPDATED') authUpdatedCount++;
      if (res.status === 'CREATED') authCreatedCount++;
      studentCount++;

      // If student document has password field, update it
      if (data.password !== undefined) {
        await doc.ref.update({ password: NEW_PASSWORD });
      }
    } catch (err) {
      console.error(`  ❌ Error processing student ${id}:`, err.message);
      errorCount++;
    }
  }
  console.log(`✅ Processed ${studentCount} students.`);

  // 3. Update any remaining non-admin Auth users
  console.log('\n[3/3] Checking all remaining Firebase Auth users...');
  let pageToken = undefined;
  let remainingCount = 0;

  do {
    const listResult = await auth.listUsers(1000, pageToken);
    for (const u of listResult.users) {
      // Strictly SKIP admin
      if (u.customClaims?.admin || u.email === 'admin@presenza.app') {
        console.log(`  🛡️ Preserving Admin Account: ${u.email} (UID: ${u.uid})`);
        continue;
      }

      try {
        await auth.updateUser(u.uid, { password: NEW_PASSWORD });
        remainingCount++;
      } catch (err) {
        console.error(`  ❌ Error updating Auth user ${u.email || u.uid}:`, err.message);
      }
    }
    pageToken = listResult.pageToken;
  } while (pageToken);

  console.log('\n' + '='.repeat(65));
  console.log('🎉 PASSWORD RESET COMPLETED SUCCESSFULLY!');
  console.log(` - Total Faculty Processed:       ${facultyCount}`);
  console.log(` - Total Students Processed:      ${studentCount}`);
  console.log(` - Firebase Auth Passwords Set:   ${remainingCount}`);
  console.log(` - Errors Encountered:            ${errorCount}`);
  console.log(` - New Password for All:          ${NEW_PASSWORD}`);
  console.log('='.repeat(65));

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during password reset:', err);
  process.exit(1);
});

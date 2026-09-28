const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const serviceAccount = require('c:/Presenza/serviceAccountKey.json');

const app = admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

const targetIdentifier = process.argv[2];

async function main() {
  if (!targetIdentifier || targetIdentifier === '--list') {
    console.log("[*] Fetching users from Firebase Auth...");
    const res = await auth.listUsers(100);
    console.log(`\nFound ${res.users.length} users:`);
    for (const u of res.users) {
      console.log(` - UID: ${u.uid} | Email: ${u.email} | Claims: ${JSON.stringify(u.customClaims || {})}`);
    }
    return;
  }

  let userRecord;
  try {
    if (targetIdentifier.includes('@')) {
      userRecord = await auth.getUserByEmail(targetIdentifier);
    } else {
      userRecord = await auth.getUser(targetIdentifier);
    }
  } catch (err) {
    console.error(`❌ User not found in Firebase Auth: ${targetIdentifier}`, err.message);
    process.exit(1);
  }

  console.log(`[+] Found user: ${userRecord.email || userRecord.uid} (UID: ${userRecord.uid})`);

  // Assign admin custom claims
  await auth.setCustomUserClaims(userRecord.uid, {
    admin: true,
    role: 'admin'
  });

  console.log(`✅ Successfully set admin: true custom claims on UID: ${userRecord.uid}`);
  console.log("The user can now access the Presenza-Admin dashboard!");

  // Clean up plaintext passwords
  const shouldClean = process.argv.includes('--clean-passwords');
  if (shouldClean) {
    console.log("\n[+] Scanning Firestore for legacy plaintext passwords to remove...");
    let count = 0;
    const facSnap = await db.collection("colleges/faculties/all_faculties").get();
    for (const doc of facSnap.docs) {
      if (doc.data().password) {
        await doc.ref.update({ password: FieldValue.delete() });
        count++;
      }
    }
    
    const stuSnap = await db.collection("colleges/students/all_students").get();
    for (const doc of stuSnap.docs) {
      if (doc.data().password) {
        await doc.ref.update({ password: FieldValue.delete() });
        count++;
      }
    }
    console.log(`✅ Removed plaintext passwords from ${count} documents.`);
  }
}

main().catch(err => {
  console.error("Error executing script:", err);
  process.exit(1);
});

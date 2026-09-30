const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const serviceAccount = require('c:/Presenza/serviceAccountKey.json');

const app = admin.getApps().length > 0 ? admin.getApp() : admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const db = getFirestore(app);

const EVENT_ID = 'evt_1790743302740';

async function generateApprovedODRequests() {
  const eventDoc = await db.collection('colleges').doc('events').collection('all_events').doc(EVENT_ID).get();
  if (!eventDoc.exists) {
    console.error('Event not found!');
    process.exit(1);
  }

  const evData = eventDoc.data();
  const studentIds = evData.assignedStudents || [];
  console.log(`Creating approved OD requests for ${studentIds.length} students...`);

  const odCol = db.collection('colleges').doc('od_requests').collection('all_requests');

  // Check existing OD requests for this event
  const existingSnap = await odCol.where('eventId', '==', EVENT_ID).get();
  const existingStudents = new Set();
  existingSnap.forEach(d => existingStudents.add(d.data().studentId));

  const batch = db.batch();
  let count = 0;

  for (const sId of studentIds) {
    if (existingStudents.has(sId)) continue;

    const stuDoc = await db.collection('colleges').doc('students').collection('all_students').doc(sId).get();
    const stu = stuDoc.exists ? stuDoc.data() : {};

    const odId = `od_${EVENT_ID}_${sId}`;
    const docRef = odCol.doc(odId);

    batch.set(docRef, {
      id: odId,
      eventId: EVENT_ID,
      eventName: evData.name,
      studentId: sId,
      studentName: stu.name || sId,
      department: stu.department || '',
      class: stu.class || '',
      mentorId: stu.mentor_id || 'SECT10CJ01',
      leaveType: 'Event',
      reason: 'Skill Development Club - GitHub Training',
      fromDate: evData.startDate,
      toDate: evData.endDate,
      durationType: evData.durationType || 'multiple_days',
      periods: evData.selectedPeriods || [1, 7],
      status: 'approved',
      mentorApproved: true,
      hodApproved: true,
      timestamp: Timestamp.now()
    });

    count++;
  }

  if (count > 0) {
    await batch.commit();
    console.log(`✅ Successfully committed ${count} approved OD requests!`);
  } else {
    console.log('All approved OD requests already exist.');
  }

  process.exit(0);
}

generateApprovedODRequests().catch(err => {
  console.error(err);
  process.exit(1);
});

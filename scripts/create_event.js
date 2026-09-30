const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const serviceAccount = require('c:/Presenza/serviceAccountKey.json');

const app = admin.getApps().length > 0 ? admin.getApp() : admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const db = getFirestore(app);

const rawInput = `
1 HEMAPRIYA L SEC25CS018 CSE II - Year D
2 NISMITA SRI M S SEC25CS410 CSE II - Year D
3 POOJA SRI B SEC25CS340 CSE II - Year D
4 SHARANYA SHREE R SEC24CS016 CSE III - Year D
5 John Bickin R SEC24CS032 CSE III - Year A
6 CYRIL DHANRAJ C SEC24EC078 ECE III - Year B
7 TAMILSELVAN U SEC24EC124 ECE III - Year B
8 DEEPAK J SEC25EC316 ECE II - Year G
9 SONA P SEC25EC506 ECE II - Year F
10 YUVASRI S SEC25EC145 ECE II - Year B
11 D.Pavatharanee SEC24EC157 ECE III -year D
12 S.Kanishka SEC24EC168 ECE III - Year D
13 Harish S SEC24EC092 ECE III - Year A
14 Surya Prakash V M SEC24EC246 ECE III - Year A
15 MATHIYANBU R P SEC24EC197 ECE III - Year C
16 V GOPALASUBRAMANIAN SEC24EC002 ECE III - Year C
17 KEERTIVASAN R SEC25EE029 EEE II - Year A
18 PRAGADEESHWARAN S SEC25EE032 EEE II- Year A
19 AAKASH V SEC25EE182 EEE II- Year B
20 ANANDHAKANNAN SEC24EE093 EEE III - Year A
21 NANDAKISHOR V SEC24EE095 EEE III - Year A
22 NARESHKRISHNA B SEC25CJ039 ME-ICSE II - Year A
23 SWETHA P S SEC25CJ062 ME-ICSE II - Year A
24 JEEVASHREE S SEC24CJ016 ME-ICSE III - Year A
25 LATHIKA S SEC24CJ031 ME-ICSE III - Year A
26 RAKSHITHA G SEC24CJ026 ME-ICSE III - Year A
27 RATHIKA P SEC25AD040 AI-DS II - Year E
28 RIFANA SHAFRIN M SEC25AD052 AI-DS II - Year B
29 KAVIN GOWTHAM G SEC25AD208 AI-DS II - Year B
30 SANJAY SREE M SEC24AD179 AI-DS III - Year B
31 KRISHIKA R SEC24AD083 AI-DS III - Year C
32 NESAPRIYAN M SEC25ME101 MECH II - Year A
33 MADHAV R SEC25ME046 MECH II - Year B
34 GNANA SHREE S SEC25ME105 MECH II - Year B
35 RUTHRA V SEC24ME033 MECH III - Year B
36 NANDA KUMAR N SEC24ME097 MECH III - Year A
37 ROSHINI J SEC24AM054 AIML III - Year A
38 MONICKA J SEC24AM100 AIML III - Year B
39 DIVYA E SEC25AM094 AIML II - Year A
40 DHANASEKARAN R SEC25AM090 AIML II - Year C
41 VAITHEESHWARI C SEC25AM158 AIML II - Year B
42 PRAVEEN A SEC25CI123 IOT II - Year B
43 NITHYA B SEC25CI015 IOT II - Year B
44 DHANALAKSHMI G SEC25CI009 IOT II - Year A
45 DHARANIVENDHAN S SEC24CI018 IOT III - Year A
46 HEMAVATHY S SEC24CI025 IOT III - Year A
47 ARI PRASATH E SEC25CE020 CIVIL II - Year A
48 KRISHNA KAMAL A K SEC25CE004 CIVIL II - Year A
49 SACHIN R SEC25CE027 CIVIL II - Year A
50 MOHAN H SEC24CE031 CIVIL III - Year A
51 MUTHU GNANA MOORTHI K SEC24CE004 CIVIL III - Year A
52 RAJASREE S SEC25CE023 CIVIL II - Year A
53 AKSHAYA M SEC25CE026 CIVIL II - Year A
54 YUGANRAJA R M SEC24CE027 CIVIL III - Year A
55 MADHUMITHA G SEC25SC089 SC II - Year A
56 HARIHARAN M SEC25SC011 SC II - Year B
57 MUGILAN M SEC25SC176 SC II - Year C
58 RAKSHIYA J SEC24SC053 SC III - Year A
59 SENTHUR VELAN V SEC24SC026 SC III - Year A
60 SAHANA R SEC25IT396 IT II - Year A
61 CHATRIYAN S SEC25IT323 IT II - Year C
62 TAMIL PRIYAN G SEC25IT494 IT II - Year H
63 RAJESH K SEC24IT111 IT III - Year C
64 DHARSHINI B SEC24IT133 IT III - Year A
65 ASWATH LINGAM D SEC24IC003 ICE III - Year A
66 NIRMAL PRASAD S SEC24IC028 ICE III - Year A
67 NIHAARIKA R D SEC24IC023 ICE II-Year
68 SWETHA M SEC24IC022 ICE II-Year
69 GOKULAKRISHNAN R SEC24IC031 ICE II-Year
70 SUPRIYA S K SEC24EI006 EIE III - Year B
71 ROSHAN G SEC24EI032 EIE III - Year B
72 SRI DEVADHARSHIHA N V SEC24CB106 CSBS III - Year A
73 THARSHANA S SEC24CB065 CSBS III - Year A
74 MANOJKUMAR R SEC24CB056 CSBS III - Year B
75 POOJA S SEC25CB004 CSBS II-Year A
76 AAKASH P SEC25CB052 CSBS II-Year A
77 JAYSON A SEC24MU005 MAE III - Year A
78 RUPIKA S SEC24MU027 MAE III - Year A
79 NAVEEN V SEC25MZ029 MZ II - Year A
80 ANJANA J SEC25MZ058 MZ II - Year A
81 RAKSHITHA K SEC25MZ045 MZ II - Year A
82 SANJAI R K SEC25CO032 CCE II - Year A
83 DHARSHINI S SEC25CO039 CCE II - Year A
84 J RAHUL SIT24AD005 AI-DS III - Year A
85 MAHENDRAN G SIT24AD112 AI-DS III - Year B
86 PAZHANIVELRAJAN S SIT24AM047 AIML III - Year A
87 AARTHI D SIT24AM006 AIML III - Year A
88 JEEVA S SIT24CO015 CCE III - Year A
89 LOKESHWARAN S SIT24CO045 CCE III - Year A
90 THENKUZHALI B SIT24CS055 CSE III - Year A
91 HARINI R SIT24CS215 CSE III - Year B
92 PARVITHA E SIT24EC040 ECE III - Year A
93 AADESH M SIT24EC076 ECE III - Year B
94 SAMRAJ J SIT24EE038 EEE III - Year A
95 PRITHIKA DEVI S SIT24EE055 EEE III - Year A
96 MUGESH E SIT24CI013 IOT III - Year A
97 SARVESH KUMAR R SIT24CI001 IOT III - Year A
98 SUSHMITHA V SIT24IT127 IT III - Year B
99 SRINIKESH A SIT24IT073 IT III - Year C
100 SANJAI S SIT24SC024 SC III - Year A
101 KAVEARASSU K SIT24ME002 MECH III - Year A
102 HARI PRASATH P SIT24ME031 MECH III - Year A
103 KISHORE VINAYAGAM SIT24ME021 MECH III - Year A
`;

function getStudentIds() {
  const lines = rawInput.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const ids = [];
  for (const line of lines) {
    const idMatch = line.match(/\b((?:SEC|SIT)\d{2}[A-Za-z0-9]{2,4}\d{2,3})\b/i);
    if (idMatch) {
      ids.push(idMatch[1].toUpperCase());
    }
  }
  return ids;
}

async function createEvent() {
  const assignedStudentIds = getStudentIds();
  console.log(`Found ${assignedStudentIds.length} student IDs.`);

  const eventId = `evt_${Date.now()}`;
  const eventRef = db.collection('colleges').doc('events').collection('all_events').doc(eventId);

  const eventPayload = {
    id: eventId,
    name: "GitHub Training",
    description: "Skill Development Club - GitHub Training on 30-09-2026 & 01-10-2026",
    startDate: "2026-09-30",
    endDate: "2026-10-01",
    assignedFacultyIds: ["SECT10CJ01"], // Dr.M.Nithya
    assignedStudents: assignedStudentIds,
    timeSlots: [],
    durationType: "multiple_days",
    selectedPeriods: [1, 2, 3, 4, 5, 6, 7],
    eventType: "event",
    createdAt: Timestamp.now()
  };

  await eventRef.set(eventPayload);
  console.log(`✅ Event successfully created with ID: ${eventId}`);
  console.log(`Title: ${eventPayload.name}`);
  console.log(`Dates: ${eventPayload.startDate} to ${eventPayload.endDate}`);
  console.log(`Assigned Faculty: Dr.M.Nithya (SECT10CJ01)`);
  console.log(`Assigned Students: ${assignedStudentIds.length}`);

  const check = await eventRef.get();
  console.log('Confirmed in DB:', check.exists, check.data().name);
}

createEvent().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

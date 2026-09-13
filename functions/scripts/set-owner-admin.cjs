const admin = require("firebase-admin");
const [projectId, email] = process.argv.slice(2);
if (!projectId || !email) throw new Error("Usage: node scripts/set-owner-admin.cjs PROJECT EMAIL");
admin.initializeApp({ projectId });
admin.auth().getUserByEmail(email).then(async user => {
  await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), ownerAdmin: true });
  console.log(`Owner review access enabled for ${email}. Sign out and back in to refresh access.`);
}).catch(error => { console.error(error); process.exitCode = 1; });

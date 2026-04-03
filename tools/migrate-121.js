const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function migrateTerritorio121() {
  const basePath = "congregaciones/sur/territorios";

  const doc121Ref = db.doc(`${basePath}/121`);
  const doc121Snap = await doc121Ref.get();

  if (!doc121Snap.exists) {
    console.log("No existe el territorio 121");
    return;
  }

  const data = doc121Snap.data();

  if (!data.poligonos || data.poligonos.length < 2) {
    console.log("El territorio 121 no tiene 2 polígonos");
    return;
  }

  const baseData = {
    tipo: data.tipo || "normal",
    punto: data.punto || null,
    ciudad: data.ciudad || null,
    notas: data.notas || null,
    territorioBase: "121"
  };

  // crear 121A
  await db.doc(`${basePath}/121A`).set({
    id: "121A",
    nombre: "Territorio 121A",
    grupoId: "2",
    poligonos: [data.poligonos[0]],
    ...baseData
  });

  // crear 121B
  await db.doc(`${basePath}/121B`).set({
    id: "121B",
    nombre: "Territorio 121B",
    grupoId: "3",
    poligonos: [data.poligonos[1]],
    ...baseData
  });

  // copiar historial si existe
  const historialSnap = await doc121Ref.collection("historial").get();

  for (const doc of historialSnap.docs) {
    const histData = doc.data();

    // copiar a ambos (después podés borrar los que no correspondan)
    await db.doc(`${basePath}/121A/historial/${doc.id}`).set(histData);
    await db.doc(`${basePath}/121B/historial/${doc.id}`).set(histData);
  }

  // borrar original
  await doc121Ref.delete();

  console.log("Migración completada");
}

migrateTerritorio121().then(() => process.exit());